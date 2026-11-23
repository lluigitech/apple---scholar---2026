const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const fakeDb = { query: null };
const fakeDbModule = new Module(dbPath, module);
fakeDbModule.filename = dbPath;
fakeDbModule.loaded = true;
fakeDbModule.exports = fakeDb;
require.cache[dbPath] = fakeDbModule;

const scholarController = require('../controllers/scholarController');

delete require.cache[dbPath];

const invoke = (handler, req, rows, queryError = null) => new Promise((resolve, reject) => {
  let query;
  fakeDb.query = (sql, values, callback) => {
    if (typeof values === 'function') callback = values;
    query = { sql, values: typeof values === 'function' ? [] : values };
    callback(queryError, rows);
  };
  const res = {
    status(code) {
      return {
        json(body) {
          resolve({ status: code, body, query });
        },
      };
    },
    json(body) {
      resolve({ status: 200, body, query });
    },
  };

  try {
    handler(req, res);
  } catch (error) {
    reject(error);
  }
});

test('scholar announcements are creation-cutoff and audience filtered', async () => {
  const response = await invoke(scholarController.getAnnouncements, {
    user: { id: 7, role: 'scholar' },
  }, [
    { id: 1, title: 'For Grade 7', target_roles: ['scholar'], target_levels: ['grade_7'], scholar_year_level: 'Grade 7' },
    { id: 2, title: 'For staff', target_roles: ['staff'], target_levels: [], scholar_year_level: 'Grade 7' },
    { id: 3, title: 'For Grade 8', target_roles: ['scholar'], target_levels: ['grade_8'], scholar_year_level: 'Grade 7' },
    { id: 4, title: 'Everyone', target_roles: null, target_levels: null, scholar_year_level: 'Grade 7' },
  ]);

  assert.equal(response.status, 200);
  assert.deepEqual(response.query.values, [7]);
  assert.match(response.query.sql, /a\.created_at > scholar\.created_at/);
  assert.deepEqual(response.body.map(item => item.id), [1, 4]);
  assert.equal(response.body[0].scholar_year_level, undefined);
});

test('scholar profile update reports duplicate email addresses as a conflict', async () => {
  const duplicateError = new Error('Duplicate email');
  duplicateError.code = 'ER_DUP_ENTRY';
  const response = await invoke(scholarController.updateProfile, {
    params: { id: '7' },
    user: { id: 7, role: 'scholar' },
    body: { email: 'used@example.test' },
  }, [], duplicateError);

  assert.equal(response.status, 409);
  assert.match(response.body.error, /email address is already in use/i);
});

test('scholar duties use the authenticated account creation cutoff', async () => {
  const response = await invoke(scholarController.getMyDuties, {
    user: { id: 7, role: 'scholar', scholar_id: 'S-7' },
  }, []);

  assert.equal(response.status, 200);
  assert.match(response.query.sql, /dga\.created_at > scholar_account\.created_at/);
  assert.equal((response.query.sql.match(/\?/g) || []).length, response.query.values.length);
  assert.deepEqual(response.query.values, ['S-7', 7, 'S-7', 'S-7', 'S-7', 'S-7', 'S-7']);
});
