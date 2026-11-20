const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
    inspectMonthlyLetterSubmission,
    INVALID_LETTER_MESSAGE,
    UNRELATED_LETTER_MESSAGE,
} = require('../services/monthlyLetterSubmissionGuard');

const submissionController = fs.readFileSync(
    path.join(__dirname, '..', 'controllers', 'submissionController.js'),
    'utf8',
);

test('blocks a task prompt with headings, directives, and a list before submission', () => {
    const result = inspectMonthlyLetterSubmission([
        'Objective:',
        'Remove the old evaluation section.',
        'Instructions:',
        '- Do not modify the existing scoring rules.',
        '- Preserve all other features.',
        'After implementation:',
        '1. Run the tests.',
        '2. Report the results.',
    ].join('\n'));

    assert.deepEqual(result, { blocked: true, reason: INVALID_LETTER_MESSAGE });
});

test('does not block an ordinary low-detail monthly update just because it may score poorly', () => {
    const result = inspectMonthlyLetterSubmission(
        'This month I attended class.',
    );

    assert.deepEqual(result, { blocked: false, reason: null });
});

test('blocks unrelated personal writing that has no monthly progress evidence', () => {
    const result = inspectMonthlyLetterSubmission(
        'I enjoy playing video games. My favorite game is Minecraft. I built a castle and explored a forest. On weekends I play with friends and watch movies.',
    );

    assert.deepEqual(result, { blocked: true, reason: UNRELATED_LETTER_MESSAGE });
});

test('blocks school-related text that has no reporting-period context', () => {
    const result = inspectMonthlyLetterSubmission(
        'I attend class and complete my assignments. I study science and math.',
    );

    assert.deepEqual(result, { blocked: true, reason: UNRELATED_LETTER_MESSAGE });
});

test('server preview and final submission both enforce the prompt check', () => {
    assert.match(submissionController, /inspectMonthlyLetterSubmission\(rawLetter\)/);
    assert.match(submissionController, /inspectMonthlyLetterSubmission\(letter_content\)/);
    assert.match(submissionController, /code: 'INVALID_MONTHLY_LETTER'/);
});
