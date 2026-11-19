const assert = require('assert');
const {
  mapSentimentLabelToValue,
  normalizeContentScoreResponse,
} = require('../services/sentimentService');

assert.strictEqual(mapSentimentLabelToValue('Negative'), -1);
assert.strictEqual(mapSentimentLabelToValue('Neutral'), 0);
assert.strictEqual(mapSentimentLabelToValue('Positive'), 1);

assert.deepStrictEqual(normalizeContentScoreResponse({
  categories: {
    'Paragraph Structure': 12,
    'Academic Update': 13,
    'Self-Improvement': 14,
    'Family Update': 10,
    'Difficulty Update': 11,
  },
  body_score: 60,
  max_score: 75,
  percentage: 80,
  sentiment: 'Positive',
  academic_tone: 'Formal',
}), {
  score: 80,
  body_score: 60,
  max_score: 75,
  percentage: 80,
  breakdown: {
    paragraph: 12,
    academic: 13,
    self_improvement: 14,
    family: 10,
    difficulty: 11,
  },
  categories: {
    'Paragraph Structure': 12,
    'Academic Update': 13,
    'Self-Improvement': 14,
    'Family Update': 10,
    'Difficulty Update': 11,
  },
  sentiment: 1,
  sentiment_label: 'Positive',
  academic_tone: 'Formal',
  quality_label: 'Good',
});

assert.strictEqual(normalizeContentScoreResponse({
  categories: {},
  body_score: 75,
  max_score: 75,
  percentage: 100,
  sentiment: 'Positive',
  academic_tone: 'Formal',
}), null);

console.log('sentimentService test passed');
