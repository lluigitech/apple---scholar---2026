const fs = require('fs');
const path = require('path');
const assert = require('assert');

const controllerContent = fs.readFileSync(
  path.join(__dirname, '..', 'controllers', 'submissionController.js'),
  'utf8'
);

const match = controllerContent.match(/INSERT INTO submissions \([\s\S]*?\) VALUES \(([^)]*\?[^)]*)\)/m);
assert.ok(match, 'submission insert block should exist in the controller');

const placeholderCount = (match[1].match(/\?/g) || []).length;
assert.strictEqual(placeholderCount, 18, 'submission insert query must provide one placeholder for each insert column');
assert.match(
  controllerContent,
  /contentPrediction\?\.sentiment_score === -1 \? 1 : 0/,
  'submission insert should derive follow-up state from the available content prediction'
);
assert.doesNotMatch(
  controllerContent,
  /prediction\?\.sentiment === -1/,
  'submission insert must not reference an out-of-scope prediction variable'
);

console.log('submissionController insert placeholder regression test passed');
