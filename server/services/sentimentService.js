const axios = require('axios');

const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001').replace(/\/+$/, '');
const ML_REQUEST_TIMEOUT_MS = Number(process.env.ML_REQUEST_TIMEOUT_MS) || 120000;
const ML_SERVICE_API_KEY = process.env.ML_SERVICE_API_KEY;

const mapSentimentLabelToValue = (label) => {
    const normalized = String(label || '').toLowerCase();
    if (normalized === 'negative') return -1;
    if (normalized === 'positive') return 1;
    return 0;
};

const normalizeExperimentalClassification = (payload) => {
    if (!payload || payload.success !== true) return null;

    const normalizePrediction = (value, labels) => {
        const label = String(value?.prediction || '');
        const confidence = Number(value?.confidence);
        if (
            !labels.includes(label.toLowerCase())
            || !Number.isFinite(confidence)
            || confidence < 0
            || confidence > 1
        ) {
            return null;
        }
        return {
            label,
            confidence,
            confidence_percent: Math.round(confidence * 10000) / 100,
            confidence_status: String(value?.confidence_status || ''),
        };
    };

    const sentiment = normalizePrediction(payload.sentiment, ['negative', 'neutral', 'positive']);
    const academicTone = normalizePrediction(payload.academic_tone, ['formal', 'moderate', 'informal']);
    if (!sentiment || !academicTone) return null;

    return {
        model_type: 'TF-IDF + Logistic Regression',
        sentiment_score: mapSentimentLabelToValue(sentiment.label),
        sentiment,
        academic_tone: academicTone,
        automated_estimate: true,
        disclaimer: 'Automated model estimate; not independently validated for real-world accuracy.',
    };
};

const predictExperimentalLetterClassification = async (letterText) => {
    if (!letterText || !String(letterText).trim()) return null;

    try {
        const response = await axios.post(`${ML_SERVICE_URL}/classify`, {
            letter: String(letterText),
        }, {
            timeout: ML_REQUEST_TIMEOUT_MS,
            headers: {
                'Content-Type': 'application/json',
                ...(ML_SERVICE_API_KEY ? { Authorization: `Bearer ${ML_SERVICE_API_KEY}` } : {}),
            },
        });

        const classification = normalizeExperimentalClassification(response?.data);
        if (!classification) {
            console.warn('Experimental classifier returned an invalid classification.');
            return null;
        }
        return classification;
    } catch (error) {
        console.warn('Experimental classification service unavailable:', error?.message || error);
        return null;
    }
};

module.exports = {
    ML_SERVICE_URL,
    mapSentimentLabelToValue,
    normalizeExperimentalClassification,
    predictExperimentalLetterClassification,
};
