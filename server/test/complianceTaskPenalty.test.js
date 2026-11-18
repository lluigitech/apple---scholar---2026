const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const compliancePath = require.resolve('../utils/complianceLogger');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db' && parent.filename === compliancePath) {
    return { query() { throw new Error('Database access is not expected in this test.'); } };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const {
  calculateComplianceScore,
  calculateOverdueTasksByScholar,
  hasNonOverdueComplianceViolation,
  getComplianceRiskTier,
  getComplianceRiskThresholds,
  defaults,
} = require('../utils/complianceLogger');
Module._load = originalLoad;

test('overdue required tasks are counted only for assigned scholars and matching task submissions', () => {
  const counts = calculateOverdueTasksByScholar(
    [
      { scholar_id: 'A-001', year_level: '1st Year College' },
      { scholar_id: 'A-002', year_level: 'Grade 10' },
    ],
    [
      { id: 1, type: 'Monthly Report', due_date: '2026-10-10', created_at: '2026-10-01 08:00:00', target_year_levels: '["College 1"]' },
      { id: 2, type: 'Report Card', due_date: '2026-10-12', created_at: '2026-10-02 08:00:00', target_year_levels: '["Grade 10"]' },
      { id: 3, type: 'COR Upload', due_date: '2026-10-15', created_at: '2026-10-03 08:00:00', target_year_levels: '[]' },
      { id: 4, type: 'Other Documents', due_date: '2026-10-16', created_at: '2026-10-03 08:00:00', target_year_levels: '["College 2"]' },
      { id: 5, type: 'Other Documents', due_date: '2026-10-20', created_at: '2026-10-03 08:00:00', target_year_levels: '["Grade 10"]' },
    ],
    [
      { record_key: 'submission:1', scholar_id: 'A-001', submission_type: 'letter', submitted_at: '2026-10-08 10:00:00' },
      { record_key: 'grade:1', scholar_id: 'A-002', submission_type: 'grades', submitted_at: '2026-10-10 10:00:00' },
    ],
    new Date(2026, 9, 27)
  );

  assert.deepEqual(counts, { 'A-001': 1, 'A-002': 2 });
});

test('new scholars are not penalized for required tasks that were already overdue before account creation', () => {
  const createdAt = '2026-10-27 09:00:00';
  const overdueTaskCount = calculateOverdueTasksByScholar(
    [{ scholar_id: 'NEW-001', year_level: 'Grade 10', created_at: createdAt }],
    [
      { id: 1, type: 'Monthly Report', due_date: '2026-10-10', created_at: '2026-10-01 08:00:00', target_year_levels: '["Grade 10"]' },
      { id: 2, type: 'Monthly Report', due_date: '2026-10-25', created_at: '2026-10-01 08:00:00', target_year_levels: '["Grade 10"]' },
    ],
    [],
    new Date(2026, 9, 27)
  )['NEW-001'];
  const score = calculateComplianceScore({
    settings: { ...defaults },
    overdueTaskCount,
    sub: null,
    att: null,
    today: new Date(2026, 9, 27),
  });

  assert.equal(overdueTaskCount, 0);
  assert.equal(score.overallCompliance, 100);
});

test('every overdue task incurs the configured deduction without allowance or grace', () => {
  const settings = {
    ...defaults,
    allowed_missed: 10,
    missed_submission_grace_count: 10,
    missed_submission_deduction: 5,
    late_duty_deduction: 0,
    absent_duty_deduction: 0,
    late_submission_deduction: 0,
    quality_drop_deduction: 0,
    good_maintenance_bonus: 0,
    recovery_enabled: 0,
  };
  const score = calculateComplianceScore({
    settings,
    overdueTaskCount: 3,
    sub: {
      total_submissions: 1,
      total_service_hours: 0,
      avg_quality: 100,
      last_submission: new Date(2026, 9, 27),
    },
    att: { total_duties: 1, present: 1, absent: 0 },
    today: new Date(2026, 9, 27),
  });

  assert.equal(score.deductions.missedSubmission.overdueTasks, 3);
  assert.equal(score.deductions.missedSubmission.penalizedTasks, 3);
  assert.equal(score.deductions.missedSubmission.allowedMissed, 0);
  assert.equal(score.deductions.missedSubmission.graceCount, 0);
  assert.equal(score.deductions.missedSubmission.points, 15);
  assert.equal(score.overallCompliance, 85);
});

test('default penalty values deduct for overdue tasks, absences, and low-quality submissions', () => {
  const today = new Date(2026, 9, 27);
  const score = calculateComplianceScore({
    settings: {
      ...defaults,
      missed_submission_deduction: 5,
      late_duty_deduction: 0,
      absent_duty_deduction: 10,
      late_submission_deduction: 0,
      quality_drop_deduction: 5,
      good_maintenance_bonus: 0,
    },
    overdueTaskCount: 1,
    sub: {
      total_submissions: 1,
      total_service_hours: 0,
      avg_quality: 40,
      last_submission: today,
    },
    att: { total_duties: 1, present: 0, absent: 1 },
    today,
  });

  assert.equal(score.deductions.missedSubmission.points, 5);
  assert.equal(score.deductions.absentDuty.points, 10);
  assert.equal(score.deductions.qualityDrop.points, 5);
  assert.equal(score.overallCompliance, 80);
  assert.equal(hasNonOverdueComplianceViolation(score), true);
});

test('quality deductions start below 50 and increase by each 10-point band', () => {
  const today = new Date(2026, 9, 27);
  const settings = {
    ...defaults,
    missed_submission_deduction: 0,
    late_duty_deduction: 0,
    absent_duty_deduction: 0,
    late_submission_deduction: 0,
    quality_drop_deduction: 5,
    good_maintenance_bonus: 0,
  };
  const qualityPenalty = quality => calculateComplianceScore({
    settings,
    sub: {
      total_submissions: 1,
      avg_quality: quality,
      last_submission: today,
    },
    att: null,
    today,
  }).deductions.qualityDrop.points;

  assert.equal(qualityPenalty(50), 0);
  assert.equal(qualityPenalty(49), 5);
  assert.equal(qualityPenalty(40), 5);
  assert.equal(qualityPenalty(39), 10);
  assert.equal(qualityPenalty(0), 15);
});

test('recovery bonuses are capped per month and accumulate across eligible months', () => {
  const today = new Date(2026, 9, 27);
  const sub = {
    total_submissions: 3,
    total_service_hours: 0,
    avg_quality: 100,
    early_submissions: 3,
    early_submission_months: '2026-08,2026-09,2026-10',
    last_submission: today,
  };
  const att = {
    total_duties: 2,
    present: 1,
    absent: 0,
    duty_months: '2026-09,2026-10',
    imperfect_duty_months: '2026-09',
  };
  const score = calculateComplianceScore({
    settings: {
      ...defaults,
      recovery_enabled: 1,
      early_submission_bonus: 0.50,
      consecutive_early_bonus: 1,
      perfect_attendance_bonus: 0.50,
      monthly_recovery_cap: 2,
    },
    sub,
    att,
    overdueTaskCount: 1,
    today,
  });

  assert.equal(score.overallCompliance, 99);
  assert.equal(score.totalDeduction, 1);
  assert.equal(score.totalBonusPoints, 4);
  assert.deepEqual(score.bonuses, {
    earlySubmission: 1.5,
    consecutiveEarly: 2,
    perfectAttendance: 0.5,
    totalBonusPoints: 4,
  });
  assert.equal(score.stats.early_submission_count, 3);
  assert.equal(score.stats.consecutive_early_months, 3);

  const disabledScore = calculateComplianceScore({
    settings: { ...defaults, recovery_enabled: 0 },
    sub,
    att,
    overdueTaskCount: 1,
    today,
  });
  assert.equal(disabledScore.totalBonusPoints, 0);
  assert.equal(disabledScore.totalDeduction, 5);
  assert.equal(disabledScore.bonuses.earlySubmission, 0);
});

test('long submission gaps start after 30 days and increase every 30 days, capped at twice the configured amount', () => {
  const settings = {
    ...defaults,
    missed_submission_deduction: 0,
    late_duty_deduction: 0,
    absent_duty_deduction: 0,
    late_submission_deduction: defaults.late_submission_deduction,
    quality_drop_deduction: 0,
    good_maintenance_bonus: 0,
  };
  const sub = {
    total_submissions: 1,
    total_service_hours: 0,
    avg_quality: 100,
    last_submission: new Date(2026, 6, 1),
  };
  const att = { total_duties: 1, present: 1, absent: 0 };

  const firstPenalty = calculateComplianceScore({
    settings,
    sub: { ...sub, last_submission: new Date(2026, 7, 2) },
    att,
    today: new Date(2026, 9, 1),
  });
  assert.equal(firstPenalty.deductions.lateSubmission.points, 10);

  const secondPenalty = calculateComplianceScore({
    settings,
    sub: { ...sub, last_submission: new Date(2026, 7, 1) },
    att,
    today: new Date(2026, 9, 1),
  });
  assert.equal(secondPenalty.deductions.lateSubmission.points, 20);

  const maximumPenalty = calculateComplianceScore({
    settings,
    sub: { ...sub, last_submission: new Date(2026, 3, 1) },
    att,
    today: new Date(2026, 9, 1),
  });
  assert.equal(maximumPenalty.deductions.lateSubmission.points, 20);
});

test('scholars with no submissions get 30 days from account creation before the long-gap penalty', () => {
  const settings = { ...defaults, late_submission_deduction: 10, recovery_enabled: 0 };
  const today = new Date(2026, 10, 1);
  const baseInput = {
    settings,
    sub: null,
    att: null,
    today,
  };

  const withinInitialPeriod = calculateComplianceScore({
    ...baseInput,
    accountCreatedAt: new Date(2026, 9, 2),
  });
  assert.equal(withinInitialPeriod.deductions.lateSubmission.points, 0);
  assert.equal(withinInitialPeriod.overallCompliance, 100);

  const beyondInitialPeriod = calculateComplianceScore({
    ...baseInput,
    accountCreatedAt: new Date(2026, 9, 1),
  });
  assert.equal(beyondInitialPeriod.deductions.lateSubmission.points, 10);
  assert.equal(beyondInitialPeriod.overallCompliance, 90);
});

test('each late duty attendance incurs the configured deduction without a service-hour target', () => {
  const today = new Date(2026, 9, 27);
  const score = calculateComplianceScore({
    settings: {
      ...defaults,
      late_duty_deduction: 2,
      absent_duty_deduction: 0,
      late_submission_deduction: 0,
      quality_drop_deduction: 0,
      good_maintenance_bonus: 0,
    },
    sub: {
      total_submissions: 1,
      total_service_hours: 0,
      avg_quality: 100,
      last_submission: today,
    },
    att: { total_duties: 3, present: 1, late: 2, absent: 0 },
    today,
  });

  assert.equal(score.deductions.lateDuty.lateCount, 2);
  assert.equal(score.deductions.lateDuty.points, 4);
  assert.equal(score.overallCompliance, 96);
  assert.equal(hasNonOverdueComplianceViolation(score), true);
  assert.equal(Object.hasOwn(score, 'requiredHours'), false);
  assert.equal(Object.hasOwn(score.deductions, 'serviceHourShortfall'), false);
  assert.equal(Object.hasOwn(score.bonuses, 'serviceHoursCompletion'), false);
});

test('overdue assigned tasks still incur penalties when the scholar has no prior compliance history', () => {
  const score = calculateComplianceScore({
    settings: { ...defaults },
    overdueTaskCount: 5,
    sub: null,
    att: null,
    today: new Date(2026, 9, 27),
  });

  assert.equal(score.deductions.missedSubmission.overdueTasks, 5);
  assert.equal(score.deductions.missedSubmission.penalizedTasks, 5);
  assert.equal(score.deductions.missedSubmission.points, 5 * defaults.missed_submission_deduction);
});

test('risk bands classify scores below the configured minimum as high risk', () => {
  assert.equal(getComplianceRiskTier(70, 70), 'low');
  assert.equal(getComplianceRiskTier(69.99, 70), 'high');
  assert.equal(getComplianceRiskTier(50, 70), 'high');
  assert.equal(getComplianceRiskTier(49.99, 70), 'high');

  assert.deepEqual(getComplianceRiskThresholds(60), {
    lowRiskMinCompliance: 60,
  });
  assert.equal(getComplianceRiskTier(60, 60), 'low');
  assert.equal(getComplianceRiskTier(59.99, 60), 'high');
  assert.equal(getComplianceRiskTier(39.99, 60), 'high');
});

test('a lone overdue task deducts points but does not immediately trigger a compliance flag', () => {
  const score = {
    overallCompliance: 95,
    deductions: {
      missedSubmission: { overdueTasks: 1 },
      lateDuty: { lateCount: 0 },
      absentDuty: { absentCount: 0 },
      lateSubmission: { penalizedPeriods: 0 },
      qualityDrop: { avgQuality: 100 },
    },
  };
  assert.equal(getComplianceRiskTier(score.overallCompliance, 50), 'low');
  assert.equal(hasNonOverdueComplianceViolation(score), false);

  assert.equal(hasNonOverdueComplianceViolation({
    deductions: {
      missedSubmission: { overdueTasks: 0 },
      lateDuty: { lateCount: 0 },
      absentDuty: { absentCount: 0 },
      lateSubmission: { penalizedPeriods: 0 },
      qualityDrop: { avgQuality: 100 },
      goodMaintenanceBonus: { points: 5 },
    },
  }), false);
});
