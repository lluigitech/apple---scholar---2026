const db = require('../config/db');
const bcrypt = require('bcryptjs');
const scholarController = require('./scholarController');

const query = (sql, values) => db.promise().query(sql, values);

const verifyScholarPassword = async (scholarId, password) => {
    if (typeof password !== 'string' || !password) {
        return { valid: false, status: 401, error: 'Enter your current password to save Scholar settings.' };
    }
    const [rows] = await query(
        'SELECT password FROM users WHERE id = ? AND role = ? LIMIT 1',
        [scholarId, 'scholar']
    );
    if (!rows.length) return { valid: false, status: 404, error: 'Scholar account not found.' };

    const storedPassword = String(rows[0].password || '');
    const valid = storedPassword.startsWith('$2')
        ? await bcrypt.compare(password, storedPassword)
        : password === storedPassword;
    return valid
        ? { valid: true }
        : { valid: false, status: 401, error: 'The current password is incorrect.' };
};

exports.verifyPassword = async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)
        || Object.keys(body).length !== 1
        || typeof body.currentPassword !== 'string' || !body.currentPassword) {
        return res.status(400).json({ error: 'Enter your current password.' });
    }

    try {
        const result = await verifyScholarPassword(req.user.id, body.currentPassword);
        if (!result.valid) return res.status(result.status).json({ error: result.error });
        return res.json({ verified: true });
    } catch (error) {
        console.error('Failed to verify Scholar settings password:', error);
        return res.status(500).json({ error: 'Failed to verify current password.' });
    }
};

exports.updateProfile = async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)
        || typeof body.currentPassword !== 'string' || !body.currentPassword) {
        return res.status(400).json({ error: 'Provide profile fields and your current password.' });
    }

    try {
        const result = await verifyScholarPassword(req.user.id, body.currentPassword);
        if (!result.valid) return res.status(result.status).json({ error: result.error });
        return scholarController.updateProfile(req, res);
    } catch (error) {
        console.error('Failed to verify Scholar profile update password:', error);
        return res.status(500).json({ error: 'Failed to verify current password.' });
    }
};
