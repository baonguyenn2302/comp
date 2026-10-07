/**
 * Comprehensive Test Suite for Quiz Generator System
 * Runs in JavaScriptCore (macOS jsc) or Node.js or Browser
 */

// Load dependencies
load('js/topic_data.js');
load('js/parser.js');
load('js/quiz_generator.js');
load('js/scoring.js');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    print('  [PASS] ' + message);
    passCount++;
  } else {
    print('  [FAIL] ' + message);
    failCount++;
  }
}

function assertEquals(actual, expected, message) {
  if (actual === expected) {
    print('  [PASS] ' + message + ' (Value: ' + actual + ')');
    passCount++;
  } else {
    print('  [FAIL] ' + message + ' (Expected: ' + expected + ', Got: ' + actual + ')');
    failCount++;
  }
}

print('========================================================');
print('🧪 RUNNING COMPREHENSIVE QUIZ GENERATOR TEST SUITE');
print('========================================================\n');

// TEST 1: PARSING AND NORMALIZING QUESTION BANKS
print('--- TEST 1: Question Bank Parsing & Normalization ---');
const rawTopics = (typeof window !== 'undefined' ? window : globalThis).RAW_TOPIC_DATA;
assert(!!rawTopics.vcx && !!rawTopics.vhm && !!rawTopics.vkq, 'All 3 topics are present in data');

const parsedVCX = QuestionParser.parseTopicMarkdown(rawTopics.vcx.rawMarkdown, 'vcx', rawTopics.vcx.title);
const parsedVHM = QuestionParser.parseTopicMarkdown(rawTopics.vhm.rawMarkdown, 'vhm', rawTopics.vhm.title);
const parsedVKQ = QuestionParser.parseTopicMarkdown(rawTopics.vkq.rawMarkdown, 'vkq', rawTopics.vkq.title);

assertEquals(parsedVCX.validCount, 137, 'VCX valid questions count');
assertEquals(parsedVCX.invalidCount, 3, 'VCX invalid questions correctly caught (Q54, Q62, Q71)');
assertEquals(parsedVHM.validCount, 20, 'VHM unique valid questions count after deduplication');
assertEquals(parsedVHM.duplicateCount, 120, 'VHM duplicates correctly identified and filtered out (120 duplicates)');
assertEquals(parsedVKQ.validCount, 106, 'VKQ unique valid questions count');
assertEquals(parsedVKQ.duplicateCount, 1, 'VKQ duplicate correctly caught and filtered out');

// Verify stable IDs
const sampleQ = parsedVCX.validQuestions[0];
assert(sampleQ.id.startsWith('vcx_q'), 'Question has stable ID format');
assert(sampleQ.options.every(o => o.id.startsWith(sampleQ.id + '_opt')), 'Options have stable IDs');
assert(!!sampleQ.correctOptionId, 'Question has valid correctOptionId');

print('\n--- TEST 2: Validation of Minimum 10 Questions Requirement ---');
const dummyBank = [
  { topicId: 't1', title: 'Topic 1', validQuestions: Array(9).fill({ id: '1' }) },
  { topicId: 't2', title: 'Topic 2', validQuestions: Array(15).fill({ id: '2' }) },
  { topicId: 't3', title: 'Topic 3', validQuestions: Array(15).fill({ id: '3' }) }
];
const valErrors = QuizGenerator.validateTopicBanks(dummyBank);
assert(valErrors.length > 0, 'Validation fails when a topic has < 10 questions');
assert(valErrors[0].indexOf('còn thiếu 1 câu') !== -1, 'Validation error clearly specifies missing count');

print('\n--- TEST 3: Quiz Generation Balanced 10-10-10 & Exactly 30 Questions ---');
const topicBanks = [parsedVCX, parsedVHM, parsedVKQ];
const generated = QuizGenerator.generateQuizzes(topicBanks, { numTests: 7 });

assertEquals(generated.tests.length, 7, 'Generates requested number of tests (7 tests)');

let all30 = true;
let allBalanced = true;
let allNoDupInTest = true;
let allInterleaved = true;

generated.tests.forEach((test, idx) => {
  if (test.questions.length !== 30) all30 = false;

  const dist = test.topic_distribution;
  if (dist.vcx !== 10 || dist.vhm !== 10 || dist.vkq !== 10) {
    allBalanced = false;
  }

  // Check no duplicates in same test
  const ids = new Set();
  test.questions.forEach(q => {
    if (ids.has(q.id)) allNoDupInTest = false;
    ids.add(q.id);
  });

  // Check interleaving: not 10 questions in a row of the exact same topic
  let maxConsecutive = 1;
  let currConsecutive = 1;
  for (let i = 1; i < test.questions.length; i++) {
    if (test.questions[i].topic_id === test.questions[i-1].topic_id) {
      currConsecutive++;
      if (currConsecutive > maxConsecutive) maxConsecutive = currConsecutive;
    } else {
      currConsecutive = 1;
    }
  }
  if (maxConsecutive >= 10) allInterleaved = false;
});

assert(all30, 'Every test has exactly 30 questions');
assert(allBalanced, 'Every test has balanced 10-10-10 questions (10 VCX, 10 VHM, 10 VKQ)');
assert(allNoDupInTest, 'No duplicate questions within any test');
assert(allInterleaved, 'Questions are interleaved across topics using Fisher-Yates shuffle');

print('\n--- TEST 4: Option Shuffling and Correct Answer Preservation ---');
let allCorrectPreserved = true;
let allLettersValid = true;

generated.tests.forEach(test => {
  test.questions.forEach(q => {
    // Find correct choice in shuffled choices
    const correctChoice = q.choices.find(c => c.id === q.correct_option_id);
    if (!correctChoice) {
      allCorrectPreserved = false;
    } else {
      if (correctChoice.letter !== q.correct_letter) allCorrectPreserved = false;
      if (correctChoice.text !== q.correct_text) allCorrectPreserved = false;
    }

    // Letters should be A, B, C, D...
    const letters = q.choices.map(c => c.letter).join('');
    if (q.choices.length === 4 && letters !== 'ABCD') {
      allLettersValid = false;
    }
  });
});

assert(allCorrectPreserved, 'Correct answer is strictly preserved via correct_option_id after option shuffle');
assert(allLettersValid, 'Options are re-indexed with standard letters A, B, C, D');

print('\n--- TEST 5: Umbrella / Position-dependent Option Handling ---');
// Create a synthetic question with umbrella option "Tất cả các đáp án" at position A
const synthQ = {
  id: 'synth_q1',
  topicId: 'vcx',
  topicTitle: 'Test',
  origNumber: 999,
  cleanText: 'Câu hỏi thử nghiệm lựa chọn vị trí',
  options: [
    { id: 'synth_opt1', text: 'Tất cả các đáp án', isCorrect: true, origLetter: 'A' },
    { id: 'synth_opt2', text: 'Lựa chọn thường 1', isCorrect: false, origLetter: 'B' },
    { id: 'synth_opt3', text: 'Lựa chọn thường 2', isCorrect: false, origLetter: 'C' },
    { id: 'synth_opt4', text: 'Lựa chọn thường 3', isCorrect: false, origLetter: 'D' }
  ],
  correctOptionId: 'synth_opt1',
  correctText: 'Tất cả các đáp án',
  lineNumber: 1
};
const shuffledSynth = QuizGenerator.shuffleQuestionOptions(synthQ);
const umbrellaChoice = shuffledSynth.choices.find(c => c.id === 'synth_opt1');
assert(umbrellaChoice.letter === 'D', 'Umbrella option "Tất cả các đáp án" is preserved at the end (position D)');
assertEquals(shuffledSynth.correctLetter, 'D', 'Correct letter automatically updated to D based on stable option ID');

print('\n--- TEST 6: Scoring Engine Evaluation ---');
const test1 = generated.tests[0];
// Simulate answering: 20 correct answers, 5 wrong, 5 unattempted
const mockAnswers = {};
for (let i = 1; i <= 20; i++) {
  mockAnswers[i] = test1.questions[i - 1].correct_option_id;
}
for (let i = 21; i <= 25; i++) {
  // choose wrong option
  const wrongChoice = test1.questions[i - 1].choices.find(c => c.id !== test1.questions[i - 1].correct_option_id);
  mockAnswers[i] = wrongChoice.id;
}
// i = 26..30 unattempted

const scoreResult = ScoringEngine.evaluateTest(test1, mockAnswers);
assertEquals(scoreResult.correctCount, 20, 'Score correct count');
assertEquals(scoreResult.wrongCount, 5, 'Score wrong count');
assertEquals(scoreResult.unattemptedCount, 5, 'Score unattempted count');
assertEquals(scoreResult.score10, 6.7, 'Score on 10-point scale: 20/30 * 10 = 6.7');
assertEquals(scoreResult.percentage, 67, 'Percentage score: 67%');
assertEquals(scoreResult.topicBreakdown.length, 3, 'Topic breakdown has all 3 topics');

print('\n--- TEST 7: Single Topic Quizzes ---');
for (const bank of topicBanks) {
  for (const count of [10, 20, 30]) {
    if (bank.validQuestions.length < count) continue;
    const data = QuizGenerator.generateQuizzes(topicBanks, { mode: 'topic', topicId: bank.topicId, questionCount: count, numTests: 3 });
    assert(data.tests.every(t => t.total_questions === count && t.questions.every(q => q.topic_id === bank.topicId)), `Only ${bank.topicId}, exactly ${count} questions per test`);
    assert(data.tests.every(t => new Set(t.questions.map(q => q.id)).size === count), 'No repeated questions within topic test');
    const test = data.tests[0];
    const answers = {};
    test.questions.forEach(q => answers[q.q_num] = q.correct_option_id);
    assertEquals(ScoringEngine.evaluateTest(test, answers).score10, 10, 'Topic quiz scoring preserves correct answers');
  }
}
const defaultTopic = QuizGenerator.generateQuizzes(topicBanks, { mode: 'topic', topicId: 'vcx', numTests: 1 });
assertEquals(defaultTopic.tests[0].total_questions, 20, 'Default topic quiz has 20 questions');
for (const options of [
  { topicId: 'vcx', questionCount: 9 },
  { topicId: 'vcx', questionCount: 31 },
  { topicId: 'vcx', questionCount: 10.5 },
  { topicId: 'missing', questionCount: 20 },
  { topicId: 'vhm', questionCount: 21 },
]) {
  let rejected = false;
  try { QuizGenerator.generateQuizzes(topicBanks, { ...options, mode: 'topic', numTests: 1 }); }
  catch (err) { rejected = true; }
  assert(rejected, 'Reject invalid topic/count or insufficient bank: ' + JSON.stringify(options));
}
const tinyBank = { ...parsedVCX, validQuestions: parsedVCX.validQuestions.slice(0, 9) };
let tinyRejected = false;
try { QuizGenerator.generateQuizzes([tinyBank], { mode: 'topic', topicId: 'vcx', questionCount: 10 }); }
catch (err) { tinyRejected = true; }
assert(tinyRejected, 'Topic with fewer than 10 valid questions is rejected');

print('\n========================================================');
print('📊 TEST SUMMARY: ' + passCount + ' PASSED, ' + failCount + ' FAILED');
print('========================================================');
if (failCount > 0) {
  throw new Error('Test suite failed with ' + failCount + ' failures.');
}
