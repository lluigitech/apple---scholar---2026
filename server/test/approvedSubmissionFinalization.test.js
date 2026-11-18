const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const queries = [];
let queryResponses = [];
const connection = {
  beginTransaction: async () => {},
  query: async (sql, values) => {
    queries.push({ sql, values });
    return [{ affectedRows: queries.length === 1 ? 2 : 1 }, []];
  },
  commit: async () => {},
  rollback: async () => {},
  release: () => {},
};
const fakeDb = {
  promise: () => ({
    getConnection: async () => connection,
    query: async (sql, values) => {
      queries.push({ sql, values });
      return queryResponses.shift() || [[], []];
    },
  }),
};
const fakeDbModule = new Module(dbPath, module);
fakeDbModule.filename = dbPath;
fakeDbModule.loaded = true;
fakeDbModule.exports = fakeDb;
require.cache[dbPath] = fakeDbModule;

const { finalizeApprovedSubmissions } = require('../services/approvedSubmissionFinalizationService');
const { getDonorReport, getDonorScholarReport } = require('../services/reportQueryService.js.js');

delete require.cache[dbPath];

test('approved submissions and grades are finalized without a waiting period', async () => {
  queries.length = 0;
  queryResponses = [];
  const result = await finalizeApprovedSubmissions();

  assert.deepEqual(result, { submissions_finalized: 2, grades_finalized: 1 });
  assert.equal(queries.length, 2);
  assert.match(queries[0].sql, /WHERE status = 'approved'\s+AND finalized_at IS NULL/);
  assert.match(queries[0].sql, /finalized_at = NOW\(\)/);
  assert.doesNotMatch(queries[0].sql, /DATE_SUB/);
  assert.match(queries[0].sql, /finalized_at IS NULL/);
  assert.match(queries[1].sql, /WHERE verification_status = 'approved'\s+AND finalized_at IS NULL/);
  assert.match(queries[1].sql, /finalized_at = NOW\(\)/);
  assert.doesNotMatch(queries[1].sql, /DATE_SUB/);
  assert.match(queries[1].sql, /finalized_at IS NULL/);
});

test('donor reports exclude approved submissions until they are finalized', async () => {
  queries.length = 0;
  queryResponses = [];
  await getDonorReport({});

  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /finalized_at IS NOT NULL/);
  assert.match(queries[0].sql, /status = 'approved'/);
});

test('donor hours and duties come from present attendance without required-hour targets', async () => {
  queries.length = 0;
  queryResponses = [];
  await getDonorReport({
    month: '2026-11',
    date_from: '2026-11-01',
    date_to: '2026-11-30',
    scholar_id: 'S-100',
    year_level: 'Grade 9',
  });

  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /da\.status = 'present'/);
  assert.match(queries[0].sql, /DATE_FORMAT\(d\.duty_date, '%Y-%m'\) = \?/);
  assert.match(queries[0].sql, /SUM\(CASE WHEN submission_type IN \('letter', 'monthly letter', 'monthly_letter'\) THEN 1 ELSE 0 END\) AS reports_submitted/);
  assert.deepEqual(queries[0].values, [
    '2026-11', '2026-11-01', '2026-11-30',
    '2026-11', '2026-11-01', '2026-11-30',
    '2026-11', '2026-11-01', '2026-11-30',
    'S-100', 'Grade 9', '2026-11-01', '2026-11-30',
  ]);
  assert.doesNotMatch(queries[0].sql, /COALESCE\(duty_summary\.total_duty_hours,\s*0\)/);
  assert.doesNotMatch(queries[0].sql, /required_hours/i);
});

test('individual donor reports use finalization month and explain zero verified letters accurately', async () => {
  queries.length = 0;
  queryResponses = [];
  const report = await getDonorScholarReport({ scholar_id: 'S-100', month: '2026-11' });

  assert.equal(queries.length, 9);
  assert.match(queries[2].sql, /status = 'approved'/);
  assert.match(queries[2].sql, /finalized_at IS NOT NULL/);
  assert.match(queries[2].sql, /DATE_FORMAT\(finalized_at, '%Y-%m'\) = \?/);
  assert.doesNotMatch(queries[2].sql, /DATE_FORMAT\(submitted_at, '%Y-%m'\) = \?/);
  assert.match(report.narrative, /no verified Monthly Letter submission on record/);
  assert.doesNotMatch(queries[2].sql, /required_hours/i);
  assert.match(queries[5].sql, /DATE_FORMAT\(submitted_at, '%Y-%m'\) = \?/);
  assert.match(queries[5].sql, /letter_content/);
  assert.match(queries[5].sql, /report_card_path/);
  assert.match(queries[5].sql, /cor_path/);
  assert.match(queries[6].sql, /FROM submission_media sm/);
  assert.match(queries[6].sql, /DATE_FORMAT\(s\.submitted_at, '%Y-%m'\) = \?/);
  assert.match(queries[7].sql, /FROM grades/);
  assert.match(queries[7].sql, /DATE_FORMAT\(created_at, '%Y-%m'\) = \?/);
  assert.match(queries[8].sql, /JOIN duty_group_assignments dga/);
  assert.match(queries[8].sql, /JOIN scholar_group_members gm/);
  assert.match(queries[8].sql, /LEFT JOIN duty_attendance da/);
  assert.match(queries[8].sql, /COALESCE\(da\.status, 'not_marked'\)/);
  assert.match(queries[8].sql, /DATE_FORMAT\(d\.duty_date, '%Y-%m'\) = \?/);
});

test('individual donor report returns submitted files, grade details, and duty attendance', async () => {
  queries.length = 0;
  queryResponses = [
    [[{ scholar: 'Julia Scholar', scholar_id: 'S-100', year_level: '4th Year College' }], []],
    [[{ gpa: 3.25 }], []],
    [[], []],
    [[], []],
    [[{ total_duty_hours: 2, activities_attended: 1 }], []],
    [[{
      id: 21,
      submission_type: 'letter',
      title: 'November Monthly Letter',
      submitted_at: '2026-11-12T10:00:00.000Z',
      status: 'pending',
      letter_content: 'I helped at the community center.',
      generated_pdf_path: 'r2://scholar-files/letter.pdf',
      report_card_path: null,
    }, {
      id: 22,
      submission_type: 'other',
      title: 'Other Documents',
      description: null,
      submitted_at: '2026-11-13T10:00:00.000Z',
      status: 'approved',
    }, {
      id: 23,
      submission_type: 'cor',
      title: 'COR',
      description: null,
      submitted_at: '2026-11-14T10:00:00.000Z',
      status: 'approved',
      cor_path: 'r2://scholar-files/cor.pdf',
    }], []],
    [[{
      submission_id: 21,
      file_path: 'r2://scholar-files/letter-photo.jpg',
      photo_path: null,
      description: 'Activity photo',
    }, {
      submission_id: 22,
      file_path: 'r2://scholar-files/other-document.pdf',
      photo_path: null,
      description: 'Certificate',
    }], []],
    [[{
      id: 31,
      semester: '1st',
      academic_year: '2026-2027',
      subject_name: 'Biology',
      units: 3,
      grade: 1.5,
      grade_scale: 'college',
      proof_path: 'r2://scholar-files/grades.pdf',
      verification_status: 'approved',
      created_at: '2026-11-10T10:00:00.000Z',
    }], []],
    [[{
      duty_id: 41,
      duty_title: 'Community Cleanup',
      duty_date: '2026-11-08',
      time_start: '08:00:00',
      time_end: '10:00:00',
      location: 'Community Center',
      attendance_status: 'late',
      group_name: 'Group 2',
      marked_at: '2026-11-08T08:15:00.000Z',
      check_out_at: null,
      is_makeup: 0,
    }], []],
  ];

  const report = await getDonorScholarReport({ scholar_id: 'S-100', month: '2026-11' });

  assert.equal(report.documents.find((document) => document.category === 'Monthly Letter').content, 'I helped at the community center.');
  assert.deepEqual(report.documents.find((document) => document.category === 'Monthly Letter').files, [
    { label: 'Monthly Letter', path: 'r2://scholar-files/letter.pdf' },
  ]);
  assert.deepEqual(report.documents.find((document) => document.category === 'COR').files, [
    { label: 'COR', path: 'r2://scholar-files/cor.pdf' },
  ]);
  assert.deepEqual(report.documents.find((document) => document.category === 'Other Documents').files, [
    { label: 'Certificate', path: 'r2://scholar-files/other-document.pdf' },
  ]);
  assert.equal(report.grades[0].subject_name, 'Biology');
  assert.equal(report.grades[0].proof_path, 'r2://scholar-files/grades.pdf');
  assert.equal(report.duty_attendance[0].status, 'late');
  assert.equal(report.duty_attendance[0].duty_title, 'Community Cleanup');
  assert.equal(report.duty_attendance[0].group_name, 'Group 2');
});

test('document task progress counts submitted and missing Monthly Report, COR, and grade records', async () => {
  queries.length = 0;
  queryResponses = [
    [[
      { scholar_id: 'S-1', year_level: 'Grade 9', account_created_at: '2026-01-01T00:00:00.000Z', reports_submitted: 1 },
      { scholar_id: 'S-2', year_level: 'Grade 9', account_created_at: '2026-01-02T00:00:00.000Z', reports_submitted: 0 },
      { scholar_id: 'S-3', year_level: 'Grade 10', account_created_at: '2026-01-03T00:00:00.000Z', reports_submitted: 0 },
      { scholar_id: 'S-4', year_level: 'Grade 11', account_created_at: '2026-11-10T00:00:00.000Z', reports_submitted: 0 },
    ], []],
    [[
      { id: 10, title: 'November Monthly Letter', type: 'Monthly Report', created_at: '2026-11-01T10:00:00.000Z', due_date: '2026-11-28', target_year_levels: '["Grade 9"]', reporting_month: '2026-11' },
      { id: 11, title: 'November COR', type: 'COR Upload', created_at: '2026-11-02T10:00:00.000Z', due_date: '2026-11-30', target_year_levels: '["Grade 9"]', reporting_month: '2026-11' },
      { id: 12, title: 'November Grades', type: 'Report Card', created_at: '2026-11-03T10:00:00.000Z', due_date: '2026-11-30', target_year_levels: '["Grade 10"]', reporting_month: '2026-11' },
      { id: 13, title: 'November Other Documents', type: 'Other Documents', created_at: '2026-11-04T10:00:00.000Z', due_date: '2026-11-30', target_year_levels: '["Grade 10"]', reporting_month: '2026-11' },
      { id: 14, title: 'November Grade 11 COR', type: 'COR Upload', created_at: '2026-11-03T10:00:00.000Z', due_date: '2026-11-30', target_year_levels: '["Grade 11"]', reporting_month: '2026-11' },
      { id: 15, title: 'December Grade 11 Report Card', type: 'Report Card', created_at: '2026-11-03T10:00:00.000Z', due_date: '2026-12-01', target_year_levels: '["Grade 11"]', reporting_month: '2026-12' },
    ], []],
    [[
      { scholar_id: 'S-1', submission_type: 'letter', submitted_at: '2026-11-05T10:00:00.000Z', status: 'approved' },
      { scholar_id: 'S-1', submission_type: 'cor', submitted_at: '2026-11-06T10:00:00.000Z', status: 'pending' },
      { scholar_id: 'S-3', submission_type: 'report_card', submitted_at: '2026-11-10T10:00:00.000Z', status: 'pending' },
    ], []],
    [[], []],
  ];

  const rows = await getDonorReport({ month: '2026-11' });

  assert.equal(queries.length, 4);
  assert.match(queries[1].sql, /DATE_FORMAT\(COALESCE\(due_date, created_at\), '%Y-%m'\) AS reporting_month/);
  assert.match(queries[1].sql, /'Monthly Report', 'Report Card', 'COR Upload', 'Other Documents'/);
  assert.match(queries[2].sql, /SELECT s\.scholar_id, s\.submission_type, s\.submitted_at/);
  assert.match(queries[2].sql, /s\.submission_type IN \(\?, \?, \?, \?, \?, \?, \?, \?\)/);
  assert.deepEqual(queries[2].values.slice(0, 8), [
    'letter', 'monthly letter', 'monthly_letter', 'report_card', 'grades', 'grade', 'cor', 'other',
  ]);
  assert.deepEqual(rows.map((row) => [
    row.scholar_id,
    row.submission_task_progress.map((task) => [task.task_type, task.submitted]).sort(),
  ]), [
    ['S-1', [['COR Upload', true], ['Monthly Report', true]]],
    ['S-2', [['COR Upload', false], ['Monthly Report', false]]],
    ['S-3', [['Other Documents', false], ['Report Card', true]]],
    ['S-4', []],
  ]);
  assert.equal(Object.hasOwn(rows[0], 'account_created_at'), false);
});

test('document task progress is empty when the selected month has no task', async () => {
  queries.length = 0;
  queryResponses = [
    [[
      { scholar_id: 'S-1', year_level: 'Grade 9', account_created_at: '2026-01-01T00:00:00.000Z' },
    ], []],
    [[
      { id: 12, title: 'December COR', type: 'COR Upload', created_at: '2026-11-03T10:00:00.000Z', due_date: '2026-12-01', target_year_levels: '["Grade 9"]', reporting_month: '2026-12' },
    ], []],
    [[], []],
  ];

  const rows = await getDonorReport({ month: '2026-11' });

  assert.equal(queries.length, 3);
  assert.deepEqual(rows[0].submission_task_progress, []);
});

test('donor report returns group duty rosters with present, late, and absent status', async () => {
  queries.length = 0;
  queryResponses = [
    [[
      { scholar_id: 'S-1', year_level: 'Grade 9', account_created_at: '2026-01-01T00:00:00.000Z' },
      { scholar_id: 'S-2', year_level: 'Grade 9', account_created_at: '2026-01-02T00:00:00.000Z' },
      { scholar_id: 'S-3', year_level: 'Grade 10', account_created_at: '2026-01-03T00:00:00.000Z' },
    ], []],
    [[], []],
    [[
      { duty_id: 7, duty_title: 'Community Cleanup', duty_date: '2026-11-18', time_start: '09:00:00', time_end: '12:00:00', group_id: 3, group_name: 'Group A', scholar_id: 'S-1', scholar: 'Scholar One', year_level: 'Grade 9', attendance_status: 'present' },
      { duty_id: 7, duty_title: 'Community Cleanup', duty_date: '2026-11-18', time_start: '09:00:00', time_end: '12:00:00', group_id: 3, group_name: 'Group A', scholar_id: 'S-2', scholar: 'Scholar Two', year_level: 'Grade 9', attendance_status: 'late' },
      { duty_id: 7, duty_title: 'Community Cleanup', duty_date: '2026-11-18', time_start: '09:00:00', time_end: '12:00:00', group_id: 3, group_name: 'Group A', scholar_id: 'S-3', scholar: 'Scholar Three', year_level: 'Grade 10', attendance_status: 'absent' },
    ], []],
  ];

  const rows = await getDonorReport({ month: '2026-11' });

  assert.equal(queries.length, 3);
  assert.match(queries[2].sql, /JOIN duty_group_assignments dga ON dga\.duty_id = d\.id/);
  assert.match(queries[2].sql, /COALESCE\(da\.status, 'pending'\) AS attendance_status/);
  assert.deepEqual(queries[2].values, ['2026-11']);
  assert.deepEqual(rows.map((row) => [
    row.scholar_id,
    row.duty_group_attendance.map((attendance) => attendance.attendance_status),
  ]), [
    ['S-1', ['present']],
    ['S-2', ['late']],
    ['S-3', ['absent']],
  ]);
});
