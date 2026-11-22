const fs = require('fs');
const path = require('path');
const assert = require('assert');

const controllerContent = fs.readFileSync(
  path.join(__dirname, '..', 'controllers', 'submissionController.js'),
  'utf8'
);

const match = controllerContent.match(
  /exports\.submitGradesResumable = async \(req, res\) => \{([\s\S]*?)\n\};/
);
assert.ok(match, 'resumable grade submission handler should exist');
assert.match(
  match[1],
  /req\.file = await consumeCompleted\(uploadId, req\.user\.scholar_id\);\s*await removeSession\(uploadId\);\s*return exports\.submitGrades\(req, res\);/,
  'resumable handler should consume the proof, clean up its session, and delegate to the exported grade handler'
);
assert.doesNotMatch(
  match[1],
  /(?<!exports\.)\bsubmitGrades\(req, res\)/,
  'resumable handler must not call an undefined local submitGrades function'
);

console.log('resumable grade submission regression test passed');
