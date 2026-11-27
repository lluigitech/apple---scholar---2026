const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const routePath = require.resolve('../routes/authRoutes');
let queryResult = [];
let capturedQuery;
const routes = new Map();
const fakeRouter = {
  get(path, ...handlers) {
    routes.set(`GET ${path}`, handlers);
    return this;
  },
  post(path, ...handlers) {
    routes.set(`POST ${path}`, handlers);
    return this;
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (parent?.filename === routePath && request === 'express') {
    return { Router: () => fakeRouter };
  }
  if (parent?.filename === routePath && request === '../config/db') {
    return {
      query(sql, values, callback) {
        capturedQuery = { sql, values };
        queueMicrotask(() => callback(null, queryResult));
      },
    };
  }
  if (parent?.filename === routePath && request === 'bcryptjs') {
    return { compare: async (plain, hash) => plain === hash };
  }
  if (parent?.filename === routePath && request === 'jsonwebtoken') {
    return { sign: () => 'test-token' };
  }
  if (parent?.filename === routePath && request === '../utils/auditLogger') {
    return { logAuditEvent: async () => {} };
  }
  if (parent?.filename === routePath && request === '../middleware/authMiddleware') {
    return { verifyToken: () => {} };
  }
  if (parent?.filename === routePath && request === '../middleware/failedLoginLimit') {
    return originalLoad.call(this, request, parent, isMain);
  }
  if (parent?.filename === routePath && request === '../utils/notifyHelpers') {
    return { sendPasswordResetEmail: () => {} };
  }
  if (parent?.filename === routePath && request === '../controllers/authController') {
    return { changePassword: () => {} };
  }
  if (parent?.filename === routePath && request === '../controllers/accountSetupController') {
    return { getProfile: () => {}, completeSetup: () => {} };
  }
  return originalLoad.call(this, request, parent, isMain);
};
require('../routes/authRoutes');
Module._load = originalLoad;

const invokeLogin = (body) => new Promise((resolve) => {
  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      resolve({ statusCode: this.statusCode, payload });
      return this;
    },
  };
  routes.get('POST /login').at(-1)({ body }, response);
});

test('all user roles sign in with their generated ID, matching email, and password', async () => {
  const users = [
    { scholar_id: 'SCH-2026-0162', role: 'scholar' },
    { scholar_id: 'OFF-2026-0001', role: 'officer' },
    { scholar_id: 'STF-2026-0001', role: 'staff' },
    { scholar_id: 'ADM-2026-0001', role: 'admin' },
  ];

  for (const user of users) {
    queryResult = [{
      ...user,
      id: 1,
      full_name: 'Test User',
      email: 'user@example.com',
      password: 'correct-password',
      must_change_password: 0,
    }];
    const response = await invokeLogin({
      loginId: user.scholar_id.toLowerCase(),
      email: ' USER@example.com ',
      password: 'correct-password',
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.status, 'Success');
    assert.equal(response.payload.role, user.role);
    assert.match(capturedQuery.sql, /UPPER\(scholar_id\) = UPPER\(\?\) AND LOWER\(email\) = LOWER\(\?\)/);
    assert.deepEqual(capturedQuery.values, [user.scholar_id.toLowerCase(), 'USER@example.com']);
  }

  queryResult = [];
  const mismatchedEmailResponse = await invokeLogin({
    loginId: 'SCH-2026-0162',
    email: 'someone-else@example.com',
    password: 'correct-password',
  });
  assert.equal(mismatchedEmailResponse.statusCode, 401);
});

test('login rejects missing identifiers or password without querying the database', async () => {
  capturedQuery = undefined;
  const missingEmail = await invokeLogin({ loginId: 'SCH-2026-0162', password: 'correct-password' });
  assert.equal(missingEmail.statusCode, 400);
  assert.equal(capturedQuery, undefined);

  const missingPassword = await invokeLogin({ loginId: 'SCH-2026-0162', email: 'user@example.com', password: '' });
  assert.equal(missingPassword.statusCode, 400);
  assert.equal(capturedQuery, undefined);
});

test('archived users cannot sign in even with valid credentials', async () => {
  queryResult = [{
    scholar_id: 'ADM-2026-0001',
    role: 'admin',
    status: 'archived',
    id: 8,
    full_name: 'Archived Admin',
    email: 'archived@example.com',
    password: 'correct-password',
    must_change_password: 0,
  }];

  const response = await invokeLogin({
    loginId: 'ADM-2026-0001',
    email: 'archived@example.com',
    password: 'correct-password',
  });

  assert.equal(response.statusCode, 403);
  assert.match(response.payload.message, /account has been archived/i);
});

test('login blocks after ten failed attempts from the same IP for the rate-limit window', () => {
  const [limitMiddleware] = routes.get('POST /login');
  const invokeLimit = () => {
    const req = { ip: '192.0.2.200', headers: {} };
    const result = { next: false, headers: {}, statusCode: 200, payload: null };
    const res = {
      setHeader(name, value) { result.headers[name] = value; },
      status(code) {
        result.statusCode = code;
        return this;
      },
      json(payload) {
        result.payload = payload;
        return this;
      },
    };
    limitMiddleware(req, res, () => {
      req.recordFailedLoginAttempt();
      result.next = true;
    });
    return result;
  };

  for (let attempt = 0; attempt < 10; attempt += 1) {
    assert.equal(invokeLimit().next, true);
  }
  const blocked = invokeLimit();
  assert.equal(blocked.next, false);
  assert.equal(blocked.statusCode, 429);
  assert.match(blocked.payload.message, /too many failed login attempts/i);
  assert.ok(Number(blocked.headers['Retry-After']) > 0);
});
