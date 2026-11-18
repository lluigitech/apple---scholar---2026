const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const queryCalls = [];
let connectionUser;
let profileUser;

const fakeConnection = {
  async beginTransaction() {},
  async commit() {},
  async rollback() {},
  release() {},
  async query(sql, values) {
    queryCalls.push({ sql, values });
    if (sql.startsWith('SELECT id, role, password, must_change_password')) {
      return [[connectionUser], []];
    }
    if (sql.startsWith('UPDATE users')) return [{ affectedRows: 1 }, []];
    throw new Error(`Unexpected connection query: ${sql}`);
  },
};

const fakeDb = {
  query(sql, values, callback) {
    queryCalls.push({ sql, values });
    if (sql.startsWith('SELECT settings_json FROM admin_preferences')) {
      callback(null, [{ settings_json: '{}' }]);
      return;
    }
    if (sql.startsWith('INSERT INTO audit_logs')) {
      callback(null, { affectedRows: 1 });
      return;
    }
    callback(new Error(`Unexpected query: ${sql}`));
  },
  promise() {
    return {
      async query(sql, values) {
        queryCalls.push({ sql, values });
        if (sql.startsWith('SELECT id, scholar_id AS login_id')) return [[profileUser], []];
        throw new Error(`Unexpected pool query: ${sql}`);
      },
      async getConnection() {
        return fakeConnection;
      },
    };
  },
};

const fakeDbModule = new Module(dbPath, module);
fakeDbModule.filename = dbPath;
fakeDbModule.loaded = true;
fakeDbModule.exports = fakeDb;
require.cache[dbPath] = fakeDbModule;

const controller = require('../controllers/accountSetupController');
delete require.cache[dbPath];

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

test('initial setup profile only returns allowed role details while password change is required', async () => {
  queryCalls.length = 0;
  profileUser = {
    login_id: 'STF-2026-001',
    full_name: 'Staff User',
    email: 'staff@example.test',
    role: 'staff',
    must_change_password: 1,
  };

  const response = await invoke(controller.getProfile, { user: { id: 21, role: 'staff' } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    login_id: 'STF-2026-001',
    full_name: 'Staff User',
    email: 'staff@example.test',
    role: 'staff',
  });
  assert.doesNotMatch(JSON.stringify(response.body), /password/i);
});

test('initial setup rejects accounts that are not awaiting first-login setup', async () => {
  profileUser = {
    login_id: 'OFF-2026-001',
    full_name: 'Officer User',
    email: 'officer@example.test',
    role: 'officer',
    must_change_password: 0,
  };

  const response = await invoke(controller.getProfile, { user: { id: 22, role: 'officer' } });
  assert.equal(response.statusCode, 403);
});

test('initial setup rejects passwords without a special character before opening a database connection', async () => {
  queryCalls.length = 0;
  const response = await invoke(controller.completeSetup, {
    user: { id: 23, role: 'admin' },
    body: {
      full_name: 'Admin User',
      email: 'admin@example.test',
      current_password: 'temporary-password',
      new_password: 'newpassword123',
    },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /special character/i);
  assert.equal(queryCalls.length, 0);
});

test('initial setup completes without a phone number and preserves existing phone data', async () => {
  queryCalls.length = 0;
  connectionUser = {
    id: 24,
    role: 'staff',
    password: 'temporary-password',
    must_change_password: 1,
  };

  const response = await invoke(controller.completeSetup, {
    user: { id: 24, role: 'staff' },
    body: {
      full_name: '  Staff User  ',
      email: ' STAFF@example.test ',
      current_password: 'temporary-password',
      new_password: 'new-secure-password',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    message: 'Account setup completed.',
    full_name: 'Staff User',
    email: 'staff@example.test',
  });

  const update = queryCalls.find(({ sql }) => sql.startsWith('UPDATE users'));
  assert.ok(update);
  assert.match(update.sql, /SET full_name = \?, email = \?, password = \?, must_change_password = 0/);
  assert.doesNotMatch(update.sql, /phone/i);
  assert.deepEqual(update.values.slice(0, 2), ['Staff User', 'staff@example.test']);
  assert.match(update.values[2], /^\$2[aby]\$/);
  assert.equal(update.values[3], 24);
  assert.ok(queryCalls.some(({ sql }) => sql.startsWith('INSERT INTO audit_logs')));
});
