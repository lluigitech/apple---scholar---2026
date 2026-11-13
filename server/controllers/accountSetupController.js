const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { logAuditEvent } = require('../utils/auditLogger');

const ALLOWED_ROLES = new Set(['admin', 'staff', 'officer']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const query = (connection, sql, values = []) => connection.query(sql, values);
const isFirstLogin = (value) => value === true || value === 1 || value === '1';

exports.getProfile = async (req, res) => {
    try {
        const [rows] = await db.promise().query(
            `SELECT id, scholar_id AS login_id, full_name, email, phone, role, must_change_password
             FROM users WHERE id = ? LIMIT 1`,
            [req.user.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Account not found.' });

        const user = rows[0];
        if (!ALLOWED_ROLES.has(user.role) || !isFirstLogin(user.must_change_password)) {
            return res.status(403).json({ error: 'Initial account setup is not available.' });
        }
        return res.json({
            login_id: user.login_id,
            full_name: user.full_name,
            email: user.email,
            phone: user.phone || '',
            role: user.role,
        });
    } catch (error) {
        console.error('Failed to load initial account setup:', error);
        return res.status(500).json({ error: 'Failed to load account details.' });
    }
};

exports.completeSetup = async (req, res) => {
    const body = req.body;
    const allowedFields = new Set(['full_name', 'email', 'phone', 'current_password', 'new_password']);
    if (
        !body ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        Object.keys(body).some((key) => !allowedFields.has(key)) ||
        typeof body.full_name !== 'string' ||
        typeof body.email !== 'string' ||
        typeof body.phone !== 'string' ||
        typeof body.current_password !== 'string' ||
        typeof body.new_password !== 'string'
    ) {
        return res.status(400).json({ error: 'Provide your name, email, phone number, and password details.' });
    }

    const fullName = body.full_name.trim();
    const email = body.email.trim().toLowerCase();
    const phone = body.phone.trim();
    if (!fullName || fullName.length > 255) {
        return res.status(400).json({ error: 'Full name is required and must not exceed 255 characters.' });
    }
    if (!EMAIL_PATTERN.test(email) || email.length > 255) {
        return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    if (!phone || phone.length > 64) {
        return res.status(400).json({ error: 'Phone number is required and must not exceed 64 characters.' });
    }
    if (!body.current_password || body.new_password.length < 8) {
        return res.status(400).json({ error: 'Enter your current password and a new password of at least 8 characters.' });
    }
    if (body.current_password === body.new_password) {
        return res.status(400).json({ error: 'Your new password must be different from your temporary password.' });
    }

    let connection;
    let user;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        const [users] = await query(
            connection,
            `SELECT id, role, password, must_change_password
             FROM users WHERE id = ? LIMIT 1 FOR UPDATE`,
            [req.user.id]
        );
        if (!users.length) {
            await connection.rollback();
            return res.status(404).json({ error: 'Account not found.' });
        }

        user = users[0];
        if (!ALLOWED_ROLES.has(user.role) || !isFirstLogin(user.must_change_password)) {
            await connection.rollback();
            return res.status(403).json({ error: 'Initial account setup is not available.' });
        }

        const passwordMatches = String(user.password || '').startsWith('$2')
            ? await bcrypt.compare(body.current_password, user.password)
            : body.current_password === String(user.password || '');
        if (!passwordMatches) {
            await connection.rollback();
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }

        const hashedPassword = await bcrypt.hash(body.new_password, 10);
        await query(
            connection,
            `UPDATE users
             SET full_name = ?, email = ?, phone = ?, password = ?, must_change_password = 0
             WHERE id = ?`,
            [fullName, email, phone, hashedPassword, req.user.id]
        );
        await connection.commit();
    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Failed to roll back initial account setup:', rollbackError);
            }
        }
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'That email address is already in use.' });
        }
        console.error('Failed to complete initial account setup:', error);
        return res.status(500).json({ error: 'Failed to save account setup.' });
    } finally {
        if (connection) connection.release();
    }

    await logAuditEvent({
        req,
        userId: req.user.id,
        role: user.role,
        action: 'edit',
        module: 'Account Setup',
        details: 'Completed initial account setup and changed temporary password',
        result: 'success',
    });
    return res.json({ message: 'Account setup completed.', full_name: fullName, email });
};
