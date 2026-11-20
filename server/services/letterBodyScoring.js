const LETTER_BODY_MAX = 75;
const CATEGORY_MAX = 15;
const POINTS_PER_CHECK = 5;
const KEYWORDS = require('../../shared/letterBodyRules.json');

const keywordPatterns = new WeakMap();

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function keywordAlternatives(keywords) {
    return keywords
        .map((keyword) => keyword.split(/\s+/).map(escapeRegex).join('\\s+'))
        .join('|');
}

function keywordPattern(keywords) {
    if (!keywordPatterns.has(keywords)) {
        keywordPatterns.set(
            keywords,
            new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${keywordAlternatives(keywords)})(?=$|[^\\p{L}\\p{N}])`, 'iu'),
        );
    }

    return keywordPatterns.get(keywords);
}

function matchesAny(text, keywords) {
    return Boolean(text) && keywordPattern(keywords).test(text);
}

function countWords(text) {
    return text.match(/\p{L}+(?:['’\-]\p{L}+)*|\p{N}+/gu)?.length || 0;
}

function countSentences(text) {
    return text.split(/[.!?]+/).map((sentence) => sentence.trim()).filter(Boolean).length;
}

function countParagraphs(text) {
    return text.split(/\n\s*\n+/).map((paragraph) => paragraph.trim()).filter(Boolean).length;
}

function splitIntoSentences(text) {
    return text
        .split(/[.!?;]+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);
}

function splitIntoClauses(sentence) {
    return sentence.split(/\b(?:but|however|although|though|yet|pero|subalit)\b/i);
}

function isNegatedDifficulty(sentence) {
    const difficultyAlternatives = keywordAlternatives(KEYWORDS.difficultyWords);
    const negationGap = String.raw`(?:\s+[\p{L}\p{N}'’\-]+){0,5}\s+`;
    const hasNegationBeforeDifficulty = (negations) => {
        const pattern = new RegExp(
            String.raw`(?:^|[^\p{L}\p{N}])(?:${keywordAlternatives(negations)})${negationGap}(?:${difficultyAlternatives})(?=$|[^\p{L}\p{N}])`,
            'iu',
        );
        return pattern.test(sentence);
    };

    if (
        hasNegationBeforeDifficulty(KEYWORDS.englishNegations)
        || hasNegationBeforeDifficulty(KEYWORDS.filipinoNegations)
    ) {
        return true;
    }

    const pronouns = keywordAlternatives(KEYWORDS.filipinoPronouns);
    const negatedVerbs = keywordAlternatives(KEYWORDS.filipinoNegatedVerbs);
    const filipinoNegatedVerb = new RegExp(
        String.raw`(?:^|[^\p{L}\p{N}])(?:hindi|di)(?:\s+(?:${pronouns})){0,2}\s+(?:masyadong\s+)?(?:${negatedVerbs})(?=$|[^\p{L}\p{N}])`,
        'iu',
    );
    return filipinoNegatedVerb.test(sentence);
}

function getReportedDifficultySentences(text) {
    return splitIntoSentences(text).filter((sentence) => (
        splitIntoClauses(sentence).some((clause) => (
            matchesAny(clause, KEYWORDS.difficultyWords)
            && !matchesAny(clause, KEYWORDS.englishNegations)
        ))
    ));
}

function reportsDifficulty(text) {
    return getReportedDifficultySentences(text).length > 0;
}

const CATEGORY_RULES = [
    {
        key: 'Paragraph Structure',
        checks: [
            (context) => context.paragraphs >= 2,
            (context) => context.sentences >= 4,
            (context) => context.words >= 150,
        ],
    },
    {
        key: 'Academic Update',
        checks: [
            (context) => matchesAny(context.text, KEYWORDS.academicTopics),
            (context) => matchesAny(context.text, KEYWORDS.academicActions),
            (context) => matchesAny(context.text, KEYWORDS.academicOutcomes),
        ],
    },
    {
        key: 'Self-Improvement',
        checks: [
            (context) => matchesAny(context.text, KEYWORDS.improvement),
            (context) => matchesAny(context.text, KEYWORDS.effort),
            (context) => matchesAny(context.text, KEYWORDS.goals),
        ],
    },
    {
        key: 'Family Update',
        checks: [
            (context) => matchesAny(context.text, KEYWORDS.familyMembers),
            (context) => matchesAny(context.text, KEYWORDS.familySupport),
            (context) => matchesAny(context.text, KEYWORDS.familyContext),
        ],
    },
    {
        key: 'Difficulty Update',
        checks: [
            (context) => context.difficultySentences.length > 0,
            (context) => context.difficultySentences.some((sentence) => matchesAny(sentence, KEYWORDS.difficultyContext)),
            (context) => context.difficultySentences.some((sentence) => matchesAny(sentence, KEYWORDS.copingActions)),
        ],
    },
];

function scoreLetterBody(body) {
    const text = typeof body === 'string' ? body.trim() : '';
    const context = {
        text,
        words: countWords(text),
        sentences: countSentences(text),
        paragraphs: countParagraphs(text),
        difficultySentences: getReportedDifficultySentences(text),
    };
    const categories = Object.fromEntries(
        CATEGORY_RULES.map(({ key, checks }) => {
            const passedChecks = checks.reduce((total, check) => total + (check(context) ? 1 : 0), 0);
            return [key, passedChecks * POINTS_PER_CHECK];
        }),
    );
    const categoryScore = Object.values(categories).reduce((total, score) => total + score, 0);
    const categoryMaxScore = CATEGORY_MAX * CATEGORY_RULES.length;
    const score = Math.round((categoryScore / categoryMaxScore) * LETTER_BODY_MAX);
    const criteria = CATEGORY_RULES.map(({ key }) => ({
        key,
        label: key,
        score: categories[key],
        max: CATEGORY_MAX,
    }));

    return {
        score,
        max_score: LETTER_BODY_MAX,
        category_score: categoryScore,
        category_max_score: categoryMaxScore,
        percentage: Math.round((categoryScore / categoryMaxScore) * 100),
        categories,
        criteria,
        evaluation_method: 'rule_based',
    };
}

module.exports = {
    LETTER_BODY_MAX,
    CATEGORY_MAX,
    scoreLetterBody,
    countWords,
    countSentences,
    countParagraphs,
    reportsDifficulty,
    getReportedDifficultySentences,
};
