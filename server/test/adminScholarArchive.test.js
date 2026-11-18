const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const fakeDb = { query: null };
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
    calculateCurrentCompliance: async () => 0,
    calculateComplianceScore: () => 0,
    getOverdueComplianceTaskCounts: async () => ({}),
    resolveGradeScale: () => null,
  }],
  ['qrcode', {}],
];

const dbModule = new Module(dbPath, module);
dbModule.filename = dbPath;
dbModule.loaded = true;
dbModule.exports = fakeDb;
require.cache[dbPath] = dbModule;

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

const invoke = (handler, req) => new Promise(resolve => {
  const res = {
    status(statusCode) {
      return { json: body => resolve({ statusCode, body }) };
    },
    json(body) {
      resolve({ statusCode: 200, body });
    },
  };
  handler(req, res);
});

test('archived scholar endpoint returns retention date three years from archive', async () => {
  let capturedSql;
  fakeDb.query = (sql, values, callback) => {
    if (typeof values === 'function') callback = values;
    capturedSql = sql;
    callback(null, [{ id: 8, role: 'scholar', status: 'archived', archived_at: '2026-01-02 03:04:05' }]);
  };

  const response = await invoke(adminController.getArchivedScholars, {});

  assert.equal(response.statusCode, 200);
  assert.match(capturedSql, /role = 'scholar' AND status = 'archived'/);
  assert.match(capturedSql, /DATE_ADD\(archived_at, INTERVAL 3 YEAR\) AS retention_until/);
  assert.equal(response.body[0].archived_at, '2026-01-02 03:04:05');
});

test('archiving a scholar records the archive timestamp', async () => {
  const queries = [];
  fakeDb.query = (sql, values, callback) => {
    queries.push({ sql, values });
    if (sql.startsWith('SELECT id, scholar_id')) {
      return callback(null, [{ id: 8, scholar_id: 'SCH-1', full_name: 'Test Scholar', role: 'scholar', status: 'active' }]);
    }
    callback(null, { affectedRows: 1 });
  };

  const response = await invoke(adminController.archiveScholar, {
    params: { id: '8' },
    user: { id: 1, role: 'admin' },
  });

  assert.equal(response.statusCode, 200);
  assert.match(queries[1].sql, /SET status = 'archived', archived_at = NOW\(\)/);
});

test('restoring an archived scholar clears its archive timestamp', async () => {
  let captured;
  fakeDb.query = (sql, values, callback) => {
    captured = { sql, values };
    callback(null, { affectedRows: 1 });
  };

  const response = await invoke(adminController.restoreScholar, {
    params: { id: '8' },
    user: { id: 1, role: 'admin' },
  });

  assert.equal(response.statusCode, 200);
  assert.match(captured.sql, /SET status = 'active', archived_at = NULL/);
  assert.deepEqual(captured.values, ['8']);
});

test('archived user endpoint includes every role', async () => {
  let capturedSql;
  fakeDb.query = (sql, values, callback) => {
    if (typeof values === 'function') callback = values;
    capturedSql = sql;
    callback(null, [{ id: 12, role: 'staff', status: 'archived' }]);
  };

  const response = await invoke(adminController.getArchivedUsers, {});

  assert.equal(response.statusCode, 200);
  assert.match(capturedSql, /WHERE status = 'archived'/);
  assert.doesNotMatch(capturedSql, /role = 'scholar'/);
});

test('archiving a staff account updates its status and timestamp', async () => {
  const statements = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, values) => {
      statements.push({ sql, values });
      if (sql.includes("WHERE role = 'admin'")) return [[{ id: 1 }, { id: 2 }], []];
      if (sql.includes('FOR UPDATE') && sql.includes('WHERE id = ?')) {
        return [[{ id: 8, scholar_id: 'STF-1', full_name: 'Test Staff', role: 'staff', status: 'active' }], []];
      }
      if (sql.startsWith('UPDATE users')) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const originalPromise = fakeDb.promise;
  fakeDb.promise = () => ({ getConnection: async () => connection });

  try {
    const response = await invoke(adminController.archiveUser, {
      params: { id: '8' },
      user: { id: 1, role: 'admin' },
    });

    assert.equal(response.statusCode, 200);
    assert.match(statements.at(-1).sql, /SET status = 'archived', archived_at = NOW\(\)/);
    assert.deepEqual(statements.at(-1).values, ['8']);
  } finally {
    fakeDb.promise = originalPromise;
  }
});

test('archiving the last administrator is rejected', async () => {
  let rolledBack = false;
  let updated = false;
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => { rolledBack = true; },
    release: () => {},
    query: async (sql) => {
      if (sql.includes("WHERE role = 'admin'")) return [[{ id: 8 }], []];
      if (sql.includes('FOR UPDATE') && sql.includes('WHERE id = ?')) {
        return [[{ id: 8, scholar_id: 'ADM-1', full_name: 'Only Admin', role: 'admin', status: 'active' }], []];
      }
      if (sql.startsWith('UPDATE users')) updated = true;
      return [{ affectedRows: 1 }, []];
    },
  };
  const originalPromise = fakeDb.promise;
  fakeDb.promise = () => ({ getConnection: async () => connection });

  try {
    const response = await invoke(adminController.archiveUser, {
      params: { id: '8' },
      user: { id: 2, role: 'admin' },
    });

    assert.equal(response.statusCode, 409);
    assert.equal(rolledBack, true);
    assert.equal(updated, false);
  } finally {
    fakeDb.promise = originalPromise;
  }
});

test('restoring an archived user clears the archive timestamp', async () => {
  let captured;
  fakeDb.query = (sql, values, callback) => {
    captured = { sql, values };
    callback(null, { affectedRows: 1 });
  };

  const response = await invoke(adminController.restoreUser, {
    params: { id: '12' },
    user: { id: 1, role: 'admin' },
  });

  assert.equal(response.statusCode, 200);
  assert.match(captured.sql, /WHERE id = \? AND status = 'archived'/);
  assert.deepEqual(captured.values, ['12']);
});
