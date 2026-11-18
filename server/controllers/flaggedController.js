const db = require('../config/db');
const {
    calculateComplianceScore,
    hasNonOverdueComplianceViolation,
    getComplianceRiskTier,
    getOverdueComplianceTaskCounts,
} = require('../utils/complianceLogger');
const { applyOfficerYearLevelFilter } = require('../utils/officerAssignments');
const nodemailer = require('nodemailer');

const NEGATIVE_SENTIMENT_SPREAD_MONTH_THRESHOLD = 5;
const NEGATIVE_SENTIMENT_CONSECUTIVE_MONTH_THRESHOLD = 3;

const getNegativeSentimentMonthStats = (monthList) => {
    const months = [...new Set(String(monthList || '')
        .split(',')
        .filter(month => /^\d{4}-(0[1-9]|1[0-2])$/.test(month)))].sort();
    let longestStreak = 0;
    let currentStreak = 0;
    let previousMonthIndex = null;

    months.forEach(month => {
        const [year, monthNumber] = month.split('-').map(Number);
        const monthIndex = year * 12 + monthNumber;
        currentStreak = previousMonthIndex === monthIndex - 1 ? currentStreak + 1 : 1;
        longestStreak = Math.max(longestStreak, currentStreak);
        previousMonthIndex = monthIndex;
    });

    return { monthCount: months.length, longestStreak };
};

const normalizeAcademicGrade = (gradeScale, rawGrade) => {
    const gradeValue = Number(rawGrade);
    if (!Number.isFinite(gradeValue)) return null;

    if (gradeScale === 'k12') {
        return Math.max(0, Math.min(100, gradeValue));
    }

    if (gradeScale === 'college') {
        // TODO: confirm exact values with foundation policy.
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

    // TODO: confirm exact values with foundation policy.
    if (normalizedScore >= 90) return 'Good Standing';
    if (normalizedScore >= 80) return 'Academic Watch';
    return 'Academic Probation';
};

// ─── GET FLAGGED SCHOLARS (shared ng Officer at Admin portals) ─────────
// Isang unified, proportional na compliance/risk formula.
// Walang duplicate scoring, walang double-counting, at bawat flag ay
// may kaakibat na malinaw na plain-English description.
exports.getFlaggedScholars = (req, res) => {
    const conditions = ["role = 'scholar'", "status = 'active'"];
    const values = [];
    applyOfficerYearLevelFilter(req, conditions, values).then(() => {
    const scholarSql = `
        SELECT id, scholar_id, full_name, email, year_level, status, created_at
        FROM users u
        WHERE ${conditions.join(' AND ')}
    `;

    db.query(scholarSql, values, (err, scholars) => {
        if (err) return res.status(500).json({ message: 'Failed to fetch scholars.' });
        if (scholars.length === 0) return res.json([]);

        const scholarIds = scholars.map(s => s.scholar_id);
        const placeholders = scholarIds.map(() => '?').join(', ');

        const submissionSql = `
            SELECT
                s.scholar_id,
                COUNT(*) AS total_submissions,
                SUM(CASE WHEN s.status = 'approved' THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN s.status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
                SUM(CASE WHEN s.status = 'pending'  THEN 1 ELSE 0 END) AS pending,
                AVG(s.quality_score) AS avg_quality,
                SUM(CASE WHEN s.service_hours IS NOT NULL THEN s.service_hours ELSE 0 END) AS total_service_hours,
                MAX(s.submitted_at) AS last_submission,
                SUM(CASE WHEN s.submission_type = 'letter' AND s.submitted_at <= DATE_SUB(LAST_DAY(s.submitted_at), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS early_submissions,
                GROUP_CONCAT(DISTINCT CASE
                    WHEN s.submission_type = 'letter' AND s.submitted_at <= DATE_SUB(LAST_DAY(s.submitted_at), INTERVAL 7 DAY)
                    THEN DATE_FORMAT(s.submitted_at, '%Y-%m')
                END ORDER BY DATE_FORMAT(s.submitted_at, '%Y-%m') SEPARATOR ',') AS early_submission_months,
                SUM(CASE
                    WHEN s.submission_type = 'letter'
                     AND s.sentiment_label LIKE '%Negative%'
                     AND s.submitted_at >= TIMESTAMPADD(YEAR, TIMESTAMPDIFF(YEAR, u.created_at, CURRENT_TIMESTAMP), u.created_at)
                    THEN 1 ELSE 0
                END) AS negative_letters,
                GROUP_CONCAT(DISTINCT CASE
                    WHEN s.submission_type = 'letter'
                     AND s.sentiment_label LIKE '%Negative%'
                     AND s.submitted_at >= TIMESTAMPADD(YEAR, TIMESTAMPDIFF(YEAR, u.created_at, CURRENT_TIMESTAMP), u.created_at)
                    THEN DATE_FORMAT(s.submitted_at, '%Y-%m')
                END ORDER BY DATE_FORMAT(s.submitted_at, '%Y-%m') SEPARATOR ',') AS negative_sentiment_months
            FROM submissions s
            JOIN users u ON u.scholar_id = s.scholar_id
            WHERE s.scholar_id IN (${placeholders})
            GROUP BY s.scholar_id
        `;

        const attendanceSql = `
            SELECT
                da.scholar_id,
                COUNT(*) AS total_duties,
                SUM(CASE WHEN da.status = 'present' THEN 1 ELSE 0 END) AS present,
                SUM(CASE WHEN da.status = 'late' THEN 1 ELSE 0 END) AS late,
                SUM(CASE WHEN da.status = 'absent'  THEN 1 ELSE 0 END) AS absent,
                GROUP_CONCAT(DISTINCT DATE_FORMAT(COALESCE(d.duty_date, da.marked_at), '%Y-%m') ORDER BY DATE_FORMAT(COALESCE(d.duty_date, da.marked_at), '%Y-%m') SEPARATOR ',') AS duty_months,
                GROUP_CONCAT(DISTINCT CASE WHEN COALESCE(da.status, '') <> 'present' THEN DATE_FORMAT(COALESCE(d.duty_date, da.marked_at), '%Y-%m') END ORDER BY DATE_FORMAT(COALESCE(d.duty_date, da.marked_at), '%Y-%m') SEPARATOR ',') AS imperfect_duty_months
            FROM duty_attendance da
            LEFT JOIN duties d ON d.id = da.duty_id
            WHERE da.scholar_id IN (${placeholders})
              AND (COALESCE(da.is_makeup, 0) = 0 OR da.check_out_at IS NOT NULL)
            GROUP BY da.scholar_id
        `;

        const settingsSql = `SELECT id, min_compliance, allowed_missed,
            missed_submission_deduction, late_duty_deduction,
            absent_duty_deduction, late_submission_deduction,
            negative_letter_deduction, quality_drop_deduction,
            good_maintenance_bonus,
            missed_submission_grace_count,
            recovery_enabled, early_submission_bonus,
            consecutive_early_bonus, perfect_attendance_bonus, monthly_recovery_cap
            FROM compliance_settings WHERE id = 1 LIMIT 1`;

        db.query(settingsSql, (err, settingsRows) => {
            const defaults = {
                min_compliance: '50.00',
                allowed_missed: 0,
                missed_submission_deduction: 5,
                late_duty_deduction: 2,
                absent_duty_deduction: 10,
                late_submission_deduction: 10,
                negative_letter_deduction: 1,
                quality_drop_deduction: 5,
                good_maintenance_bonus: 5,
                missed_submission_grace_count: 0,
                recovery_enabled: 1,
                early_submission_bonus: 0.50,
                consecutive_early_bonus: 1.00,
                perfect_attendance_bonus: 0.50,
                monthly_recovery_cap: 2.00,
            };
            const settings = (settingsRows && settingsRows[0]) ? settingsRows[0] : defaults;

            db.query(submissionSql, scholarIds, (err, subStats) => {
                if (err) return res.status(500).json({ message: 'Failed to fetch submission stats.' });

                db.query(attendanceSql, scholarIds, (err, attStats) => {
                    if (err) return res.status(500).json({ message: 'Failed to fetch attendance stats.' });

                    const subMap = {};
                    subStats.forEach(s => { subMap[s.scholar_id] = s; });

                    const attMap = {};
                    attStats.forEach(a => { attMap[a.scholar_id] = a; });

                    const gradesSql = `
                        SELECT g.scholar_id, g.units, g.grade, g.grade_scale
                        FROM grades g
                        WHERE g.scholar_id IN (${placeholders})
                    `;

                    db.query(gradesSql, scholarIds, (err, gradeRows) => {
                        if (err) return res.status(500).json({ message: 'Failed to fetch academic grades.' });
                        const today = new Date();
                        getOverdueComplianceTaskCounts(scholars, today, (taskErr, overdueTasksByScholar) => {
                            if (taskErr) return res.status(500).json({ message: 'Failed to calculate overdue compliance tasks.' });

                        const academicMap = {};
                        if (!err && Array.isArray(gradeRows)) {
                            const normalizedScores = {};

                            gradeRows.forEach(row => {
                                const scholarId = row.scholar_id;
                                const gradeScale = row.grade_scale || 'k12';
                                const normalizedGrade = normalizeAcademicGrade(gradeScale, row.grade);
                                const units = Number(row.units) || 0;

                                if (normalizedGrade === null || units <= 0) return;

                                if (!normalizedScores[scholarId]) {
                                    normalizedScores[scholarId] = { weightedSum: 0, totalUnits: 0 };
                                }

                                normalizedScores[scholarId].weightedSum += units * normalizedGrade;
                                normalizedScores[scholarId].totalUnits += units;
                            });

                            Object.entries(normalizedScores).forEach(([scholarId, summary]) => {
                                if (summary.totalUnits > 0) {
                                    academicMap[scholarId] = Number((summary.weightedSum / summary.totalUnits).toFixed(2));
                                }
                            });
                        }

                        const results = [];

                        scholars.forEach(scholar => {
                            const sub = subMap[scholar.scholar_id] || null;
                            const att = attMap[scholar.scholar_id] || null;

                            const normalizedAcademicScore = academicMap[scholar.scholar_id] !== undefined
                                ? academicMap[scholar.scholar_id]
                                : null;
                            const academicStatus = getAcademicTier(normalizedAcademicScore);

                            const score = calculateComplianceScore({
                                sub,
                                att,
                                settings,
                                overdueTaskCount: overdueTasksByScholar[scholar.scholar_id] || 0,
                                accountCreatedAt: scholar.created_at,
                                today,
                            });
                            const overallCompliance = score.overallCompliance;
                            const riskLevel = getComplianceRiskTier(overallCompliance, score.minComplianceNum);
                            const negativeSentimentMonthStats = getNegativeSentimentMonthStats(sub?.negative_sentiment_months);
                            const hasScatteredNegativeSentimentFlag = negativeSentimentMonthStats.monthCount >= NEGATIVE_SENTIMENT_SPREAD_MONTH_THRESHOLD;
                            const hasConsecutiveNegativeSentimentFlag = negativeSentimentMonthStats.longestStreak >= NEGATIVE_SENTIMENT_CONSECUTIVE_MONTH_THRESHOLD;
                            const hasNegativeSentimentFlag = hasScatteredNegativeSentimentFlag || hasConsecutiveNegativeSentimentFlag;
                            const flags = [];

                            const addFlag = (type, description, severity) => {
                                flags.push({ type, description, severity });
                            };

                            if (overallCompliance < score.minComplianceNum) {
                                addFlag(
                                    'Below Minimum Compliance',
                                    `Compliance score is ${overallCompliance.toFixed(2)}%, below the required ${score.minComplianceNum.toFixed(2)}%.`,
                                    riskLevel
                                );
                            }

                            if (score.deductions.missedSubmission.overdueTasks > 0) {
                                addFlag(
                                    'Overdue Compliance Tasks',
                                    `${score.deductions.missedSubmission.penalizedTasks} overdue required task${score.deductions.missedSubmission.penalizedTasks === 1 ? '' : 's'} incurred an immediate deduction.`,
                                    score.deductions.missedSubmission.penalizedTasks >= 2 ? 'high' : 'medium'
                                );
                            }

                            if (score.deductions.lateDuty.lateCount > 0) {
                                addFlag(
                                    'Late to Duty',
                                    `${score.deductions.lateDuty.lateCount} late duty attendance${score.deductions.lateDuty.lateCount === 1 ? '' : 's'} incurred a ${score.deductions.lateDuty.points}-point deduction.`,
                                    score.deductions.lateDuty.lateCount >= 3 ? 'high' : 'medium'
                                );
                            }

                            if (score.deductions.absentDuty.absentCount > 0) {
                                addFlag(
                                    'Absent Duty',
                                    `${score.deductions.absentDuty.absentCount} missed duty attendance${score.deductions.absentDuty.absentCount === 1 ? '' : 's'} out of ${score.stats.total_duties}`,
                                    score.deductions.absentDuty.absentCount >= 2 ? 'high' : 'medium'
                                );
                            }

                            if (score.deductions.lateSubmission.penalizedPeriods > 0) {
                                addFlag(
                                    'Late Submission',
                                    score.deductions.lateSubmission.daysSinceSubmission === null
                                        ? 'No reports submitted yet.'
                                        : `No submission for ${score.deductions.lateSubmission.daysSinceSubmission} days; the long-gap rule deducted ${score.deductions.lateSubmission.points} points.`,
                                    score.deductions.lateSubmission.daysSinceSubmission === null ? 'high' : 'medium'
                                );
                            }

                            if (hasNegativeSentimentFlag) {
                                const sentimentFlagReasons = [];
                                if (hasScatteredNegativeSentimentFlag) {
                                    sentimentFlagReasons.push(`${negativeSentimentMonthStats.monthCount} different months`);
                                }
                                if (hasConsecutiveNegativeSentimentFlag) {
                                    sentimentFlagReasons.push(`${negativeSentimentMonthStats.longestStreak} consecutive months`);
                                }
                                addFlag(
                                    'Negative Sentiment',
                                    `Negative sentiment detected in ${sentimentFlagReasons.join(' and ')} this account year; review the scholar's situation.`,
                                    'medium'
                                );
                            }

                            if (score.deductions.qualityDrop.avgQuality !== null
                                && score.deductions.qualityDrop.avgQuality < 50) {
                                addFlag(
                                    'Low Quality Score',
                                    `Average submission quality is ${score.deductions.qualityDrop.avgQuality}%`,
                                    score.deductions.qualityDrop.avgQuality < 50 ? 'high' : 'medium'
                                );
                            }

                            if (riskLevel === 'low' && !hasNonOverdueComplianceViolation(score) && !hasNegativeSentimentFlag) return;

                            results.push({
                                scholar_id:   scholar.scholar_id,
                                full_name:    scholar.full_name,
                                email:        scholar.email,
                                year_level:   scholar.year_level || 'N/A',
                                risk_score:   score.riskScore,
                                overall_compliance: overallCompliance,
                                total_deduction: score.totalDeduction,
                                deductions: score.deductions,
                                bonuses: score.bonuses,
                                negative_sentiment_month_count: negativeSentimentMonthStats.monthCount,
                                negative_sentiment_consecutive_months: negativeSentimentMonthStats.longestStreak,
                                negative_sentiment_spread_month_threshold: NEGATIVE_SENTIMENT_SPREAD_MONTH_THRESHOLD,
                                negative_sentiment_consecutive_month_threshold: NEGATIVE_SENTIMENT_CONSECUTIVE_MONTH_THRESHOLD,
                                risk_level:   riskLevel,
                                flags,
                                academic_status: academicStatus,
                                stats: {
                                    total_submissions:    sub?.total_submissions || 0,
                                    approved:             sub?.approved || 0,
                                    rejected:             sub?.rejected || 0,
                                    avg_quality:          sub?.avg_quality ? Math.round(sub.avg_quality) : 0,
                                    attendance_rate:      score.stats.attendance_rate ?? 0,
                                    total_duties:         score.stats.total_duties,
                                    present:              score.stats.present,
                                    late:                 score.stats.late,
                                    absent:               score.stats.absent,
                                    negative_letters:     score.stats.negative_letters,
                                    gwa: normalizedAcademicScore,
                                    min_compliance:        score.minComplianceNum,
                                    days_since_submission: score.stats.days_since_submission,
                                    last_submission:      sub?.last_submission || null,
                                },
                            });
                        });

                        results.sort((a, b) => b.risk_score - a.risk_score);
                        res.json(results);
                        });
                    });
                });
            });
        });
    });
    }).catch(() => res.status(500).json({ message: 'Failed to resolve officer assignments.' }));
};

// ─── LOG HOME VISIT REQUEST ─────────────────────────────────────────
// Called right before the frontend opens the Gmail compose window.
// Just records that a home visit was requested for this scholar, by
// whom (if the auth middleware sets req.user), and any note attached.
exports.logHomeVisit = (req, res) => {
    const { scholarId } = req.params;
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : null;

    if (!scholarId) {
        return res.status(400).json({ message: 'scholarId is required.' });
    }

    // If your auth middleware decodes the JWT and attaches the user to
    // req.user (e.g. { id, role, ... }), this will pick it up automatically.
    // If it doesn't yet, performed_by just stays null — safe either way.
    const performedBy = req.user?.id || null;

    const sql = `
        INSERT INTO scholar_interventions (scholar_id, type, note, performed_by)
        VALUES (?, 'home_visit', ?, ?)
    `;

    db.query(sql, [scholarId, note || null, performedBy], (err, result) => {
        if (err) {
            console.error('logHomeVisit error:', err);
            return res.status(500).json({ message: 'Failed to log home visit request.' });
        }
        res.status(201).json({
            message: 'Home visit request logged.',
            intervention: {
                id: result.insertId,
                scholar_id: scholarId,
                type: 'home_visit',
                note: note || null,
                performed_by: performedBy,
                created_at: new Date().toISOString(),
            },
        });
    });
};

exports.logCaseNote = (req, res) => {
    const { scholarId } = req.params;
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

    if (!scholarId) {
        return res.status(400).json({ message: 'scholarId is required.' });
    }
    if (!note || note.length > 5000) {
        return res.status(400).json({ message: 'A case note between 1 and 5000 characters is required.' });
    }

    const performedBy = req.user?.id || null;
    db.query(
        `INSERT INTO scholar_interventions (scholar_id, type, note, performed_by)
         VALUES (?, 'case_note', ?, ?)`,
        [scholarId, note, performedBy],
        (err, result) => {
            if (err) {
                console.error('logCaseNote error:', err);
                return res.status(500).json({ message: 'Failed to save case note.' });
            }
            return res.status(201).json({
                message: 'Case note saved.',
                intervention: {
                    id: result.insertId,
                    scholar_id: scholarId,
                    type: 'case_note',
                    note,
                    performed_by: performedBy,
                    created_at: new Date().toISOString(),
                },
            });
        }
    );
};

// ─── LOG CONTACT SCHOLAR ACTION ─────────────────────────────────────
// Called when staff clicks "Contact Scholar" (mailto link), so there's
// a record of who was contacted and when.
exports.logContact = (req, res) => {
    const { scholarId } = req.params;
    const { note } = req.body || {};

    if (!scholarId) {
        return res.status(400).json({ message: 'scholarId is required.' });
    }

    const performedBy = req.user?.id || null;

    const sql = `
        INSERT INTO scholar_interventions (scholar_id, type, note, performed_by)
        VALUES (?, 'contact', ?, ?)
    `;

    db.query(sql, [scholarId, note || null, performedBy], (err, result) => {
        if (err) {
            console.error('logContact error:', err);
            return res.status(500).json({ message: 'Failed to log contact action.' });
        }
        res.status(201).json({ message: 'Contact action logged.', id: result.insertId });
    });
};

// ─── GET INTERVENTION HISTORY FOR A SCHOLAR ─────────────────────────
// Optional but handy: powers a "history" list under a scholar card
// showing every home visit / contact action logged for them.
exports.getInterventions = (req, res) => {
    const { scholarId } = req.params;

    if (!scholarId) {
        return res.status(400).json({ message: 'scholarId is required.' });
    }

    const sql = `
        SELECT id, scholar_id, type, note, performed_by, created_at
        FROM scholar_interventions
        WHERE scholar_id = ?
        ORDER BY created_at DESC
    `;

    db.query(sql, [scholarId], (err, rows) => {
        if (err) {
            console.error('getInterventions error:', err);
            return res.status(500).json({ message: 'Failed to fetch intervention history.' });
        }
        res.json(rows);
    });
};

exports.remindScholar = async (req, res) => {
    const { scholarId } = req.params;
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    try {
        const rows = await new Promise((resolve, reject) => {
            db.query(
                `SELECT scholar_id, full_name, email FROM users
                 WHERE scholar_id = ? AND role = 'scholar' AND status = 'active' LIMIT 1`,
                [scholarId],
                (err, data) => err ? reject(err) : resolve(data)
            );
        });
        if (!rows.length) return res.status(404).json({ error: 'Scholar not found.' });
        if (!rows[0].email) return res.status(400).json({ error: 'Scholar has no email address.' });

        const host = process.env.SMTP_HOST;
        const port = process.env.SMTP_PORT;
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        if (!host || !port || !user || !pass) return res.status(503).json({ error: 'Email service is not configured.' });

        const transporter = nodemailer.createTransport({ host, port: Number(port), secure: Number(port) === 465, auth: { user, pass } });
        const subject = 'Apple Scholar reminder: please review your compliance status';
        const text = `Hello ${rows[0].full_name || 'Scholar'},\n\nThis is a reminder to review your pending scholar requirements and submissions in the Apple Scholar portal.\n${note ? `\nNote from the scholarship team:\n${note}\n` : ''}\nPlease log in to check your current compliance status.\n\nThank you,\nApple Scholar Team`;
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: rows[0].email,
            subject,
            text,
        });

        await new Promise((resolve) => db.query(
            `INSERT INTO notification_logs (scholar_id, recipient, channel, type, status, detail)
             VALUES (?, ?, 'email', 'compliance_reminder', 'sent', ?)`,
            [scholarId, rows[0].email, info.messageId || 'sent'],
            () => resolve()
        ));
        res.json({ success: true, message: `Reminder sent to ${rows[0].email}.` });
    } catch (error) {
        console.error('Reminder email error:', error);
        try {
            await new Promise((resolve) => db.query(
                `INSERT INTO notification_logs (scholar_id, recipient, channel, type, status, detail)
                 VALUES (?, ?, 'email', 'compliance_reminder', 'failed', ?)`,
                [scholarId, '', String(error.message || error)],
                () => resolve()
            ));
        } catch (_) { /* notification logging must not mask the original error */ }
        res.status(502).json({ error: 'The reminder could not be sent.' });
    }
};