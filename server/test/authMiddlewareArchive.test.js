const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const middlewarePath = require.resolve('../middleware/authMiddleware');
let userStatus = 'active';
const originalLoad = Module._load;

Module._load = function (request, parent, isMain) {
  if (parent?.filename === middlewarePath && request === 'jsonwebtoken') {
    return { verify: (token, secret, callback) => callback(null, { id: 8, role: 'admin' }) };
  }
  if (parent?.filename === middlewarePath && request === '../config/db') {
    return {
      query(sql, values, callback) {
        assert.match(sql, /SELECT id, role, scholar_id, status FROM users/);
        queueMicrotask(() => callback(null, [{
          id: 8,
          role: 'admin',
          scholar_id: 'ADM-2026-0001',
          status: userStatus,
        }]));
      },
    };
  }
  if (parent?.filename === middlewarePath && request === './privacyAccess') {
    return { logPrivacyAccess: async () => {} };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const { verifyToken } = require('../middleware/authMiddleware');
Module._load = originalLoad;

const invoke = () => new Promise((resolve) => {
  const req = { headers: { authorization: 'Bearer test-token' } };
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      resolve({ statusCode: this.statusCode, payload, req });
    },
  };
  verifyToken(req, res, () => resolve({ statusCode: 200, req }));
});

test('archived account tokens are rejected by authentication middleware', async () => {
  userStatus = 'archived';
  const response = await invoke();

  assert.equal(response.statusCode, 401);
  assert.match(response.payload.message, /account has been archived/i);
});

test('active account tokens continue to authenticate', async () => {
  userStatus = 'active';
  const response = await invoke();

  assert.equal(response.statusCode, 200);
  assert.equal(response.req.user.role, 'admin');
  assert.equal(response.req.user.scholar_id, 'ADM-2026-0001');
});
