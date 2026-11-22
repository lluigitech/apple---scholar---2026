const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const assignmentsPath = require.resolve('../utils/officerAssignments');
const dbModule = new Module(dbPath, module);
const assignmentsModule = new Module(assignmentsPath, module);
const queryLog = [];

const today = new Date();
const formatDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dueDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
const createdAt = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 5);
const submissionDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
const scholars = [
  { id: 1, scholar_id: 'S-1', full_name: 'Approved Scholar', year_level: 'Grade 7' },
  { id: 2, scholar_id: 'S-2', full_name: 'Pending Scholar', year_level: 'Grade 7' },
  { id: 3, scholar_id: 'S-3', full_name: 'Missing Scholar', year_level: 'Grade 7' },
];
const fakeDb = {
  promise() {
    return { query: async () => [[], []] };
  },
  query(sql, values, callback) {
    queryLog.push(sql);
    if (sql.includes('SELECT u.id, u.scholar_id')) return callback(null, scholars);
    if (sql.includes('SELECT id, title, type, due_date')) {
      return callback(null, [{
        id: 90,
        title: 'Closed Monthly Report',
        type: 'Monthly Report',
        due_date: formatDate(dueDate),
        created_at: `${formatDate(createdAt)} 08:00:00`,
        target_year_levels: '["Grade 7"]',
        is_active: 0,
      }]);
    }
    if (sql.includes('FROM submissions')) {
      return callback(null, [
        { scholar_id: 'S-1', submission_type: 'letter', status: 'approved', submitted_at: `${formatDate(submissionDate)} 09:00:00` },
        { scholar_id: 'S-2', submission_type: 'letter', status: 'pending', submitted_at: `${formatDate(submissionDate)} 09:00:00` },
      ]);
    }
    if (sql.includes('FROM grades')) return callback(null, []);
    throw new Error(`Unexpected query: ${sql}`);
  },
};

dbModule.filename = dbPath;
dbModule.loaded = true;
dbModule.exports = fakeDb;
assignmentsModule.filename = assignmentsPath;
assignmentsModule.loaded = true;
assignmentsModule.exports = {
  applyOfficerYearLevelFilter: async () => {},
};
require.cache[dbPath] = dbModule;
require.cache[assignmentsPath] = assignmentsModule;

const officerController = require('../controllers/officerController');

delete require.cache[dbPath];
delete require.cache[assignmentsPath];

test('includes deleted tasks when calculating each scholar completion report', async () => {
  const response = await new Promise(resolve => {
    officerController.getTaskCompletionSummary({ query: {}, user: { role: 'officer' } }, {
      status(code) {
        return { json: body => resolve({ status: code, body }) };
      },
      json(body) {
        resolve({ status: 200, body });
      },
    });
  });

  assert.equal(response.status, 200);
  const rowsByStudent = new Map(response.body.map(row => [row.studentId, row]));
  assert.equal(rowsByStudent.get('S-1').completedTasks, 1);
  assert.equal(rowsByStudent.get('S-2').pendingTasks, 1);
  assert.equal(rowsByStudent.get('S-3').missingTasks, 1);
  const tasksQuery = queryLog.find(sql => sql.includes('SELECT id, title, type, due_date'));
  assert.ok(tasksQuery);
  assert.doesNotMatch(tasksQuery, /WHERE\s+is_active\s*=\s*1/i);
});
