const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
let connection;
const fakeDb = {
  promise: () => ({ getConnection: async () => connection }),
};
const fakeDbModule = new Module(dbPath, module);
fakeDbModule.filename = dbPath;
fakeDbModule.loaded = true;
fakeDbModule.exports = fakeDb;
require.cache[dbPath] = fakeDbModule;

const staffController = require('../controllers/staffController');
delete require.cache[dbPath];

const invoke = handler => new Promise(resolve => {
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
  Promise.resolve(handler({ user: { id: 1, role: 'admin' } }, res)).catch(resolve);
});

test('balances every active scholar across groups within one member of each other', async () => {
  const events = [];
  let insertedValues;
  connection = {
    async beginTransaction() { events.push('begin'); },
    async query(sql, values) {
      events.push(sql);
      if (sql.includes('FROM scholar_groups')) return [[{ id: 1 }, { id: 2 }, { id: 3 }], []];
      if (sql.includes('FROM users')) {
        return [[1, 2, 3, 4, 5, 6, 7, 8].map(id => ({ scholar_id: `S${id}` })), []];
      }
      if (sql.startsWith('INSERT INTO scholar_group_members')) {
        insertedValues = values;
        return [{ affectedRows: 8 }, []];
      }
      return [{ affectedRows: 8 }, []];
    },
    async commit() { events.push('commit'); },
    async rollback() { events.push('rollback'); },
    release() { events.push('release'); },
  };

  const response = await invoke(staffController.balanceScholarGroups);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.scholar_count, 8);
  assert.equal(response.body.group_count, 3);
  assert.deepEqual(response.body.groups.map(group => group.member_count).sort(), [2, 3, 3]);
  const assignedScholars = insertedValues.filter((_, index) => index % 2 === 1);
  assert.equal(new Set(assignedScholars).size, 8);
  assert.deepEqual(assignedScholars.sort(), Array.from({ length: 8 }, (_, index) => `S${index + 1}`));
  assert.ok(events.some(event => typeof event === 'string' && event.startsWith('DELETE FROM scholar_group_members')));
  assert.ok(events.indexOf('commit') > events.findIndex(event => typeof event === 'string' && event.startsWith('INSERT INTO scholar_group_members')));
  assert.equal(events.at(-1), 'release');
});

test('does not alter assignments when there are no groups', async () => {
  const events = [];
  connection = {
    async beginTransaction() { events.push('begin'); },
    async query(sql) {
      events.push(sql);
      if (sql.includes('FROM scholar_groups')) return [[], []];
      throw new Error('Should not query or change scholars without groups.');
    },
    async commit() { events.push('commit'); },
    async rollback() { events.push('rollback'); },
    release() { events.push('release'); },
  };

  const response = await invoke(staffController.balanceScholarGroups);

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /Create at least one group/);
  assert.ok(events.includes('rollback'));
  assert.equal(events.some(event => typeof event === 'string' && event.startsWith('DELETE')), false);
  assert.equal(events.at(-1), 'release');
});
