const fs = require('fs');
const path = require('path');
const assert = require('assert');

const controllerContent = fs.readFileSync(
  path.join(__dirname, '..', 'controllers', 'submissionController.js'),
  'utf8'
);

assert.match(controllerContent, /const prediction = await predictLetterWithMl\(rawLetter\);/);
assert.match(controllerContent, /return res\.status\(503\)\.json\(\{[\s\S]*?fallback: true,/);
assert.match(controllerContent, /body_score: prediction\.body_score \* 70 \/ prediction\.max_score/);
assert.match(controllerContent, /source: 'xlm_roberta'/);

console.log('submissionController XLM-RoBERTa prediction regression test passed');
