const { generateExecutiveRecommendation } = require('../services/executiveRecommendationsService');

const YEAR_LEVELS = new Set([
    'all',
    'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
    '1st Year College', '2nd Year College', '3rd Year College', '4th Year College', '5th Year College',
    'Unknown',
]);
const COUNT_LIMIT = 1000000;

const isCount = (value) => Number.isSafeInteger(value) && value >= 0 && value <= COUNT_LIMIT;
const isPercentage = (value) => value === null
    || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100);
const isMonth = (value) => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const isYearLevel = (value) => YEAR_LEVELS.has(value);

const sanitizeAnalyticsSummary = (summary) => {
    if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return null;

    const {
        month,
        overview,
        yearLevelDistribution,
        scholarGrowth,
        sentiment,
        submissionOutcomes,
        attendance,
        scoring,
        archiveRetention,
        operations,
    } = summary;
    if (
        !isMonth(month)
        || !overview || !isCount(overview.totalScholars) || !isPercentage(overview.averageCompliance)
        || !isCount(overview.activeScholars) || !isCount(overview.pendingLetterReviews)
        || !Array.isArray(yearLevelDistribution) || yearLevelDistribution.length > YEAR_LEVELS.size
        || !Array.isArray(scholarGrowth) || scholarGrowth.length !== 1
        || !sentiment || !isCount(sentiment.analyzedSubmissions)
        || !isCount(sentiment.positive) || !isCount(sentiment.neutral) || !isCount(sentiment.negative)
        || !Array.isArray(sentiment.monthly) || sentiment.monthly.length !== 1
        || !submissionOutcomes || !isCount(submissionOutcomes.accepted) || !isCount(submissionOutcomes.rejected)
        || !attendance || !isCount(attendance.records) || !isCount(attendance.present)
        || !isCount(attendance.late) || !isCount(attendance.absent)
        || !isPercentage(attendance.attendanceRate)
        || !Array.isArray(attendance.monthly) || attendance.monthly.length !== 1
        || !Array.isArray(attendance.groups) || attendance.groups.length > 100
        || !scoring || scoring.month !== month
        || !isCount(scoring.scoredRecords) || !isPercentage(scoring.average)
        || !scoring.bands || !isCount(scoring.bands.excellent) || !isCount(scoring.bands.good)
        || !isCount(scoring.bands.needsImprovement) || !isCount(scoring.bands.nonCompliant)
        || !archiveRetention || !isCount(archiveRetention.total)
        || !isCount(archiveRetention.upcoming) || !isCount(archiveRetention.expired)
        || !operations || !isCount(operations.activeOfficers)
    ) {
        return null;
    }

    const safeYearLevelDistribution = [];
    for (const item of yearLevelDistribution) {
        if (!item || !isYearLevel(item.yearLevel) || !isCount(item.scholars)) return null;
        safeYearLevelDistribution.push({ yearLevel: item.yearLevel, scholars: item.scholars });
    }

    const safeScholarGrowth = [];
    for (const item of scholarGrowth) {
        if (!item || item.month !== month || !isCount(item.registrations)) return null;
        safeScholarGrowth.push({ month: item.month, registrations: item.registrations });
    }

    const safeSentimentMonthly = [];
    for (const item of sentiment.monthly) {
        if (
            !item || item.month !== month
            || !isCount(item.positive) || !isCount(item.neutral) || !isCount(item.negative)
        ) {
            return null;
        }
        safeSentimentMonthly.push({
            month: item.month,
            positive: item.positive,
            neutral: item.neutral,
            negative: item.negative,
        });
    }

    const safeAttendanceMonthly = [];
    for (const item of attendance.monthly) {
        if (
            !item || item.month !== month
            || !isCount(item.present) || !isCount(item.late) || !isCount(item.absent)
        ) {
            return null;
        }
        safeAttendanceMonthly.push({
            month: item.month,
            present: item.present,
            late: item.late,
            absent: item.absent,
        });
    }

    const safeAttendanceGroups = [];
    for (const group of attendance.groups) {
        if (
            !group || !isCount(group.records) || !isCount(group.present)
            || !isCount(group.late) || !isCount(group.absent)
            || !isPercentage(group.attendanceRate)
        ) {
            return null;
        }
        safeAttendanceGroups.push({
            records: group.records,
            present: group.present,
            late: group.late,
            absent: group.absent,
            attendanceRate: group.attendanceRate,
        });
    }

    return {
        month,
        overview: {
            totalScholars: overview.totalScholars,
            averageCompliance: overview.averageCompliance,
            activeScholars: overview.activeScholars,
            pendingLetterReviews: overview.pendingLetterReviews,
        },
        yearLevelDistribution: safeYearLevelDistribution,
        scholarGrowth: safeScholarGrowth,
        sentiment: {
            analyzedSubmissions: sentiment.analyzedSubmissions,
            positive: sentiment.positive,
            neutral: sentiment.neutral,
            negative: sentiment.negative,
            monthly: safeSentimentMonthly,
        },
        submissionOutcomes: {
            accepted: submissionOutcomes.accepted,
            rejected: submissionOutcomes.rejected,
        },
        attendance: {
            records: attendance.records,
            present: attendance.present,
            late: attendance.late,
            absent: attendance.absent,
            attendanceRate: attendance.attendanceRate,
            monthly: safeAttendanceMonthly,
            groups: safeAttendanceGroups,
        },
        scoring: {
            month: scoring.month,
            scoredRecords: scoring.scoredRecords,
            average: scoring.average,
            bands: {
                excellent: scoring.bands.excellent,
                good: scoring.bands.good,
                needsImprovement: scoring.bands.needsImprovement,
                nonCompliant: scoring.bands.nonCompliant,
            },
        },
        archiveRetention: {
            total: archiveRetention.total,
            upcoming: archiveRetention.upcoming,
            expired: archiveRetention.expired,
        },
        operations: {
            activeOfficers: operations.activeOfficers,
        },
    };
};

const generate = async (req, res) => {
    const { yearLevel, analyticsSummary } = req.body || {};
    if (typeof yearLevel !== 'string' || !YEAR_LEVELS.has(yearLevel)) {
        return res.status(400).json({ error: 'Invalid analytics summary input.' });
    }
    const sanitizedAnalyticsSummary = sanitizeAnalyticsSummary(analyticsSummary);
    if (!sanitizedAnalyticsSummary) {
        return res.status(400).json({ error: 'Invalid analytics summary input.' });
    }

    try {
        const recommendation = await generateExecutiveRecommendation({
            yearLevel,
            analyticsSummary: sanitizedAnalyticsSummary,
        });
        return res.json({ recommendation });
    } catch (error) {
        if (error.code === 'GROQ_NOT_CONFIGURED') {
            return res.status(503).json({
                error: 'Groq recommendations need GROQ_API_KEY and GROQ_MODEL configured on the server.',
            });
        }

        console.error('[executive-recommendations] Groq request failed:', {
            code: error.code || 'GROQ_REQUEST_FAILED',
            status: error.response?.status || null,
        });
        return res.status(502).json({
            error: 'Groq could not generate an analytics narrative. The dashboard data is still available.',
        });
    }
};

module.exports = { generate };
