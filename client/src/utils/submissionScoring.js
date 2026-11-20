import { getEducationStage, hasEducationProgram } from './educationStage.js';
import KEYWORDS from '../../../shared/letterBodyRules.json' with { type: 'json' };

// ─── Rule-based letter body scoring; the ML service is used for classification ──

// The scoring contract is intentionally three-way in the UI model,
// rendered as a 100-point scoreboard with explicit subcomponent maxes.
export const LETTER_BODY_MAX = 75;
const DOCUMENTATION_MAX = 20;
const INFO_MAX = 5;

export function classifyQualityScore(score) {
    const normalizedScore = Math.min(Math.max(Number(score) || 0, 0), 100);

    if (normalizedScore >= 90) {
        return { riskLevel: 'accepted', riskColor: '#16a34a', riskLabel: 'Excellent', accepted: true, qualityStatus: 'accepted' };
    }
    if (normalizedScore >= 75) {
        return { riskLevel: 'accepted', riskColor: '#16a34a', riskLabel: 'Good', accepted: true, qualityStatus: 'accepted' };
    }
    if (normalizedScore >= 50) {
        return { riskLevel: 'medium', riskColor: '#d97706', riskLabel: 'Needs Improvement', accepted: false, qualityStatus: 'medium_risk' };
    }
    return { riskLevel: 'high', riskColor: '#ef4444', riskLabel: 'Non-Compliant', accepted: false, qualityStatus: 'high_risk' };
}

const CATEGORY_MAX = 15;
const POINTS_PER_CHECK = 5;
const CATEGORY_LABELS = [
    'Paragraph Structure',
    'Academic Update',
    'Self-Improvement',
    'Family Update',
    'Difficulty Update',
];

const asText = (value) => {
    if (value === null || typeof value === 'undefined') return '';
    return String(value).trim();
};

export const CHECKLIST = [
    { id: 'name',    label: 'Scholar name filled in',              check: (i) => asText(i.name).length > 2 },
    { id: 'age',     label: 'Age provided',                        check: (i) => asText(i.age).length > 0 },
    { id: 'year',    label: 'Year level provided',                 check: (i) => asText(i.year).length > 0 },
    { id: 'course',  label: 'Course or track/strand provided',     check: (i) => !hasEducationProgram(i.year) || asText(getEducationStage(i.year) === 'senior_high' ? i.track_strand : i.course).length > 2 },
    { id: 'school',  label: 'School provided',                     check: (i) => asText(i.school).length > 2 },
    { id: 'length',  label: 'Letter meets length (150+ words)',    check: (_, b) => countWords(asText(b)) >= 150 },
    { id: 'media',   label: 'At least 1 documentation photo',      check: (_, _b, m) => Array.isArray(m) && m.length >= 1 },
    { id: 'mdesc',   label: 'All photos have descriptions',        check: (_, _b, m) => Array.isArray(m) && m.length > 0 && m.every(p => asText(p.description).length > 3) },
];

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

export function countWords(text) {
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
    const hasNegationBeforeDifficulty = (negations) => new RegExp(
        String.raw`(?:^|[^\p{L}\p{N}])(?:${keywordAlternatives(negations)})${negationGap}(?:${difficultyAlternatives})(?=$|[^\p{L}\p{N}])`,
        'iu',
    ).test(sentence);

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
            && !isNegatedDifficulty(clause)
        ))
    ));
}

function reportsDifficulty(text) {
    return getReportedDifficultySentences(text).length > 0;
}

export function calcReportCategories(body) {
    const normalized = asText(body);
    const context = {
        text: normalized,
        words: countWords(normalized),
        sentences: countSentences(normalized),
        paragraphs: countParagraphs(normalized),
        difficultySentences: getReportedDifficultySentences(normalized),
    };
    const categories = [
        {
            key: 'Paragraph Structure',
            checks: [
                context.paragraphs >= 2,
                context.sentences >= 4,
                context.words >= 150,
            ],
        },
        {
            key: 'Academic Update',
            checks: [
                matchesAny(context.text, KEYWORDS.academicTopics),
                matchesAny(context.text, KEYWORDS.academicActions),
                matchesAny(context.text, KEYWORDS.academicOutcomes),
            ],
        },
        {
            key: 'Self-Improvement',
            checks: [
                matchesAny(context.text, KEYWORDS.improvement),
                matchesAny(context.text, KEYWORDS.effort),
                matchesAny(context.text, KEYWORDS.goals),
            ],
        },
        {
            key: 'Family Update',
            checks: [
                matchesAny(context.text, KEYWORDS.familyMembers),
                matchesAny(context.text, KEYWORDS.familySupport),
                matchesAny(context.text, KEYWORDS.familyContext),
            ],
        },
        {
            key: 'Difficulty Update',
            checks: [
                context.difficultySentences.length > 0,
                context.difficultySentences.some((sentence) => matchesAny(sentence, KEYWORDS.difficultyContext)),
                context.difficultySentences.some((sentence) => matchesAny(sentence, KEYWORDS.copingActions)),
            ],
        },
    ];

    return Object.fromEntries(
        categories.map(({ key, checks }) => [
            key,
            checks.filter(Boolean).length * POINTS_PER_CHECK,
        ]),
    );
}

export function calcReportScore(info, body) {
    const categoryScore = Object.values(calcReportCategories(body)).reduce((total, score) => total + score, 0);
    return Math.round((categoryScore / (CATEGORY_MAX * CATEGORY_LABELS.length)) * LETTER_BODY_MAX);
}

export function calcInfoScore(info) {
    let score = 0;
    score += asText(info.name).length > 2 ? 1.5 : 0;
    score += asText(info.age).length > 0 ? 0.5 : 0;
    score += asText(info.year).length > 0 ? 0.75 : 0;
    score += !hasEducationProgram(info.year) || asText(getEducationStage(info.year) === 'senior_high' ? info.track_strand : info.course).length > 2 ? 1 : 0;
    score += asText(info.school).length > 2 ? 1 : 0;
    score += asText(info.date).length > 0 ? 0.25 : 0;
    return Math.min(Math.round(score), INFO_MAX);
}

export function isInfoBlank(info) {
    return !asText(info.name)
        && !asText(info.age)
        && !asText(info.year)
        && !asText(info.course)
        && !asText(info.track_strand)
        && !asText(info.school)
        && !asText(info.date);
}

export function calcMediaScore(media) {
    if (!Array.isArray(media) || media.length === 0) return 0;

    const photos = Array.isArray(media) ? media.length : 0;
    const described = Array.isArray(media) ? media.filter(m => m.description?.trim().length > 3).length : 0;
    const pictureScore = photos >= 1 ? 15 : 0;
    const captionScore = Math.min(described, photos) >= 1 ? 5 : 0;
    const total = Math.min(Math.round(pictureScore + captionScore), DOCUMENTATION_MAX);
    return total;
}

export function buildEval(info, body, media) {
    const categories = calcReportCategories(body);
    const rawReportScore = calcReportScore(info, body);
    const mediaScore = calcMediaScore(media);
    const infoScore = calcInfoScore(info);

    const reportScore = rawReportScore;
    const overallScore = Math.min(Math.round(reportScore + mediaScore + infoScore), 100);

    const checklist = CHECKLIST.map(item => ({ item, passed: item.check(info, body, media) }));

    const quality = classifyQualityScore(overallScore);

    const sentimentLabel = overallScore >= 75 ? 'Positive' : overallScore >= 50 ? 'Neutral' : 'Negative';
    const sentimentScore = Math.max(-1, Math.min(1, (overallScore - 50) / 50));

    return {
        reportScore,
        categories,
        categoryScore: Object.values(categories).reduce((total, score) => total + score, 0),
        bodyCriteria: CATEGORY_LABELS.map((label) => ({ key: label, label, score: categories[label], max: CATEGORY_MAX })),
        mediaScore,
        infoScore,
        overallScore,
        checklist,
        ...quality,
        sentimentLabel,
        sentimentScore,
    };
}

export function getRiskBg(l) { return l === 'accepted' ? '#f0fdf4' : l === 'medium' ? '#fffbeb' : '#fef2f2'; }
export function getRiskBorder(l) { return l === 'accepted' ? '#bbf7d0' : l === 'medium' ? '#fde68a' : '#fecaca'; }
