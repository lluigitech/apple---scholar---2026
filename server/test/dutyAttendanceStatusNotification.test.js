const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const notifyPath = require.resolve('../utils/notifyHelpers');
const sentEmails = [];
const notificationLogs = [];

const fakeDb = {
  query(sql, params, callback) {
    let rows = [];
    if (sql.includes('FROM duties WHERE id = ?')) {
      rows = [{
        id: 7,
        title: 'Campus Cleanup',
        duty_date: '2026-11-24',
        time_start: '09:00:00',
        time_end: '11:00:00',
        location: 'Campus',
      }];
    } else if (sql.includes('LEFT JOIN duty_attendance da')) {
      rows = [
        { scholar_id: 'AS-101', full_name: 'Makeup Scholar', email: 'makeup@example.com', is_makeup: 1 },
        { scholar_id: 'AS-102', full_name: 'Absent Scholar', email: 'absent@example.com', is_makeup: 0 },
      ];
    } else if (sql.includes('INSERT INTO notification_logs')) {
      const [scholar_id, recipient, channel, type, status, detail] = params;
      notificationLogs.push({ scholar_id, recipient, channel, type, status, detail });
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
          sentEmails.push(message);
          return { messageId: `attendance-test-${sentEmails.length}` };
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

const { sendDutyAttendanceStatusEmails } = require('../utils/notifyHelpers');
Module._load = originalLoad;

const sendAttendanceEmails = records => new Promise((resolve, reject) => {
  sendDutyAttendanceStatusEmails(7, records, (error, result) => {
    if (error) return reject(error);
    resolve(result);
  });
});

test('present and absent attendance emails go to the scholars, including makeup duty context', async () => {
  const result = await sendAttendanceEmails([
    { scholar_id: 'AS-101', status: 'present' },
    { scholar_id: 'AS-102', status: 'absent' },
    { scholar_id: 'AS-103', status: 'late' },
  ]);

  assert.equal(result.ok, true);
  assert.equal(result.sent_count, 2);
  assert.deepEqual(
    sentEmails.map(email => email.to).sort(),
    ['absent@example.com', 'makeup@example.com']
  );
  const makeupEmail = sentEmails.find(email => email.to === 'makeup@example.com');
  const absentEmail = sentEmails.find(email => email.to === 'absent@example.com');
  assert.match(makeupEmail.subject, /present/i);
  assert.match(makeupEmail.text, /makeup duty/i);
  assert.match(makeupEmail.html, /Makeup duty/);
  assert.match(absentEmail.subject, /absent/i);
  assert.match(absentEmail.text, /recorded as absent/i);
  assert.equal(notificationLogs.length, 2);
  assert.ok(notificationLogs.every(log => log.type === 'duty_attendance_status' && log.status === 'sent'));
});
