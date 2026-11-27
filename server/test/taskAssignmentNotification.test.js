const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const nodemailerPath = require.resolve('nodemailer');
const sentMessages = [];
const notificationLogs = [];
let activeSends = 0;
let maxConcurrentSends = 0;

const fakeDb = {
  query(sql, _values, callback) {
    if (sql.includes('FROM duties WHERE id = ?')) {
      return callback(null, [{
        id: 17,
        title: 'Campus Cleanup',
        description: 'Join the cleanup activity.',
        location: 'Campus',
        duty_date: '2026-11-30',
        time_start: '09:00:00',
        time_end: '11:00:00',
      }]);
    }
    if (sql.includes('FROM duty_group_assignments dga')) {
      return callback(null, Array.from({ length: 7 }, (_, index) => ({
        scholar_id: `D-${index + 1}`,
        full_name: `Duty Scholar ${index + 1}`,
        email: `duty-${index + 1}@example.com`,
        role: 'scholar',
      })));
    }
    if (sql.includes('FROM tasks') && sql.includes('target_year_levels')) {
      return callback(null, [{
        id: 42,
        title: 'Monthly Report',
        type: 'Monthly Report',
        due_date: '2026-11-30',
        instructions: 'Upload the signed report.',
        target_year_levels: JSON.stringify(['Grade 10', 'College 1']),
      }]);
    }
    if (sql.includes("role = 'scholar'")) {
      return callback(null, [
        { scholar_id: 'S-10', full_name: 'Grade Ten Scholar', email: 'grade10@example.com', year_level: 'grade_10' },
        { scholar_id: 'S-11', full_name: 'Grade Ten Scholar 2', email: 'grade10-2@example.com', year_level: 'grade_10' },
        { scholar_id: 'S-12', full_name: 'Grade Ten Scholar 3', email: 'grade10-3@example.com', year_level: 'grade_10' },
        { scholar_id: 'S-13', full_name: 'Grade Ten Scholar 4', email: 'grade10-4@example.com', year_level: 'grade_10' },
        { scholar_id: 'S-C1', full_name: 'College Scholar', email: 'college@example.com', year_level: '1st Year College' },
        { scholar_id: 'S-8', full_name: 'Other Scholar', email: 'grade8@example.com', year_level: 'Grade 8' },
      ]);
    }
    if (sql.includes('officer_year_level_assignments')) {
      return callback(null, [
        { id: 7, full_name: 'Grade Ten Officer', email: 'officer10@example.com', year_level: 'Grade 10' },
        { id: 7, full_name: 'Grade Ten Officer', email: 'officer10@example.com', year_level: 'College 1' },
        { id: 8, full_name: 'College Officer', email: 'officercollege@example.com', year_level: 'college_1' },
        { id: 9, full_name: 'Other Officer', email: 'officer8@example.com', year_level: 'Grade 8' },
      ]);
    }
    if (sql.includes('INSERT INTO notification_logs')) {
      notificationLogs.push(_values);
      return callback(null, { affectedRows: 1 });
    }
    return callback(new Error(`Unexpected query: ${sql}`));
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
        sentMessages.push(message);
        await new Promise((resolve) => setTimeout(resolve, 10));
        activeSends -= 1;
        return { messageId: `message-${sentMessages.length}` };
      },
    };
  },
});

process.env.SMTP_HOST = 'smtp.example.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'sender@example.com';
process.env.SMTP_PASS = 'test-password';

const { sendTaskAssignmentEmails, sendDutyNotifyEmails } = require('../utils/notifyHelpers');

delete require.cache[dbPath];
delete require.cache[nodemailerPath];

const sendTaskNotice = (taskId) => new Promise((resolve, reject) => {
  sendTaskAssignmentEmails(taskId, (error, result) => error ? reject(error) : resolve(result));
});

const sendDutyNotice = (dutyId) => new Promise((resolve, reject) => {
  sendDutyNotifyEmails(dutyId, (error, result) => error ? reject(error) : resolve(result));
});

test('manual task notifications email targeted scholars and their assigned officers only', async () => {
  sentMessages.length = 0;
  notificationLogs.length = 0;
  activeSends = 0;
  maxConcurrentSends = 0;

  const result = await sendTaskNotice(42);

  assert.equal(result.ok, true);
  assert.equal(result.sent_count, 7);
  assert.equal(result.failed_count, 0);
  assert.equal(maxConcurrentSends, 5);
  assert.deepEqual(
    sentMessages.map((message) => message.to).sort(),
    [
      'college@example.com',
      'grade10@example.com',
      'grade10-2@example.com',
      'grade10-3@example.com',
      'grade10-4@example.com',
      'officer10@example.com',
      'officercollege@example.com',
    ].sort()
  );
  assert.equal(notificationLogs.length, 7);
  assert.ok(sentMessages.every((message) => message.subject.includes('Monthly Report')));
});

test('duty notification emails use the shared five-recipient concurrency limit', async () => {
  sentMessages.length = 0;
  notificationLogs.length = 0;
  activeSends = 0;
  maxConcurrentSends = 0;

  const result = await sendDutyNotice(17);

  assert.equal(result.sent_count, 7);
  assert.equal(result.failed_count, 0);
  assert.equal(maxConcurrentSends, 5);
  assert.equal(notificationLogs.length, 7);
});
