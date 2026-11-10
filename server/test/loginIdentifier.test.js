const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const routePath = require.resolve('../routes/authRoutes');
let queryResult = [];
let capturedQuery;
const routes = new Map();
const fakeRouter = {
  post(path, ...handlers) {
    routes.set(`POST ${path}`, handlers.at(-1));
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
  if (parent?.filename === routePath && request === '../utils/notifyHelpers') {
    return { sendPasswordResetEmail: () => {} };
  }
  if (parent?.filename === routePath && request === '../controllers/authController') {
    return { changePassword: () => {} };
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
  routes.get('POST /login')({ body }, response);
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
