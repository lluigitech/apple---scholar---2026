const assert = require('assert');
const {
  mapSentimentLabelToValue,
  normalizeExperimentalClassification,
} = require('../services/sentimentService');

assert.strictEqual(mapSentimentLabelToValue('Negative'), -1);
assert.strictEqual(mapSentimentLabelToValue('Neutral'), 0);
assert.strictEqual(mapSentimentLabelToValue('Positive'), 1);

assert.deepStrictEqual(normalizeExperimentalClassification({
  success: true,
  model_type: 'Experimental TF-IDF + Logistic Regression',
  sentiment: {
    prediction: 'Negative',
    confidence: 0.81,
    confidence_status: 'High',
  },
  academic_tone: {
    prediction: 'Moderate',
    confidence: 0.63,
    confidence_status: 'Moderate',
  },
}), {
  model_type: 'TF-IDF + Logistic Regression',
  sentiment_score: -1,
  sentiment: {
    label: 'Negative',
    confidence: 0.81,
    confidence_percent: 81,
    confidence_status: 'High',
  },
  academic_tone: {
    label: 'Moderate',
    confidence: 0.63,
    confidence_percent: 63,
    confidence_status: 'Moderate',
  },
  automated_estimate: true,
  disclaimer: 'Automated model estimate; not independently validated for real-world accuracy.',
});

assert.strictEqual(normalizeExperimentalClassification({
  success: true,
  sentiment: { prediction: 'Negative', confidence: 0.81 },
  academic_tone: { prediction: 'Moderate', confidence: 1.1 },
}), null);

console.log('sentimentService test passed');
