const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const nodemailerPath = require.resolve('nodemailer');
let announcement = {
  id: 5,
  title: 'Program update',
  content: 'Please review the latest update.',
  target_roles: JSON.stringify(['scholar', 'staff', 'officer']),
  target_levels: JSON.stringify(['grade_7']),
  created_by: 99,
  created_by_role: 'admin',
};
let recipients = [];
let adminAuthor = {
  id: 99,
  full_name: 'Announcing Admin',
  email: 'admin@example.com',
  role: 'admin',
  preferences: JSON.stringify({ emailNotifications: true }),
};
let sendError = null;
let recipientQuery;
const sentMessages = [];
const notificationLogs = [];
let delaySends = false;
let activeSends = 0;
let maxConcurrentSends = 0;

const fakeDb = {
  query(sql, values, callback) {
    if (sql.includes('FROM announcements WHERE id = ?')) {
      callback(null, [announcement]);
    } else if (sql.includes('FROM users u LEFT JOIN admin_preferences') && sql.includes('WHERE u.id = ?')) {
      callback(null, adminAuthor ? [adminAuthor] : []);
    } else if (sql.includes('FROM users u LEFT JOIN admin_preferences')) {
      recipientQuery = { sql, values };
      callback(null, recipients);
    } else if (sql.includes('INSERT INTO notification_logs')) {
      notificationLogs.push(values);
      callback(null, { affectedRows: 1 });
    } else {
      callback(new Error(`Unexpected query: ${sql}`));
    }
  },
};

const installMock = (resolvedPath, exports) => {
  const mockModule = new Module(resolvedPath, module);
  mockModule.filename = resolvedPath;
  mockModule.loaded = true;
  mockModule.exports = exports;
  require.cache[resolvedPath] = mockModule;
};

installMock(dbPath, fakeDb);
installMock(nodemailerPath, {
  createTransport() {
    return {
      async sendMail(message) {
        activeSends += 1;
        maxConcurrentSends = Math.max(maxConcurrentSends, activeSends);
        try {
          if (sendError) throw sendError;
          if (delaySends) await new Promise(resolve => setTimeout(resolve, 10));
          sentMessages.push(message);
          return { messageId: `announcement-${sentMessages.length}` };
        } finally {
          activeSends -= 1;
        }
      },
    };
  },
});

process.env.SMTP_HOST = 'smtp.example.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'sender@example.com';
process.env.SMTP_PASS = 'test-password';

const { sendAnnouncementNotifyEmails } = require('../utils/notifyHelpers');

delete require.cache[dbPath];
delete require.cache[nodemailerPath];

const sendAnnouncement = (id = 5) => new Promise((resolve, reject) => {
  sendAnnouncementNotifyEmails(id, (error, result) => error ? reject(error) : resolve(result));
});

test('announcement notify includes every selected role and canonical year-level matches', async () => {
  announcement = {
    ...announcement,
    target_roles: JSON.stringify(['scholar', 'staff', 'officer']),
    target_levels: JSON.stringify(['grade_7']),
  };
  recipients = [
    { scholar_id: 'S-7', full_name: 'Grade Seven Scholar', email: 'scholar@example.com', role: 'scholar', year_level: 'Grade 7' },
    { full_name: 'Staff Recipient', email: 'staff@example.com', role: 'staff' },
    { full_name: 'Officer Recipient', email: 'officer@example.com', role: 'officer' },
  ];
  sendError = null;
  recipientQuery = null;
  sentMessages.length = 0;
  notificationLogs.length = 0;

  const result = await sendAnnouncement();

  assert.equal(result.ok, true);
  assert.equal(result.recipient_count, 4);
  assert.equal(result.sent_count, 4);
  assert.equal(result.failed_count, 0);
  assert.equal(result.admin_author_included, true);
  assert.equal(result.admin_author_sent, true);
  assert.deepEqual(
    sentMessages.map(message => message.to).sort(),
    ['admin@example.com', 'officer@example.com', 'scholar@example.com', 'staff@example.com']
  );
  assert.match(recipientQuery.sql, /LOWER\(TRIM\(COALESCE\(u\.role, ''\)\)\) IN \(\?, \?, \?\)/);
  assert.match(recipientQuery.sql, /u\.email IS NOT NULL AND TRIM\(u\.email\) <> ''/);
  assert.match(recipientQuery.sql, /LOWER\(REPLACE\(REPLACE\(TRIM\(COALESCE\(u\.year_level, ''\)\)/);
  assert.deepEqual(recipientQuery.values, ['scholar', 'staff', 'officer', 'grade 7']);
  assert.equal(notificationLogs.length, 4);
});

test('announcement notify reports no eligible email recipients as an error', async () => {
  recipients = [];
  adminAuthor = null;
  announcement = { ...announcement, created_by: null };
  sentMessages.length = 0;

  const result = await sendAnnouncement();

  assert.equal(result.ok, false);
  assert.equal(result.recipient_count, 0);
  assert.equal(result.sent_count, 0);
  assert.match(result.error, /no active recipients with email addresses/i);
  assert.equal(sentMessages.length, 0);
});

test('each explicit announcement notify click sends to the target audience', async () => {
  recipients = [{ email: 'scholar@example.com', role: 'scholar' }];
  adminAuthor = {
    id: 99,
    full_name: 'Announcing Admin',
    email: 'admin@example.com',
    role: 'admin',
    preferences: JSON.stringify({ emailNotifications: true }),
  };
  announcement = { ...announcement, created_by: 99, created_by_role: 'admin' };
  sendError = null;
  sentMessages.length = 0;
  notificationLogs.length = 0;

  const firstResult = await sendAnnouncement();
  const secondResult = await sendAnnouncement();

  assert.equal(firstResult.sent_count, 2);
  assert.equal(secondResult.sent_count, 2);
  assert.equal(sentMessages.length, 4);
  assert.equal(notificationLogs.length, 4);
});

test('announcement author is not duplicated when already in the selected audience', async () => {
  announcement = {
    ...announcement,
    target_roles: JSON.stringify(['admin', 'scholar']),
    created_by: 99,
  };
  adminAuthor = {
    id: 99,
    full_name: 'Announcing Admin',
    email: 'admin@example.com',
    role: 'admin',
    preferences: JSON.stringify({ emailNotifications: true }),
  };
  recipients = [
    adminAuthor,
    { scholar_id: 'S-7', full_name: 'Scholar', email: 'scholar@example.com', role: 'scholar' },
  ];
  sendError = null;
  sentMessages.length = 0;
  notificationLogs.length = 0;

  const result = await sendAnnouncement();

  assert.equal(result.recipient_count, 2);
  assert.equal(result.sent_count, 2);
  assert.equal(result.admin_author_sent, true);
  assert.equal(sentMessages.filter(message => message.to === 'admin@example.com').length, 1);
});

test('bulk announcement email sends use the shared five-recipient concurrency limit', async () => {
  announcement = {
    ...announcement,
    target_roles: JSON.stringify(['scholar']),
    target_levels: JSON.stringify([]),
    created_by: null,
    created_by_role: null,
  };
  adminAuthor = null;
  recipients = Array.from({ length: 8 }, (_, index) => ({
    scholar_id: `S-${index + 1}`,
    full_name: `Scholar ${index + 1}`,
    email: `scholar-${index + 1}@example.com`,
    role: 'scholar',
  }));
  sendError = null;
  delaySends = true;
  activeSends = 0;
  maxConcurrentSends = 0;
  sentMessages.length = 0;
  notificationLogs.length = 0;

  const result = await sendAnnouncement();

  delaySends = false;
  assert.equal(result.sent_count, 8);
  assert.equal(maxConcurrentSends, 5);
  assert.equal(notificationLogs.length, 8);
});

test('announcement notify returns SMTP failures instead of counting them as sent', async () => {
  recipients = [{ scholar_id: 'S-7', email: 'scholar@example.com', role: 'scholar' }];
  adminAuthor = {
    id: 99,
    full_name: 'Announcing Admin',
    email: 'admin@example.com',
    role: 'admin',
    preferences: JSON.stringify({ emailNotifications: true }),
  };
  announcement = { ...announcement, created_by: 99, created_by_role: 'admin' };
  sendError = new Error('SMTP rejected the message');
  notificationLogs.length = 0;

  const result = await sendAnnouncement();

  assert.equal(result.ok, false);
  assert.equal(result.recipient_count, 2);
  assert.equal(result.sent_count, 0);
  assert.equal(result.failed_count, 2);
  assert.equal(result.admin_author_included, true);
  assert.equal(result.admin_author_sent, false);
  assert.match(result.failures[0].error, /SMTP rejected/);
  assert.ok(notificationLogs.some(([scholarId, recipient, channel, type, status]) =>
    scholarId === 'S-7'
    && recipient === 'scholar@example.com'
    && channel === 'email'
    && type === 'announcement_notification'
    && status === 'failed'
  ));
  assert.ok(notificationLogs.some(([, recipient, channel, type, status]) =>
    recipient === 'admin@example.com'
    && channel === 'email'
    && type === 'announcement_notification'
    && status === 'failed'
  ));
});
