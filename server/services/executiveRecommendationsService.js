const axios = require('axios');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const generateExecutiveRecommendation = async ({ yearLevel, analyticsSummary }) => {
    const apiKey = process.env.GROQ_API_KEY;
    const model = process.env.GROQ_MODEL;
    if (!apiKey || !model) {
        const error = new Error('Groq API key and model must be configured.');
        error.code = 'GROQ_NOT_CONFIGURED';
        throw error;
    }

    const response = await axios.post(GROQ_API_URL, {
        model,
        messages: [
            {
                role: 'system',
                content: [
                    'Write a concise English executive narrative summarizing the supplied school analytics.',
                    'Use activity metrics for the supplied current month only; overview, retention, and operations are current snapshots, not historical monthly trends.',
                    'Cover current-month scholar registrations, sentiment, submission outcomes, duty attendance, and scoring, plus the current roster and compliance snapshot when available.',
                    'Treat attendance rate as the share of recorded attendance entries marked present or late; do not make claims about unrecorded duties.',
                    'If group attendance aggregates are available, summarize the group-level pattern without identifying or naming groups.',
                    'Do not describe older-month trends, infer causes, or predict outcomes.',
                    'Do not classify high-risk scholars or invent facts. Use only the aggregate metrics provided.',
                    'Return 3 to 5 short sentences with a balanced summary and practical next steps. Mention when a section has insufficient data.',
                ].join(' '),
            },
            {
                role: 'user',
                content: JSON.stringify({ yearLevel, analyticsSummary }),
            },
        ],
        temperature: 0.2,
        reasoning_effort: 'low',
        max_completion_tokens: 512,
    }, {
        timeout: 15000,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
    });

    const recommendation = response?.data?.choices?.[0]?.message?.content;
    if (typeof recommendation !== 'string' || !recommendation.trim()) {
        const error = new Error('Groq returned an empty recommendation.');
        error.code = 'GROQ_INVALID_RESPONSE';
        throw error;
    }

    return recommendation.trim().slice(0, 1800);
};

module.exports = { generateExecutiveRecommendation };
