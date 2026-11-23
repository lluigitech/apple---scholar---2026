const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const Module = require('node:module');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const fakeDb = { query: null };
let complianceScore;
const complianceTools = {
  logComplianceIncident: async () => {},
  clampCompliance: value => value,
  getComplianceSettings: async () => ({}),
  getComplianceRiskThresholds: () => ({
    lowRiskMinCompliance: 75,
    mediumRiskMinCompliance: 50,
  }),
  getComplianceRiskTier: score => score >= 75 ? 'low' : score >= 50 ? 'medium' : 'high',
  calculateCurrentCompliance: (scholarId, callback) => callback(
    null,
    complianceScore.overallCompliance,
    complianceScore.minCompliance,
    complianceScore
  ),
  calculateComplianceScore: () => 0,
  getOverdueComplianceTaskCounts: async () => ({}),
  resolveGradeScale: yearLevel => /^college/i.test(String(yearLevel)) ? 'college' : 'k12',
};
const mockedDependencies = [
  ['../utils/notifyHelpers', {}],
  ['../utils/auditLogger', { logAuditEvent: async () => {} }],
  ['../utils/officerAssignments', {
    getAssignedYearLevels: async () => [],
    normalizeYearLevel: value => value,
    yearLevelSqlExpression: value => value,
  }],
  ['../utils/complianceLogger', complianceTools],
  ['qrcode', {}],
];

const dbModule = new Module(dbPath, module);
dbModule.filename = dbPath;
dbModule.loaded = true;
dbModule.exports = fakeDb;
require.cache[dbPath] = dbModule;

const injectedModules = mockedDependencies.map(([request, exports]) => {
  const resolvedPath = require.resolve(request);
  const mockedModule = new Module(resolvedPath, module);
  mockedModule.filename = resolvedPath;
  mockedModule.loaded = true;
  mockedModule.exports = exports;
  require.cache[resolvedPath] = mockedModule;
  return resolvedPath;
});

const adminController = require('../controllers/adminController');
delete require.cache[dbPath];
injectedModules.forEach(path => delete require.cache[path]);

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

const complianceSettingsBody = currentPassword => ({
  currentPassword,
  min_compliance: '50',
  missed_submission_deduction: 5,
  late_duty_deduction: 2,
  absent_duty_deduction: 10,
  late_submission_deduction: 10,
  quality_drop_deduction: 5,
  recovery_enabled: true,
  early_submission_bonus: 0.5,
  consecutive_early_bonus: 1,
  perfect_attendance_bonus: 0.5,
  monthly_recovery_cap: 2,
});

const setQueryRows = (resolveRows) => {
  fakeDb.query = (sql, values, callback) => {
    if (typeof values === 'function') callback = values;
    callback(null, resolveRows(sql));
  };
};

test('scholar grades use grade scale and only show outcomes after review', async () => {
  setQueryRows(sql => {
    if (sql.includes('SELECT scholar_id, year_level FROM users')) {
      return [{ scholar_id: 'SCH-1', year_level: 'College 1' }];
    }
    return [
      { semester: '1st', academic_year: '2025-2026', subject_name: 'College Passing Course', units: '3', grade: '3.00', grade_scale: 'college', verification_status: 'approved' },
      { semester: '2nd', academic_year: '2025-2026', subject_name: 'College Failing Course', units: '3', grade: '3.25', grade_scale: 'college', verification_status: 'approved' },
      { semester: '3rd', academic_year: '2025-2026', subject_name: 'K-12 Passing Course', units: '1', grade: '75', grade_scale: 'k12', verification_status: 'approved' },
      { semester: '4th', academic_year: '2025-2026', subject_name: 'Pending Course', units: '1', grade: '95', grade_scale: 'k12', verification_status: 'pending' },
    ];
  });

  const response = await invoke(adminController.getScholarGrades, { params: { id: '12' } });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.map(semester => ({
    gradeScale: semester.grade_scale,
    verification: semester.verification_status,
    outcome: semester.academic_outcome,
  })), [
    { gradeScale: 'college', verification: 'approved', outcome: 'passed' },
    { gradeScale: 'college', verification: 'approved', outcome: 'failed' },
    { gradeScale: 'k12', verification: 'approved', outcome: 'passed' },
    { gradeScale: 'k12', verification: 'pending', outcome: null },
  ]);
});

test('scholar grade summary orders semesters by latest submission date', async () => {
  setQueryRows(sql => {
    if (sql.includes('SELECT scholar_id, year_level FROM users')) {
      return [{ scholar_id: 'SCH-1', year_level: 'College 1' }];
    }
    return [
      { semester: '2nd', academic_year: '2025-2026', subject_name: 'History', units: '3', grade: '2.00', grade_scale: 'college', verification_status: 'approved', created_at: '2026-03-01T10:00:00.000Z' },
      { semester: '1st', academic_year: '2025-2026', subject_name: 'History', units: '3', grade: '1.50', grade_scale: 'college', verification_status: 'approved', created_at: '2026-09-10T10:00:00.000Z' },
      { semester: '1st', academic_year: '2025-2026', subject_name: 'Math', units: '3', grade: '1.75', grade_scale: 'college', verification_status: 'approved', created_at: '2026-09-12T10:00:00.000Z' },
    ];
  });

  const response = await invoke(adminController.getScholarGrades, { params: { id: '12' } });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.map(semester => semester.semester), ['1st', '2nd']);
  assert.equal(response.body[0].submitted_at, '2026-09-12T10:00:00.000Z');
});

test('scholar compliance summary reports official scores and reviewed academic outcomes', async () => {
  const queries = [];
  setQueryRows(sql => {
    queries.push(sql);
    if (sql.includes('SELECT scholar_id, year_level FROM users')) {
      return [{ scholar_id: 'SCH-1', year_level: 'College 1' }];
    }
    if (sql.includes('SELECT id, submission_type, status, submitted_at')) {
      return [{ id: 8, submission_type: 'letter', status: 'approved', submitted_at: '2026-03-01' }];
    }
    if (sql.includes('service_activity as name')) return [];
    if (sql.includes('SELECT status, is_makeup, check_out_at')) {
      return [
        { status: 'present' }, { status: 'late' }, { status: 'absent' }, { status: 'excused' },
      ];
    }
    return [
      { semester: '1st', academic_year: '2025-2026', units: '3', grade: '3.00', grade_scale: 'college', verification_status: 'approved' },
      { semester: '2nd', academic_year: '2025-2026', units: '1', grade: '90', grade_scale: 'k12', verification_status: 'pending' },
      { semester: '3rd', academic_year: '2025-2026', units: '1', grade: '70', grade_scale: 'k12', verification_status: 'approved' },
    ];
  });
  complianceScore = {
    overallCompliance: 83.25,
    riskScore: 16.75,
    totalDeduction: 16.75,
    totalBonusPoints: 0,
    minComplianceNum: 70,
    deductions: {
      missedSubmission: { points: 8, overdueTasks: 4, penalizedTasks: 4, allowedMissed: 0, graceCount: 0 },
      absentDuty: { points: 2, absentCount: 1 },
      lateDuty: { points: 2, lateCount: 1 },
    },
    bonuses: {},
    minCompliance: 70,
    stats: { total_service_hours: 5 },
  };

  const response = await invoke(adminController.getScholarComplianceSummary, { params: { id: '12' } });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.overall_compliance, 83.25);
  assert.equal(response.body.risk_score, 16.75);
  assert.equal(response.body.risk_level, 'low');
  assert.deepEqual(response.body.risk_thresholds, {
    low_risk_min_compliance: 75,
    medium_risk_min_compliance: 50,
  });
  assert.equal(response.body.compliance_points.total_deduction, 16.75);
  assert.equal(response.body.compliance_points.total_bonus_points, 0);
  assert.deepEqual(response.body.compliance_points.deductions, complianceScore.deductions);
  assert.deepEqual(response.body.compliance_points.bonuses, complianceScore.bonuses);
  assert.equal(response.body.community_service.total_hours, 5);
  assert.equal(Object.hasOwn(response.body, 'required_hours_to_date'), false);
  assert.equal(Object.hasOwn(response.body.community_service, 'required_hours'), false);
  assert.equal(Object.hasOwn(response.body.community_service, 'progress'), false);
  assert.deepEqual(response.body.attendance, {
    present: 1, absent: 1, late: 1, excused: 1, total: 4, rate: 25,
  });
  assert.deepEqual(response.body.academic, { passed_sems: 1, total_sems: 3 });
  assert.equal(response.body.report_submissions.items[0].submission_type, 'letter');
  assert.match(queries.find(sql => sql.includes('SELECT status, is_makeup, check_out_at')), /check_out_at IS NOT NULL/);
});

test('compliance settings save penalty and recovery rules without no-submission grace periods', async () => {
  let savedQuery;
  let savedValues;
  const passwordHash = await bcrypt.hash('current-password', 4);
  fakeDb.query = (sql, values, callback) => {
    if (sql.includes('SELECT password FROM users')) {
      callback(null, [{ password: passwordHash }]);
      return;
    }
    savedQuery = sql;
    savedValues = values;
    callback(null, {});
  };

  const response = await invoke(adminController.upsertComplianceSettings, {
    user: { id: 7 },
    body: complianceSettingsBody('current-password'),
  });

  assert.equal(response.statusCode, 200);
  assert.match(savedQuery, /late_duty_deduction/);
  assert.match(savedQuery, /recovery_enabled/);
  assert.doesNotMatch(savedQuery, /required_hours|service_hour_shortfall_deduction|extra_service_bonus|service_hours_completion_bonus/);
  assert.match(savedQuery, /late_submission_grace_count = 0/);
  assert.equal((savedQuery.match(/\?/g) || []).length, savedValues.length);
  assert.equal(savedValues.length, 16);
  assert.equal(savedValues[3], 2);
  assert.equal(savedValues[10], 1);
  assert.equal(savedValues[14], 2);
});

test('compliance settings reject missing or incorrect passwords without saving', async () => {
  const passwordHash = await bcrypt.hash('current-password', 4);
  let writeAttempted = false;
  fakeDb.query = (sql, values, callback) => {
    if (sql.includes('SELECT password FROM users')) {
      callback(null, [{ password: passwordHash }]);
      return;
    }
    writeAttempted = true;
    callback(null, {});
  };

  const missingPasswordResponse = await invoke(adminController.upsertComplianceSettings, {
    user: { id: 7 },
    body: complianceSettingsBody(''),
  });
  assert.equal(missingPasswordResponse.statusCode, 401);
  assert.equal(writeAttempted, false);

  const incorrectPasswordResponse = await invoke(adminController.upsertComplianceSettings, {
    user: { id: 7 },
    body: complianceSettingsBody('wrong-password'),
  });
  assert.equal(incorrectPasswordResponse.statusCode, 401);
  assert.equal(writeAttempted, false);
});

test('scholar risk levels follow the configured score bands', async () => {
  setQueryRows(sql => {
    if (sql.includes('SELECT scholar_id, year_level FROM users')) {
      return [{ scholar_id: 'SCH-1', year_level: 'College 1' }];
    }
    if (sql.includes('SELECT id, submission_type, status, submitted_at')) return [];
    if (sql.includes('service_activity as name')) return [];
    if (sql.includes('SELECT status, is_makeup, check_out_at')) return [];
    return [];
  });

  for (const [score, expectedLevel] of [
    [91, 'low'],
    [81, 'low'],
    [75, 'low'],
    [74.99, 'medium'],
    [50, 'medium'],
    [49.99, 'high'],
  ]) {
    complianceScore = {
      overallCompliance: score,
      riskScore: 100 - score,
      minComplianceNum: 70,
      deductions: {},
      bonuses: {},
      stats: {},
    };
    const response = await invoke(adminController.getScholarComplianceSummary, { params: { id: '12' } });
    assert.equal(response.body.risk_level, expectedLevel, `compliance score ${score}`);
    assert.equal(response.body.risk_thresholds.low_risk_min_compliance, 75);
    assert.equal(response.body.risk_thresholds.medium_risk_min_compliance, 50);
  }
});

test('scholar attendance includes duty group and recording user details', async () => {
  const queries = [];
  setQueryRows(sql => {
    queries.push(sql);
    if (sql.includes('SELECT scholar_id FROM users')) return [{ scholar_id: 'SCH-1' }];
    return [{
      group_name: 'Community Team',
      marked_by_name: 'Staff Member',
      marked_by_role: 'staff',
    }];
  });

  const response = await invoke(adminController.getScholarAttendance, { params: { id: '12' } });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body[0].group_name, 'Community Team');
  assert.equal(response.body[0].marked_by_name, 'Staff Member');
  assert.equal(response.body[0].marked_by_role, 'staff');
  assert.match(queries[1], /GROUP_CONCAT\(DISTINCT g\.group_name/);
  assert.match(queries[1], /marker\.full_name AS marked_by_name/);
  assert.match(queries[1], /da\.marked_by_id/);
});
