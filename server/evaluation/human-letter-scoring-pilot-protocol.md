# Human Letter-Scoring Pilot Protocol

## Purpose and limits

This proposed 36-letter pilot is strictly for:

- Checking rubric feasibility and identifying ambiguous category definitions.
- Measuring evaluator consistency and agreement.
- Testing the secure evaluation workflow.

It is not designed to be statistically representative, and it must not be used as definitive validation of model accuracy or as a definitive calibration/holdout study. Keep the 12 random cases and 24 targeted cases separately identified in analysis. Do not combine them to claim population-level performance.

The existing dataset's reference scores were AI-generated and have not been independently verified by human evaluators. They are not human ground truth. They may be used privately as sampling strata only, if authorized. No letters have been selected or scored for this protocol.

## Category definitions and rubric information

The workbook comments describe the five categories as follows:

- **Paragraph Structure:** greeting, opening, topic-based paragraphs, closing/thanks, signature, and coherent flow.
- **Academic Update:** a concrete update about studies during the period, such as classes, grades, subjects, thesis/research, or school activities.
- **Self-Improvement:** what the scholar does or plans to do to improve, such as study habits, skills, time management, or lessons learned.
- **Family Update:** family members, work, situation, finances, and how the family is doing.
- **Difficulty Update:** challenges faced during the period and how the scholar handled them.

The workbook provides broad bands, but no point-by-point scoring rules or category-specific weighting. The following anchors are **PROPOSED** for evaluator review; they are not officially approved rubric rules:

| Score | Proposed anchor |
|---|---|
| 0 | No relevant evidence |
| 1-3 | Barely mentioned |
| 4-8 | Brief or vague |
| 9-12 | Present with some specifics |
| 13-15 | Detailed and specific |

These anchors do not establish how to distinguish individual scores within a band. Evaluators must discuss and approve any added interpretation before scoring. Do not require every example in a category definition, multiple examples, or a particular number of sentences unless the evaluator confirms that as an official requirement. Do not reward length, repetition, or keywords by themselves.

### Questions to resolve with the evaluator before scoring

Record the answers in a dated, versioned rubric addendum before the pilot starts. Do not invent answers during scoring.

- **Paragraph Structure:** Are greeting, opening, topic-based paragraphs, closing/thanks, signature, and coherent flow all expected, or are they examples? How should missing components be weighed against otherwise coherent organization?
- **Academic Update:** What qualifies as an update about studies during the relevant period? Is a general statement about school sufficient, or must it describe a current class, result, activity, or other concrete event?
- **Self-Improvement:** Do plans or intentions count in the same way as actions already taken? How should a stated lesson learned without a described change in behavior be scored?
- **Family Update:** Is information about one family member or one aspect of family life sufficient? Are the listed aspects examples rather than required subtopics?
- **Difficulty Update:** Must a letter describe both a challenge and how it was handled, or can either component count on its own? How should an explicitly stated lack of difficulty be treated?
- **Across categories:** How should evaluators distinguish 0 from 1-3, choose a point within each band, handle negation or contradictory evidence, and score evidence that could fit more than one category?
- **Language and context:** How should evaluators handle mixed-language phrasing, indirect wording, or context-dependent statements without translation?

If these questions are not resolved, pause scoring and document the unresolved item rather than applying an unapproved rule.

## Proposed sample design

The proposed sample is **36 unique letters: 12 random cases and 24 targeted cases**.

1. **12 random cases:** draw randomly from the eligible dataset. Record the draw method and random seed in restricted sampling records so the draw can be reproduced without putting identifying information in evaluator materials.
2. **24 targeted cases:** select to improve coverage of category score bands, categories, and English, Filipino, and Taglish writing. Use the existing AI-generated reference bands, if authorized, only as private sampling strata; they are not verified human scores and must not be used to describe a case to evaluators. Select across categories and bands using multi-category coverage where possible. Aim for at least six cases in each language group when available, and include varied writing styles and levels of detail. Do not claim a quota was met if the source data does not support it.

Case-level V2/V3 disagreement information is **not confirmed to be available or authorized for sampling**. Do not assume it exists, calculate or regenerate predictions for this task, or show predictions to evaluators. If an authorized, pre-existing case-level disagreement list is later confirmed available, the data custodian may propose using it as a supplementary selection consideration without displacing the coverage goals above. Otherwise, use the alternative plan as written: select all 24 targeted cases for category/band and language/style coverage, and document that disagreement cases were not deliberately sampled. The existing aggregate validation reports alone do not identify per-case disagreements.

De-duplicate the random and targeted selections. If a candidate overlaps, retain it in one group and fill the open place from that group's eligible pool. Store the sampling-group label in restricted analysis data, not in evaluator packets. Analyze random and targeted results separately. The targeted sample is intentionally enriched and neither group supports a claim of population representativeness.

A coordinator may classify language and broad writing style for sampling without scoring. Keep these labels and the sampling record free of letter text and identifying details. Use random selection within available strata and document unavailable strata or shortfalls.

## Evaluator requirements and independent scoring

Both evaluators must:

- Be proficient in the language or languages used in the letter they score.
- Read and score the original letter; do not use machine translation.
- Score independently using an integer from 0 to 15 for each of the five categories.
- Provide a rationale for every category without copying letter text or including identifying details.
- Never see AI-generated reference scores, baseline predictions, V2/V3 predictions, previous comments, or the other evaluator's scores or rationales before their own form is submitted and locked.

Before distribution, the coordinator must confirm evaluator language proficiency and provide the same approved rubric version to both evaluators. Give them separate forms and independently randomized presentation orders. Evaluators must not discuss pilot cases before both forms are locked. The coordinator should collect and lock each form independently; only then may ratings be compared.

The evaluator should score only what the letter communicates for that category. Do not infer missing information from other categories. Do not treat a negated mention as positive evidence. If an explicit statement of absence or ambiguous wording arises, apply only the interpretation approved in the rubric addendum and note the issue in the rationale or uncertainty field.

## Privacy and data-handling approval checklist

Before any letter is distributed, the responsible data custodian must review and approve each item below. This protocol does not claim that any control is already approved or implemented.

- [ ] Authorization to use the records and applicable consent/privacy requirements are confirmed.
- [ ] Anonymization and re-identification-risk review is complete, including uncommon details that could identify a scholar.
- [ ] The authorized evaluator list is approved and access is restricted to those people.
- [ ] Secure storage and transfer methods for letters and evaluation forms are approved.
- [ ] Any re-identification key is stored separately with more restricted access and is not included in evaluator materials.
- [ ] A retention period and secure deletion process are set for evaluator copies, working files, and temporary extracts.
- [ ] Cases with unacceptable re-identification risk, or cases that cannot be safely anonymized without materially changing meaning, are excluded.

Assign a random study code that is not a scholar ID, name, initials, or reversible identifier. Replace direct identifiers and review indirect identifiers while preserving category-relevant meaning where possible. Use neutral placeholders that retain a relationship or role. Provide letters only in the approved secure environment. Do not copy letter text into forms, rationales, reports, email, or external tools. Rationales must not contain names, IDs, direct quotations, or unnecessary personal details.

## Disagreement and adjudication

Before scoring, evaluators must approve the disagreement triggers. **Proposed triggers** are a difference greater than two points, different proposed bands, disagreement on absent versus present, or an uncertainty flag. These are not official thresholds.

For a triggered category:

1. Preserve and lock the two original scores and rationales without edits.
2. A third evaluator who meets the language-proficiency requirement independently scores the original letter using the same rubric version. The third evaluator must not see the first two ratings or rationales before submitting and locking their own score.
3. Only after the third rating is locked may the evaluators discuss the evidence and rubric. Do not show AI reference scores or baseline/V2/V3 predictions during adjudication.
4. Record the adjudicated score separately with a concise rationale and the decision method. **Proposed method:** after discussion, the adjudicated score is the value supported by at least two of the three evaluators. If no value receives at least two votes, mark the category unresolved and refer it to the designated rubric adjudicator; do not manufacture a consensus score.
5. Preserve all three independent scores, rationales, and the adjudication record. Never replace or erase an original rating. Do not use unresolved ratings as a final human reference until resolved under the approved procedure.

Name the rubric adjudicator and approve the proposed decision method before the pilot. Record unresolved rubric questions for later review rather than silently changing the rubric mid-pilot.

## Evaluator-agreement analysis

Use the two original independent ratings, not adjudicated scores. Calculate these measures separately for each category and report the paired-rating sample size:

- Exact score agreement.
- Agreement within one point.
- Agreement in the same proposed score band.
- Mean absolute score difference.
- Quadratic-weighted Cohen's kappa as a supplementary measure only.

Report the measures separately for the 12 random cases and the 24 targeted cases, as well as descriptively for the full pilot if useful. With this small sample, category and subgroup estimates may be unstable; interpret them cautiously. Do not set or imply a pass/fail threshold without evaluator approval, and do not claim population representativeness, definitive rubric validity, or model accuracy from these results.

## Future calibration and holdout

The 36-letter pilot will not be used to make definitive model-calibration or holdout claims. Its purpose is rubric feasibility, evaluator agreement, identifying ambiguity, and workflow testing. A larger independently human-scored dataset is needed before model calibration and meaningful holdout evaluation.

For any future model evaluation, plan the dataset split before model tuning. Keep holdout labels unavailable during tuning, avoid leakage between related letters (for example, letters from the same scholar), and report performance on human-verified scores separately from prior agreement with AI-generated references.

## Pilot reporting

Report only aggregate pilot results and approved rubric/workflow findings. Do not include letter content, excerpts, names, scholar IDs, re-identification keys, or AI-generated reference scores represented as human scores.
