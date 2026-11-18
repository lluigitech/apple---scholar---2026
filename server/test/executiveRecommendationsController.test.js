const assert = require('node:assert/strict');
const axios = require('axios');
const { test } = require('node:test');
const { generate } = require('../controllers/executiveRecommendationsController');

const currentMonth = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
})();
const previousMonth = (() => {
    const now = new Date();
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
})();

const invoke = async (body) => {
    let statusCode = 200;
    let responseBody;
    const res = {
        status(code) {
            statusCode = code;
            return this;
        },
        json(value) {
            responseBody = value;
            return this;
        },
    };
    await generate({ body }, res);
    return { statusCode, body: responseBody };
};

const validSummary = {
    month: currentMonth,
    overview: {
        totalScholars: 3,
        averageCompliance: 62,
        activeScholars: 3,
        pendingLetterReviews: 0,
    },
    yearLevelDistribution: [{ yearLevel: 'Grade 9', scholars: 3 }],
    scholarGrowth: [{ month: currentMonth, registrations: 1 }],
    sentiment: {
        analyzedSubmissions: 2,
        positive: 1,
        neutral: 0,
        negative: 1,
        monthly: [{ month: currentMonth, positive: 1, neutral: 0, negative: 1 }],
    },
    submissionOutcomes: { accepted: 2, rejected: 0 },
    attendance: {
        records: 3,
        present: 2,
        late: 1,
        absent: 0,
        attendanceRate: 100,
        monthly: [{ month: currentMonth, present: 2, late: 1, absent: 0 }],
        groups: [{ records: 3, present: 2, late: 1, absent: 0, attendanceRate: 100 }],
    },
    scoring: {
        month: currentMonth,
        scoredRecords: 2,
        average: 78,
        bands: { excellent: 0, good: 2, needsImprovement: 0, nonCompliant: 0 },
    },
    archiveRetention: { total: 0, upcoming: 0, expired: 0 },
    operations: { activeOfficers: 1 },
};

const preserveEnvironment = (t, names) => {
    const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
    t.after(() => {
        names.forEach((name) => {
            if (original[name] === undefined) delete process.env[name];
            else process.env[name] = original[name];
        });
    });
};

test('rejects malformed analytics summaries before calling Groq', async (t) => {
    const originalPost = axios.post;
    t.after(() => { axios.post = originalPost; });
    axios.post = async () => { throw new Error('Groq must not be called for invalid input.'); };

    const response = await invoke({
        yearLevel: 'Grade 7',
        analyticsSummary: {
            ...validSummary,
            sentiment: { ...validSummary.sentiment, monthly: [{ month: 'not-a-month', positive: 1, neutral: 0, negative: 0 }] },
        },
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, { error: 'Invalid analytics summary input.' });
});

test('rejects analytics activity from a different month', async (t) => {
    const originalPost = axios.post;
    t.after(() => { axios.post = originalPost; });
    axios.post = async () => { throw new Error('Groq must not be called for out-of-month analytics.'); };

    const response = await invoke({
        yearLevel: 'Grade 7',
        analyticsSummary: {
            ...validSummary,
            month: previousMonth,
            scoring: { ...validSummary.scoring, month: previousMonth },
        },
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, { error: 'Invalid analytics summary input.' });
});

test('sends only allowlisted aggregate analytics to Groq and returns the narrative', async (t) => {
    preserveEnvironment(t, ['GROQ_API_KEY', 'GROQ_MODEL']);
    const originalPost = axios.post;
    t.after(() => { axios.post = originalPost; });
    process.env.GROQ_API_KEY = 'test-groq-key';
    process.env.GROQ_MODEL = 'test-free-model';

    let request;
    axios.post = async (url, body, options) => {
        request = { url, body, options };
        return { data: { choices: [{ message: { content: 'Average compliance is 62%, with three active scholars. Continue monitoring sentiment and review outcomes as new data arrives.' } }] } };
    };

    const response = await invoke({
        yearLevel: 'Grade 9',
        analyticsSummary: {
            ...validSummary,
            highRiskScholars: 2,
            studentName: 'Private Student',
            letterText: 'Private letter content',
            attendance: {
                ...validSummary.attendance,
                groups: [{ ...validSummary.attendance.groups[0], groupName: 'Confidential Group Label' }],
            },
        },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.recommendation, 'Average compliance is 62%, with three active scholars. Continue monitoring sentiment and review outcomes as new data arrives.');
    assert.equal(request.url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(request.body.model, 'test-free-model');
    assert.match(request.body.messages[0].content, /English executive narrative/);
    assert.deepEqual(JSON.parse(request.body.messages[1].content), {
        yearLevel: 'Grade 9',
        analyticsSummary: validSummary,
    });
    assert.equal(JSON.stringify(request.body).includes('Private Student'), false);
    assert.equal(JSON.stringify(request.body).includes('Private letter content'), false);
    assert.equal(JSON.stringify(request.body.messages[1].content).includes('highRiskScholars'), false);
    assert.equal(JSON.stringify(request.body.messages[1].content).includes('Confidential Group Label'), false);
});

test('reports missing Groq configuration without calling the API', async (t) => {
    preserveEnvironment(t, ['GROQ_API_KEY', 'GROQ_MODEL']);
    const originalPost = axios.post;
    t.after(() => { axios.post = originalPost; });
    delete process.env.GROQ_MODEL;
    process.env.GROQ_API_KEY = 'test-groq-key';
    axios.post = async () => { throw new Error('Groq must not be called without a configured model.'); };

    const response = await invoke({
        yearLevel: 'all',
        analyticsSummary: validSummary,
    });

    assert.equal(response.statusCode, 503);
    assert.match(response.body.error, /GROQ_MODEL/);
});
