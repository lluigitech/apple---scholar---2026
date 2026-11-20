const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
    CATEGORY_NAMES,
    EXPERIMENTAL_SCORING_LIMITATIONS,
    getBand,
    scoreLetterBodyExperimental,
} = require('../services/experimentalLetterBodyScoring');

test('experimental scorer returns bounded category scores and non-text evidence indicators', () => {
    const result = scoreLetterBodyExperimental('');

    assert.deepEqual(Object.keys(result.categories), CATEGORY_NAMES);
    assert.equal(result.totalScore, 0);
    assert.equal(result.maxTotalScore, 75);
    for (const category of Object.values(result.categories)) {
        assert.equal(category.score, 0);
        assert.equal(category.band, 'Absent');
        assert.deepEqual(category.evidenceIndicators, []);
    }
    assert.ok(EXPERIMENTAL_SCORING_LIMITATIONS.length > 0);
});

test('a topic keyword by itself does not produce a high category score', () => {
    const result = scoreLetterBodyExperimental('School. Improvement. Family. Difficulty.');

    assert.ok(result.categories['Academic Update'].score <= 3);
    assert.ok(result.categories['Self-Improvement'].score <= 3);
    assert.ok(result.categories['Family Update'].score <= 3);
    assert.ok(result.categories['Difficulty Update'].score <= 3);
});

test('academic score increases when the update includes an identifiable activity and detail', () => {
    const vague = scoreLetterBodyExperimental('School is important to me.');
    const specific = scoreLetterBodyExperimental(
        'This semester, I completed my biology project and earned 92%. I also presented my research.',
    );

    assert.ok(vague.categories['Academic Update'].score <= 3);
    assert.ok(specific.categories['Academic Update'].score >= 13);
    assert.ok(
        specific.categories['Academic Update'].evidenceIndicators.includes('academic_contextual_detail_detected'),
    );
});

test('self-improvement and family scores reflect actions and context rather than presence alone', () => {
    const result = scoreLetterBodyExperimental([
        'I am improving my study habits by reviewing notes every evening.',
        'I plan to practice math problems each week because I want to build my skills.',
        '',
        'At home, my parents work at a small shop, and my younger brother attends school.',
        'This month, our family adjusted expenses because income was lower.',
    ].join('\n'));

    assert.ok(result.categories['Self-Improvement'].score >= 13);
    assert.ok(result.categories['Family Update'].score >= 13);
    assert.ok(
        result.categories['Family Update'].evidenceIndicators.includes('family_contextual_detail_detected'),
    );
});

test('difficulty score requires a reported challenge and rewards context plus a response', () => {
    const negated = scoreLetterBodyExperimental('I did not have any difficulty this month.');
    const vague = scoreLetterBodyExperimental('I faced a challenge.');
    const detailed = scoreLetterBodyExperimental(
        'I struggled to pay for transportation this month, so I asked for help and adjusted my budget.',
    );

    assert.equal(negated.categories['Difficulty Update'].score, 0);
    assert.ok(vague.categories['Difficulty Update'].score <= 3);
    assert.ok(detailed.categories['Difficulty Update'].score >= 12);
});

test('score-band labels cover the defined boundaries', () => {
    assert.equal(getBand(0), 'Absent');
    assert.equal(getBand(3), 'Barely mentioned');
    assert.equal(getBand(4), 'Brief or vague');
    assert.equal(getBand(9), 'Present with some specifics');
    assert.equal(getBand(13), 'Detailed and specific');
});
