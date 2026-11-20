const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
    CATEGORY_NAMES,
    DIMENSION_MAXIMUMS,
    scoreLetterBodyExperimentalV3,
} = require('../services/experimentalLetterBodyScoringV3');

function category(text, name) {
    return scoreLetterBodyExperimentalV3(text).categories[name];
}

test('empty text produces absent scores and no letter text in the result', () => {
    const result = scoreLetterBodyExperimentalV3('');

    assert.deepEqual(Object.keys(result.categories), CATEGORY_NAMES);
    assert.equal(result.totalScore, 0);
    assert.equal(result.maxTotalScore, 75);
    for (const item of Object.values(result.categories)) {
        assert.equal(item.score, 0);
        assert.equal(item.band, 'Absent');
        assert.equal(item.reviewRequired, false);
        assert.ok(!JSON.stringify(item).includes('letter'));
    }
});

test('vague, moderate, and detailed academic evidence receives progressively higher scores', () => {
    const vague = category('School is important.', 'Academic Update');
    const moderate = category('I studied at school.', 'Academic Update');
    const specific = category('This semester I attended class.', 'Academic Update');
    const detailed = category(
        'This semester I completed a biology project and earned 92%, because I practiced each week.',
        'Academic Update',
    );

    assert.ok(vague.score <= 3);
    assert.ok(moderate.score > vague.score);
    assert.ok(specific.score >= 9);
    assert.ok(detailed.score >= 13);
    assert.ok(detailed.evidenceIndicators.includes('academic_result_or_progress'));
});

test('one detailed self-improvement example can reach the high band', () => {
    const vague = category('I want to improve.', 'Self-Improvement');
    const detailed = category(
        'I practice reading each evening to improve my English because this helps me understand the lessons better.',
        'Self-Improvement',
    );

    assert.ok(vague.score <= 8);
    assert.ok(detailed.score >= 13);
    assert.ok(detailed.evidenceIndicators.includes('purpose_or_reason_detected'));
});

test('self-improvement negation is not scored as a positive improvement claim', () => {
    const negated = category('I did not improve my study habits.', 'Self-Improvement');
    const mixed = category(
        'I did not improve my habits, but I practice reading every evening to develop my skills.',
        'Self-Improvement',
    );

    assert.equal(negated.score, 0);
    assert.ok(negated.reviewRequired);
    assert.ok(mixed.score > 0);
    assert.ok(mixed.reviewRequired);
});

test('one detailed family situation can reach the high band without a support statement', () => {
    const absent = category('I studied for my exam.', 'Family Update');
    const vague = category('My family is okay.', 'Family Update');
    const detailed = category(
        'This month, my mother’s small business had fewer customers, so she reduced work hours and we adjusted expenses.',
        'Family Update',
    );

    assert.equal(absent.score, 0);
    assert.ok(vague.score > 0 && vague.score <= 8);
    assert.ok(detailed.score >= 13);
    assert.ok(detailed.evidenceIndicators.includes('family_context_connected'));
});

test('family absence detection is independent of unrelated text', () => {
    const short = category('I studied for my exam.', 'Family Update');
    const longer = category(
        'I studied for my exam. I practiced each day. The class project took time. The school term was busy.',
        'Family Update',
    );

    assert.equal(short.score, 0);
    assert.equal(longer.score, 0);
});

test('difficulty negation scores as absent and mixed reports require review', () => {
    const negated = category('I did not face any challenge this month.', 'Difficulty Update');
    const mixed = category(
        'I had no difficulty with school, but I struggled with internet access and contacted my teacher, which helped me continue.',
        'Difficulty Update',
    );
    const detailed = category(
        'This month, limited internet access interrupted my classes, so I contacted my teacher and rescheduled the assignment; this helped me finish.',
        'Difficulty Update',
    );

    assert.equal(negated.score, 0);
    assert.ok(negated.evidenceIndicators.includes('negated_difficulty_not_scored_as_reported'));
    assert.ok(mixed.score > 0);
    assert.ok(mixed.reviewRequired);
    assert.ok(detailed.score >= 13);
});

test('English, Filipino, and Taglish examples are recognized without returning text', () => {
    const academicFilipino = category(
        'Ngayong semestre, natapos ko ang research project at tumaas ang marka ko dahil nag-review ako.',
        'Academic Update',
    );
    const selfFilipino = category(
        'Nagsisikap ako na pagbutihin ang aking pag-aaral; nagbabasa ako gabi-gabi upang mas maintindihan ang lessons.',
        'Self-Improvement',
    );
    const familyFilipino = category(
        'Ngayong buwan, maayos ang kalagayan ng pamilya ko. Nagtatrabaho ang tatay ko sa bukid, kaya inayos namin ang gastusin.',
        'Family Update',
    );
    const difficultyTaglish = category(
        'Nahirapan ako sa internet access ngayong buwan, pero naghanap ako ng library connection at natapos ko ang assignments.',
        'Difficulty Update',
    );

    assert.ok(academicFilipino.score >= 9);
    assert.ok(selfFilipino.score >= 9);
    assert.ok(familyFilipino.score >= 9);
    assert.ok(difficultyTaglish.score >= 9);
    for (const result of [academicFilipino, selfFilipino, familyFilipino, difficultyTaglish]) {
        assert.ok(!JSON.stringify(result).includes('Ngayong'));
        assert.ok(!JSON.stringify(result).includes('Nagsisikap'));
        assert.ok(!JSON.stringify(result).includes('Nahirapan'));
    }
});

test('repeating evidence or adding unrelated length does not increase content-category scores', () => {
    const example = 'I completed my biology project this semester and earned a clear result.';
    const repeated = `${example} ${example} ${example}`;
    const padded = `${example}\n\nThe school building is large. The weather is pleasant.`;

    for (const name of CATEGORY_NAMES.slice(1)) {
        assert.equal(category(example, name).score, category(repeated, name).score);
        assert.equal(category(example, name).score, category(padded, name).score);
    }

    const structured = [
        'Dear sponsor, I am writing this month.',
        '',
        'I completed a biology assignment.',
        '',
        'My family is doing well.',
        '',
        'Additionally, I practiced reading.',
        '',
        'Thank you for your support. Sincerely.',
    ].join('\n');
    const repeatedStructure = `${structured}\n\n${structured}`;
    assert.equal(
        category(structured, 'Paragraph Structure').score,
        category(repeatedStructure, 'Paragraph Structure').score,
    );
});

test('each category can occupy multiple score values and each dimension stays within its cap', () => {
    const examples = [
        '',
        'Dear sponsor.',
        'This month I am writing to share an update.',
        [
            'Dear sponsor, I am writing this month.',
            '',
            'I completed a biology assignment.',
            '',
            'My family is doing well.',
            '',
            'Additionally, I practiced reading.',
            '',
            'Thank you for your support. Sincerely.',
        ].join('\n'),
        'I studied at school.',
        'I want to improve.',
        'I practice reading each evening to improve my English.',
        'My family.',
        'My family is okay.',
        'My father works at a shop.',
        'This month, my mother’s small business had fewer customers, so she reduced work hours and we adjusted expenses.',
        'I struggled with internet access.',
        'I struggled with internet access this month.',
        'I struggled with internet access, so I asked for help.',
        'This month, I completed a detailed class project because I practiced every week and improved my result.',
    ];

    for (const name of CATEGORY_NAMES) {
        const scores = new Set(examples.map((text) => category(text, name).score));
        assert.ok(scores.size >= 4, `${name} produced only ${scores.size} distinct scores`);
    }

    const result = scoreLetterBodyExperimentalV3(
        'This month, I completed a detailed class project because I practiced every week and improved my result.',
    );
    for (const item of Object.values(result.categories)) {
        assert.ok(item.score >= 0 && item.score <= 15);
        for (const [dimension, value] of Object.entries(item.dimensionScores)) {
            assert.ok(value >= 0 && value <= DIMENSION_MAXIMUMS[dimension]);
        }
        assert.equal(item.score, Object.values(item.dimensionScores).reduce((sum, value) => sum + value, 0));
        assert.ok(typeof item.explanation === 'string' && item.explanation.length > 0);
    }
});
