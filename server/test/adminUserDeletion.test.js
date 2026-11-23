const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
let targetUser;
let activeAdmins;
let queryCalls = [];
let committed = false;
let rolledBack = false;

const connection = {
  async beginTransaction() {},
  async commit() {
    committed = true;
  },
  async rollback() {
    rolledBack = true;
  },
  release() {},
  async query(sql, values = []) {
    queryCalls.push({ sql, values });
    if (sql.includes('SELECT id, scholar_id, full_name, email, role FROM users WHERE id = ?')) {
      return [targetUser ? [targetUser] : [], []];
    }
    if (sql.includes("WHERE role = 'admin' AND COALESCE(status, '') <> 'archived'")) {
      return [activeAdmins, []];
    }
    if (sql === 'DELETE FROM users WHERE id = ?') return [{ affectedRows: 1 }, []];
    return [{ affectedRows: 1 }, []];
  },
};

const fakeDb = {
  promise() {
    return { getConnection: async () => connection };
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
installMock(require.resolve('../utils/notifyHelpers'), {});
installMock(require.resolve('../utils/auditLogger'), { logAuditEvent: async () => {} });
installMock(require.resolve('../utils/officerAssignments'), {
  getAssignedYearLevels: async () => [],
  normalizeYearLevel: value => value,
  yearLevelSqlExpression: value => value,
});
installMock(require.resolve('../utils/complianceLogger'), {
  logComplianceIncident: async () => {},
  clampCompliance: value => value,
  getComplianceSettings: async () => ({}),
  calculateCurrentCompliance: () => {},
  calculateComplianceScore: () => 0,
  getOverdueComplianceTaskCounts: async () => ({}),
  getComplianceRiskThresholds: () => ({}),
  getComplianceRiskTier: () => '',
  resolveGradeScale: () => '',
});
installMock(require.resolve('qrcode'), {});

const adminController = require('../controllers/adminController');

delete require.cache[dbPath];
delete require.cache[require.resolve('../utils/notifyHelpers')];
delete require.cache[require.resolve('../utils/auditLogger')];
delete require.cache[require.resolve('../utils/officerAssignments')];
delete require.cache[require.resolve('../utils/complianceLogger')];
delete require.cache[require.resolve('qrcode')];

const invokeDelete = (userId = 9) => new Promise((resolve, reject) => {
  const res = {
    status(statusCode) {
      return { json: body => resolve({ statusCode, body }) };
    },
    json(body) {
      resolve({ statusCode: 200, body });
    },
  };
  Promise.resolve(adminController.deleteUser({
    params: { id: String(targetUser?.id || userId) },
    user: { id: 5, role: 'admin' },
  }, res)).catch(reject);
});

test('permanently deletes a non-scholar account and detaches shared records transactionally', async () => {
  targetUser = {
    id: 9,
    scholar_id: 'STF-2026-0001',
    full_name: 'Mistaken Staff',
    email: 'mistaken@example.test',
    role: 'staff',
  };
  activeAdmins = [];
  queryCalls = [];
  committed = false;
  rolledBack = false;

  const response = await invokeDelete();

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.message, 'User permanently deleted.');
  assert.equal(committed, true);
  assert.equal(rolledBack, false);
  assert.ok(queryCalls.some(({ sql }) => sql === 'DELETE FROM staff_notification_preferences_v2 WHERE staff_id = ?'));
  assert.ok(queryCalls.some(({ sql }) => sql === 'DELETE FROM staff_attendance WHERE staff_id = ?'));
  assert.ok(queryCalls.some(({ sql }) => sql.includes('UPDATE scholar_groups SET created_by = NULL, assigned_staff_id = NULL')));
  assert.ok(queryCalls.some(({ sql }) => sql === 'DELETE FROM users WHERE id = ?'));
});

test('scholar accounts cannot be permanently deleted through User Management', async () => {
  targetUser = {
    id: 9,
    scholar_id: 'AS-2026-000001',
    full_name: 'Scholar',
    email: 'scholar@example.test',
    role: 'scholar',
  };
  queryCalls = [];
  committed = false;
  rolledBack = false;

  const response = await invokeDelete();

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /must be archived/i);
  assert.equal(committed, false);
  assert.equal(rolledBack, true);
  assert.equal(queryCalls.some(({ sql }) => sql === 'DELETE FROM users WHERE id = ?'), false);
});

test('cannot permanently delete the acting or last administrator', async () => {
  targetUser = {
    id: 5,
    scholar_id: 'ADM-001',
    full_name: 'Current Admin',
    email: 'admin@example.test',
    role: 'admin',
  };
  activeAdmins = [{ id: 5 }, { id: 6 }];
  queryCalls = [];
  committed = false;
  rolledBack = false;

  const selfDeleteResponse = await invokeDelete();
  assert.equal(selfDeleteResponse.statusCode, 400);
  assert.match(selfDeleteResponse.body.error, /own administrator/i);
  assert.equal(committed, false);
  assert.equal(rolledBack, true);

  targetUser = { ...targetUser, id: 6 };
  activeAdmins = [{ id: 6 }];
  queryCalls = [];
  rolledBack = false;
  const lastAdminResponse = await invokeDelete();
  assert.equal(lastAdminResponse.statusCode, 409);
  assert.match(lastAdminResponse.body.error, /last administrator/i);
  assert.equal(rolledBack, true);
  assert.equal(queryCalls.some(({ sql }) => sql === 'DELETE FROM users WHERE id = ?'), false);
});
