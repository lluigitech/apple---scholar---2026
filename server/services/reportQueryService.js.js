const db = require('../config/db'); // your mysql2 pool/connection
const promiseDb = db.promise();

const buildMonthPredicate = (column, month) => {
  if (!month) return '';
  return ` AND DATE_FORMAT(${column}, '%Y-%m') = ?`;
};

const monthValue = (month) => (month ? [month] : []);

const parseTaskYearLevels = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeTaskYearLevel = (value) => {
  const normalized = String(value || '').trim().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
  const aliases = {
    'grade7': 'grade 7', 'grade8': 'grade 8', 'grade9': 'grade 9',
    'grade10': 'grade 10', 'grade11': 'grade 11', 'grade12': 'grade 12',
    '1st year': 'college 1', '1st year college': 'college 1',
    '2nd year': 'college 2', '2nd year college': 'college 2',
    '3rd year': 'college 3', '3rd year college': 'college 3',
    '4th year': 'college 4', '4th year college': 'college 4',
    '5th year': 'college 5', '5th year college': 'college 5',
  };
  return aliases[normalized] || normalized;
};

const DOCUMENT_TASK_SUBMISSION_TYPES = {
  'Monthly Report': ['letter', 'monthly letter', 'monthly_letter'],
  'Report Card': ['report_card', 'grades', 'grade'],
  'COR Upload': ['cor'],
  'Other Documents': ['other'],
};
const DOCUMENT_SUBMISSION_TYPES = [...new Set(Object.values(DOCUMENT_TASK_SUBMISSION_TYPES).reduce(
  (allTypes, types) => allTypes.concat(types),
  []
))];

const timestampOf = (value) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const buildWhere = (filters) => {
  const conditions = [];
  const values = [];

  if (filters.scholar_id) {
    conditions.push('s.id = ?');
    values.push(filters.scholar_id);
  }
  if (filters.date_from) {
    conditions.push('DATE(created_at) >= ?');
    values.push(filters.date_from);
  }
  if (filters.date_to) {
    conditions.push('DATE(created_at) <= ?');
    values.push(filters.date_to);
  }

  return {
    clause: conditions.length ? 'WHERE ' + conditions.join(' AND ') : '',
    values,
  };
};

// ─── COMPLIANCE REPORT ────────────────────────────────────────────────────────
// Used for: internal monitoring, staff dashboard
const getComplianceReport = async (filters) => {
  const { clause, values } = buildWhere(filters);

  // Duty attendance
  const [dutyRows] = await promiseDb.query(
    `SELECT
       s.id            AS scholar_id,
       s.name          AS scholar,
       s.course,
       s.year_level,
       da.duty_date    AS date,
       dt.title        AS duty,
       da.status,
       da.hours_rendered AS hours
     FROM duty_attendance da
     JOIN scholars s  ON s.id = da.scholar_id
     JOIN duty_tasks dt ON dt.id = da.duty_task_id
     ${clause.replace('created_at', 'da.duty_date')}
     ORDER BY da.duty_date DESC, s.name`,
    values
  );

  // Monthly report submissions
  const [submissionRows] = await promiseDb.query(
    `SELECT
       s.id            AS scholar_id,
       s.name          AS scholar,
       sub.report_type AS type,
       sub.period,
       sub.submitted_at,
       sub.status
     FROM submissions sub
     JOIN scholars s ON s.id = sub.scholar_id
     ${clause.replace('created_at', 'sub.submitted_at')}
     ORDER BY sub.submitted_at DESC, s.name`,
    values
  );

  // Requirements (COR, grades, ID card)
  const [reqRows] = await promiseDb.query(
    `SELECT
       s.id            AS scholar_id,
       s.name          AS scholar,
       r.requirement_type AS type,
       r.semester,
       r.submitted_at,
       r.status
     FROM requirements r
     JOIN scholars s ON s.id = r.scholar_id
     ${clause.replace('created_at', 'r.submitted_at')}
     ORDER BY r.submitted_at DESC, s.name`,
    values
  );

  // Activity participation
  const [activityRows] = await promiseDb.query(
    `SELECT
       s.id            AS scholar_id,
       s.name          AS scholar,
       a.title         AS activity,
       ap.activity_date AS date,
       ap.attended,
       ap.with_photos,
       ap.photos_count
     FROM activity_participation ap
     JOIN scholars s    ON s.id = ap.scholar_id
     JOIN activities a  ON a.id = ap.activity_id
     ${clause.replace('created_at', 'ap.activity_date')}
     ORDER BY ap.activity_date DESC, s.name`,
    values
  );

  return {
    duty_attendance: dutyRows,
    submissions:     submissionRows,
    requirements:    reqRows,
    activities:      activityRows,
  };
};

// ─── DONOR REPORT ─────────────────────────────────────────────────────────────
// Summary per scholar — for donor transparency / progress report
const getDonorReport = async (filters) => {
  const gpaConditions = ["verification_status = 'approved'", 'finalized_at IS NOT NULL'];
  const submissionConditions = [
    "status = 'approved'",
    'finalized_at IS NOT NULL',
  ];
  const dutyConditions = [];
  const gpaValues = [];
  const submissionValues = [];
  const dutyValues = [];

  if (filters.month) {
    gpaConditions.push("DATE_FORMAT(finalized_at, '%Y-%m') = ?");
    submissionConditions.push("DATE_FORMAT(submitted_at, '%Y-%m') = ?");
    dutyConditions.push("DATE_FORMAT(d.duty_date, '%Y-%m') = ?");
    gpaValues.push(filters.month);
    submissionValues.push(filters.month);
    dutyValues.push(filters.month);
  }

  if (filters.date_from) {
    gpaConditions.push('DATE(finalized_at) >= ?');
    submissionConditions.push('DATE(submitted_at) >= ?');
    dutyConditions.push('DATE(d.duty_date) >= ?');
    gpaValues.push(filters.date_from);
    submissionValues.push(filters.date_from);
    dutyValues.push(filters.date_from);
  }

  if (filters.date_to) {
    gpaConditions.push('DATE(finalized_at) <= ?');
    submissionConditions.push('DATE(submitted_at) <= ?');
    dutyConditions.push('DATE(d.duty_date) <= ?');
    gpaValues.push(filters.date_to);
    submissionValues.push(filters.date_to);
    dutyValues.push(filters.date_to);
  }

  const values = [...gpaValues, ...submissionValues, ...dutyValues];
  if (filters.scholar_id) values.push(filters.scholar_id);
  if (filters.year_level) values.push(filters.year_level);
  if (filters.date_from) values.push(filters.date_from);
  if (filters.date_to) values.push(filters.date_to);

  const [rows] = await promiseDb.query(
    `SELECT
       u.scholar_id AS scholar_id,
       u.full_name AS scholar,
       u.scholar_id AS student_id,
       u.year_level,
       u.created_at AS account_created_at,
       gpa.gpa AS gpa,
       COALESCE(submission_summary.reports_submitted, 0) AS reports_submitted,
       duty_summary.total_duty_hours AS total_duty_hours,
       duty_summary.activities_attended AS activities_attended,
       NULL AS compliance_rate,
       NULL AS photos,
       NULL AS narrative,
       NULL AS milestones
     FROM users u
     LEFT JOIN (
       SELECT scholar_id,
              ROUND(SUM(CASE WHEN units > 0 THEN units * grade ELSE 0 END) / NULLIF(SUM(CASE WHEN units > 0 THEN units ELSE 0 END), 0), 2) AS gpa
       FROM grades
       WHERE ${gpaConditions.join(' AND ')}
       GROUP BY scholar_id
     ) gpa ON gpa.scholar_id = u.scholar_id
     LEFT JOIN (
       SELECT scholar_id,
              SUM(CASE WHEN submission_type IN ('letter', 'monthly letter', 'monthly_letter') THEN 1 ELSE 0 END) AS reports_submitted
       FROM submissions
       WHERE ${submissionConditions.join(' AND ')}
       GROUP BY scholar_id
     ) submission_summary ON submission_summary.scholar_id = u.scholar_id
     LEFT JOIN (
       SELECT da.scholar_id,
              ROUND(SUM(CASE WHEN da.status = 'present'
                AND (COALESCE(da.is_makeup, 0) = 0 OR da.check_out_at IS NOT NULL)
                THEN COALESCE(TIMESTAMPDIFF(MINUTE, d.time_start, d.time_end), 0) / 60 ELSE 0 END), 2) AS total_duty_hours,
              SUM(CASE WHEN da.status = 'present'
                AND (COALESCE(da.is_makeup, 0) = 0 OR da.check_out_at IS NOT NULL)
                THEN 1 ELSE 0 END) AS activities_attended
       FROM duty_attendance da
       JOIN duties d ON d.id = da.duty_id
       WHERE ${dutyConditions.length ? dutyConditions.join(' AND ') : '1 = 1'}
       GROUP BY da.scholar_id
     ) duty_summary ON duty_summary.scholar_id = u.scholar_id
     WHERE u.role = 'scholar'
       AND u.status = 'active'
       ${filters.scholar_id ? ' AND u.scholar_id = ?' : ''}
       ${filters.year_level ? ' AND u.year_level = ?' : ''}
       ${filters.date_from ? ' AND DATE(u.created_at) >= ?' : ''}
       ${filters.date_to ? ' AND DATE(u.created_at) <= ?' : ''}
     ORDER BY u.full_name ASC`,
    values
  );

  if (filters.month && rows.length) {
    const [tasks] = await promiseDb.query(
      `SELECT id, title, type, created_at, due_date, target_year_levels,
              DATE_FORMAT(COALESCE(due_date, created_at), '%Y-%m') AS reporting_month
       FROM tasks
       WHERE type IN ('Monthly Report', 'Report Card', 'COR Upload', 'Other Documents')
         AND is_active = 1`
    );
    const documentTasks = tasks.filter((task) => task.reporting_month === filters.month);

    let taskSubmissions = [];
    if (documentTasks.length) {
      const taskStart = Math.min(...documentTasks.map((task) => timestampOf(task.created_at)).filter((value) => value !== null));
      if (Number.isFinite(taskStart)) {
        const [submissions] = await promiseDb.query(
          `SELECT s.scholar_id, s.submission_type, s.submitted_at
           FROM submissions s
           JOIN users u ON u.scholar_id = s.scholar_id
           WHERE u.role = 'scholar' AND u.status = 'active'
             AND s.submission_type IN (${DOCUMENT_SUBMISSION_TYPES.map(() => '?').join(', ')})
             AND s.submitted_at >= ?`,
          [...DOCUMENT_SUBMISSION_TYPES, new Date(taskStart)]
        );
        taskSubmissions = submissions;
      }
    }

    const taskIdsForMonth = new Set(documentTasks.map((task) => String(task.id)));
    const submissionsByScholar = new Map();
    taskSubmissions.forEach((submission) => {
      const scholarSubmissions = submissionsByScholar.get(submission.scholar_id) || [];
      scholarSubmissions.push(submission);
      submissionsByScholar.set(submission.scholar_id, scholarSubmissions);
    });

    rows.forEach((row) => {
      const accountCreatedAt = timestampOf(row.account_created_at);
      const eligibleTasks = tasks
        .filter((task) => {
          const createdAt = timestampOf(task.created_at);
          if (accountCreatedAt === null || createdAt === null || createdAt <= accountCreatedAt) return false;
          const targetLevels = parseTaskYearLevels(task.target_year_levels);
          return !targetLevels.length || targetLevels.some((level) => (
            normalizeTaskYearLevel(level) === normalizeTaskYearLevel(row.year_level)
          ));
        })
        .sort((a, b) => timestampOf(b.created_at) - timestampOf(a.created_at));
      row.submission_task_progress = eligibleTasks
        .filter((task) => taskIdsForMonth.has(String(task.id)))
        .map((task) => {
          const taskSubmissionTypes = DOCUMENT_TASK_SUBMISSION_TYPES[task.type] || [];
          const submitted = (submissionsByScholar.get(row.scholar_id) || []).some((submission) => {
            if (!taskSubmissionTypes.includes(submission.submission_type)) return false;
            const submittedAt = timestampOf(submission.submitted_at);
            if (submittedAt === null || submittedAt < timestampOf(task.created_at)) return false;
            const taskAtSubmission = eligibleTasks.find((candidate) => (
              timestampOf(candidate.created_at) <= submittedAt
              && (DOCUMENT_TASK_SUBMISSION_TYPES[candidate.type] || []).includes(submission.submission_type)
            ));
            return String(taskAtSubmission?.id) === String(task.id);
          });
          return {
            task_id: task.id,
            task_type: task.type,
            task_title: task.title,
            submitted,
          };
        });
      delete row.account_created_at;
    });

    const dutyValues = [filters.month];
    if (filters.year_level) dutyValues.push(filters.year_level);
    if (filters.scholar_id) dutyValues.push(filters.scholar_id);
    const [dutyAttendanceRows] = await promiseDb.query(
      `SELECT DISTINCT
         d.id AS duty_id,
         d.title AS duty_title,
         DATE_FORMAT(d.duty_date, '%Y-%m-%d') AS duty_date,
         d.time_start,
         d.time_end,
         d.location,
         g.id AS group_id,
         g.group_name,
         u.scholar_id,
         u.full_name AS scholar,
         u.year_level,
         COALESCE(da.status, 'pending') AS attendance_status
       FROM duties d
       JOIN duty_group_assignments dga ON dga.duty_id = d.id
       JOIN scholar_groups g ON g.id = dga.group_id
       JOIN scholar_group_members gm ON gm.group_id = g.id
       JOIN users u ON u.scholar_id = gm.scholar_id
         AND u.role = 'scholar' AND u.status = 'active'
       LEFT JOIN duty_attendance da ON da.id = (
         SELECT latest_da.id
         FROM duty_attendance latest_da
         WHERE latest_da.duty_id = d.id AND latest_da.scholar_id = u.scholar_id
         ORDER BY latest_da.marked_at DESC, latest_da.id DESC
         LIMIT 1
       )
       WHERE DATE_FORMAT(d.duty_date, '%Y-%m') = ?
         AND LOWER(COALESCE(d.status, '')) <> 'cancelled'
         ${filters.year_level ? ' AND u.year_level = ?' : ''}
         ${filters.scholar_id ? ' AND u.scholar_id = ?' : ''}
       ORDER BY d.duty_date ASC, d.time_start ASC, g.group_name ASC, u.full_name ASC`,
      dutyValues
    );
    const dutyAttendanceByScholar = new Map();
    dutyAttendanceRows.forEach((attendance) => {
      const scholarDutyRows = dutyAttendanceByScholar.get(attendance.scholar_id) || [];
      scholarDutyRows.push(attendance);
      dutyAttendanceByScholar.set(attendance.scholar_id, scholarDutyRows);
    });
    rows.forEach((row) => {
      row.duty_group_attendance = dutyAttendanceByScholar.get(row.scholar_id) || [];
    });
  } else {
    rows.forEach((row) => {
      delete row.account_created_at;
      row.duty_group_attendance = [];
    });
  }

  return rows;
};

const getDonorScholarReport = async ({ scholar_id, month }) => {
  const targetId = String(scholar_id || '').trim();
  if (!targetId) {
    return { narrative: null, photos: [], milestones: [] };
  }

  const [profileRows] = await promiseDb.query(
    `SELECT full_name AS scholar, scholar_id, year_level
     FROM users
     WHERE scholar_id = ? OR id = ?
     LIMIT 1`,
    [targetId, targetId]
  );

  const profile = profileRows[0] || { scholar: 'Scholar', scholar_id: targetId, year_level: null };

  const [gpaRows] = await promiseDb.query(
    `SELECT ROUND(SUM(CASE WHEN units > 0 THEN units * grade ELSE 0 END) / NULLIF(SUM(CASE WHEN units > 0 THEN units ELSE 0 END), 0), 2) AS gpa
     FROM grades
     WHERE scholar_id = ?
       AND verification_status = 'approved'
       AND finalized_at IS NOT NULL
       ${month ? "AND DATE_FORMAT(finalized_at, '%Y-%m') = ?" : ''}`,
    month ? [targetId, month] : [targetId]
  );

  const [reportRows] = await promiseDb.query(
    `SELECT id, submission_type, submitted_at, status, letter_content
     FROM submissions
     WHERE scholar_id = ?
       AND status = 'approved'
       AND finalized_at IS NOT NULL
       ${month ? "AND DATE_FORMAT(finalized_at, '%Y-%m') = ?" : ''}
     ORDER BY submitted_at DESC`,
    month ? [targetId, month] : [targetId]
  );

  const [photoRows] = await promiseDb.query(
    `SELECT sm.file_path AS url,
            sm.description AS caption,
            sm.approved_at,
            sm.approved_for_donor
     FROM submission_media sm
     JOIN submissions s ON s.id = sm.submission_id
     WHERE s.scholar_id = ?
       AND sm.approved_for_donor = 1
       ${month ? "AND DATE_FORMAT(s.submitted_at, '%Y-%m') = ?" : ''}
     ORDER BY sm.approved_at DESC, sm.id DESC`,
    month ? [targetId, month] : [targetId]
  );

  const isMonthlyLetter = (row) => ['letter', 'monthly letter', 'monthly_letter'].includes(String(row.submission_type || '').toLowerCase());
  const latestLetter = reportRows.find(isMonthlyLetter);
  const letterText = latestLetter?.letter_content && String(latestLetter.letter_content).trim()
    ? latestLetter.letter_content.trim()
    : '';

  const gpa = gpaRows[0]?.gpa != null ? Number(gpaRows[0].gpa) : null;
  const reportsSubmitted = reportRows.filter(isMonthlyLetter).length;
  const dutyHours = await promiseDb.query(
    `SELECT ROUND(SUM(CASE WHEN da.status = 'present'
              AND (COALESCE(da.is_makeup, 0) = 0 OR da.check_out_at IS NOT NULL)
              THEN COALESCE(TIMESTAMPDIFF(MINUTE, d.time_start, d.time_end), 0) / 60 ELSE 0 END), 2) AS total_duty_hours,
            SUM(CASE WHEN da.status = 'present'
              AND (COALESCE(da.is_makeup, 0) = 0 OR da.check_out_at IS NOT NULL)
              THEN 1 ELSE 0 END) AS activities_attended
     FROM duty_attendance da
     JOIN duties d ON d.id = da.duty_id
     WHERE da.scholar_id = ?
       ${month ? "AND DATE_FORMAT(d.duty_date, '%Y-%m') = ?" : ''}`,
    month ? [targetId, month] : [targetId]
  );

  const totalDutyHours = dutyHours[0][0]?.total_duty_hours != null ? Number(dutyHours[0][0].total_duty_hours) : null;
  const activitiesAttended = dutyHours[0][0]?.activities_attended != null ? Number(dutyHours[0][0].activities_attended) : null;

  const [submittedRows] = await promiseDb.query(
    `SELECT id, submission_type, title, description, submitted_at, status, letter_content,
            generated_pdf_path, report_card_path, cor_path
     FROM submissions
     WHERE scholar_id = ?
       ${month ? "AND DATE_FORMAT(submitted_at, '%Y-%m') = ?" : ''}
     ORDER BY submitted_at DESC, id DESC`,
    month ? [targetId, month] : [targetId]
  );

  const [submissionMediaRows] = await promiseDb.query(
    `SELECT sm.submission_id, sm.file_path, sm.photo_path, sm.description
     FROM submission_media sm
     JOIN submissions s ON s.id = sm.submission_id
     WHERE s.scholar_id = ?
       ${month ? "AND DATE_FORMAT(s.submitted_at, '%Y-%m') = ?" : ''}
     ORDER BY sm.id ASC`,
    month ? [targetId, month] : [targetId]
  );

  const [gradeDetailRows] = await promiseDb.query(
    `SELECT id, semester, academic_year, subject_name, units, grade, grade_scale,
            proof_path, verification_status, created_at
     FROM grades
     WHERE scholar_id = ?
       ${month ? "AND DATE_FORMAT(created_at, '%Y-%m') = ?" : ''}
     ORDER BY created_at DESC, academic_year DESC, semester ASC, subject_name ASC`,
    month ? [targetId, month] : [targetId]
  );

  const [attendanceRows] = await promiseDb.query(
    `SELECT DISTINCT d.id AS duty_id, d.title AS duty_title, d.duty_date, d.time_start,
            d.time_end, d.location, g.group_name,
            COALESCE(da.status, 'not_marked') AS attendance_status,
            da.marked_at, da.check_out_at, COALESCE(da.is_makeup, 0) AS is_makeup
     FROM duties d
     JOIN duty_group_assignments dga ON dga.duty_id = d.id
     JOIN scholar_groups g ON g.id = dga.group_id
     JOIN scholar_group_members gm ON gm.group_id = g.id AND gm.scholar_id = ?
     LEFT JOIN duty_attendance da ON da.id = (
         SELECT latest_da.id
         FROM duty_attendance latest_da
         WHERE latest_da.duty_id = d.id
           AND latest_da.scholar_id = gm.scholar_id
         ORDER BY latest_da.marked_at DESC, latest_da.id DESC
         LIMIT 1
       )
     WHERE LOWER(COALESCE(d.status, '')) <> 'cancelled'
       ${month ? "AND DATE_FORMAT(d.duty_date, '%Y-%m') = ?" : ''}
     ORDER BY d.duty_date DESC, d.time_start DESC, d.id DESC`,
    month ? [targetId, month] : [targetId]
  );

  const clauses = [];
  if (gpa !== null) clauses.push(`maintained a GPA of ${Number(gpa).toFixed(2)}`);
  if (reportsSubmitted > 0) clauses.push(`submitted ${reportsSubmitted} progress report${reportsSubmitted === 1 ? '' : 's'}`);
  else clauses.push('has no verified Monthly Letter submission on record');
  if (totalDutyHours !== null) clauses.push(`completed ${Number(totalDutyHours).toFixed(1)} community service hour${Number(totalDutyHours) === 1 ? '' : 's'}`);
  if (activitiesAttended !== null) clauses.push(`participated in ${activitiesAttended} program activit${activitiesAttended === 1 ? 'y' : 'ies'}`);

  const narrative = letterText || (clauses.length
    ? `During this period, ${profile.scholar} ${clauses.join(', ')}.`
    : `Progress data for ${profile.scholar} is not yet available for this period.`);

  const milestones = reportRows
    .filter((row) => row.submission_type)
    .slice(0, 6)
    .map((row) => ({
      date: row.submitted_at ? new Date(row.submitted_at).toISOString().slice(0, 10) : null,
      title: String(row.submission_type || 'Submission').replace(/_/g, ' '),
      description: row.letter_content ? String(row.letter_content).replace(/\s+/g, ' ').slice(0, 180) : 'Submission recorded for the reporting period.',
    }));

  const mediaBySubmission = new Map();
  (submissionMediaRows || []).forEach((row) => {
    const files = mediaBySubmission.get(String(row.submission_id)) || [];
    [row.file_path, row.photo_path].filter(Boolean).forEach((filePath) => {
      if (!files.some((file) => file.path === filePath)) {
        files.push({ label: row.description || 'Attachment', path: filePath });
      }
    });
    mediaBySubmission.set(String(row.submission_id), files);
  });

  const documents = [];
  (submittedRows || []).forEach((row) => {
    const type = String(row.submission_type || '').toLowerCase().replace(/[\s-]+/g, '_');
    const isLetter = ['letter', 'monthly_letter', 'monthly_report'].includes(type) || Boolean(row.generated_pdf_path);
    const isCorType = type.includes('cor');
    const isGradeType = ['grade', 'grades', 'report_card'].includes(type);
    const isCor = isCorType || Boolean(row.cor_path);
    const isGrades = isGradeType || Boolean(row.report_card_path);
    const base = {
      submission_id: row.id,
      submitted_at: row.submitted_at,
      status: row.status || 'pending',
      title: row.title || row.description || null,
    };
    const filesByCategory = new Map();
    const addFiles = (category, files) => {
      if (!files.length) return;
      const current = filesByCategory.get(category) || [];
      current.push(...files);
      filesByCategory.set(category, current);
    };

    if (isLetter && row.generated_pdf_path) {
      addFiles('Monthly Letter', [{ label: 'Monthly Letter', path: row.generated_pdf_path }]);
    }
    if (row.cor_path) addFiles('COR', [{ label: 'COR', path: row.cor_path }]);
    if (row.report_card_path) addFiles('Grades', [{ label: 'Report Card', path: row.report_card_path }]);

    const directPaths = new Set([row.generated_pdf_path, row.cor_path, row.report_card_path].filter(Boolean));
    const extraFiles = (mediaBySubmission.get(String(row.id)) || []).filter((file) => !directPaths.has(file.path));
    if (extraFiles.length && !(isLetter && row.generated_pdf_path)) {
      const category = isCorType ? 'COR' : isGradeType ? 'Grades' : isLetter ? 'Monthly Letter' : 'Other Documents';
      addFiles(category, extraFiles);
    }

    const letterContent = isLetter ? String(row.letter_content || '').trim() : '';
    const otherDescription = !isLetter && !isCor && !isGrades && !extraFiles.length
      ? String(row.description || '').trim()
      : '';
    ['Monthly Letter', 'Grades', 'COR', 'Other Documents'].forEach((category) => {
      const files = filesByCategory.get(category) || [];
      const content = category === 'Monthly Letter' ? letterContent
        : category === 'Other Documents' ? otherDescription
          : '';
      if (files.length || content) {
        documents.push({
          ...base,
          id: `${row.id}-${category}`,
          category,
          files,
          content,
        });
      }
    });
  });

  return {
    scholar: profile.scholar,
    scholar_id: profile.scholar_id,
    year_level: profile.year_level,
    narrative,
    photos: (photoRows || []).map((row) => ({
      url: row.url || '',
      caption: row.caption || profile.scholar,
      approved_at: row.approved_at,
    })).filter((row) => row.url),
    documents,
    grades: (gradeDetailRows || []).map((row) => ({
      id: row.id,
      semester: row.semester,
      academic_year: row.academic_year,
      subject_name: row.subject_name,
      units: row.units,
      grade: row.grade,
      grade_scale: row.grade_scale,
      proof_path: row.proof_path || null,
      status: row.verification_status || 'pending',
      submitted_at: row.created_at,
    })),
    duty_attendance: (attendanceRows || []).map((row) => ({
      duty_id: row.duty_id,
      duty_title: row.duty_title || 'Duty',
      duty_date: row.duty_date,
      time_start: row.time_start,
      time_end: row.time_end,
      group_name: row.group_name,
      location: row.location,
      status: row.attendance_status || 'not marked',
      marked_at: row.marked_at,
      check_out_at: row.check_out_at,
      is_makeup: Boolean(row.is_makeup),
    })),
    milestones,
  };
};

// ─── AUDIT TRAIL REPORT ───────────────────────────────────────────────────────
// Full action log — for auditors / admin
const getAuditReport = async (filters) => {
  const conditions = [];
  const values = [];
  const roles = Array.isArray(filters.roles)
    ? [...new Set(filters.roles.filter((role) => ['admin', 'staff', 'officer'].includes(role)))]
    : null;

  if (roles && roles.length === 0) return [];

  if (filters.scholar_id) {
    conditions.push('al.user_id = ?');
    values.push(filters.scholar_id);
  }
  if (filters.date_from) {
    conditions.push('DATE(al.created_at) >= ?');
    values.push(filters.date_from);
  }
  if (filters.date_to) {
    conditions.push('DATE(al.created_at) <= ?');
    values.push(filters.date_to);
  }
  if (roles) {
    conditions.push(`u.role IN (${roles.map(() => '?').join(', ')})`);
    values.push(...roles);
  }

  const [rows] = await promiseDb.query(
    `SELECT
       al.id,
       al.user_id,
       al.created_at   AS timestamp,
       u.full_name     AS performed_by,
       u.role,
       al.action,
       al.module,
       al.details,
       al.ip_address
      ,al.result
     FROM audit_logs al
     JOIN users u ON u.id = al.user_id
     WHERE u.role IN ('admin', 'officer', 'staff')
       ${conditions.length ? 'AND ' + conditions.join(' AND ') : ''}
     ORDER BY al.created_at DESC
     LIMIT 5000`,
    values
  );

  return rows;
};

const getDonorDutyReport = async (filters) => {
  const conditions = ["u.role = 'scholar'", "u.status = 'active'"];
  const values = [];
  if (filters.month) { conditions.push("DATE_FORMAT(d.duty_date, '%Y-%m') = ?"); values.push(filters.month); }
  if (filters.date_from) { conditions.push('DATE(d.duty_date) >= ?'); values.push(filters.date_from); }
  if (filters.date_to) { conditions.push('DATE(d.duty_date) <= ?'); values.push(filters.date_to); }
  if (filters.scholar_id) { conditions.push('u.scholar_id = ?'); values.push(filters.scholar_id); }
  if (filters.year_level) { conditions.push('u.year_level = ?'); values.push(filters.year_level); }

  const [rows] = await promiseDb.query(
    `SELECT u.full_name AS scholar, u.year_level, d.title AS duty, d.duty_date AS date,
            CONCAT(COALESCE(DATE_FORMAT(d.time_start, '%h:%i %p'), 'time TBD'), ' - ',
                   COALESCE(DATE_FORMAT(d.time_end, '%h:%i %p'), 'time TBD')) AS schedule,
            da.status, ROUND(CASE WHEN da.status = 'present'
              AND (COALESCE(da.is_makeup, 0) = 0 OR da.check_out_at IS NOT NULL)
              THEN COALESCE(TIMESTAMPDIFF(MINUTE, d.time_start, d.time_end), 0) / 60
              ELSE 0 END, 2) AS hours,
            COALESCE(staff_names.assigned_staff, 'Unassigned') AS assigned_staff
     FROM duty_attendance da
     JOIN users u ON u.scholar_id = da.scholar_id
     JOIN duties d ON d.id = da.duty_id
     LEFT JOIN (
       SELECT dga.duty_id, gm.scholar_id,
              GROUP_CONCAT(DISTINCT staff.full_name ORDER BY staff.full_name SEPARATOR ', ') AS assigned_staff
       FROM duty_group_assignments dga
       JOIN scholar_group_members gm ON gm.group_id = dga.group_id
       LEFT JOIN scholar_groups sg ON sg.id = dga.group_id
       LEFT JOIN users staff ON staff.id = sg.assigned_staff_id AND LOWER(staff.role) = 'staff'
       GROUP BY dga.duty_id, gm.scholar_id
     ) staff_names ON staff_names.duty_id = da.duty_id AND staff_names.scholar_id = da.scholar_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY d.duty_date DESC, u.full_name ASC`,
    values
  );
  return rows;
};

const getDonorComplianceReport = async (filters) => {
  const conditions = ["u.role = 'scholar'", "u.status = 'active'"];
  const values = [];
  if (filters.month) { conditions.push("DATE_FORMAT(s.submitted_at, '%Y-%m') = ?"); values.push(filters.month); }
  if (filters.date_from) { conditions.push('DATE(s.submitted_at) >= ?'); values.push(filters.date_from); }
  if (filters.date_to) { conditions.push('DATE(s.submitted_at) <= ?'); values.push(filters.date_to); }
  if (filters.scholar_id) { conditions.push('u.scholar_id = ?'); values.push(filters.scholar_id); }
  if (filters.year_level) { conditions.push('u.year_level = ?'); values.push(filters.year_level); }

  const [rows] = await promiseDb.query(
    `SELECT u.full_name AS scholar,
            u.year_level,
            CASE
              WHEN LOWER(s.submission_type) IN ('letter', 'monthly letter', 'monthly_letter') THEN 'Monthly Letter'
              WHEN LOWER(s.submission_type) IN ('cor', 'certificate of registration', 'certificate_of_registration') THEN 'COR'
              WHEN LOWER(s.submission_type) IN ('grade', 'grades', 'grade report', 'grade_report') THEN 'Grades'
              ELSE s.submission_type
            END AS requirement,
            s.submitted_at AS submitted_at,
            s.status,
            COALESCE(s.officer_comment, s.staff_comment, '—') AS reviewer_comment
     FROM submissions s
     JOIN users u ON u.scholar_id = s.scholar_id
     WHERE ${conditions.join(' AND ')}
       AND LOWER(s.submission_type) IN ('letter', 'monthly letter', 'monthly_letter', 'cor', 'certificate of registration', 'certificate_of_registration', 'grade', 'grades', 'grade report', 'grade_report')
     ORDER BY s.submitted_at DESC, u.full_name ASC`,
    values
  );
  return rows;
};

module.exports = {
  getComplianceReport,
  getDonorReport,
  getDonorScholarReport,
  getDonorDutyReport,
  getDonorComplianceReport,
  getAuditReport,
};