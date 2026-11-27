const failedAttemptsByIp = new Map();

const failedLoginLimit = ({ windowMs = 15 * 60 * 1000, max = 10 } = {}) => (req, res, next) => {
    const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    let bucket = failedAttemptsByIp.get(key);

    if (!bucket || now >= bucket.resetAt) {
        bucket = { count: 0, resetAt: now + windowMs };
        failedAttemptsByIp.set(key, bucket);
    }

    if (bucket.count >= max) {
        res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
        return res.status(429).json({ message: 'Too many failed login attempts. Please try again in 15 minutes.' });
    }

    req.recordFailedLoginAttempt = () => {
        bucket.count += 1;
    };
    req.clearFailedLoginAttempts = () => {
        failedAttemptsByIp.delete(key);
    };
    return next();
};

module.exports = { failedLoginLimit };
