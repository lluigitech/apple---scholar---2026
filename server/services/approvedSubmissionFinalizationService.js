const db = require('../config/db');

const finalizeApprovedSubmissions = async () => {
    const connection = await db.promise().getConnection();
    try {
        await connection.beginTransaction();
        const [submissionResult] = await connection.query(`
            UPDATE submissions
            SET approved_at = COALESCE(approved_at, reviewed_at, submitted_at, NOW()),
                finalized_at = NOW(),
                export_available_at = NOW(),
                finalization_batch_id = CONCAT('approved-submission-', id)
            WHERE status = 'approved'
              AND finalized_at IS NULL
        `);
        const [gradeResult] = await connection.query(`
            UPDATE grades
            SET approved_at = COALESCE(approved_at, created_at, NOW()),
                finalized_at = NOW(),
                export_available_at = NOW(),
                finalization_batch_id = CONCAT('approved-grade-', id)
            WHERE verification_status = 'approved'
              AND finalized_at IS NULL
        `);
        await connection.commit();
        return {
            submissions_finalized: submissionResult.affectedRows,
            grades_finalized: gradeResult.affectedRows,
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

module.exports = { finalizeApprovedSubmissions };
