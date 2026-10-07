/**
 * Random Quiz Generator
 * Module handles:
 * - Sampling balanced 10-10-10 quizzes or 10–30 questions from one topic
 * - Ensuring no duplicate questions within any test
 * - Minimizing question overlap across multiple tests
 * - Shuffling questions order with Fisher-Yates to interleave topics
 * - Shuffling options with Fisher-Yates while preserving correct answers via stable option IDs
 * - Handling position-dependent choices (e.g. "Tất cả các đáp án", "Cả A và B")
 * - Fresh generation on page reload with fingerprint differentiation from previous session
 * - In-session immutability (state remains stable during re-renders and answering)
 */

(function (global) {
  'use strict';

  class QuizGenerator {
    /**
     * Unbiased Fisher-Yates shuffle
     * @param {Array} array
     * @returns {Array} New shuffled array
     */
    static shuffle(array) {
      const arr = array.slice();
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    /**
     * Generate fingerprint for a set of questions
     */
    static getFingerprint(questions) {
      return questions
        .map(q => q.id)
        .sort()
        .join('|');
    }

    /**
     * Detect if an option is position-dependent or umbrella (e.g., "Tất cả các đáp án")
     */
    static isUmbrellaOption(text) {
      if (!text) return false;
      const lower = text.toLowerCase().trim();
      return (
        /^tất cả(?:\s+các)?\s+(?:đáp án|phương án|lựa chọn|câu trên|ý trên)/i.test(lower) ||
        /^không có\s+(?:đáp án|phương án|lựa chọn)/i.test(lower) ||
        /^cả\s+[a-d]\s+(?:và|,)\s+[a-d]/i.test(lower) ||
        lower === 'tất cả đều đúng' ||
        lower === 'tất cả đều sai'
      );
    }

    /**
     * Shuffle options while preserving correct answer via stable ID
     * and preserving semantic integrity for position-dependent choices
     */
    static shuffleQuestionOptions(question) {
      const origOptions = question.options.map(opt => ({ ...opt }));
      const letters = 'ABCD';

      // Check if any option is umbrella / position-dependent
      const umbrellaOptions = [];
      const regularOptions = [];

      origOptions.forEach(opt => {
        if (this.isUmbrellaOption(opt.text)) {
          umbrellaOptions.push(opt);
        } else {
          regularOptions.push(opt);
        }
      });

      let finalOptions;
      if (umbrellaOptions.length > 0 && regularOptions.length > 0) {
        // Shuffle regular options first, then append umbrella options at the end (position C/D)
        const shuffledRegular = this.shuffle(regularOptions);
        const shuffledUmbrella = this.shuffle(umbrellaOptions);
        finalOptions = [...shuffledRegular, ...shuffledUmbrella];
      } else {
        finalOptions = this.shuffle(origOptions);
      }

      // Reassign letters A, B, C, D...
      const choices = finalOptions.map((opt, idx) => ({
        id: opt.id,
        letter: letters[idx] || String.fromCharCode(65 + idx),
        text: opt.text,
        isCorrect: opt.id === question.correctOptionId,
        origLetter: opt.origLetter,
      }));

      const correctChoice = choices.find(c => c.id === question.correctOptionId);

      return {
        choices,
        correctLetter: correctChoice ? correctChoice.letter : 'A',
        correctOptionId: question.correctOptionId,
        correctText: question.correctText,
      };
    }

    /**
     * Validate that all 3 topics have at least 10 valid questions
     * @param {Array<Object>} topicBanks
     */
    static validateTopicBanks(topicBanks) {
      const errors = [];
      if (!Array.isArray(topicBanks) || topicBanks.length !== 3) {
        errors.push(`Ngân hàng cần đúng 3 topic (hiện có: ${topicBanks ? topicBanks.length : 0})`);
      }

      topicBanks.forEach(topic => {
        const count = topic.validQuestions ? topic.validQuestions.length : 0;
        if (count < 10) {
          errors.push(
            `Chủ đề "${topic.title}" (${topic.topicId}) chỉ có ${count} câu hợp lệ, còn thiếu ${10 - count} câu để đạt tối thiểu 10 câu/đề.`
          );
        }
      });

      return errors;
    }

    /**
     * Select the requested number of questions per topic, minimizing repetition across tests
     */
    static sampleBalancedQuestions(topicBanks, numTests, perTopic = 10) {
      // Track question usage per topic: Map<questionId, count>
      const usageMap = new Map();
      topicBanks.forEach(tb => {
        tb.validQuestions.forEach(q => usageMap.set(q.id, 0));
      });

      const testsQuestions = [];

      for (let testIdx = 0; testIdx < numTests; testIdx++) {
        const testSelected = [];

        topicBanks.forEach(topic => {
          const validQs = topic.validQuestions.slice();

          // Sort questions by usage count (ascending), with random tie-breaker
          // This ensures questions used fewer times are prioritized for next tests
          const shuffledWithRandomTie = this.shuffle(validQs);
          shuffledWithRandomTie.sort((a, b) => {
            const usageA = usageMap.get(a.id) || 0;
            const usageB = usageMap.get(b.id) || 0;
            return usageA - usageB;
          });

          // Pick unique questions from this topic
          const picked = shuffledWithRandomTie.slice(0, perTopic);

          picked.forEach(q => {
            testSelected.push(q);
            usageMap.set(q.id, (usageMap.get(q.id) || 0) + 1);
          });
        });

        // Verify the requested question count
        if (testSelected.length !== topicBanks.length * perTopic) {
          throw new Error(`Đề số ${testIdx + 1} không đủ ${topicBanks.length * perTopic} câu (chỉ có ${testSelected.length} câu)`);
        }

        // Shuffle the selected questions
        const interleaved = this.shuffle(testSelected);
        testsQuestions.push(interleaved);
      }

      return testsQuestions;
    }

    /**
     * Generate complete quiz data for numTests (default 7)
     * @param {Array<Object>} topicBanks - Array of 3 parsed topic bank objects
     * @param {Object} options - { numTests, mode, topicId, questionCount, avoidPreviousFingerprint }
     * @returns {Object} { tests: Array, metadata: Object }
     */
    static generateQuizzes(topicBanks, options = {}) {
      const numTests = options.numTests || 7;
      const avoidFingerprint = options.avoidPreviousFingerprint !== false;

      // 1. Validate
      const mode = options.mode || 'combined';
      let selectedBanks = topicBanks;
      let perTopic = 10;
      if (mode === 'topic') {
        perTopic = options.questionCount === undefined ? 20 : options.questionCount;
        if (!Number.isInteger(perTopic) || perTopic < 10 || perTopic > 30) {
          throw new Error('Số câu hỏi theo chủ đề phải là số nguyên từ 10 đến 30.');
        }
        selectedBanks = topicBanks.filter(t => t.topicId === options.topicId);
        if (selectedBanks.length !== 1) throw new Error('Vui lòng chọn một chủ đề hợp lệ.');
      } else if (mode !== 'combined') {
        throw new Error('Loại đề không hợp lệ.');
      }
      const validationErrors = mode === 'combined' ? this.validateTopicBanks(topicBanks) : [];
      selectedBanks.forEach(t => {
        if (t.validQuestions.length < perTopic) {
          validationErrors.push(`Chủ đề "${t.title}" chỉ có ${t.validQuestions.length} câu hợp lệ. Vui lòng chọn tối đa ${t.validQuestions.length} câu (tối thiểu 10 câu).`);
        }
      });
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join('\n'));
      }

      // Check if data is limited (e.g. exactly 10 questions per topic)
      const totalPossibleCombinations = selectedBanks.reduce((acc, t) => {
        // Combination C(n, 10)
        const n = t.validQuestions.length;
        return acc * (n >= 10 ? n : 1);
      }, 1);

      let prevFingerprint = null;
      if (avoidFingerprint && typeof sessionStorage !== 'undefined') {
        try {
          prevFingerprint = sessionStorage.getItem('antigravity_quiz_fingerprint');
        } catch (e) {
          // ignore storage error
        }
      }

      // 2. Generate with retry to avoid exact repeat of previous session if combinations permit
      let testsRawQuestions = null;
      let attempts = 0;
      const maxAttempts = totalPossibleCombinations > 1 ? 20 : 1;

      while (attempts < maxAttempts) {
        attempts++;
        testsRawQuestions = this.sampleBalancedQuestions(selectedBanks, numTests, perTopic);
        const currentFingerprint = this.getFingerprint(testsRawQuestions[0]);

        if (!prevFingerprint || currentFingerprint !== prevFingerprint || attempts >= maxAttempts) {
          if (typeof sessionStorage !== 'undefined') {
            try {
              sessionStorage.setItem('antigravity_quiz_fingerprint', currentFingerprint);
            } catch (e) {}
          }
          break;
        }
      }

      // 3. Transform into final test structures with shuffled options & stable IDs
      const tests = testsRawQuestions.map((questionList, testIdx) => {
        const testNum = testIdx + 1;
        const questions = questionList.map((q, qIndex) => {
          const qNum = qIndex + 1;
          const shuffledOptData = this.shuffleQuestionOptions(q);

          return {
            q_num: qNum,
            id: q.id,
            orig_id: q.origNumber,
            topic_id: q.topicId,
            topic_title: q.topicTitle,
            clean_text: q.cleanText,
            explanation: q.explanation || '',
            choices: shuffledOptData.choices,
            correct_letter: shuffledOptData.correctLetter,
            correct_option_id: shuffledOptData.correctOptionId,
            correct_text: shuffledOptData.correctText,
          };
        });

        // Verify distribution
        const topicCounts = {};
        questions.forEach(q => {
          topicCounts[q.topic_id] = (topicCounts[q.topic_id] || 0) + 1;
        });

        return {
          test_num: testNum,
          title: mode === 'topic' ? `Đề ${selectedBanks[0].title} — số ${testNum}` : `Đề trắc nghiệm số ${testNum}`,
          total_questions: questions.length,
          topic_distribution: topicCounts,
          questions,
        };
      });

      return {
        tests,
        generatedAt: new Date().toISOString(),
        config: {
          numTests,
          questionsPerTest: selectedBanks.length * perTopic,
          perTopic,
          mode,
          topicId: mode === 'topic' ? options.topicId : null,
        },
        topicSummary: topicBanks.map(t => ({
          topicId: t.topicId,
          title: t.title,
          validCount: t.validQuestions.length,
          invalidCount: t.invalidCount,
          duplicateCount: t.duplicateCount,
        })),
      };
    }
  }

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuizGenerator;
  } else {
    global.QuizGenerator = QuizGenerator;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis));
