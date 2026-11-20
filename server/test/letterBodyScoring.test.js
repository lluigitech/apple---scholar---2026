const assert = require('node:assert/strict');
const {
  LETTER_BODY_MAX,
  countWords,
  getReportedDifficultySentences,
  reportsDifficulty,
  scoreLetterBody,
} = require('../services/letterBodyScoring');

const fullCreditLetter = [
  'Dear supporters,',
  '',
  ...Array.from({ length: 10 }, () => (
    `I attended school, completed my assignments, and received good grades in my math class. I improved my skills through practice, worked hard, and achieved my goals. My family supported me at home, and my parents helped with household chores. I struggled with financial expenses while balancing school and family responsibilities, but I managed this difficulty and continued my studies.`
  )),
  '',
  'Thank you for your continued support.',
].join('\n');

const fullCredit = scoreLetterBody(fullCreditLetter);
assert.equal(LETTER_BODY_MAX, 75);
assert.equal(fullCredit.max_score, 75);
assert.equal(fullCredit.score, 75);
assert.equal(fullCredit.percentage, 100);
assert.equal(fullCredit.category_max_score, 75);
assert.deepEqual(Object.values(fullCredit.categories), [15, 15, 15, 15, 15]);
assert.equal(fullCredit.criteria.reduce((total, criterion) => total + criterion.max, 0), 75);

const empty = scoreLetterBody('  ');
assert.equal(empty.score, 0);
assert.equal(empty.percentage, 0);
assert.equal(empty.categories['Difficulty Update'], 0);

const noDifficulty = scoreLetterBody('I had no difficulty this month and everything went well.');
assert.equal(noDifficulty.categories['Difficulty Update'], 0);
assert.equal(scoreLetterBody('Wala akong naging problema ngayong buwan.').categories['Difficulty Update'], 0);
assert.equal(scoreLetterBody('Hindi ako nahirapan ngayong buwan.').categories['Difficulty Update'], 0);
assert.equal(scoreLetterBody("I don't have any challenges this month.").categories['Difficulty Update'], 0);
assert.equal(scoreLetterBody('I had no difficulty, but faced financial trouble and managed it.').categories['Difficulty Update'], 15);
assert.equal(reportsDifficulty('Hindi po ako nahihirapan ngayong buwan.'), false);
assert.deepEqual(
  getReportedDifficultySentences('I had no difficulty. I struggled with expenses but managed them.'),
    ['I struggled with expenses but managed them'],
);

const partial = scoreLetterBody('I attended school and completed an assignment.');
assert.ok(partial.score > 0);
assert.ok(partial.score < LETTER_BODY_MAX);
assert.equal(partial.categories['Academic Update'], 10);
assert.equal(countWords('Mag-aaral O’Connor 2026'), 3);
assert.equal(scoreLetterBody('The scholarship and classmate received mention.').categories['Academic Update'], 0);
assert.equal(scoreLetterBody('Ang pag-aaral ay mahalaga.').categories['Academic Update'], 5);

console.log('letterBodyScoring tests passed');
