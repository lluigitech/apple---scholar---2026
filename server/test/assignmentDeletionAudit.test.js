const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const fakeDb = { query: null };
const auditEvents = [];

const installMock = (modulePath, exports) => {
  const resolvedPath = require.resolve(modulePath);
  const mockModule = new Module(resolvedPath, module);
  mockModule.filename = resolvedPath;
  mockModule.loaded = true;
  mockModule.exports = exports;
  require.cache[resolvedPath] = mockModule;
};

const dbPath = require.resolve('../config/db');
const auditLoggerPath = require.resolve('../utils/auditLogger');
installMock(dbPath, fakeDb);
installMock(auditLoggerPath, {
  logAuditEvent: async (event) => {
    auditEvents.push(event);
  },
});
installMock(require.resolve('../utils/officerAssignments'), {
  getAssignedYearLevels: async () => [],
  getAllAssignedYearLevels: async () => [],
});
installMock(require.resolve('../services/taskComplianceTemplate'), {
  buildTaskComplianceHTML: () => '',
});
installMock(require.resolve('../services/reportPdfService'), {
  generateReportPdf: () => {},
});
installMock(require.resolve('../utils/notifyHelpers'), {
  sendDutyNotifyEmails: () => {},
  sendMakeupDutyAssignmentEmails: () => {},
});
installMock(require.resolve('../utils/complianceLogger'), {
  logComplianceIncident: () => {},
  clampCompliance: () => {},
  getComplianceSettings: () => {},
  calculateCurrentCompliance: () => {},
});
installMock(require.resolve('../services/dutyAbsenceService'), {
  markEndedDutyAbsences: () => {},
});
installMock(require.resolve('../services/dutyAttendanceService'), {
  checkOutDutyAttendance: () => {},
});

const taskController = require('../controllers/taskController');
const dutyController = require('../controllers/dutyController');

delete require.cache[dbPath];
delete require.cache[auditLoggerPath];

const actorRequest = (params) => ({
  params,
  user: { id: 21, role: 'admin' },
});

const invoke = (handler, req) => new Promise((resolve) => {
  let statusCode = 200;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      resolve({ statusCode, body });
    },
  };
  handler(req, res);
});

test('task removal records the acting admin in the audit event', async () => {
  auditEvents.length = 0;
  fakeDb.query = (_sql, _values, callback) => callback(null, { affectedRows: 1 });

  const response = await invoke(taskController.deleteTask, actorRequest({ id: '14' }));

  assert.equal(response.statusCode, 200);
  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].req.user.id, 21);
  assert.equal(auditEvents[0].action, 'delete');
  assert.equal(auditEvents[0].module, 'Task Assignment');
  assert.match(auditEvents[0].details, /14/);
});

test('duty group unassignment records the acting admin in the audit event', async () => {
  auditEvents.length = 0;
  fakeDb.query = (_sql, _values, callback) => callback(null, { affectedRows: 1 });

  const response = await invoke(
    dutyController.unassignDutyFromGroup,
    actorRequest({ duty_id: '8', group_id: '5' })
  );

  assert.equal(response.statusCode, 200);
  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].req.user.id, 21);
  assert.equal(auditEvents[0].module, 'Duty Assignment');
  assert.match(auditEvents[0].details, /group 5 from duty 8/);
});

test('duty deletion records the acting admin in the audit event', async () => {
  auditEvents.length = 0;
  fakeDb.query = (_sql, _values, callback) => callback(null, { affectedRows: 1 });

  const response = await invoke(dutyController.deleteDuty, actorRequest({ id: '8' }));

  assert.equal(response.statusCode, 200);
  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].req.user.id, 21);
  assert.equal(auditEvents[0].module, 'Duty Assignment');
  assert.match(auditEvents[0].details, /Deleted duty 8/);
});

test('duty unassignment does not create an audit event when no assignment was removed', async () => {
  auditEvents.length = 0;
  fakeDb.query = (_sql, _values, callback) => callback(null, { affectedRows: 0 });

  await invoke(
    dutyController.unassignDutyFromGroup,
    actorRequest({ duty_id: '8', group_id: '5' })
  );

  assert.equal(auditEvents.length, 0);
});
