const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
let lookupCount = 0;
let savedPreferences;
let userUpdateError = null;
const connection = {
  beginTransaction(callback) {
    callback(null);
  },
  query(sql, values, callback) {
    process.nextTick(() => {
      if (sql.includes('UPDATE users')) {
        callback(null, { affectedRows: 1 });
      } else if (sql.includes('INSERT INTO admin_preferences')) {
        savedPreferences = JSON.parse(values[1]);
        callback(null, { affectedRows: 1 });
      } else if (sql.includes('INSERT INTO admin_system_settings')) {
        callback(null, { affectedRows: 1 });
      } else {
        callback(new Error(`Unexpected query: ${sql}`));
      }
    });

  },
  commit(callback) {
    callback(null);
  },
  rollback(callback) {
    callback(null);
  },
  release() {},
};
const fakeDb = {
  query(sql, values, callback) {
    lookupCount += 1;
    if (sql.startsWith('UPDATE users SET full_name=')) {
      callback(userUpdateError, { affectedRows: userUpdateError ? 0 : 1 });
      return;
    }
    if (sql.includes('SELECT u.full_name AS displayName')) {
      callback(null, [{
        displayName: 'Admin',
        email: 'admin@example.org',
        preferences: JSON.stringify({ timezone: '(GMT+0) UTC', sessionTimeout: '30', paginationPageSize: 25 }),
        scheduledBackups: 1,
        backupIntervalHours: 24,
        backupRetentionCount: 14,
      }]);
      return;
    }
    callback(null, [{ password: 'unused', preferences: JSON.stringify({ requireReauth: false }) }]);
  },
  getConnection(callback) {
    callback(null, connection);
  },
};

const dbModule = new Module(dbPath, module);
dbModule.filename = dbPath;
dbModule.loaded = true;
dbModule.exports = fakeDb;
require.cache[dbPath] = dbModule;

const mockedDependencies = [
  ['../utils/notifyHelpers', {}],
  ['../utils/auditLogger', { logAuditEvent: async () => {} }],
  ['../utils/officerAssignments', {
    getAssignedYearLevels: async () => [],
    normalizeYearLevel: value => value,
    yearLevelSqlExpression: value => value,
  }],
  ['../utils/complianceLogger', {
    logComplianceIncident: async () => {},
    clampCompliance: value => value,
    getComplianceSettings: async () => ({}),
    calculateCurrentCompliance: () => {},
    calculateComplianceScore: () => 0,
    getOverdueComplianceTaskCounts: async () => ({}),
    getComplianceRiskThresholds: () => ({}),
    getComplianceRiskTier: () => '',
    resolveGradeScale: () => '',
  }],
  ['qrcode', {}],
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

const adminController = require('../controllers/adminController');
delete require.cache[dbPath];
injectedModules.forEach(path => delete require.cache[path]);

const settingsBody = (sessionTimeout, paginationPageSize = 10) => ({
  displayName: 'Admin',
  email: 'admin@example.org',
  preferences: {
    dateFormat: 'MMMM DD, YYYY',
    paginationPageSize,
    tableDensity: 'comfortable',
    compactTables: false,
    emailNotifications: true,
    inAppNotifications: true,
    autoRefresh: true,
    sessionTimeout,
    requireReauth: false,
    securityAlerts: true,
    logAdminActivity: true,
  },
  scheduledBackups: true,
  backupIntervalHours: '24',
  backupRetentionCount: '14',
});

const invokeUpdate = body => new Promise(resolve => {
  const res = {
    status(statusCode) {
      return { json: responseBody => resolve({ statusCode, body: responseBody }) };
    },
    json(responseBody) {
      resolve({ statusCode: 200, body: responseBody });
    },
  };
  adminController.updateAdminSettings({ user: { id: 5 }, body }, res);
});

const invokeGet = () => new Promise(resolve => {
  const res = { json: body => resolve({ statusCode: 200, body }) };
  adminController.getAdminSettings({ user: { id: 5 } }, res);
});

const invokeUserUpdate = body => new Promise(resolve => {
  const res = {
    status(statusCode) {
      return { json: responseBody => resolve({ statusCode, body: responseBody }) };
    },
    json(responseBody) {
      resolve({ statusCode: 200, body: responseBody });
    },
  };
  adminController.updateUser({ params: { id: '15' }, body }, res);
});

test('administrator settings normalize a previously saved 30-minute timeout to 20 minutes', async () => {
  const response = await invokeGet();

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.sessionTimeout, '20');
  assert.equal(response.body.paginationPageSize, 10);
  assert.equal('language' in response.body, false);
  assert.equal('timezone' in response.body, false);
});

test('administrator settings accept the configured session timeout choices', async () => {
  for (const timeout of ['3', '5', '10', '15', '20']) {
    lookupCount = 0;
    const response = await invokeUpdate(settingsBody(timeout));

    assert.equal(response.statusCode, 200, `${timeout} minutes should be accepted`);
    assert.equal(response.body.sessionTimeout, timeout);
    assert.equal(savedPreferences.sessionTimeout, timeout);
  }
});

test('administrator settings reject session timeouts outside the configured choices', async () => {
  for (const timeout of ['2', '30']) {
    lookupCount = 0;
    const response = await invokeUpdate(settingsBody(timeout));

    assert.equal(response.statusCode, 400, `${timeout} minutes should be rejected`);
    assert.equal(lookupCount, 0);
  }
});

test('administrator settings accept page sizes of 10, 20, and 50', async () => {
  for (const pageSize of [10, 20, 50]) {
    const response = await invokeUpdate(settingsBody('20', pageSize));

    assert.equal(response.statusCode, 200, `${pageSize} rows should be accepted`);
    assert.equal(response.body.paginationPageSize, pageSize);
    assert.equal(savedPreferences.paginationPageSize, pageSize);
  }
});

test('administrator settings reject page sizes outside 10, 20, and 50', async () => {
  for (const pageSize of [0, 5, 25, '20']) {
    lookupCount = 0;
    const response = await invokeUpdate(settingsBody('20', pageSize));

    assert.equal(response.statusCode, 400, `${pageSize} rows should be rejected`);
    assert.equal(lookupCount, 0);
  }
});

test('editing a user reports duplicate email addresses as a conflict', async () => {
  const duplicateError = new Error('Duplicate email');
  duplicateError.code = 'ER_DUP_ENTRY';
  userUpdateError = duplicateError;

  const response = await invokeUserUpdate({
    full_name: 'Scholar Name',
    email: 'used@example.test',
    role: 'scholar',
    year_level: 'grade_7',
    status: 'active',
  });

  assert.equal(response.statusCode, 409);
  assert.match(response.body.error, /email address is already in use/i);
  userUpdateError = null;
});
