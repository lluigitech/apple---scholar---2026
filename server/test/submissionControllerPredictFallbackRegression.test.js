const fs = require('fs');
const path = require('path');
const assert = require('assert');

const controllerContent = fs.readFileSync(
  path.join(__dirname, '..', 'controllers', 'submissionController.js'),
  'utf8'
);

assert.doesNotMatch(controllerContent, /const bodyEvaluation = scoreLetterBody\(rawLetter\);/, 'preview must not use baseline scorer for new submissions');
assert.doesNotMatch(controllerContent, /const bodyEvaluation = scoreLetterBody\(normalizedPayload\.letter_content\);/, 'submission must not use baseline scorer for new submissions');
assert.match(controllerContent, /const v3Evaluation = scoreLetterBodyExperimentalV3\(rawLetter\);/);
assert.match(controllerContent, /const v3Evaluation = scoreLetterBodyExperimentalV3\(normalizedPayload\.letter_content\);/);
assert.match(controllerContent, /normalizedPayload\.content_score = normalizeSubmissionValue\(v3Percentage\);/);
assert.match(controllerContent, /body_score: v3Evaluation\.totalScore/);
assert.match(controllerContent, /source: classification \? 'rule_based_v3_tfidf' : 'rule_based_v3'/);
assert.match(controllerContent, /fallback: !classification/);
assert.match(controllerContent, /predictLetterSentiment\(normalizedPayload\.letter_content\)/);
assert.match(controllerContent, /normalizedPayload\.sentiment_score = normalizeSubmissionValue\(classification\.sentiment_score\)/);
assert.match(controllerContent, /breakdown\.primary_classification = classification/);
assert.doesNotMatch(
  controllerContent,
  /predictLetterWithMl/,
  'active submission and preview classification must not call XLM-RoBERTa'
);

console.log('submissionController rule-based body scoring regression test passed');
