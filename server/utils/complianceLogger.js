const db = require('../config/db');

const GOOD_MAINTENANCE_MIN_SUBMISSIONS = 3;

const defaults = {
    min_compliance: '50.00',
    allowed_missed: 0,
    missed_submission_deduction: 5,
    late_duty_deduction: 2,
    absent_duty_deduction: 10,
    late_submission_deduction: 10,
    quality_drop_deduction: 5,
    good_maintenance_bonus: 5,
    missed_submission_grace_count: 0,
    recovery_enabled: 1,
    early_submission_bonus: 0.50,
    consecutive_early_bonus: 1.00,
    perfect_attendance_bonus: 0.50,
    monthly_recovery_cap: 2.00,
};

const clampCompliance = (value) => Math.max(0, Math.min(100, Number(value.toFixed(2))));
const parseBooleanSetting = (value) => value === true || value === 1 || value === '1' || value === 'true';
const normalizeMonthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;
const buildMonthSet = (monthsString) => new Set(
    String(monthsString || '')
        .split(',')
        .map((monthKey) => monthKey.trim())
        .filter(Boolean)
);

const calculateConsecutiveEarlyMonths = (earlyMonthSet, todayDate) => {
    if (!earlyMonthSet || earlyMonthSet.size === 0) return 0;

    let year = todayDate.getFullYear();
    let month = todayDate.getMonth() + 1;
    let count = 0;

    while (earlyMonthSet.has(normalizeMonthKey(year, month))) {
        count += 1;
        month -= 1;
        if (month === 0) {
            month = 12;
            year -= 1;
        }
        if (count >= 12) break;
    }

    return count;
};

const getComplianceRiskThresholds = () => ({
    lowRiskMinCompliance: 75,
    mediumRiskMinCompliance: 50,
});

const getComplianceRiskTier = (overallCompliance) => {
    if (overallCompliance === null || overallCompliance === undefined || overallCompliance === '') return null;
    const score = Number(overallCompliance);
    if (!Number.isFinite(score)) return null;

    if (score >= 75) return 'low';
    if (score >= 50) return 'medium';
    return 'high';
};

const hasNonOverdueComplianceViolation = (score) => {
    const deductions = score?.deductions || {};
    return Number(deductions.lateDuty?.lateCount) > 0
        || Number(deductions.absentDuty?.absentCount) > 0
        || Number(deductions.lateSubmission?.penalizedPeriods) > 0
        || (deductions.qualityDrop?.avgQuality !== null
            && deductions.qualityDrop?.avgQuality !== undefined
            && Number(deductions.qualityDrop.avgQuality) < 50);
};

const normalizeYearLevel = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^grade\s*(\d+)$/, 'grade $1')
    .replace(/^(1st|2nd|3rd|4th|5th)\s+year(?:\s+college)?$/, (_, year) => `college ${({ '1st': 1, '2nd': 2, '3rd': 3, '4th': 4, '5th': 5 })[year]}`);

const parseTaskYearLevels = (value) => {
    if (Array.isArray(value)) return value;
    try {
        const parsed = JSON.parse(value || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const getTaskSubmissionTypes = (type) => ({
    'monthly report': ['letter'],
    'report card': ['report_card', 'grades'],
    'cor upload': ['cor'],
    'other documents': ['other'],
})[String(type || '').trim().toLowerCase()] || [];

const toDateKey = (value) => {
    if (!value) return '';
    if (value instanceof Date) {
        return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    }
    return String(value).slice(0, 10);
};

const calculateOverdueTasksByScholar = (scholars, tasks, records, today = new Date()) => {
    const todayKey = toDateKey(today);
    const taskCounts = {};

    for (const scholar of scholars) {
        const scholarId = scholar.scholar_id;
        const yearLevel = normalizeYearLevel(scholar.year_level);
        const accountCreatedDate = toDateKey(scholar.created_at);
        const assignedOverdueTasks = tasks
            .filter((task) => {
                const dueDate = toDateKey(task.due_date);
                const taskLevels = parseTaskYearLevels(task.target_year_levels).map(normalizeYearLevel);
                return dueDate && dueDate < todayKey
                    && (!accountCreatedDate || dueDate >= accountCreatedDate)
                    && getTaskSubmissionTypes(task.type).length > 0
                    && (!taskLevels.length || taskLevels.includes(yearLevel));
            })
            .sort((a, b) => toDateKey(a.due_date).localeCompare(toDateKey(b.due_date)));

        const scholarRecords = records
            .filter((record) => record.scholar_id === scholarId)
            .sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime());
        const usedRecordIds = new Set();
        let overdueCount = 0;

        for (const task of assignedOverdueTasks) {
            const acceptedTypes = getTaskSubmissionTypes(task.type);
            const createdAt = new Date(task.created_at || 0).getTime();
            const dueAt = new Date(`${toDateKey(task.due_date)}T23:59:59.999`).getTime();
            const matchingRecord = scholarRecords.find((record) => {
                const submittedAt = new Date(record.submitted_at || 0).getTime();
                return !usedRecordIds.has(record.record_key)
                    && acceptedTypes.includes(String(record.submission_type || '').toLowerCase())
                    && submittedAt >= createdAt
                    && submittedAt <= dueAt;
            });

            if (matchingRecord) {
                usedRecordIds.add(matchingRecord.record_key);
            } else {
                overdueCount += 1;
            }
        }

        taskCounts[scholarId] = overdueCount;
    }

    return taskCounts;
};

const getOverdueComplianceTaskCounts = (scholars, today, callback) => {
    if (!scholars.length) return callback(null, {});
    const scholarIds = scholars.map((scholar) => scholar.scholar_id);
    const placeholders = scholarIds.map(() => '?').join(', ');

    db.query(
        `SELECT id, type, due_date, created_at, target_year_levels
         FROM tasks
         WHERE is_active = 1 AND due_date IS NOT NULL AND due_date < CURRENT_DATE()`,
        (taskErr, tasks) => {
            if (taskErr) return callback(taskErr);
            db.query(
                `SELECT CONCAT('submission:', id) AS record_key, scholar_id, submission_type, submitted_at
                 FROM submissions WHERE scholar_id IN (${placeholders})
                 UNION ALL
                 SELECT CONCAT('grade:', id) AS record_key, scholar_id, 'grades' AS submission_type, created_at AS submitted_at
                 FROM grades WHERE scholar_id IN (${placeholders})`,
                [...scholarIds, ...scholarIds],
                (recordErr, records) => {
                    if (recordErr) return callback(recordErr);
                    callback(null, calculateOverdueTasksByScholar(scholars, tasks, records, today));
                }
            );
        }
    );
};

const getPreviousMonthKey = (monthKey) => {
    const [year, month] = monthKey.split('-').map(Number);
    const previousDate = new Date(year, month - 2, 1);
    return normalizeMonthKey(previousDate.getFullYear(), previousDate.getMonth() + 1);
};

const calculateMonthlyRecoveryBonuses = ({
    earlySubmissionMonths,
    dutyMonths,
    imperfectDutyMonths,
    settings,
}) => {
    const earlyBonus = Number(settings.earlySubmissionBonus ?? defaults.early_submission_bonus);
    const consecutiveBonus = Number(settings.consecutiveEarlyBonus ?? defaults.consecutive_early_bonus);
    const attendanceBonus = Number(settings.perfectAttendanceBonus ?? defaults.perfect_attendance_bonus);
    const configuredCap = Number(settings.monthlyRecoveryCap ?? defaults.monthly_recovery_cap);
    const monthlyCap = Number.isFinite(configuredCap) ? Math.max(0, configuredCap) : defaults.monthly_recovery_cap;
    const bonusTotalsInCents = { earlySubmission: 0, consecutiveEarly: 0, perfectAttendance: 0 };
    const monthlyCapInCents = Math.round(monthlyCap * 100);
    const earlyMonths = new Set([...earlySubmissionMonths].filter((month) => /^\d{4}-\d{2}$/.test(month)));
    const allMonths = new Set([
        ...earlyMonths,
        ...[...dutyMonths].filter((month) => /^\d{4}-\d{2}$/.test(month)),
    ]);

    for (const month of allMonths) {
        const monthBonuses = {
            earlySubmission: earlyMonths.has(month) ? earlyBonus : 0,
            consecutiveEarly: earlyMonths.has(month) && earlyMonths.has(getPreviousMonthKey(month))
                ? consecutiveBonus
                : 0,
            perfectAttendance: dutyMonths.has(month) && !imperfectDutyMonths.has(month)
                ? attendanceBonus
                : 0,
        };
        const monthlyTotal = Object.values(monthBonuses).reduce((sum, value) => sum + value, 0);
        const scale = monthlyTotal > monthlyCap && monthlyTotal > 0 ? monthlyCap / monthlyTotal : 1;
        let allocatedCents = 0;

        for (const key of Object.keys(bonusTotalsInCents)) {
            const pointsInCents = Math.min(
                monthlyCapInCents - allocatedCents,
                Math.round(monthBonuses[key] * scale * 100)
            );
            bonusTotalsInCents[key] += pointsInCents;
            allocatedCents += pointsInCents;
        }
    }

    const bonusTotals = Object.fromEntries(
        Object.entries(bonusTotalsInCents).map(([key, value]) => [key, value / 100])
    );
    const totalBonusPoints = Object.values(bonusTotalsInCents).reduce((sum, value) => sum + value, 0) / 100;
    return { ...bonusTotals, totalBonusPoints };
};

const getComplianceSettings = (callback) => {
    db.query(
        `
            SELECT id, min_compliance, allowed_missed,
                missed_submission_deduction, late_duty_deduction,
                absent_duty_deduction, late_submission_deduction,
                negative_letter_deduction, quality_drop_deduction,
                good_maintenance_bonus,
                missed_submission_grace_count,
                recovery_enabled, early_submission_bonus,
                consecutive_early_bonus, perfect_attendance_bonus, monthly_recovery_cap
            FROM compliance_settings WHERE id = 1 LIMIT 1
        `,
        (err, rows) => {
            if (err) return callback(err, null);
            const settings = (rows && rows[0]) ? rows[0] : defaults;
            callback(null, settings);
        }
    );
};

const resolveGradeScale = (yearLevel) => {
    const normalized = typeof yearLevel === 'string'
        ? yearLevel.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
        : '';
    if (/^grade\s+\d+$/.test(normalized)) return 'k12';
    if (/^college\s+[1-5]$/.test(normalized)
        || /^(1st|2nd|3rd|4th|5th)\s+year(\s+college)?$/.test(normalized)) return 'college';
    return 'k12';
};

const isGradeWithinScale = (gradeScale, rawGrade) => {
    const grade = Number(rawGrade);
    if (!Number.isFinite(grade)) return false;
    if (gradeScale === 'college') return grade >= 1.00 && grade <= 5.00;
    if (gradeScale === 'k12') return grade >= 0 && grade <= 100;
    return false;
};

const normalizeAcademicGrade = (gradeScale, rawGrade) => {
    const gradeValue = Number(rawGrade);
    if (!Number.isFinite(gradeValue)) return null;

    if (gradeScale === 'k12') {
        return Math.max(0, Math.min(100, gradeValue));
    }

    if (gradeScale === 'college') {
        const collegeScaleMap = {
            1.00: 100,
            1.25: 96,
            1.50: 92,
            1.75: 88,
            2.00: 84,
            2.25: 80,
            2.50: 76,
            2.75: 72,
            3.00: 68,
            3.25: 64,
            3.50: 60,
            3.75: 56,
            4.00: 52,
            4.25: 48,
            4.50: 44,
            4.75: 40,
            5.00: 36,
        };

        const exactMatch = collegeScaleMap[gradeValue];
        if (exactMatch !== undefined) {
            return exactMatch;
        }

        const clamped = Math.max(1, Math.min(5, gradeValue));
        const floorKey = Math.floor(clamped * 4) / 4;
        const ceilKey = Math.ceil(clamped * 4) / 4;

        const floorValue = collegeScaleMap[floorKey];
        const ceilValue = collegeScaleMap[ceilKey];

        if (floorValue === undefined || ceilValue === undefined) {
            return null;
        }

        const ratio = (clamped - floorKey) / (ceilKey - floorKey || 1);
        return Math.round((floorValue + (ceilValue - floorValue) * ratio));
    }

    return null;
};

const getAcademicTier = (normalizedScore) => {
    if (normalizedScore === null || normalizedScore === undefined) return 'No Academic Record';

    if (normalizedScore >= 90) return 'Good Standing';
    if (normalizedScore >= 80) return 'Academic Watch';
    return 'Academic Probation';
};

const calculateComplianceScore = ({
    sub = null,
    att = null,
    settings = null,
    overdueTaskCount = 0,
    accountCreatedAt = null,
    today = new Date(),
}) => {
    settings = settings || defaults;
    const recoveryEnabled = parseBooleanSetting(settings.recovery_enabled ?? defaults.recovery_enabled);
    const penalties = {
        missedSubmission: settings.missed_submission_deduction ?? defaults.missed_submission_deduction,
        lateDuty: settings.late_duty_deduction ?? defaults.late_duty_deduction,
        absentDuty: settings.absent_duty_deduction ?? defaults.absent_duty_deduction,
        lateSubmission: settings.late_submission_deduction ?? defaults.late_submission_deduction,
        qualityDrop: settings.quality_drop_deduction ?? defaults.quality_drop_deduction,
        goodMaintenanceBonus: settings.good_maintenance_bonus ?? defaults.good_maintenance_bonus,
    };
    const bonusSettings = {
        earlySubmissionBonus: parseFloat(settings.early_submission_bonus ?? defaults.early_submission_bonus),
        consecutiveEarlyBonus: parseFloat(settings.consecutive_early_bonus ?? defaults.consecutive_early_bonus),
        perfectAttendanceBonus: parseFloat(settings.perfect_attendance_bonus ?? defaults.perfect_attendance_bonus),
        monthlyRecoveryCap: parseFloat(settings.monthly_recovery_cap ?? defaults.monthly_recovery_cap),
    };
    const todayDate = today instanceof Date ? today : new Date(today);
    const totalSubs = Number(sub?.total_submissions || 0);
    const totalServiceHours = Number(sub?.total_service_hours || 0);
    const rawAverageQuality = sub?.avg_quality;
    const numericAverageQuality = rawAverageQuality == null ? null : Number(rawAverageQuality);
    const avgQuality = Number.isFinite(numericAverageQuality) ? Math.round(numericAverageQuality) : null;
    const negativeLetters = Number(sub?.negative_letters || 0);
    const lastActivityDate = sub?.last_submission
        ? new Date(sub.last_submission)
        : accountCreatedAt ? new Date(accountCreatedAt) : null;
    const daysSinceSubmission = lastActivityDate && Number.isFinite(lastActivityDate.getTime())
        ? Math.floor((todayDate - lastActivityDate) / (1000 * 60 * 60 * 24))
        : null;
    const totalDuties = Number(att?.total_duties || 0);
    const presentCount = Number(att?.present || 0);
    const lateCount = Number(att?.late || 0);
    const attendanceRate = totalDuties > 0 ? Math.round((presentCount / totalDuties) * 100) : null;
    const absentCount = Number(att?.absent || 0);
    const earlySubmissionCount = Number(sub?.early_submissions || 0);
    const earlySubmissionMonthSet = buildMonthSet(sub?.early_submission_months);
    const consecutiveEarlyMonths = calculateConsecutiveEarlyMonths(earlySubmissionMonthSet, todayDate);
    const dutyMonthSet = buildMonthSet(att?.duty_months);
    const imperfectDutyMonthSet = buildMonthSet(att?.imperfect_duty_months);

    let totalDeduction = 0;
    const deductions = {};

    const rawMissingTasks = Math.max(0, Number(overdueTaskCount) || 0);
    const penalizedMissingTasks = rawMissingTasks;
    const missedSubmissionPoints = penalizedMissingTasks * penalties.missedSubmission;
    totalDeduction += missedSubmissionPoints;
    deductions.missedSubmission = {
        points: missedSubmissionPoints,
        missingReports: rawMissingTasks,
        reportsTarget: rawMissingTasks,
        overdueTasks: rawMissingTasks,
        allowedMissed: 0,
        graceCount: 0,
        penalizedTasks: penalizedMissingTasks,
        penalizedReports: penalizedMissingTasks,
    };

    const lateDutyPoints = lateCount * penalties.lateDuty;
    totalDeduction += lateDutyPoints;
    deductions.lateDuty = { points: lateDutyPoints, lateCount };

    const absentDutyPoints = attendanceRate !== null ? absentCount * penalties.absentDuty : 0;
    totalDeduction += absentDutyPoints;
    deductions.absentDuty = { points: absentDutyPoints, absentCount, attendanceRate };

    let lateSubmissionPoints = 0;
    let latePeriods = 0;
    let effectiveLatePeriods = 0;
    if (daysSinceSubmission !== null) {
        const daysLate = Math.max(0, daysSinceSubmission - 30);
        latePeriods = Math.ceil(daysLate / 30);
    }
    effectiveLatePeriods = latePeriods;
    lateSubmissionPoints = Math.min(penalties.lateSubmission * effectiveLatePeriods, penalties.lateSubmission * 2);
    totalDeduction += lateSubmissionPoints;
    deductions.lateSubmission = {
        points: lateSubmissionPoints,
        daysSinceSubmission,
        hasSubmission: Boolean(sub?.last_submission),
        latePeriods,
        graceCount: 0,
        penalizedPeriods: effectiveLatePeriods,
    };

    // Negative sentiment remains available for review and reporting, but it is
    // not a compliance deduction.
    deductions.negativeLetter = { points: 0, negativeLetters };

    let qualityDropPoints = 0;
    if (avgQuality !== null && avgQuality < 50) {
        const delta = Math.max(0, 50 - avgQuality);
        const buckets = Math.ceil(delta / 10);
        qualityDropPoints = Math.min(buckets * penalties.qualityDrop, penalties.qualityDrop * 3);
        totalDeduction += qualityDropPoints;
    }
    deductions.qualityDrop = { points: qualityDropPoints, avgQuality };

    const averageQualityAndAttendance = (avgQuality !== null && attendanceRate !== null)
        ? Math.round((avgQuality + attendanceRate) / 2)
        : null;
    const hasNoComplianceHistory = totalSubs === 0
        && totalDuties === 0
        && totalServiceHours === 0
        && negativeLetters === 0
        && avgQuality === null
        && rawMissingTasks === 0
        && lateSubmissionPoints === 0;
    const goodMaintenanceBonusPoints = averageQualityAndAttendance !== null
        && averageQualityAndAttendance >= 85
        && totalSubs >= GOOD_MAINTENANCE_MIN_SUBMISSIONS
        ? penalties.goodMaintenanceBonus
        : 0;
    if (goodMaintenanceBonusPoints > 0) {
        totalDeduction = Math.max(0, totalDeduction - goodMaintenanceBonusPoints);
    }
    deductions.goodMaintenanceBonus = {
        points: goodMaintenanceBonusPoints,
        averageQualityAndAttendance,
        totalSubs,
        minimumSubmissions: GOOD_MAINTENANCE_MIN_SUBMISSIONS,
    };

    const bonuses = recoveryEnabled
        ? calculateMonthlyRecoveryBonuses({
            earlySubmissionMonths: earlySubmissionMonthSet,
            dutyMonths: dutyMonthSet,
            imperfectDutyMonths: imperfectDutyMonthSet,
            settings: bonusSettings,
        })
        : { earlySubmission: 0, consecutiveEarly: 0, perfectAttendance: 0, totalBonusPoints: 0 };
    totalDeduction = Math.max(0, totalDeduction - bonuses.totalBonusPoints);

    if (hasNoComplianceHistory) {
        return {
            overallCompliance: 100,
            riskScore: 0,
            totalDeduction: 0,
            totalBonusPoints: 0,
            bonuses: {
                earlySubmission: 0,
                consecutiveEarly: 0,
                perfectAttendance: 0,
                totalBonusPoints: 0,
            },
            minComplianceNum: parseFloat(settings.min_compliance || defaults.min_compliance),
            deductions: {
                missedSubmission: { points: 0, missingReports: 0, reportsTarget: 0, overdueTasks: 0, allowedMissed: 0, graceCount: 0, penalizedTasks: 0, penalizedReports: 0 },
                lateDuty: { points: 0, lateCount: 0 },
                absentDuty: { points: 0, absentCount: 0, attendanceRate: 0 },
                lateSubmission: { points: 0, daysSinceSubmission, hasSubmission: false, latePeriods: 0, graceCount: 0, penalizedPeriods: 0 },
                negativeLetter: { points: 0, negativeLetters: 0 },
                qualityDrop: { points: 0, avgQuality: null },
                goodMaintenanceBonus: { points: 0, averageQualityAndAttendance: null, totalSubs: 0, minimumSubmissions: GOOD_MAINTENANCE_MIN_SUBMISSIONS },
            },
            stats: {
                total_submissions: totalSubs,
                total_service_hours: totalServiceHours,
                avg_quality: avgQuality,
                attendance_rate: attendanceRate,
                absent: absentCount,
                negative_letters: negativeLetters,
                days_since_submission: daysSinceSubmission,
                total_duties: totalDuties,
                present: presentCount,
                late: lateCount,
                early_submission_count: earlySubmissionCount,
                consecutive_early_months: consecutiveEarlyMonths,
            },
        };
    }

    const overallCompliance = clampCompliance(100 - totalDeduction);
    const riskScore = 100 - overallCompliance;
    const minComplianceNum = parseFloat(settings.min_compliance || defaults.min_compliance);

    return {
        overallCompliance,
        riskScore,
        totalDeduction,
        totalBonusPoints: bonuses.totalBonusPoints,
        bonuses,
        minComplianceNum,
        deductions,
        stats: {
            total_submissions: totalSubs,
            total_service_hours: totalServiceHours,
            avg_quality: avgQuality,
            attendance_rate: attendanceRate,
            absent: absentCount,
            negative_letters: negativeLetters,
            days_since_submission: daysSinceSubmission,
            total_duties: totalDuties,
            present: presentCount,
            late: lateCount,
            early_submission_count: earlySubmissionCount,
            consecutive_early_months: consecutiveEarlyMonths,
        },
    };
};

const calculateCurrentCompliance = (scholarId, callback) => {
    getComplianceSettings((settingsErr, settings) => {
        if (settingsErr) return callback(settingsErr, null);

        db.query(
            `
                SELECT
                    COUNT(*) AS total_submissions,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
                    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
                    AVG(quality_score) AS avg_quality,
                    SUM(CASE WHEN service_hours IS NOT NULL THEN service_hours ELSE 0 END) AS total_service_hours,
                    MAX(submitted_at) AS last_submission,
                    SUM(CASE WHEN submission_type = 'letter' AND submitted_at <= DATE_SUB(LAST_DAY(submitted_at), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS early_submissions,
                    GROUP_CONCAT(DISTINCT CASE
                        WHEN submission_type = 'letter' AND submitted_at <= DATE_SUB(LAST_DAY(submitted_at), INTERVAL 7 DAY)
                        THEN DATE_FORMAT(submitted_at, '%Y-%m')
                    END ORDER BY DATE_FORMAT(submitted_at, '%Y-%m') SEPARATOR ',') AS early_submission_months,
                    SUM(CASE WHEN sentiment_label LIKE '%Negative%' THEN 1 ELSE 0 END) AS negative_letters
                FROM submissions
                WHERE scholar_id = ?
            `,
            [scholarId],
            (subErr, subRows) => {
                if (subErr) return callback(subErr, null);
                const sub = subRows && subRows[0] ? subRows[0] : null;

                db.query(
                    `
                        SELECT
                            COUNT(*) AS total_duties,
                            SUM(CASE WHEN da.status = 'present' THEN 1 ELSE 0 END) AS present,
                            SUM(CASE WHEN da.status = 'late' THEN 1 ELSE 0 END) AS late,
                            SUM(CASE WHEN da.status = 'absent' THEN 1 ELSE 0 END) AS absent,
                            GROUP_CONCAT(DISTINCT DATE_FORMAT(COALESCE(d.duty_date, da.marked_at), '%Y-%m') ORDER BY DATE_FORMAT(COALESCE(d.duty_date, da.marked_at), '%Y-%m') SEPARATOR ',') AS duty_months,
                            GROUP_CONCAT(DISTINCT CASE WHEN COALESCE(da.status, '') <> 'present' THEN DATE_FORMAT(COALESCE(d.duty_date, da.marked_at), '%Y-%m') END ORDER BY DATE_FORMAT(COALESCE(d.duty_date, da.marked_at), '%Y-%m') SEPARATOR ',') AS imperfect_duty_months
                        FROM duty_attendance da
                        LEFT JOIN duties d ON d.id = da.duty_id
                        WHERE da.scholar_id = ?
                          AND (COALESCE(da.is_makeup, 0) = 0 OR da.check_out_at IS NOT NULL)
                    `,
                    [scholarId],
                    (attErr, attRows) => {
                        if (attErr) return callback(attErr, null);
                        const att = attRows && attRows[0] ? attRows[0] : null;

                        db.query(
                            `SELECT year_level, created_at FROM users WHERE scholar_id = ? AND role = 'scholar' LIMIT 1`,
                            [scholarId],
                            (userErr, userRows) => {
                                if (userErr) return callback(userErr, null);
                                const today = new Date();
                                getOverdueComplianceTaskCounts(
                                    [{
                                        scholar_id: scholarId,
                                        year_level: userRows[0]?.year_level,
                                        created_at: userRows[0]?.created_at,
                                    }],
                                    today,
                                    (taskErr, overdueTasksByScholar) => {
                                        if (taskErr) return callback(taskErr, null);
                                        const score = calculateComplianceScore({
                                            sub,
                                            att,
                                            settings,
                                            overdueTaskCount: overdueTasksByScholar[scholarId] || 0,
                                            accountCreatedAt: userRows[0]?.created_at,
                                            today,
                                        });
                                        callback(null, score.overallCompliance, score.minComplianceNum, score);
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    });
};

const logComplianceIncident = (scholarId, incidentType, deductionPoints, beforeCompliance, afterCompliance, details) => {
    db.query(
        `
            INSERT INTO compliance_incident_log
                (scholar_id, incident_type, deduction_points, before_compliance, after_compliance, details, triggered_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [scholarId, incidentType, deductionPoints, beforeCompliance, afterCompliance, details, null],
        (err) => {
            if (err) {
                console.error('logComplianceIncident error:', err);
            }

            db.query('SELECT email FROM users WHERE scholar_id = ? LIMIT 1', [scholarId], (userErr, userRows) => {
                if (userErr || !userRows || userRows.length === 0) return;
                const recipient = userRows[0].email;
                db.query(
                    'INSERT INTO notification_logs (scholar_id, recipient, channel, type, status, detail) VALUES (?, ?, ?, ?, ?, ?)',
                    [scholarId, recipient, 'system', 'compliance_flag_triggered', 'generated', `${incidentType}: ${details || 'Compliance flag triggered.'}`],
                    () => { /* ignore logging errors */ }
                );
            });
        }
    );
};

module.exports = {
    defaults,
    clampCompliance,
    getComplianceRiskThresholds,
    getComplianceRiskTier,
    hasNonOverdueComplianceViolation,
    getComplianceSettings,
    resolveGradeScale,
    isGradeWithinScale,
    normalizeAcademicGrade,
    getAcademicTier,
    calculateComplianceScore,
    calculateOverdueTasksByScholar,
    getOverdueComplianceTaskCounts,
    calculateCurrentCompliance,
    logComplianceIncident,
};
