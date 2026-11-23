const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const notifyPath = require.resolve('../utils/notifyHelpers');
const emails = [];
const logs = [];
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const dueDate = [
  tomorrow.getFullYear(),
  String(tomorrow.getMonth() + 1).padStart(2, '0'),
  String(tomorrow.getDate()).padStart(2, '0'),
].join('-');

const fakeDb = {
  query(sql, params, callback) {
    let rows = [];
    if (sql.includes('FROM tasks') && sql.includes('DATE_ADD(CURDATE(), INTERVAL 3 DAY)')) {
      rows = [{
        id: 41,
        title: 'Monthly Report',
        type: 'Monthly Report',
        due_date: dueDate,
        days_left: 1,
        created_at: '2026-01-01 00:00:00',
        target_year_levels: '["Grade 10","College 1"]',
      }];
    } else if (sql.includes("FROM users WHERE role = 'scholar'")) {
      rows = [
        { scholar_id: 'AS-101', full_name: 'Pending Grade 10', email: 'pending10@example.com', year_level: 'grade_10' },
        { scholar_id: 'AS-102', full_name: 'Submitted College Scholar', email: 'submitted@example.com', year_level: '1st Year College' },
        { scholar_id: 'AS-103', full_name: 'Pending College Scholar', email: 'pendingcollege@example.com', year_level: 'college_1' },
        { scholar_id: 'AS-104', full_name: 'Other Year Scholar', email: 'other@example.com', year_level: 'Grade 8' },
      ];
    } else if (sql.includes('SELECT DISTINCT scholar_id FROM submissions')) {
      rows = [{ scholar_id: 'AS-102' }];
    } else if (sql.includes('SELECT id FROM notification_logs')) {
      const [scholarId, detail] = params;
      rows = logs.some(log => log.scholar_id === scholarId && log.type === 'deadline_reminder' && log.detail === detail && log.status === 'sent')
        ? [{ id: 1 }]
        : [];
    } else if (sql.includes('INSERT INTO notification_logs')) {
      const [scholar_id, recipient, channel, type, status, detail] = params;
      logs.push({ scholar_id, recipient, channel, type, status, detail });
    } else {
      throw new Error(`Unexpected SQL: ${sql}`);
    }
    queueMicrotask(() => callback(null, rows));
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'nodemailer' && parent.filename === notifyPath) {
    return {
      createTransport: () => ({
        sendMail: async message => {
          emails.push(message);
          return { messageId: `deadline-test-${emails.length}` };
        },
      }),
    };
  }
  if (request === '../config/db' && parent.filename === notifyPath) return fakeDb;
  return originalLoad.call(this, request, parent, isMain);
};

process.env.SMTP_HOST = 'smtp.example.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'sender@example.com';
process.env.SMTP_PASS = 'test-password';

const { sendTaskDeadlineReminders } = require('../utils/notifyHelpers');
Module._load = originalLoad;

test('one-day task reminder emails only targeted scholars who have not submitted', async () => {
  const firstRun = await sendTaskDeadlineReminders();

  assert.equal(firstRun.sent_count, 2);
  assert.deepEqual(
    emails.map(email => email.to).sort(),
    ['pending10@example.com', 'pendingcollege@example.com']
  );
  assert.ok(emails.every(email => email.text.includes('due tomorrow')));
  assert.ok(emails.every(email => email.html.includes('Deadline Tomorrow')));
  assert.equal(logs.length, 2);
  assert.ok(logs.every(log => log.type === 'deadline_reminder' && log.detail.includes('stage:due-tomorrow')));

  const duplicateRun = await sendTaskDeadlineReminders();
  assert.equal(duplicateRun.sent_count, 0);
  assert.equal(emails.length, 2);
});
