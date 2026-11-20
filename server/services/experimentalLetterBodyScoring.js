const KEYWORDS = require('../../shared/letterBodyRules.json');
const { getReportedDifficultySentences } = require('./letterBodyScoring');

const CATEGORY_MAX = 15;
const TOTAL_MAX = CATEGORY_MAX * 5;
const patternCache = new Map();

const CATEGORY_NAMES = [
    'Paragraph Structure',
    'Academic Update',
    'Self-Improvement',
    'Family Update',
    'Difficulty Update',
];

const GREETING_TERMS = [
    'dear', 'hello', 'good day', 'good morning', 'good afternoon',
    'mahal kong', 'magandang araw', 'magandang umaga',
];
const OPENING_TERMS = [
    'i am', 'i would like to share', 'i want to share', 'this month',
    'this semester', 'ngayong buwan', 'sa buwang ito', 'ako po',
    'nais ko pong ibahagi',
];
const CLOSING_TERMS = [
    'thank you', 'thanks', 'salamat', 'maraming salamat', 'taos-puso',
    'lubos na nagpapasalamat',
];
const SIGNATURE_TERMS = [
    'sincerely', 'respectfully', 'regards', 'yours truly',
    'your scholar', 'lubos na gumagalang', 'sumasainyo',
];
const TRANSITION_TERMS = [
    'also', 'however', 'because', 'therefore', 'in addition',
    'as a result', 'but', 'then', 'dahil', 'kaya', 'pero',
    'samantala', 'bukod dito',
];
const DETAIL_TERMS = [
    'because', 'as a result', 'for example', 'such as', 'so that',
    'dahil', 'kaya', 'upang', 'halimbawa',
];
const PERIOD_TERMS = [
    'this month', 'this semester', 'this term', 'this school year',
    'during the month', 'ngayong buwan', 'sa buwang ito',
    'ngayong semestre', 'sa panahong ito',
];
const ACADEMIC_ITEMS = [
    'class', 'classes', 'subject', 'subjects', 'grade', 'grades',
    'exam', 'exams', 'quiz', 'quizzes', 'test', 'tests', 'project',
    'projects', 'assignment', 'assignments', 'research', 'thesis',
    'school activity', 'activities', 'presentation', 'presentations',
    'klase', 'asignatura', 'grado', 'proyekto', 'pagsusulit',
    'pananaliksik', 'aktibidad',
];
const SELF_METHODS = [
    'study habit', 'study habits', 'time management', 'practice',
    'practiced', 'review', 'reviewed', 'skill', 'skills', 'lesson',
    'lessons', 'learned', 'nag-aral', 'nagsikap', 'nagpraktis',
    'kasanayan', 'aral',
];
const SELF_PLAN_TERMS = [
    'plan', 'planned', 'intend', 'will try', 'want to', 'aim to',
    'goal', 'goals', 'balak', 'plano', 'sisikapin', 'nais kong',
];
const FAMILY_STATUS_TERMS = [
    'doing well', 'doing fine', 'is well', 'is fine', 'maayos',
    'mabuti', 'okay', 'kumusta',
];
const FAMILY_CONTEXT_ITEMS = [
    'work', 'health', 'income', 'livelihood', 'chores', 'household',
    'responsibilities', 'expenses', 'finances', 'trabaho', 'kalusugan',
    'kabuhayan', 'gawaing bahay', 'responsibilidad', 'gastusin',
    'pinansyal',
];

const EXPERIMENTAL_SCORING_LIMITATIONS = [
    'Heuristic keyword and pattern matching cannot reliably understand meaning, relevance, or coherence.',
    'English, Filipino, and Taglish phrase coverage is incomplete; paraphrases may be missed.',
    'Negation handling reuses the production difficulty-sentence detector and may miss complex or indirect negation.',
    'Specificity and detail indicators are proxies, not human judgments; numbers and context markers can be misleading.',
    'Evidence indicators are labels only. The scorer does not return letter text or personal information.',
];

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function termPattern(term) {
    if (!patternCache.has(term)) {
        const phrase = term.split(/\s+/).map(escapeRegex).join('\\s+');
        patternCache.set(
            term,
            new RegExp(`(?:^|[^\\p{L}\\p{N}])${phrase}(?=$|[^\\p{L}\\p{N}])`, 'iu'),
        );
    }

    return patternCache.get(term);
}

function hasTerm(text, term) {
    return termPattern(term).test(text);
}

function hasAny(text, terms) {
    return terms.some((term) => hasTerm(text, term));
}

function countMatchedTerms(text, terms) {
    return terms.reduce((count, term) => count + (hasTerm(text, term) ? 1 : 0), 0);
}

function normalizeText(body) {
    return typeof body === 'string' ? body.normalize('NFKC').trim().toLowerCase() : '';
}

function splitSentences(text) {
    return text
        .split(/[.!?;]+\s*|\r?\n+/u)
        .map((sentence) => sentence.trim())
        .filter(Boolean);
}

function splitParagraphs(text) {
    return text
        .split(/\n\s*\n+/u)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);
}

function hasQuantifiedDetail(text) {
    return /(?:^|[^\p{L}\p{N}])\d+(?:[.,]\d+)?\s*%?(?=$|[^\p{L}\p{N}])/u.test(text);
}

function hasContextualDetail(text) {
    return hasQuantifiedDetail(text)
        || hasAny(text, DETAIL_TERMS)
        || hasAny(text, PERIOD_TERMS);
}

function hasTopicGrouping(paragraphs) {
    const domainGroups = [
        [...KEYWORDS.academicTopics, ...KEYWORDS.academicActions],
        [...KEYWORDS.improvement, ...KEYWORDS.effort, ...KEYWORDS.goals],
        [...KEYWORDS.familyMembers, ...KEYWORDS.familyContext],
        KEYWORDS.difficultyWords,
    ];

    for (let firstIndex = 0; firstIndex < paragraphs.length; firstIndex++) {
        const firstDomains = domainGroups
            .map((terms, domainIndex) => (hasAny(paragraphs[firstIndex], terms) ? domainIndex : -1))
            .filter((domainIndex) => domainIndex >= 0);

        for (let secondIndex = firstIndex + 1; secondIndex < paragraphs.length; secondIndex++) {
            const secondDomains = domainGroups
                .map((terms, domainIndex) => (hasAny(paragraphs[secondIndex], terms) ? domainIndex : -1))
                .filter((domainIndex) => domainIndex >= 0);
            if (firstDomains.some((domainIndex) => secondDomains.some((other) => other !== domainIndex))) {
                return true;
            }
        }
    }

    return false;
}

function scoreParagraphStructure(text, sentences, paragraphs) {
    if (!text) {
        return { score: 0, evidenceIndicators: [] };
    }

    const firstSentence = sentences[0] || '';
    const lastParagraph = paragraphs[paragraphs.length - 1] || '';
    const hasGreeting = hasAny(paragraphs[0] || '', GREETING_TERMS);
    const hasOpening = hasAny(firstSentence, OPENING_TERMS);
    const hasTopicGroupingDetected = paragraphs.length >= 2 && hasTopicGrouping(paragraphs);
    const hasClosing = hasAny(lastParagraph, CLOSING_TERMS);
    const hasSignature = hasAny(lastParagraph, SIGNATURE_TERMS);
    const hasTransitions = sentences.length >= 2 && hasAny(text, TRANSITION_TERMS);
    const hasMultipleParagraphs = paragraphs.length >= 2;
    const signals = [
        hasGreeting,
        hasOpening,
        hasTopicGroupingDetected,
        hasClosing,
        hasSignature,
        hasTransitions,
        hasMultipleParagraphs,
    ].filter(Boolean).length;

    let score = 0;
    if (signals === 1) score = 2;
    else if (signals === 2) score = 6;
    else if (signals === 3) score = 9;
    else if (signals === 4) score = 12;
    else if (signals === 5) score = 14;
    else if (signals >= 6) score = 15;

    const evidenceIndicators = [];
    if (hasGreeting) evidenceIndicators.push('greeting_detected');
    if (hasOpening) evidenceIndicators.push('opening_statement_detected');
    if (hasMultipleParagraphs) evidenceIndicators.push('multiple_paragraphs_detected');
    if (hasTopicGroupingDetected) evidenceIndicators.push('topic_grouping_detected');
    if (hasClosing) evidenceIndicators.push('closing_or_thanks_detected');
    if (hasSignature) evidenceIndicators.push('closing_signature_marker_detected');
    if (hasTransitions) evidenceIndicators.push('transition_marker_detected');

    return { score, evidenceIndicators };
}

function scoreAcademicUpdate(sentences) {
    const academicSentences = sentences.filter((sentence) => (
        hasAny(sentence, KEYWORDS.academicTopics)
    ));
    if (academicSentences.length === 0) {
        return { score: 0, evidenceIndicators: [] };
    }

    const activitySentences = academicSentences.filter((sentence) => (
        hasAny(sentence, KEYWORDS.academicActions)
        || hasAny(sentence, KEYWORDS.academicOutcomes)
    ));
    const specificSentences = activitySentences.filter((sentence) => (
        hasAny(sentence, ACADEMIC_ITEMS)
    ));
    const contextualSpecificSentences = specificSentences.filter((sentence) => (
        hasContextualDetail(sentence)
    ));
    let score = 2;

    if (activitySentences.length > 0) score = 6;
    if (specificSentences.length > 0) score = 9;
    if (specificSentences.length > 1) score = 12;
    if (contextualSpecificSentences.length > 0) score = 13;
    if (
        (contextualSpecificSentences.length > 0 && specificSentences.length > 1)
        || (specificSentences.length > 0 && activitySentences.length > 1 && contextualSpecificSentences.length > 0)
    ) {
        score = 15;
    }

    const evidenceIndicators = ['academic_topic_mentioned'];
    if (activitySentences.length > 0) evidenceIndicators.push('academic_action_or_outcome_detected');
    if (specificSentences.length > 0) evidenceIndicators.push('identifiable_academic_item_detected');
    if (specificSentences.length > 1) evidenceIndicators.push('multiple_academic_updates_detected');
    if (contextualSpecificSentences.length > 0) evidenceIndicators.push('academic_contextual_detail_detected');

    return { score, evidenceIndicators };
}

function scoreSelfImprovement(sentences) {
    const selfTerms = [...KEYWORDS.improvement, ...KEYWORDS.effort, ...KEYWORDS.goals];
    const selfSentences = sentences.filter((sentence) => hasAny(sentence, selfTerms));
    if (selfSentences.length === 0) {
        return { score: 0, evidenceIndicators: [] };
    }

    const actionableSentences = selfSentences.filter((sentence) => (
        hasAny(sentence, KEYWORDS.effort) || hasAny(sentence, SELF_PLAN_TERMS)
    ));
    const methodSentences = actionableSentences.filter((sentence) => (
        hasAny(sentence, SELF_METHODS)
    ));
    const detailedMethodSentences = methodSentences.filter((sentence) => (
        hasContextualDetail(sentence)
    ));
    let score = 2;

    if (actionableSentences.length > 0) score = 6;
    if (methodSentences.length > 0) score = 10;
    if (methodSentences.length > 1) score = 13;
    if (detailedMethodSentences.length > 0) score = 14;
    if (detailedMethodSentences.length > 0 && methodSentences.length > 1) score = 15;

    const evidenceIndicators = ['self_improvement_topic_detected'];
    if (actionableSentences.length > 0) evidenceIndicators.push('action_or_plan_detected');
    if (methodSentences.length > 0) evidenceIndicators.push('specific_improvement_method_detected');
    if (methodSentences.length > 1) evidenceIndicators.push('multiple_improvement_details_detected');
    if (detailedMethodSentences.length > 0) evidenceIndicators.push('improvement_contextual_detail_detected');

    return { score, evidenceIndicators };
}

function scoreFamilyUpdate(sentences) {
    const familySentences = sentences.filter((sentence) => (
        hasAny(sentence, KEYWORDS.familyMembers)
    ));
    if (familySentences.length === 0) {
        return { score: 0, evidenceIndicators: [] };
    }

    const contextSentences = familySentences.filter((sentence) => (
        hasAny(sentence, KEYWORDS.familyContext) || hasAny(sentence, FAMILY_STATUS_TERMS)
    ));
    const specificContextSentences = contextSentences.filter((sentence) => (
        hasAny(sentence, FAMILY_CONTEXT_ITEMS)
    ));
    const detailedContextSentences = specificContextSentences.filter((sentence) => (
        hasContextualDetail(sentence)
    ));
    const contextConcepts = familySentences.reduce(
        (total, sentence) => total + countMatchedTerms(sentence, FAMILY_CONTEXT_ITEMS),
        0,
    );
    let score = 2;

    if (contextSentences.length > 0) score = 6;
    if (specificContextSentences.length > 0) score = 9;
    if (contextConcepts > 1) score = 12;
    if (detailedContextSentences.length > 0) score = 14;
    if (detailedContextSentences.length > 0 && contextConcepts > 1) score = 15;

    const evidenceIndicators = ['family_member_or_family_reference_detected'];
    if (contextSentences.length > 0) evidenceIndicators.push('family_situation_or_status_detected');
    if (specificContextSentences.length > 0) evidenceIndicators.push('specific_family_context_detected');
    if (contextConcepts > 1) evidenceIndicators.push('multiple_family_context_details_detected');
    if (detailedContextSentences.length > 0) evidenceIndicators.push('family_contextual_detail_detected');

    return { score, evidenceIndicators };
}

function scoreDifficultyUpdate(text) {
    const reportedSentences = getReportedDifficultySentences(text);
    if (reportedSentences.length === 0) {
        return { score: 0, evidenceIndicators: [] };
    }

    const contextualSentences = reportedSentences.filter((sentence) => (
        hasAny(sentence, KEYWORDS.difficultyContext)
    ));
    const responseSentences = reportedSentences.filter((sentence) => (
        hasAny(sentence, KEYWORDS.copingActions)
    ));
    const detailSentences = reportedSentences.filter((sentence) => (
        hasContextualDetail(sentence)
    ));
    const contextConcepts = reportedSentences.reduce(
        (total, sentence) => total + countMatchedTerms(sentence, KEYWORDS.difficultyContext),
        0,
    );

    let score = 2;
    if (contextualSentences.length > 0 || responseSentences.length > 0) score = 7;
    if (contextualSentences.length > 0 && responseSentences.length > 0) score = 12;
    if (
        contextualSentences.length > 0
        && responseSentences.length > 0
        && detailSentences.length > 0
    ) {
        score = contextConcepts > 1 ? 15 : 14;
    }

    const evidenceIndicators = ['difficulty_report_detected'];
    if (contextualSentences.length > 0) evidenceIndicators.push('difficulty_context_detected');
    if (responseSentences.length > 0) evidenceIndicators.push('response_or_coping_action_detected');
    if (detailSentences.length > 0) evidenceIndicators.push('difficulty_contextual_detail_detected');

    return { score, evidenceIndicators };
}

function getBand(score) {
    if (score === 0) return 'Absent';
    if (score <= 3) return 'Barely mentioned';
    if (score <= 8) return 'Brief or vague';
    if (score <= 12) return 'Present with some specifics';
    return 'Detailed and specific';
}

function scoreLetterBodyExperimental(body) {
    const text = normalizeText(body);
    const sentences = splitSentences(text);
    const paragraphs = splitParagraphs(text);
    const categoryResults = {
        'Paragraph Structure': scoreParagraphStructure(text, sentences, paragraphs),
        'Academic Update': scoreAcademicUpdate(sentences),
        'Self-Improvement': scoreSelfImprovement(sentences),
        'Family Update': scoreFamilyUpdate(sentences),
        'Difficulty Update': scoreDifficultyUpdate(text),
    };

    const categories = Object.fromEntries(
        CATEGORY_NAMES.map((name) => {
            const result = categoryResults[name];
            return [name, {
                score: result.score,
                band: getBand(result.score),
                evidenceIndicators: result.evidenceIndicators,
            }];
        }),
    );
    const totalScore = Object.values(categories).reduce((total, category) => total + category.score, 0);

    return {
        evaluationMethod: 'experimental_rubric_band',
        categories,
        totalScore,
        maxTotalScore: TOTAL_MAX,
    };
}

module.exports = {
    CATEGORY_MAX,
    CATEGORY_NAMES,
    EXPERIMENTAL_SCORING_LIMITATIONS,
    getBand,
    scoreLetterBodyExperimental,
};
