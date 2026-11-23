const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
let capturedQuery;
const fakeDb = {
  query(sql, values, callback) {
    capturedQuery = { sql, values };
    callback(null, []);
  },
};
const fakeDbModule = new Module(dbPath, module);
fakeDbModule.filename = dbPath;
fakeDbModule.loaded = true;
fakeDbModule.exports = fakeDb;
require.cache[dbPath] = fakeDbModule;

const adminController = require('../controllers/adminController');

delete require.cache[dbPath];

test('monthly reports match college_N records when filtering by ordinal year labels', async () => {
  capturedQuery = undefined;
  const response = await new Promise(resolve => {
    adminController.getMonthlySubmissions(
      { query: { month: '2026-09', year_level: '2nd Year College' } },
      {
        status() {
          return this;
        },
        json(body) {
          resolve(body);
        },
      }
    );
  });

  assert.deepEqual(response, []);
  assert.match(capturedQuery.sql, /CASE[\s\S]*u\.year_level[\s\S]*college 2[\s\S]*college_2/);
  assert.deepEqual(capturedQuery.values, [2026, 9, 'college_2']);
});

test('monthly report status includes archived submissions without returning them as active records', async () => {
  const queries = [];
  fakeDb.query = (sql, values, callback) => {
    queries.push({ sql, values });
    if (sql.includes('COALESCE(s.archived_at, s.archive_at) IS NOT NULL')) {
      callback(null, [{
        scholar_id: 'S-27',
        userId: 27,
        scholarName: 'Test Scholar',
        year_level: 'college_2',
      }]);
      return;
    }
    callback(null, []);
  };

  const response = await new Promise(resolve => {
    adminController.getMonthlySubmissions(
      { query: { month: '2026-09', year_level: '2nd Year College', include_archived_status: '1' } },
      {
        status() {
          return this;
        },
        json(body) {
          resolve(body);
        },
      }
    );
  });

  assert.deepEqual(response, {
    submissions: [],
    archivedSubmissions: [{
      scholar_id: 'S-27',
      userId: 27,
      scholarName: 'Test Scholar',
      year_level: 'college_2',
    }],
  });
  assert.match(queries[0].sql, /COALESCE\(s\.archived_at, s\.archive_at\) IS NULL/);
  assert.match(queries[1].sql, /COALESCE\(s\.archived_at, s\.archive_at\) IS NOT NULL/);
  assert.match(queries[1].sql, /s\.status = 'approved'/);
  assert.match(queries[1].sql, /s\.finalized_at IS NOT NULL/);
  assert.deepEqual(queries[1].values, [2026, 9, 'college_2']);
});
