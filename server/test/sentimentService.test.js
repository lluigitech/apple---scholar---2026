const assert = require('assert');
const {
  mapSentimentLabelToValue,
  normalizeLetterSentiment,
} = require('../services/sentimentService');

assert.strictEqual(mapSentimentLabelToValue('Negative'), -1);
assert.strictEqual(mapSentimentLabelToValue('Neutral'), 0);
assert.strictEqual(mapSentimentLabelToValue('Positive'), 1);

assert.deepStrictEqual(normalizeLetterSentiment({
  success: true,
  model_type: 'Automated Letter Sentiment Classifier (TF-IDF + Logistic Regression)',
  sentiment: {
    prediction: 'Negative',
    confidence: 0.81,
    confidence_status: 'High',
  },
}), {
  model_type: 'Automated Letter Sentiment Classifier (TF-IDF + Logistic Regression)',
  sentiment_score: -1,
  sentiment: {
    label: 'Negative',
    confidence: 0.81,
    confidence_percent: 81,
    confidence_status: 'High',
  },
  automated_estimate: true,
  disclaimer: 'Automated model estimate; not independently validated for real-world accuracy.',
});

assert.strictEqual(normalizeLetterSentiment({
  success: true,
  sentiment: { prediction: 'Unknown', confidence: 0.81 },
}), null);

console.log('sentimentService test passed');
