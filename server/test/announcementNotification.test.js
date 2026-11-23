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
  created_by_role: 'admin',
};
let recipients = [];
let recentSentCount = 0;
let sendError = null;
let recipientQuery;
const sentMessages = [];
const notificationLogs = [];

const fakeDb = {
  query(sql, values, callback) {
    if (sql.includes('FROM announcements WHERE id = ?')) {
      callback(null, [announcement]);
    } else if (sql.includes('SELECT COUNT(*) AS sent_count')) {
      callback(null, [{ sent_count: recentSentCount }]);
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
        if (sendError) throw sendError;
        sentMessages.push(message);
        return { messageId: `announcement-${sentMessages.length}` };
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
  recentSentCount = 0;
  sendError = null;
  recipientQuery = null;
  sentMessages.length = 0;
  notificationLogs.length = 0;

  const result = await sendAnnouncement();

  assert.equal(result.ok, true);
  assert.equal(result.recipient_count, 3);
  assert.equal(result.sent_count, 3);
  assert.equal(result.failed_count, 0);
  assert.deepEqual(
    sentMessages.map(message => message.to).sort(),
    ['officer@example.com', 'scholar@example.com', 'staff@example.com']
  );
  assert.match(recipientQuery.sql, /LOWER\(TRIM\(COALESCE\(u\.role, ''\)\)\) IN \(\?, \?, \?\)/);
  assert.match(recipientQuery.sql, /u\.email IS NOT NULL AND TRIM\(u\.email\) <> ''/);
  assert.match(recipientQuery.sql, /LOWER\(REPLACE\(REPLACE\(TRIM\(COALESCE\(u\.year_level, ''\)\)/);
  assert.deepEqual(recipientQuery.values, ['scholar', 'staff', 'officer', 'grade 7']);
  assert.equal(notificationLogs.length, 3);
});

test('announcement notify reports no eligible email recipients as an error', async () => {
  recipients = [];
  recentSentCount = 0;
  sentMessages.length = 0;

  const result = await sendAnnouncement();

  assert.equal(result.ok, false);
  assert.equal(result.recipient_count, 0);
  assert.equal(result.sent_count, 0);
  assert.match(result.error, /no active recipients with email addresses/i);
  assert.equal(sentMessages.length, 0);
});

test('announcement notify reports when it was already sent recently', async () => {
  recipients = [{ email: 'scholar@example.com', role: 'scholar' }];
  recentSentCount = 1;
  sentMessages.length = 0;

  const result = await sendAnnouncement();

  assert.equal(result.already_sent, true);
  assert.match(result.message, /already emailed within the last 24 hours/i);
  assert.equal(sentMessages.length, 0);
});

test('announcement notify returns SMTP failures instead of counting them as sent', async () => {
  recipients = [{ scholar_id: 'S-7', email: 'scholar@example.com', role: 'scholar' }];
  recentSentCount = 0;
  sendError = new Error('SMTP rejected the message');
  notificationLogs.length = 0;

  const result = await sendAnnouncement();

  assert.equal(result.ok, false);
  assert.equal(result.recipient_count, 1);
  assert.equal(result.sent_count, 0);
  assert.equal(result.failed_count, 1);
  assert.match(result.failures[0].error, /SMTP rejected/);
  assert.ok(notificationLogs.some(([scholarId, recipient, channel, type, status]) =>
    scholarId === 'S-7'
    && recipient === 'scholar@example.com'
    && channel === 'email'
    && type === 'announcement_notification'
    && status === 'failed'
  ));
});
