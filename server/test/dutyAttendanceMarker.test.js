const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const queryCalls = [];
const attendanceNotifications = [];
const fakeDb = {
  query(sql, values, callback) {
    queryCalls.push({ sql, values });
    if (sql.includes('SELECT d.status')) {
      callback(null, [{ status: 'ongoing', checkin_locked: 0, is_late: 0 }]);
    } else if (sql.includes('SELECT status FROM duties')) {
      callback(null, [{ status: 'ongoing' }]);
    } else if (sql.includes('FROM duty_attendance WHERE duty_id')) {
      callback(null, []);
    } else if (sql.includes('FROM duty_makeup_permissions')) {
      callback(null, []);
    } else if (sql.includes('INSERT INTO duty_attendance')) {
      callback(null, { affectedRows: 1 });
    } else {
      throw new Error(`Unexpected query: ${sql}`);
    }
  },
};

const dbModule = new Module(dbPath, module);
dbModule.filename = dbPath;
dbModule.loaded = true;
dbModule.exports = fakeDb;
require.cache[dbPath] = dbModule;

const mockedDependencies = [
  ['../utils/notifyHelpers', {
    sendDutyAttendanceStatusEmails(dutyId, records, callback) {
      attendanceNotifications.push({ dutyId, records });
      callback(null, { ok: true, sent_count: records.length, failed_count: 0 });
    },
  }],
  ['../utils/complianceLogger', {}],
  ['../services/dutyAbsenceService', {}],
  ['../services/dutyAttendanceService', {}],
];
const injectedModules = mockedDependencies.map(([request, exports]) => {
  const resolvedPath = require.resolve(request);
  const mockedModule = new Module(resolvedPath, module);
  mockedModule.filename = resolvedPath;
  mockedModule.loaded = true;
  mockedModule.exports = exports;
  require.cache[resolvedPath] = mockedModule;
  return resolvedPath;
});

const dutyController = require('../controllers/dutyController');
delete require.cache[dbPath];
injectedModules.forEach(path => delete require.cache[path]);

test('bulk staff attendance stores the authenticated marker id', async () => {
  queryCalls.length = 0;
  attendanceNotifications.length = 0;
  const response = await new Promise(resolve => {
    dutyController.bulkMarkAttendance({
      params: { duty_id: '5' },
      body: { records: [
        { scholar_id: 'SCH-1', status: 'present', method: 'manual' },
        { scholar_id: 'SCH-2', status: 'absent', method: 'manual' },
      ] },
      user: { id: 42, role: 'staff' },
    }, {
      status(statusCode) {
        return { json: body => resolve({ statusCode, body }) };
      },
      json(body) {
        resolve({ statusCode: 200, body });
      },
    });
  });

  const insertCall = queryCalls.find(call => call.sql.includes('INSERT INTO duty_attendance'));
  assert.equal(response.statusCode, 201);
  assert.match(insertCall.sql, /marked_by_id/);
  assert.deepEqual(insertCall.values, [
    '5', 'SCH-1', 'present', 'manual', 0, 42,
    '5', 'SCH-2', 'absent', 'manual', 0, 42,
  ]);
  assert.deepEqual(attendanceNotifications, [{
    dutyId: '5',
    records: [
      { scholar_id: 'SCH-1', status: 'present', method: 'manual' },
      { scholar_id: 'SCH-2', status: 'absent', method: 'manual' },
    ],
  }]);
  assert.equal(response.body.notification.sent_count, 2);
});

test('QR attendance emails the scholar when present is recorded', async () => {
  queryCalls.length = 0;
  attendanceNotifications.length = 0;
  const response = await new Promise(resolve => {
    dutyController.markAttendance({
      params: { id: '5' },
      body: { scholar_id: 'SCH-1', status: 'present', method: 'qr' },
      user: { id: 42, role: 'scholar' },
    }, {
      json(body) {
        resolve({ statusCode: 200, body });
      },
      status(statusCode) {
        return { json: body => resolve({ statusCode, body }) };
      },
    });
  });

  assert.equal(response.statusCode, 200);
  assert.equal(attendanceNotifications.length, 1);
  assert.deepEqual(attendanceNotifications[0], {
    dutyId: '5',
    records: [{ scholar_id: 'SCH-1', status: 'present' }],
  });
  assert.equal(response.body.notification.sent_count, 1);
});
