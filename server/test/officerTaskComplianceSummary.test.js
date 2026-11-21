const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const assignmentsPath = require.resolve('../utils/officerAssignments');
const dbModule = new Module(dbPath, module);
const assignmentsModule = new Module(assignmentsPath, module);
let scholars = [];
let tasks = [];
let submissions = [];
let grades = [];

const fakeDb = {
  promise: () => ({
    query: async (sql, values = []) => {
      if (sql.includes('SELECT u.scholar_id')) {
        return [scholars.filter(scholar => String(scholar.year_level).toLowerCase().replace(/[_\s-]+/g, '') === 'grade12'), []];
      }
      if (sql.includes('FROM tasks')) {
        return [tasks
          .filter(task => task.is_active !== 0)
          .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)) || Number(a.id) - Number(b.id)), []];
      }
      if (sql.includes('FROM submissions')) return [submissions, []];
      if (sql.includes('FROM grades')) return [grades, []];
      throw new Error(`Unexpected query: ${sql}`);
    },
  }),
};

dbModule.filename = dbPath;
dbModule.loaded = true;
dbModule.exports = fakeDb;
require.cache[dbPath] = dbModule;

assignmentsModule.filename = assignmentsPath;
assignmentsModule.loaded = true;
assignmentsModule.exports = {
  applyOfficerYearLevelFilter: async (req, conditions, values, column) => {
    conditions.push(`${column} IN (?)`);
    values.push('grade_12');
  },
  normalizeYearLevel: value => String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' '),
  getAssignedYearLevels: async () => ['grade_12'],
  yearLevelSqlExpression: column => column,
};
require.cache[assignmentsPath] = assignmentsModule;

const officerController = require('../controllers/officerController');

delete require.cache[dbPath];
delete require.cache[assignmentsPath];

const invoke = req => new Promise(resolve => {
  officerController.getTaskComplianceSummary(req, {
    status(code) {
      return { json: body => resolve({ status: code, body }) };
    },
    json(body) {
      resolve({ status: 200, body });
    },
  });
});

test('keeps active non-monthly tasks and resets Monthly Letter counts to the newest task', async () => {
  scholars = [
    { scholar_id: 'S-1', year_level: 'grade_12' },
    { scholar_id: 'S-2', year_level: 'Grade 12' },
    { scholar_id: 'S-3', year_level: 'grade_11' },
  ];
  tasks = [
    { id: 101, title: 'Monthly Report - First', type: 'Monthly Report', due_date: '2026-11-10', created_at: '2026-11-01 08:00:00', target_year_levels: '["grade_12"]', is_active: 1 },
    { id: 102, title: 'Monthly Report - Second', type: 'Monthly Report', due_date: '2026-12-30', created_at: '2026-11-15 08:00:00', target_year_levels: '["grade_12"]', is_active: 1 },
    { id: 103, title: 'COR Upload', type: 'COR Upload', due_date: '2026-10-22', created_at: '2026-10-03 08:00:00', target_year_levels: '["grade_12"]', is_active: 1 },
    { id: 104, title: 'Other Documents', type: 'Other Documents', due_date: '2026-11-25', created_at: '2026-11-05 08:00:00', target_year_levels: '["grade_12"]', is_active: 1 },
    { id: 105, title: 'Report Card', type: 'Report Card', due_date: '2026-12-28', created_at: '2026-11-06 08:00:00', target_year_levels: '["grade_12"]', is_active: 1 },
    { id: 106, title: 'Closed COR', type: 'COR Upload', due_date: '2026-11-22', created_at: '2026-11-03 08:00:00', target_year_levels: '["grade_12"]', is_active: 0 },
  ];
  submissions = [
    { scholar_id: 'S-1', submission_type: 'letter', status: 'approved', submitted_at: '2026-11-05 09:00:00' },
    { scholar_id: 'S-2', submission_type: 'letter', status: 'pending', submitted_at: '2026-11-20 09:00:00' },
    { scholar_id: 'S-1', submission_type: 'cor', status: 'returned', submitted_at: '2026-11-10 09:00:00' },
    { scholar_id: 'S-2', submission_type: 'other', status: 'under_review', submitted_at: '2026-11-12 09:00:00' },
  ];
  grades = [
    { scholar_id: 'S-1', submission_type: 'grades', status: 'approved', submitted_at: '2026-11-08 09:00:00' },
  ];

  const response = await invoke({ user: { id: 8, role: 'officer' }, query: {} });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.map(task => ({
    task_id: task.task_id,
    total: task.total,
    submitted: task.submitted,
    pending: task.pending,
    notSubmitted: task.notSubmitted,
  })), [
    { task_id: 103, total: 2, submitted: 0, pending: 0, notSubmitted: 2 },
    { task_id: 104, total: 2, submitted: 0, pending: 1, notSubmitted: 1 },
    { task_id: 105, total: 2, submitted: 1, pending: 0, notSubmitted: 1 },
    { task_id: 102, total: 2, submitted: 0, pending: 1, notSubmitted: 1 },
  ]);
});
