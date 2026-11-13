const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const scholarControllerPath = require.resolve('../controllers/scholarController');
let promiseQuery;
const queryCalls = [];
let profileUpdateCalls = 0;
const fakeDb = {
  promise() {
    return {
      async query(sql, values) {
        queryCalls.push({ sql, values });
        return promiseQuery(sql, values);
      },
    };
  },
};

const fakeDbModule = new Module(dbPath, module);
fakeDbModule.filename = dbPath;
fakeDbModule.loaded = true;
fakeDbModule.exports = fakeDb;
require.cache[dbPath] = fakeDbModule;

const fakeScholarControllerModule = new Module(scholarControllerPath, module);
fakeScholarControllerModule.filename = scholarControllerPath;
fakeScholarControllerModule.loaded = true;
fakeScholarControllerModule.exports = {
  updateProfile(req, res) {
    profileUpdateCalls += 1;
    return res.json({ updated: true, id: req.params.id });
  },
};
require.cache[scholarControllerPath] = fakeScholarControllerModule;

const scholarSettingsController = require('../controllers/scholarSettingsController');

delete require.cache[dbPath];
delete require.cache[scholarControllerPath];

const invoke = (handler, request) => new Promise((resolve, reject) => {
  let statusCode = 200;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      resolve({ statusCode, body });
      return this;
    },
  };
  Promise.resolve(handler(request, res)).catch(reject);
});

test('scholar settings password verification uses the authenticated scholar account', async () => {
  queryCalls.length = 0;
  promiseQuery = async (sql, values) => {
    assert.match(sql, /WHERE id = \? AND role = \? LIMIT 1/);
    assert.deepEqual(values, [15, 'scholar']);
    return [[{ password: 'current-password' }], []];
  };

  const valid = await invoke(scholarSettingsController.verifyPassword, {
    user: { id: 15, role: 'scholar' },
    body: { currentPassword: 'current-password' },
  });
  const invalid = await invoke(scholarSettingsController.verifyPassword, {
    user: { id: 15, role: 'scholar' },
    body: { currentPassword: 'wrong-password' },
  });

  assert.equal(valid.statusCode, 200);
  assert.deepEqual(valid.body, { verified: true });
  assert.equal(invalid.statusCode, 401);
  assert.match(invalid.body.error, /password is incorrect/i);
});

test('scholar settings password verification rejects missing and extra fields', async () => {
  queryCalls.length = 0;
  const missing = await invoke(scholarSettingsController.verifyPassword, {
    user: { id: 15, role: 'scholar' },
    body: {},
  });
  const extra = await invoke(scholarSettingsController.verifyPassword, {
    user: { id: 15, role: 'scholar' },
    body: { currentPassword: 'current-password', role: 'admin' },
  });

  assert.equal(missing.statusCode, 400);
  assert.equal(extra.statusCode, 400);
  assert.equal(queryCalls.length, 0);
});

test('scholar settings profile update verifies password before changing profile', async () => {
  profileUpdateCalls = 0;
  promiseQuery = async () => [[{ password: 'current-password' }], []];

  const invalid = await invoke(scholarSettingsController.updateProfile, {
    user: { id: 15, role: 'scholar' },
    params: { id: '15' },
    body: { full_name: 'Scholar Name', currentPassword: 'wrong-password' },
  });
  assert.equal(invalid.statusCode, 401);
  assert.equal(profileUpdateCalls, 0);

  const valid = await invoke(scholarSettingsController.updateProfile, {
    user: { id: 15, role: 'scholar' },
    params: { id: '15' },
    body: { full_name: 'Scholar Name', currentPassword: 'current-password' },
  });
  assert.equal(valid.statusCode, 200);
  assert.deepEqual(valid.body, { updated: true, id: '15' });
  assert.equal(profileUpdateCalls, 1);
});
