const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');
const { scoreLetterBodyExperimentalV3 } = require('../services/experimentalLetterBodyScoringV3');

const scoringSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'client', 'src', 'utils', 'submissionScoring.js'),
  'utf8'
);

assert.ok(scoringSource.includes('const LETTER_BODY_MAX = 75;'), 'letter-body max should be 75');
assert.ok(scoringSource.includes('const DOCUMENTATION_MAX = 20;'), 'documentation max should be 20');
assert.ok(scoringSource.includes('const INFO_MAX = 5;'), 'info max should be 5');
assert.ok(scoringSource.includes('score += asText(info.name).length > 2 ? 1.5 : 0;'), 'name contribution should be 1.5');
assert.ok(scoringSource.includes('score += asText(info.age).length > 0 ? 0.5 : 0;'), 'age contribution should be 0.5');
assert.ok(scoringSource.includes('score += asText(info.year).length > 0 ? 0.75 : 0;'), 'year level contribution should be 0.75');
assert.ok(
  scoringSource.includes("!hasEducationProgram(info.year) || asText(getEducationStage(info.year) === 'senior_high' ? info.track_strand : info.course).length > 2"),
  'academic program contribution should require track/strand for senior high and course for college, but neither for junior high'
);
assert.ok(scoringSource.includes('score += asText(info.school).length > 2 ? 1 : 0;'), 'school contribution should be 1');
assert.ok(scoringSource.includes('score += asText(info.date).length > 0 ? 0.25 : 0;'), 'date contribution should be 0.25');
assert.ok(scoringSource.includes('const pictureScore = photos >= 1 ? 15 : 0;'), 'picture contribution should be 15');
assert.ok(scoringSource.includes('const captionScore = Math.min(described, photos) >= 1 ? 5 : 0;'), 'caption contribution should be 5');
assert.ok(scoringSource.includes('const total = Math.min(Math.round(pictureScore + captionScore), DOCUMENTATION_MAX);'), 'documentation total should be capped at 20');
assert.ok(scoringSource.includes('const reportScore = rawReportScore;'), 'rule-based letter-body score should already use the 75-point scale');
assert.ok(scoringSource.includes('const overallScore = Math.min(Math.round(reportScore + mediaScore + infoScore), 100);'), 'overall score should remain a whole-number 100-point total');
assert.ok(scoringSource.includes('return Math.min(Math.round(score), INFO_MAX);'), 'info score must be a whole-number score capped at 5');
assert.ok(scoringSource.includes('calcInfoScore'), 'scoring utility must expose an info score function for the separate information component');

(async () => {
 const { CHECKLIST, buildEval, calcReportCategories, calcReportScore, calcInfoScore, calcMediaScore } = await import(pathToFileURL(
   path.join(__dirname, '..', '..', 'client', 'src', 'utils', 'submissionScoring.js')
 ).href);
 assert.ok(!CHECKLIST.some((item) => item.id === 'body'), 'the 50-word letter-body checklist item should be removed');
 assert.ok(CHECKLIST.some((item) => item.id === 'length'), 'the 150-word minimum should remain in the checklist');
 const letter = 'I attended school and completed my assignment. I practiced and improved. My family helped at home. I had no difficulty.';
 const serverScore = scoreLetterBodyExperimentalV3(letter);
 const serverCategoryScores = Object.fromEntries(
   Object.entries(serverScore.categories).map(([label, category]) => [label, category.score])
 );
 assert.deepStrictEqual(Object.keys(serverCategoryScores).sort(), Object.keys(calcReportCategories(letter)).sort(), 'V3 and legacy scoring must expose the same five category names');
 assert.ok(serverScore.totalScore >= 0 && serverScore.totalScore <= 75, 'V3 total must remain within the 75-point body scale');
 assert.strictEqual(serverScore.maxTotalScore, 75, 'V3 must retain the 75-point body scale');
 assert.strictEqual(calcInfoScore({
   name: 'Test Scholar',
   age: '20',
   year: '1st Year College',
   course: 'Test Course',
   school: 'Test School',
   date: 'November 2026',
 }), 5, 'complete information should receive the full five points');
 assert.strictEqual(calcMediaScore([{ description: 'Caption' }]), 20, 'a documentation item with a caption should receive 20 points');
 assert.strictEqual(calcMediaScore([{ description: '' }]), 15, 'a documentation item without a caption should receive 15 points');
 const fallbackEvaluation = buildEval({}, letter, []);
 assert.ok(['Positive', 'Neutral', 'Negative'].includes(fallbackEvaluation.sentimentLabel), 'sentiment fallback should remain available');
 assert.ok(!Object.hasOwn(fallbackEvaluation, 'toneLabel'), 'fallback evaluation should not classify academic tone');
 const academicProgramItem = CHECKLIST.find((item) => item.id === 'course');
 assert.ok(academicProgramItem, 'academic program checklist item should exist');
 assert.strictEqual(academicProgramItem.check({ year: 'Grade 7', course: '' }), true, 'junior high should not require course or track/strand');
 assert.strictEqual(academicProgramItem.check({ year: 'Grade 11', track_strand: 'STEM' }), true, 'senior high should accept a track/strand');
 assert.strictEqual(academicProgramItem.check({ year: 'Grade 11', track_strand: '' }), false, 'senior high should require a track/strand');
 assert.strictEqual(academicProgramItem.check({ year: '1st Year College', course: 'BS Computer Science' }), true, 'college should accept a course');
 console.log('submissionScoringThreeWayRegression test passed');
})().catch((error) => {
 console.error(error);
 process.exitCode = 1;
});
