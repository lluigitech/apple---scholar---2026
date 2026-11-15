const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
let submissionStatuses = {};
let gradeStatus = null;
let taskCreatedAt = '2026-11-10 09:00:00';

const fakeDb = {
  query() {},
  promise: () => ({
    query: async (sql, values = []) => {
      if (sql.includes('FROM tasks t')) {
        return [[{
          id: 1,
          created_at: taskCreatedAt,
          due_date: '2026-11-30',
          target_year_levels: '[]',
          year_level: 'college_4',
          deadline_passed: 0,
        }], []];
      }
      if (sql.includes('FROM grades')) {
        return [gradeStatus ? [{ status: gradeStatus }] : [], []];
      }
      if (sql.includes('FROM submissions')) {
        const [scholarId, type, createdAt] = values;
        const row = submissionStatuses[type];
        return [row && row.submitted_at >= createdAt ? [{ status: row.status }] : [], []];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  }),
};

const dbModule = new Module(dbPath, module);
dbModule.filename = dbPath;
dbModule.loaded = true;
dbModule.exports = fakeDb;
require.cache[dbPath] = dbModule;

const submissionController = require('../controllers/submissionController');

delete require.cache[dbPath];

const invoke = async () => {
  let statusCode = 200;
  const response = await submissionController.getScholarTaskDeadlines(
    { user: { scholar_id: 'S-1' } },
    {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        return body;
      },
    }
  );
  return { statusCode, body: response };
};

test('only returned submissions can be resubmitted for the current task', async () => {
  submissionStatuses = {
    letter: { status: 'pending', submitted_at: '2026-11-12 10:00:00' },
    cor: { status: 'approved', submitted_at: '2026-11-12 10:00:00' },
    other: { status: 'returned', submitted_at: '2026-11-12 10:00:00' },
  };
  gradeStatus = 'pending';

  const { statusCode, body } = await invoke();

  assert.equal(statusCode, 200);
  assert.equal(body.letter.has_submission, true);
  assert.equal(body.letter.can_resubmit, false);
  assert.equal(body.letter.submission_status, 'pending');
  assert.equal(body.cor.can_resubmit, false);
  assert.equal(body.other.can_resubmit, true);
  assert.equal(body.report_card.has_submission, true);
  assert.equal(body.report_card.can_resubmit, false);
});

test('a submission from before the latest admin task does not lock the new task', async () => {
  taskCreatedAt = '2026-11-15 09:00:00';
  submissionStatuses = {
    letter: { status: 'approved', submitted_at: '2026-11-12 10:00:00' },
  };
  gradeStatus = null;

  const { statusCode, body } = await invoke();

  assert.equal(statusCode, 200);
  assert.equal(body.letter.has_submission, false);
  assert.equal(body.letter.can_resubmit, false);
});
