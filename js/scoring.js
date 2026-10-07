/**
 * Quiz Scoring and Evaluation Engine
 * Module handles:
 * - Evaluating user answers against correctOptionId
 * - Scoring on a 10-point scale and percentage
 * - Topic-by-topic score breakdown
 * - Detailed feedback generation
 */

(function (global) {
  'use strict';

  class ScoringEngine {
    /**
     * Score a test based on user answers
     * @param {Object} test - Test object containing questions
     * @param {Object} userAnswers - Map of { [q_num]: chosenOptionId } or { [q_num]: chosenLetter }
     * @returns {Object} Score details, topic breakdown, evaluation summary
     */
    static evaluateTest(test, userAnswers) {
      let correct = 0;
      let wrong = 0;
      let unattempted = 0;

      const topicStats = {};
      const detailedResults = [];

      test.questions.forEach(q => {
        const topicId = q.topic_id;
        if (!topicStats[topicId]) {
          topicStats[topicId] = {
            topicId,
            topicTitle: q.topic_title,
            total: 0,
            correct: 0,
            wrong: 0,
            unattempted: 0,
          };
        }
        topicStats[topicId].total++;

        const userChoice = userAnswers[q.q_num];
        // User choice can be option ID or letter
        let isCorrect = false;
        let chosenChoice = null;

        if (userChoice) {
          chosenChoice = q.choices.find(c => c.id === userChoice || c.letter === userChoice);
          if (chosenChoice && (chosenChoice.id === q.correct_option_id || chosenChoice.letter === q.correct_letter)) {
            isCorrect = true;
          }
        }

        if (!userChoice) {
          unattempted++;
          topicStats[topicId].unattempted++;
        } else if (isCorrect) {
          correct++;
          topicStats[topicId].correct++;
        } else {
          wrong++;
          topicStats[topicId].wrong++;
        }

        detailedResults.push({
          q_num: q.q_num,
          id: q.id,
          topic_id: q.topic_id,
          userChoice: chosenChoice ? chosenChoice.letter : null,
          correctLetter: q.correct_letter,
          isCorrect,
          unattempted: !userChoice,
          explanation: q.explanation || '',
        });
      });

      const total = test.questions.length;
      const score10 = total > 0 ? parseFloat(((correct / total) * 10).toFixed(1)) : 0;
      const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

      // Evaluation grade
      let grade = '';
      let feedback = '';
      if (score10 >= 9.0) {
        grade = 'Xuất sắc';
        feedback = '🎉 Tuyệt vời! Bạn nắm rất vững kiến thức trong đề thi!';
      } else if (score10 >= 8.0) {
        grade = 'Giỏi';
        feedback = '👏 Rất tốt! Bạn hiểu sâu lý thuyết và làm bài tự tin!';
      } else if (score10 >= 6.5) {
        grade = 'Khá';
        feedback = '👍 Khá tốt! Cần chú ý thêm một số câu hỏi lý thuyết chuyên sâu.';
      } else if (score10 >= 5.0) {
        grade = 'Trung bình';
        feedback = '⚠️ Đạt yêu cầu cơ bản. Hãy xem lại các câu sai để củng cố!';
      } else {
        grade = 'Chưa đạt';
        feedback = '📚 Cần dành thêm thời gian ôn tập lý luận và làm lại đề này nhé!';
      }

      return {
        testNum: test.test_num,
        totalQuestions: total,
        correctCount: correct,
        wrongCount: wrong,
        unattemptedCount: unattempted,
        score10,
        percentage,
        grade,
        feedback,
        topicBreakdown: Object.values(topicStats),
        detailedResults,
      };
    }
  }

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScoringEngine;
  } else {
    global.ScoringEngine = ScoringEngine;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis));
