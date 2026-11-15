const assert = require('node:assert/strict');
const { test } = require('node:test');
const { hasRequiredPasswordSymbol, isValidPassword } = require('../utils/passwordPolicy');

test('password policy requires eight characters and a non-whitespace special character', () => {
  assert.equal(isValidPassword('secure!1'), true);
  assert.equal(isValidPassword('longpassword'), false);
  assert.equal(isValidPassword('short!'), false);
  assert.equal(isValidPassword('password '), false);
  assert.equal(hasRequiredPasswordSymbol('password!'), true);
});
