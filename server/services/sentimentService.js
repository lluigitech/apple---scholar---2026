const axios = require('axios');

const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001').replace(/\/+$/, '');
const ML_REQUEST_TIMEOUT_MS = Number(process.env.ML_REQUEST_TIMEOUT_MS) || 120000;
const ML_SERVICE_API_KEY = process.env.ML_SERVICE_API_KEY;

const CATEGORY_KEYS = {
    'Paragraph Structure': 'paragraph',
    'Academic Update': 'academic',
    'Self-Improvement': 'self_improvement',
    'Family Update': 'family',
    'Difficulty Update': 'difficulty',
};

const mapSentimentLabelToValue = (label) => {
    const normalized = String(label || '').toLowerCase();
    if (normalized === 'negative') return -1;
    if (normalized === 'positive') return 1;
    return 0;
};

const normalizeContentScoreResponse = (payload) => {
    if (!payload || typeof payload !== 'object') return null;

    const categories = payload.categories && typeof payload.categories === 'object'
        ? payload.categories
        : null;
    const breakdown = {};
    for (const [label, key] of Object.entries(CATEGORY_KEYS)) {
        const score = Number(categories?.[label]);
        if (!Number.isFinite(score) || score < 0 || score > 15) return null;
        breakdown[key] = score;
    }

    const bodyScore = Number(payload.body_score);
    const maxScore = Number(payload.max_score);
    const percentage = Number(payload.percentage);
    const sentimentLabel = String(payload.sentiment || '');
    const academicTone = String(payload.academic_tone || '');
    if (
        !Number.isFinite(bodyScore) || bodyScore < 0 || bodyScore > 75
        || maxScore !== 75
        || !Number.isFinite(percentage) || percentage < 0 || percentage > 100
        || !['negative', 'neutral', 'positive'].includes(sentimentLabel.toLowerCase())
        || !['formal', 'moderate', 'informal'].includes(academicTone.toLowerCase())
    ) {
        return null;
    }

    return {
        score: percentage,
        body_score: bodyScore,
        max_score: maxScore,
        percentage,
        breakdown,
        categories,
        sentiment: mapSentimentLabelToValue(sentimentLabel),
        sentiment_label: sentimentLabel,
        academic_tone: academicTone,
        quality_label: percentage >= 75 ? 'Good' : percentage >= 50 ? 'Needs Improvement' : 'Non-Compliant',
    };
};

const predictLetterWithMl = async (letterText) => {
    if (!letterText || !String(letterText).trim()) return null;

    try {
        const response = await axios.post(`${ML_SERVICE_URL}/predict`, {
            letter: String(letterText),
        }, {
            timeout: ML_REQUEST_TIMEOUT_MS,
            headers: {
                'Content-Type': 'application/json',
                ...(ML_SERVICE_API_KEY ? { Authorization: `Bearer ${ML_SERVICE_API_KEY}` } : {}),
            },
        });

        const prediction = normalizeContentScoreResponse(response?.data);
        if (!prediction) {
            console.warn('ML service returned an invalid XLM-RoBERTa prediction.');
            return null;
        }
        return prediction;
    } catch (error) {
        console.warn('ML prediction service unavailable:', error?.message || error);
        return null;
    }
};

module.exports = {
    ML_SERVICE_URL,
    CATEGORY_KEYS,
    mapSentimentLabelToValue,
    normalizeContentScoreResponse,
    predictLetterWithMl,
};
