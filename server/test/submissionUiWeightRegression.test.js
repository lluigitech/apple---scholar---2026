const fs = require('fs');
const path = require('path');
const assert = require('assert');

const submissionUi = fs.readFileSync(
  path.join(__dirname, '..', '..', 'client', 'src', 'pages', 'Scholar', 'Submission.jsx'),
  'utf8'
);
const confirmModal = fs.readFileSync(
  path.join(__dirname, '..', '..', 'client', 'src', 'components', 'Scholar', 'SubmissionPage', 'ConfirmModal.jsx'),
  'utf8'
);

assert.ok(submissionUi.includes('75 pts'), 'Report should have 75 points');
assert.ok(submissionUi.includes('20 pts'), 'Media should have 20 points');
assert.ok(submissionUi.includes('5 pts'), 'Information should have 5 points');

assert.ok(!submissionUi.includes('75% weight'), 'Incorrect 75% report weight');
assert.ok(!submissionUi.includes('25% weight'), 'Incorrect 25% media weight');
assert.ok(!submissionUi.includes('30% weight'), 'Incorrect 30% media weight');

assert.ok(submissionUi.includes('Sentiment: {evalResult.sentimentLabel}'), 'Scholar preview should continue showing sentiment');
assert.ok(!submissionUi.includes('Academic tone'), 'Scholar preview should not show Academic Tone');
assert.ok(!submissionUi.includes('toneLabel'), 'Scholar preview should not use Academic Tone results or feedback');
assert.ok(confirmModal.includes('Sentiment: {ev.sentimentLabel}'), 'Confirmation modal should continue showing sentiment');
assert.ok(!confirmModal.includes('Academic tone'), 'Confirmation modal should not show Academic Tone');
assert.ok(!confirmModal.includes('toneLabel'), 'Confirmation modal should not render Academic Tone results');

console.log('submissionUiWeightRegression test passed');
