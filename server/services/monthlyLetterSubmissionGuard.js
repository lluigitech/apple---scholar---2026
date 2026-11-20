const { scoreLetterBodyExperimentalV3 } = require('./experimentalLetterBodyScoringV3');

const INVALID_LETTER_MESSAGE = 'This looks like instructions or a task prompt, not a Monthly Letter. Please replace it with your monthly update before submitting.';
const UNRELATED_LETTER_MESSAGE = 'This text does not appear to contain a monthly progress update. Please add information about your studies, progress, family situation, or challenges before submitting.';

const SECTION_HEADING = /^\s*(?:#{1,6}\s*)?(?:objective|task|instructions?|strict safety rules|after implementation|output)\s*:?\s*$/imu;
const DIRECTIVE_PATTERN = /\b(?:do not|don't|must not|preserve|remove only|update only|run (?:the )?(?:relevant )?tests|report (?:the exact|any remaining)|after implementation)\b/giu;
const LIST_ITEM_PATTERN = /^\s*(?:[-*]\s+|\d+[.)]\s+)/gm;

function inspectMonthlyLetterSubmission(value) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) {
        return { blocked: false, reason: null };
    }

    const hasPromptHeading = SECTION_HEADING.test(text);
    SECTION_HEADING.lastIndex = 0;
    const directiveCount = [...text.matchAll(DIRECTIVE_PATTERN)].length;
    DIRECTIVE_PATTERN.lastIndex = 0;
    const listItemCount = [...text.matchAll(LIST_ITEM_PATTERN)].length;
    LIST_ITEM_PATTERN.lastIndex = 0;

    const looksLikeInstructions = (
        hasPromptHeading && (directiveCount >= 2 || listItemCount >= 3)
    ) || (directiveCount >= 4 && listItemCount >= 3);

    if (looksLikeInstructions) {
        return { blocked: true, reason: INVALID_LETTER_MESSAGE };
    }

    const evaluation = scoreLetterBodyExperimentalV3(text);
    const updateCategories = [
        'Academic Update',
        'Self-Improvement',
        'Family Update',
        'Difficulty Update',
    ];
    const hasRelevantContent = updateCategories.some(
        (category) => evaluation.categories[category]?.score > 0,
    );
    const hasReportingPeriod = updateCategories.some((category) => (
        evaluation.categories[category]?.evidenceIndicators.some((indicator) => (
            indicator === 'period_or_context_detail'
            || indicator === 'time_or_circumstance_detected'
        ))
    ));
    const hasMonthlyUpdateEvidence = hasRelevantContent && hasReportingPeriod;

    return {
        blocked: !hasMonthlyUpdateEvidence,
        reason: hasMonthlyUpdateEvidence ? null : UNRELATED_LETTER_MESSAGE,
    };
}

module.exports = {
    INVALID_LETTER_MESSAGE,
    UNRELATED_LETTER_MESSAGE,
    inspectMonthlyLetterSubmission,
};
