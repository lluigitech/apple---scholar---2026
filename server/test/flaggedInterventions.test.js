const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const compliancePath = require.resolve('../utils/complianceLogger');
const assignmentsPath = require.resolve('../utils/officerAssignments');
const fakeDb = { query: null };
const injectedPaths = [];
let predictedNegativeLetters = 0;
let predictedNegativeMonths = '';

const makeComplianceScore = () => ({
  overallCompliance: 100,
  riskScore: 0,
  totalDeduction: 0,
  totalBonusPoints: 0,
  bonuses: { earlySubmission: 0, consecutiveEarly: 0, perfectAttendance: 0, totalBonusPoints: 0 },
  minComplianceNum: 50,
  deductions: {
    missedSubmission: { points: 0, overdueTasks: 0, penalizedTasks: 0 },
    lateDuty: { points: 0, lateCount: 0 },
    absentDuty: { points: 0, absentCount: 0 },
    lateSubmission: { points: 0, daysSinceSubmission: 0, penalizedPeriods: 0 },
    negativeLetter: { points: 0, negativeLetters: predictedNegativeLetters },
    qualityDrop: { points: 0, avgQuality: null },
    goodMaintenanceBonus: { points: 0 },
  },
  stats: {
    total_submissions: 5,
    total_service_hours: 0,
    avg_quality: null,
    attendance_rate: null,
    absent: 0,
    negative_letters: predictedNegativeLetters,
    days_since_submission: 0,
    total_duties: 0,
    present: 0,
    late: 0,
  },
});

const injectModule = (path, exports) => {
  const mockedModule = new Module(path, module);
  mockedModule.filename = path;
  mockedModule.loaded = true;
  mockedModule.exports = exports;
  require.cache[path] = mockedModule;
  injectedPaths.push(path);
};

injectModule(dbPath, fakeDb);
injectModule(compliancePath, {
  calculateComplianceScore: makeComplianceScore,
  hasNonOverdueComplianceViolation: () => false,
  getComplianceRiskTier: () => 'low',
  getOverdueComplianceTaskCounts: (scholars, today, callback) => callback(null, {}),
});
injectModule(assignmentsPath, { applyOfficerYearLevelFilter: async () => {} });

const flaggedController = require('../controllers/flaggedController');

test('case notes are trimmed, persisted, and returned with their database record', async () => {
  const savedIntervention = {
    id: 21,
    scholar_id: 'SCH-1',
    type: 'case_note',
    note: 'Followed up by email.',
    performed_by: 7,
  };
  const calls = [];
  fakeDb.query = (sql, values, callback) => {
    calls.push({ sql, values });
    callback(null, { insertId: savedIntervention.id });
  };

  const response = await invoke(flaggedController.logCaseNote, {
    params: { scholarId: 'SCH-1' },
    body: { note: '  Followed up by email.  ' },
    user: { id: 7 },
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual({
    id: response.body.intervention.id,
    scholar_id: response.body.intervention.scholar_id,
    type: response.body.intervention.type,
    note: response.body.intervention.note,
    performed_by: response.body.intervention.performed_by,
  }, savedIntervention);
  assert.doesNotThrow(() => new Date(response.body.intervention.created_at).toISOString());
  assert.deepEqual(calls[0].values, ['SCH-1', 'Followed up by email.', 7]);
  assert.equal(calls.length, 1);
});

test('case notes reject empty and oversized notes without writing to the database', async () => {
  let writeAttempted = false;
  fakeDb.query = () => { writeAttempted = true; };

  const emptyResponse = await invoke(flaggedController.logCaseNote, {
    params: { scholarId: 'SCH-1' },
    body: { note: '  ' },
  });
  const oversizedResponse = await invoke(flaggedController.logCaseNote, {
    params: { scholarId: 'SCH-1' },
    body: { note: 'x'.repeat(5001) },
  });

  assert.equal(emptyResponse.statusCode, 400);
  assert.equal(oversizedResponse.statusCode, 400);
  assert.equal(writeAttempted, false);
});

test('intervention history is returned newest-first from the database query', async () => {
  const history = [{ id: 21, type: 'case_note', note: 'Followed up by email.' }];
  let query;
  fakeDb.query = (sql, values, callback) => {
    query = { sql, values };
    callback(null, history);
  };

  const response = await invoke(flaggedController.getInterventions, {
    params: { scholarId: 'SCH-1' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, history);
  assert.deepEqual(query.values, ['SCH-1']);
  assert.match(query.sql, /ORDER BY created_at DESC/);
});

test('sentiment flags trigger for five different months or three consecutive months without compliance deductions', async () => {
  const scholarRows = [{
    id: 7,
    scholar_id: 'SCH-1',
    full_name: 'Sample Scholar',
    email: 'scholar@example.test',
    year_level: 'College 1',
    status: 'active',
    created_at: '2026-01-01',
  }];
  fakeDb.query = (sql, values, callback) => {
    if (typeof values === 'function') callback = values;
    if (sql.includes('FROM users u')) {
      callback(null, scholarRows);
    } else if (sql.includes('FROM compliance_settings')) {
      callback(null, [{}]);
    } else if (sql.includes('FROM submissions s')) {
      assert.match(sql, /TIMESTAMPADD\(YEAR, TIMESTAMPDIFF\(YEAR, u\.created_at, CURRENT_TIMESTAMP\), u\.created_at\)/);
      assert.match(sql, /s\.submission_type = 'letter'/);
      assert.match(sql, /AS negative_sentiment_months/);
      callback(null, [{
        scholar_id: 'SCH-1',
        total_submissions: 5,
        negative_letters: predictedNegativeLetters,
        negative_sentiment_months: predictedNegativeMonths,
      }]);
    } else if (sql.includes('FROM duty_attendance')) {
      callback(null, []);
    } else if (sql.includes('FROM grades')) {
      callback(null, []);
    } else {
      throw new Error(`Unexpected query: ${sql}`);
    }
  };

  predictedNegativeLetters = 4;
  predictedNegativeMonths = '2026-01,2026-03,2026-05,2026-07';
  const belowSpreadThreshold = await invoke(flaggedController.getFlaggedScholars, { query: {} });
  assert.deepEqual(belowSpreadThreshold.body, []);

  predictedNegativeLetters = 5;
  predictedNegativeMonths = '2026-01,2026-03,2026-05,2026-07,2026-09';
  const atSpreadThreshold = await invoke(flaggedController.getFlaggedScholars, { query: {} });
  assert.equal(atSpreadThreshold.body.length, 1);
  assert.equal(atSpreadThreshold.body[0].negative_sentiment_month_count, 5);
  assert.equal(atSpreadThreshold.body[0].negative_sentiment_spread_month_threshold, 5);
  assert.ok(atSpreadThreshold.body[0].flags.some(flag => flag.type === 'Negative Sentiment'));

  predictedNegativeLetters = 3;
  predictedNegativeMonths = '2026-12,2027-01,2027-02';
  const atConsecutiveThreshold = await invoke(flaggedController.getFlaggedScholars, { query: {} });
  assert.equal(atConsecutiveThreshold.body.length, 1);
  assert.equal(atConsecutiveThreshold.body[0].negative_sentiment_consecutive_months, 3);
  assert.equal(atConsecutiveThreshold.body[0].negative_sentiment_consecutive_month_threshold, 3);
  assert.equal(atConsecutiveThreshold.body[0].overall_compliance, 100);
  assert.equal(atConsecutiveThreshold.body[0].risk_score, 0);
});

const invoke = (handler, req) => new Promise(resolve => {
  const res = {
    status(statusCode) {
      return { json: body => resolve({ statusCode, body }) };
    },
    json(body) {
      resolve({ statusCode: 200, body });
    },
  };
  handler(req, res);
});

test.after(() => {
  delete require.cache[require.resolve('../controllers/flaggedController')];
  injectedPaths.forEach(path => delete require.cache[path]);
});
