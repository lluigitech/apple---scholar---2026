const KEYWORDS = require('../../shared/letterBodyRules.json');
const { getReportedDifficultySentences } = require('./letterBodyScoring');

const CATEGORY_MAX = 15;
const TOTAL_MAX = CATEGORY_MAX * 5;
const CATEGORY_NAMES = [
    'Paragraph Structure',
    'Academic Update',
    'Self-Improvement',
    'Family Update',
    'Difficulty Update',
];
const DIMENSION_MAXIMUMS = {
    relevance: 3,
    specificity: 4,
    context: 4,
    explanation: 4,
};
const patternCache = new Map();

const STRUCTURE_TERMS = {
    greeting: [
        'dear', 'hello', 'good day', 'good morning', 'good afternoon',
    ],
    opening: [
        'i am', 'i would like to share', 'i want to share', 'this month',
        'this semester',
    ],
    closing: [
        'thank you', 'thanks',
    ],
    signature: [
        'sincerely', 'respectfully', 'regards', 'yours truly',
        'your scholar',
    ],
    transitions: [
        'also', 'however', 'therefore', 'in addition', 'as a result',
        'on the other hand', 'at the same time',
    ],
};

const TIME_TERMS = [
    'this month', 'this semester', 'this term', 'this school year',
    'during the month', 'every week', 'every day', 'each week',
    'each day', 'each evening', 'every evening', 'weekly', 'daily',
];
const EXPLANATION_TERMS = [
    'because', 'so that', 'as a result', 'which helped', 'this helped',
    'which allowed', 'so i could', 'this meant', 'in order to',
    'as a way to', 'it helped', 'which helped',
];
const OUTCOME_TERMS = [
    'resulted in', 'improved', 'learned', 'achieved', 'completed',
    'passed', 'earned', 'increased', 'decreased', 'understood',
    'understand', 'helped', 'finished', 'continued',
];
const PERSON_TERMS = [
    'i', 'me', 'my', 'we', 'our',
];
const ACADEMIC_ITEMS = [
    'class', 'classes', 'subject', 'subjects', 'grade', 'grades',
    'exam', 'exams', 'quiz', 'quizzes', 'test', 'tests', 'project',
    'projects', 'assignment', 'assignments', 'research', 'thesis',
    'school activity', 'activities', 'presentation', 'presentations',
];
const ACADEMIC_TOPIC_TERMS = [
    ...KEYWORDS.academicTopics,
    'research', 'thesis',
];
const ACADEMIC_RESULTS = [
    'grade', 'grades', 'score', 'scores', 'mark', 'marks', 'result',
    'results', 'passed', 'earned', 'completed',
];
const SELF_METHODS = [
    'study habit', 'study habits', 'time management', 'practice',
    'practiced', 'review', 'reviewed', 'read', 'reading', 'skill',
    'skills', 'lesson', 'lessons', 'learned',
];
const SELF_PLAN_TERMS = [
    'plan', 'planned', 'intend', 'will try', 'want to', 'aim to',
    'goal', 'goals',
];
const FAMILY_STATUS_TERMS = [
    'doing well', 'doing fine', 'is well', 'is fine', 'is doing okay',
    'okay',
];
const FAMILY_CONTEXT_ITEMS = [
    'work', 'works', 'worked', 'working', 'health', 'income', 'livelihood', 'chores', 'household',
    'responsibilities', 'expenses', 'finances', 'business', 'job',
];
const FAMILY_PRONOUNS = [
    'they', 'their', 'them', 'we', 'our',
];
const DIFFICULTY_NEGATION_TERMS = [
    ...KEYWORDS.englishNegations,
];
const SELF_NEGATION_TERMS = [
    ...KEYWORDS.englishNegations,
];
const COPING_ACTIONS = [
    ...KEYWORDS.copingActions,
    'asked', 'borrowed', 'saved', 'reorganized', 'contacted',
    'rescheduled', 'adjusted my schedule',
];

const EXPERIMENTAL_SCORING_LIMITATIONS = [
    'This scorer uses explainable phrase and context heuristics; it does not understand language as reliably as a human evaluator.',
    'Only English letters are supported; unlisted paraphrases and inflections may be missed.',
    'Difficulty negation detection reuses the production sentence detector and has known scope and clause-boundary limitations.',
    'Evidence dimensions are proposed operational judgments, not evaluator-approved point anchors.',
    'The scorer returns indicator labels and dimension explanations, not letter text or personal information.',
];

const DIMENSION_DESCRIPTIONS = {
    relevance: [
        'no relevant evidence',
        'a topic is mentioned but relevance is weak',
        'the evidence is relevant to the category',
        'the evidence directly addresses the category rubric',
    ],
    specificity: [
        'no specific detail',
        'a general statement',
        'an identifiable action, situation, or component',
        'a concrete example with useful particulars',
        'a precise example with meaningful detail',
    ],
    context: [
        'no context',
        'limited context',
        'some relevant circumstances or timeframe',
        'context connects the evidence to the update',
        'the situation is clearly contextualized',
    ],
    explanation: [
        'no explanation',
        'a bare assertion',
        'what happened or what is planned is stated',
        'the action, outcome, or response is explained',
        'the explanation clearly connects circumstances and outcome',
    ],
};

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function phrasePattern(phrase) {
    if (!patternCache.has(phrase)) {
        const escaped = phrase.split(/\s+/).map(escapeRegex).join('\\s+');
        patternCache.set(
            phrase,
            new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'iu'),
        );
    }

    return patternCache.get(phrase);
}

function hasTerm(text, term) {
    return phrasePattern(term).test(text);
}

function hasAny(text, terms) {
    return terms.some((term) => hasTerm(text, term));
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

function splitClauses(sentence) {
    return sentence
        .split(/\b(?:but|however|although|though|yet)\b/iu)
        .map((clause) => clause.trim())
        .filter(Boolean);
}

function splitParagraphs(text) {
    return text
        .split(/\n\s*\n+/u)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);
}

function sentenceGroups(text) {
    return splitParagraphs(text).map(splitSentences);
}

function hasTimeContext(text) {
    return hasAny(text, TIME_TERMS)
        || hasQuantifiedDetail(text);
}

function hasQuantifiedDetail(text) {
    return /(?:^|[^\p{L}\p{N}])\d+(?:[.,]\d+)?\s*%?(?=$|[^\p{L}\p{N}])/u.test(text);
}

function hasExplanatoryLink(text) {
    return hasAny(text, EXPLANATION_TERMS);
}

function hasOutcome(text) {
    return hasAny(text, OUTCOME_TERMS);
}

function hasFirstPerson(text) {
    return hasAny(text, PERSON_TERMS);
}

function hasNegatedDifficulty(text) {
    const sentences = splitSentences(text);
    return sentences.some((sentence) => (
        hasAny(sentence, DIFFICULTY_NEGATION_TERMS)
        && hasAny(sentence, KEYWORDS.difficultyWords)
    ));
}

function hasNegatedTarget(text, targets) {
    const negations = SELF_NEGATION_TERMS
        .map((term) => term.split(/\s+/).map(escapeRegex).join('\\s+'))
        .join('|');
    const targetAlternatives = targets
        .map((term) => term.split(/\s+/).map(escapeRegex).join('\\s+'))
        .join('|');
    const pattern = new RegExp(
        `(?:^|[^\\p{L}\\p{N}])(?:${negations})(?:\\s+[\\p{L}\\p{N}'’\\-]+){0,5}\\s+(?:${targetAlternatives})(?=$|[^\\p{L}\\p{N}])`,
        'iu',
    );
    return pattern.test(text);
}

function clampDimension(value, maximum) {
    return Math.max(0, Math.min(maximum, Math.round(value)));
}

function getBand(score) {
    if (score === 0) return 'Absent';
    if (score <= 3) return 'Barely mentioned';
    if (score <= 8) return 'Brief or vague';
    if (score <= 12) return 'Present with some specifics';
    return 'Detailed and specific';
}

function makeResult(dimensions, evidenceIndicators = [], reviewRequired = false) {
    const dimensionScores = {
        relevance: clampDimension(dimensions.relevance, DIMENSION_MAXIMUMS.relevance),
        specificity: clampDimension(dimensions.specificity, DIMENSION_MAXIMUMS.specificity),
        context: clampDimension(dimensions.context, DIMENSION_MAXIMUMS.context),
        explanation: clampDimension(dimensions.explanation, DIMENSION_MAXIMUMS.explanation),
    };
    const score = Object.values(dimensionScores).reduce((total, value) => total + value, 0);
    const explanation = Object.entries(dimensionScores)
        .map(([dimension, value]) => `${dimension}: ${DIMENSION_DESCRIPTIONS[dimension][value]}`)
        .join('; ');

    return {
        score,
        band: getBand(score),
        dimensionScores,
        evidenceIndicators: [...new Set(evidenceIndicators)],
        explanation,
        reviewRequired,
    };
}

function getTopicDomains(paragraph) {
    const domains = [];
    if (hasAny(paragraph, [...ACADEMIC_TOPIC_TERMS, ...KEYWORDS.academicActions])) {
        domains.push('academic');
    }
    if (hasAny(paragraph, [...KEYWORDS.improvement, ...KEYWORDS.effort, ...KEYWORDS.goals])) {
        domains.push('self_improvement');
    }
    if (hasAny(paragraph, [...KEYWORDS.familyMembers, ...KEYWORDS.familyContext])) {
        domains.push('family');
    }
    if (hasAny(paragraph, KEYWORDS.difficultyWords)) {
        domains.push('difficulty');
    }
    return domains;
}

function scoreParagraphStructure(text, paragraphs, groupedSentences) {
    if (!text) {
        return makeResult({ relevance: 0, specificity: 0, context: 0, explanation: 0 });
    }

    const firstParagraph = paragraphs[0] || '';
    const lastParagraph = paragraphs[paragraphs.length - 1] || '';
    const firstSentence = groupedSentences[0]?.[0] || '';
    const allSentences = groupedSentences.flat();
    const hasGreeting = hasAny(firstParagraph, STRUCTURE_TERMS.greeting);
    const hasOpening = hasAny(firstSentence, STRUCTURE_TERMS.opening);
    const hasClosing = hasAny(lastParagraph, STRUCTURE_TERMS.closing);
    const hasSignature = hasAny(lastParagraph, STRUCTURE_TERMS.signature);
    const hasTransitions = allSentences.length > 1 && hasAny(text, STRUCTURE_TERMS.transitions);
    const domainsByParagraph = paragraphs.map(getTopicDomains);
    const hasTopicGrouping = domainsByParagraph.some((first, firstIndex) => (
        domainsByParagraph.slice(firstIndex + 1).some((second) => (
            first.some((domain) => second.some((other) => other !== domain))
        ))
    ));
    const componentCount = [
        hasGreeting,
        hasOpening,
        hasClosing,
        hasSignature,
        hasTopicGrouping,
    ].filter(Boolean).length;
    const hasParagraphOrganization = paragraphs.length > 1 && hasTopicGrouping;
    const hasStructureCue = componentCount > 0 || hasTransitions || hasTopicGrouping;
    const evidenceIndicators = [];

    if (hasGreeting) evidenceIndicators.push('greeting_detected');
    if (hasOpening) evidenceIndicators.push('opening_detected');
    if (hasParagraphOrganization) evidenceIndicators.push('distinct_topic_grouping_detected');
    if (hasClosing) evidenceIndicators.push('closing_or_thanks_detected');
    if (hasSignature) evidenceIndicators.push('signature_marker_detected');
    if (hasTransitions) evidenceIndicators.push('transition_in_multi_sentence_text');
    if (!hasStructureCue) {
        return makeResult(
            { relevance: 0, specificity: 0, context: 0, explanation: 0 },
            ['no_structure_evidence_detected'],
        );
    }

    const relevance = componentCount >= 3 && hasTransitions ? 3 : componentCount >= 2 ? 2 : 1;
    const specificity = Math.min(4, componentCount + (hasParagraphOrganization ? 1 : 0));
    const context = Math.min(
        4,
        (hasParagraphOrganization ? 2 : 0)
            + (hasOpening ? 1 : 0)
            + (hasTransitions ? 1 : 0),
    );
    const explanation = Math.min(
        4,
        (hasTransitions ? 2 : 0)
            + (hasTopicGrouping ? 1 : 0)
            + (hasClosing ? 1 : 0),
    );

    return makeResult({ relevance, specificity, context, explanation }, evidenceIndicators);
}

function scoreAcademicUpdate(groupedSentences) {
    const assessments = [];

    for (const sentences of groupedSentences) {
        const text = sentences.join(' ');
        const topicSentences = sentences.filter((sentence) => (
            hasAny(sentence, ACADEMIC_TOPIC_TERMS)
        ));
        if (topicSentences.length === 0) continue;

        const actionSentences = topicSentences.filter((sentence) => (
            hasAny(sentence, KEYWORDS.academicActions)
            || hasAny(sentence, KEYWORDS.academicOutcomes)
        ));
        const itemSentences = actionSentences.filter((sentence) => hasAny(sentence, ACADEMIC_ITEMS));
        const outcomeEvidence = itemSentences.some((sentence) => (
            hasAny(sentence, ACADEMIC_RESULTS) || hasOutcome(sentence)
        ));
        const periodEvidence = hasTimeContext(text);
        const explanationEvidence = hasExplanatoryLink(text)
            || (outcomeEvidence && actionSentences.length > 0);
        const directlyLinked = itemSentences.length > 0;
        const dimensions = {
            relevance: directlyLinked ? 3 : actionSentences.length > 0 ? 2 : 1,
            specificity: directlyLinked
                ? (outcomeEvidence ? 4 : 3)
                : actionSentences.length > 0 ? 2 : 1,
            context: Math.min(
                4,
                (periodEvidence ? 1 : 0)
                    + (directlyLinked ? 1 : 0)
                    + (outcomeEvidence ? 1 : 0)
                    + (explanationEvidence ? 1 : 0),
            ),
            explanation: Math.min(
                4,
                (actionSentences.length > 0 ? 1 : 0)
                    + (outcomeEvidence ? 1 : 0)
                    + (explanationEvidence ? 2 : 0),
            ),
        };
        const indicators = ['academic_topic_detected'];
        if (actionSentences.length > 0) indicators.push('academic_action_or_outcome');
        if (directlyLinked) indicators.push('identifiable_academic_item');
        if (periodEvidence) indicators.push('period_or_context_detail');
        if (outcomeEvidence) indicators.push('academic_result_or_progress');
        if (explanationEvidence) indicators.push('update_explained');

        assessments.push(makeResult(dimensions, indicators));
    }

    return assessments.sort((left, right) => right.score - left.score)[0]
        || makeResult({ relevance: 0, specificity: 0, context: 0, explanation: 0 });
}

function scoreSelfImprovement(groupedSentences) {
    const selfTerms = [...KEYWORDS.improvement, ...KEYWORDS.effort, ...KEYWORDS.goals];
    const methodTerms = [...SELF_METHODS, ...SELF_PLAN_TERMS];
    const assessments = [];

    for (const sentences of groupedSentences) {
        const allText = sentences.join(' ');
        const selfTopicSentences = sentences.flatMap(splitClauses).filter((sentence) => (
            hasAny(sentence, selfTerms)
            || (hasFirstPerson(sentence) && hasAny(sentence, methodTerms))
        ));
        if (selfTopicSentences.length === 0) continue;

        const negatedSentences = selfTopicSentences.filter((sentence) => (
            hasNegatedTarget(sentence, [...selfTerms, ...SELF_METHODS])
        ));
        const positiveSentences = selfTopicSentences.filter((sentence) => (
            !hasNegatedTarget(sentence, [...selfTerms, ...SELF_METHODS])
        ));
        if (positiveSentences.length === 0) {
            assessments.push(makeResult(
                { relevance: 0, specificity: 0, context: 0, explanation: 0 },
                ['self_improvement_claim_negated'],
                true,
            ));
            continue;
        }

        const text = positiveSentences.join(' ');
        const hasPersonalAttribution = hasFirstPerson(text);
        const hasImprovementTheme = hasAny(text, [...KEYWORDS.improvement, ...KEYWORDS.goals]);
        const hasEffortOrPlan = hasAny(text, [...KEYWORDS.effort, ...SELF_PLAN_TERMS]);
        const hasMethod = hasAny(text, SELF_METHODS);
        const hasSpecificObject = hasAny(text, [
            'study habit', 'time management', 'skill', 'skills', 'english',
            'reading', 'reviewing', 'practice',
            'vocabulary',
        ]);
        const hasContext = hasTimeContext(text);
        const hasPurposeOrReason = hasExplanatoryLink(text);
        const hasProgressOrLesson = hasOutcome(text)
            || hasAny(text, ['lesson learned', 'natutunan ko', 'napansin ko', 'progress']);
        const linkedAction = positiveSentences.some((sentence) => (
            hasAny(sentence, [...KEYWORDS.effort, ...SELF_PLAN_TERMS, ...SELF_METHODS])
        ));
        const relevance = hasImprovementTheme && (hasMethod || hasSpecificObject)
            ? 3
            : (hasImprovementTheme && hasEffortOrPlan) || (hasPersonalAttribution && hasMethod)
                ? 2
                : 1;
        const specificity = !hasEffortOrPlan && !hasMethod
            ? 1
            : hasSpecificObject ? 4
                : hasMethod ? 3 : 1;
        const context = Math.min(
            4,
            (hasContext ? 1 : 0)
                + (hasPurposeOrReason ? 1 : 0)
                + (hasProgressOrLesson ? 1 : 0)
                + (hasPersonalAttribution && linkedAction && hasMethod ? 1 : 0),
        );
        const explanation = Math.min(
            4,
            (hasEffortOrPlan || hasMethod ? 1 : 0)
                + (linkedAction ? 1 : 0)
                + (hasPurposeOrReason ? 1 : 0)
                + (hasProgressOrLesson ? 1 : 0),
        );
        const indicators = ['self_improvement_evidence_detected'];
        if (hasPersonalAttribution) indicators.push('self_attribution_detected');
        if (hasEffortOrPlan) indicators.push('action_or_plan_detected');
        if (hasMethod) indicators.push('improvement_method_detected');
        if (hasSpecificObject) indicators.push('specific_skill_or_habit_detected');
        if (hasContext) indicators.push('time_or_circumstance_detected');
        if (hasProgressOrLesson) indicators.push('progress_or_lesson_detected');
        if (hasPurposeOrReason) indicators.push('purpose_or_reason_detected');
        if (negatedSentences.length > 0 || hasNegatedTarget(allText, [...selfTerms, ...SELF_METHODS])) {
            indicators.push('mixed_negated_and_positive_self_improvement_evidence');
        }

        assessments.push(makeResult(
            { relevance, specificity, context, explanation },
            indicators,
            negatedSentences.length > 0,
        ));
    }

    return assessments.sort((left, right) => right.score - left.score)[0]
        || makeResult({ relevance: 0, specificity: 0, context: 0, explanation: 0 });
}

function scoreFamilyUpdate(groupedSentences) {
    const assessments = [];

    for (const sentences of groupedSentences) {
        const text = sentences.join(' ');
        const familySentences = sentences.filter((sentence) => (
            hasAny(sentence, KEYWORDS.familyMembers)
        ));
        if (familySentences.length === 0) continue;

        const familyReference = familySentences.length > 0;
        const contextTerms = [...KEYWORDS.familyContext, ...FAMILY_CONTEXT_ITEMS];
        const contextSentences = sentences.filter((sentence) => hasAny(sentence, contextTerms));
        const statusSentences = sentences.filter((sentence) => hasAny(sentence, FAMILY_STATUS_TERMS));
        const nearbyFamilyReference = contextSentences.some((sentence) => (
            familySentences.includes(sentence)
            || hasAny(sentence, FAMILY_PRONOUNS)
        ));
        const hasFamilyContext = nearbyFamilyReference
            || (statusSentences.length > 0 && familyReference);
        const hasSpecificArea = contextSentences.some((sentence) => (
            hasAny(sentence, FAMILY_CONTEXT_ITEMS)
        ));
        const hasExplanatoryLinkEvidence = hasExplanatoryLink(text);
        const hasSituationChange = hasAny(text, [
            'changed', 'reduced', 'increased', 'work', 'works', 'worked', 'working',
            'labor',
        ]);
        const hasTime = hasTimeContext(text);
        const hasConcreteParticular = hasSpecificArea
            && (hasTime || hasExplanatoryLinkEvidence || hasQuantifiedDetail(text) || hasSituationChange);
        const hasConnectedSituation = hasFamilyContext
            && (hasExplanatoryLinkEvidence || hasTime || hasConcreteParticular);
        const dimensions = {
            relevance: hasConnectedSituation ? 3 : hasFamilyContext ? 2 : 1,
            specificity: hasConcreteParticular ? 4 : hasSpecificArea ? 3 : hasFamilyContext ? 2 : 1,
            context: Math.min(
                4,
                (hasFamilyContext ? 1 : 0)
                    + (hasTime ? 1 : 0)
                    + (hasExplanatoryLinkEvidence ? 1 : 0)
                    + (hasConnectedSituation ? 1 : 0),
            ),
            explanation: Math.min(
                4,
                (hasFamilyContext ? 1 : 0)
                    + (hasSpecificArea ? 1 : 0)
                    + (hasExplanatoryLinkEvidence ? 1 : 0)
                    + (hasConnectedSituation ? 1 : 0),
            ),
        };
        const indicators = ['family_reference_detected'];
        if (hasFamilyContext) indicators.push('family_situation_linked');
        if (hasSpecificArea) indicators.push('specific_family_area_detected');
        if (hasTime) indicators.push('time_or_circumstance_detected');
        if (hasExplanatoryLinkEvidence) indicators.push('family_change_or_explanation_detected');
        if (hasConnectedSituation) indicators.push('family_context_connected');

        assessments.push(makeResult(dimensions, indicators));
    }

    return assessments.sort((left, right) => right.score - left.score)[0]
        || makeResult({ relevance: 0, specificity: 0, context: 0, explanation: 0 });
}

function scoreDifficultyUpdate(text, groupedSentences) {
    const reported = getReportedDifficultySentences(text);
    const negatedEvidence = hasNegatedDifficulty(text);
    if (reported.length === 0) {
        return makeResult(
            { relevance: 0, specificity: 0, context: 0, explanation: 0 },
            negatedEvidence ? ['negated_difficulty_not_scored_as_reported'] : [],
        );
    }

    const assessments = [];
    for (const sentences of groupedSentences) {
        const paragraph = sentences.join(' ');
        const reportedHere = getReportedDifficultySentences(paragraph);
        if (reportedHere.length === 0) continue;

        const hasDifficultyContext = hasAny(paragraph, KEYWORDS.difficultyContext);
        const hasCopingResponse = hasAny(paragraph, COPING_ACTIONS);
        const hasImpact = hasAny(paragraph, [
            'affected', 'impact', 'because', 'so', 'prevented', 'made it hard',
            'interrupted', 'which helped', 'allowed me',
        ]);
        const hasTime = hasTimeContext(paragraph);
        const hasExplanation = hasExplanatoryLink(paragraph) || hasImpact;
        const hasSpecificChallenge = hasDifficultyContext || hasImpact;
        const linkedResponse = hasCopingResponse && (hasDifficultyContext || hasImpact);
        const dimensions = {
            relevance: linkedResponse ? 3 : hasSpecificChallenge ? 2 : 1,
            specificity: hasImpact && hasDifficultyContext ? 4
                : hasSpecificChallenge ? 3
                    : hasCopingResponse ? 2 : 1,
            context: Math.min(
                4,
                (hasDifficultyContext ? 1 : 0)
                    + (hasTime ? 1 : 0)
                    + (hasImpact ? 1 : 0)
                    + (linkedResponse ? 1 : 0),
            ),
            explanation: Math.min(
                4,
                (hasCopingResponse ? 1 : 0)
                    + (linkedResponse ? 1 : 0)
                    + (hasExplanation ? 1 : 0)
                    + (hasImpact ? 1 : 0),
            ),
        };
        const indicators = ['reported_difficulty_detected'];
        if (hasDifficultyContext) indicators.push('difficulty_context_detected');
        if (hasCopingResponse) indicators.push('coping_or_response_detected');
        if (hasImpact) indicators.push('difficulty_impact_detected');
        if (hasTime) indicators.push('time_or_circumstance_detected');
        if (hasExplanation) indicators.push('response_or_cause_explained');
        if (negatedEvidence) indicators.push('mixed_negated_and_reported_evidence');

        assessments.push(makeResult(dimensions, indicators, negatedEvidence));
    }

    return assessments.sort((left, right) => right.score - left.score)[0]
        || makeResult(
            { relevance: 0, specificity: 0, context: 0, explanation: 0 },
            negatedEvidence ? ['negated_difficulty_not_scored_as_reported'] : [],
        );
}

function scoreLetterBodyExperimentalV3(body) {
    const text = normalizeText(body);
    const paragraphs = splitParagraphs(text);
    const groupedSentences = sentenceGroups(text);
    const categories = {
        'Paragraph Structure': scoreParagraphStructure(text, paragraphs, groupedSentences),
        'Academic Update': scoreAcademicUpdate(groupedSentences),
        'Self-Improvement': scoreSelfImprovement(groupedSentences),
        'Family Update': scoreFamilyUpdate(groupedSentences),
        'Difficulty Update': scoreDifficultyUpdate(text, groupedSentences),
    };
    const totalScore = Object.values(categories).reduce((total, category) => total + category.score, 0);

    return {
        evaluationMethod: 'experimental_rubric_evidence_v3',
        categories,
        totalScore,
        maxTotalScore: TOTAL_MAX,
    };
}

module.exports = {
    CATEGORY_MAX,
    CATEGORY_NAMES,
    DIMENSION_MAXIMUMS,
    EXPERIMENTAL_SCORING_LIMITATIONS,
    getBand,
    scoreLetterBodyExperimentalV3,
};
