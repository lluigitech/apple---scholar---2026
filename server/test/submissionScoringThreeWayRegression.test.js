const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

const scoringSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'client', 'src', 'utils', 'submissionScoring.js'),
  'utf8'
);

assert.ok(scoringSource.includes('const LETTER_BODY_MAX = 70;'), 'letter-body max should be 70');
assert.ok(scoringSource.includes('const DOCUMENTATION_MAX = 20;'), 'documentation max should be 20');
assert.ok(scoringSource.includes('const INFO_MAX = 10;'), 'info max should be 10');
assert.ok(scoringSource.includes('score += asText(info.name).length > 2 ? 3 : 0;'), 'name contribution should be 3');
assert.ok(scoringSource.includes('score += asText(info.age).length > 0 ? 1 : 0;'), 'age contribution should be 1');
assert.ok(scoringSource.includes('score += asText(info.year).length > 0 ? 1.5 : 0;'), 'year level contribution should be 1.5');
assert.ok(
  scoringSource.includes("!hasEducationProgram(info.year) || asText(getEducationStage(info.year) === 'senior_high' ? info.track_strand : info.course).length > 2"),
  'academic program contribution should require track/strand for senior high and course for college, but neither for junior high'
);
assert.ok(scoringSource.includes('score += asText(info.school).length > 2 ? 2 : 0;'), 'school contribution should be 2');
assert.ok(scoringSource.includes('score += asText(info.date).length > 0 ? 0.5 : 0;'), 'date contribution should be 0.5');
assert.ok(scoringSource.includes('const pictureScore = photos >= 1 ? 15 : 0;'), 'picture contribution should be 15');
assert.ok(scoringSource.includes('const captionScore = Math.min(described, photos) >= 1 ? 5 : 0;'), 'caption contribution should be 5');
assert.ok(scoringSource.includes('const total = Math.min(Math.round(pictureScore + captionScore), 20);'), 'documentation total should be capped at 20');
assert.ok(scoringSource.includes('const reportScore = Math.round(rawReportScore * LETTER_BODY_MAX / 100);'), 'letter-body score must be normalized into a whole-number 70-point contribution');
assert.ok(scoringSource.includes('const overallScore = Math.min(Math.round(reportScore + mediaScore + infoScore), 100);'), 'overall score should remain a whole-number 100-point total');
assert.ok(scoringSource.includes('return Math.min(Math.round(score), 10);'), 'info score must be a whole-number score capped at 10');
assert.ok(scoringSource.includes('calcInfoScore'), 'scoring utility must expose an info score function for the separate information component');

(async () => {
 const { CHECKLIST } = await import(pathToFileURL(
   path.join(__dirname, '..', '..', 'client', 'src', 'utils', 'submissionScoring.js')
 ).href);
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
