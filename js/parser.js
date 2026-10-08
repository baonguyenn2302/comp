/**
 * Markdown Question Bank Parser
 * Module handles:
 * - Parsing Markdown formatted quiz questions
 * - Standardizing question and option contents
 * - Assigning stable IDs for questions and options
 * - Detecting format errors, missing answers, and duplicate questions
 * - Preserving formulas, code formatting, and images
 */

(function (global) {
  'use strict';

  class QuestionParser {
    /**
     * Cleans question text removing header tags like [!b:$...$] while preserving inner content
     */
    static cleanText(text) {
      if (!text) return '';
      let cleaned = text.trim();
      // Remove [!b:$ ... $] or [!b: ... ]
      cleaned = cleaned.replace(/^\[!b:\$?\s*/i, '');
      cleaned = cleaned.replace(/\$?\s*\]$/i, '');
      // Remove any inline [!b:$ or $]
      cleaned = cleaned.replace(/\[!b:\$?/gi, '').replace(/\$?\]/gi, '');
      return cleaned.trim();
    }

    /**
     * Normalize text for comparison to detect duplicate questions
     */
    static normalizeForComparison(text) {
      if (!text) return '';
      let norm = this.cleanText(text).toLowerCase();
      // Remove trailing punctuation
      norm = norm.replace(/[.,:;?!\s]+$/, '');
      // Collapse whitespace
      norm = norm.replace(/\s+/g, ' ');
      return norm.trim();
    }

    /**
     * Parse raw Markdown text from a topic file
     * @param {string} markdownContent - Raw string of markdown
     * @param {string} topicId - Identifier for the topic ('vcx', 'vhm', 'vkq')
     * @param {string} topicTitle - Human readable title
     * @returns {Object} Parse result with validQuestions, invalidQuestions, duplicates, and stats
     */
    static parseTopicMarkdown(markdownContent, topicId, topicTitle) {
      const lines = markdownContent.split(/\r?\n/);
      const rawQuestions = [];
      let currentQuestion = null;

      const qRegex = /^(?:\[!b:[^\]]*\])?\s*Câu\s+(\d+)[:\.]\s*(.*)$/i;
      const optRegex = /^(\*?)([A-Da-d])[\.\)]\s*(.*)$/;
      const expRegex = /^(?:>\s*)?(?:Lời giải|Giải thích|Ghi chú)[:\.]\s*(.*)$/i;

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const rawLine = lines[lineIdx];
        const line = rawLine.trim();

        if (!line) continue;

        const boldMatch = line.match(/^\[!b:\$?([\s\S]*?)\$?\]$/i);
        const contentLine = boldMatch ? boldMatch[1].trim() : line;

        // Skip top-level section headers like [!b:$PHẦN I: BỘ 60 CÂU HỎI$]
        if (/^\[!b:\$?(?:PHẦN|CHỦ ĐỀ|BỘ ĐỀ|BÀI TẬP)/i.test(line) && !qRegex.test(line)) {
          continue;
        }

        // Check if line starts a question
        const questionLine = contentLine.replace(/^[•·]\s*/, '');
        const qMatch = questionLine.match(qRegex);
        if (qMatch) {
          if (currentQuestion) {
            rawQuestions.push(currentQuestion);
          }
          currentQuestion = {
            topicId,
            origNumber: parseInt(qMatch[1], 10),
            rawTitle: line,
            text: qMatch[2] ? qMatch[2].trim() : '',
            options: [],
            explanation: '',
            lineNumber: lineIdx + 1,
          };
          continue;
        }

        // If currently in a question
        if (currentQuestion) {
          // Check for explanation line
          const expMatch = line.match(expRegex);
          if (expMatch) {
            currentQuestion.explanation = expMatch[1].trim();
            continue;
          }

          // Check if option
          const optMatch = contentLine.match(optRegex);
          if (optMatch) {
            const isCorrect = optMatch[1] === '*' || !!boldMatch;
            const letter = optMatch[2].toUpperCase();
            const optText = optMatch[3] ? optMatch[3].trim() : '';

            currentQuestion.options.push({
              letter,
              isCorrect,
              text: optText,
              raw: line,
              lineNumber: lineIdx + 1,
            });
            continue;
          }

          // Continuation line
          if (currentQuestion.explanation) {
            currentQuestion.explanation += ' ' + line;
          } else if (currentQuestion.options.length > 0) {
            currentQuestion.options[currentQuestion.options.length - 1].text += ' ' + line;
          } else {
            currentQuestion.text += (currentQuestion.text ? ' ' : '') + line;
          }
        }
      }

      if (currentQuestion) {
        rawQuestions.push(currentQuestion);
      }

      // Validate, standardize and deduplicate
      const validQuestions = [];
      const invalidQuestions = [];
      const duplicateQuestions = [];
      const seenComparisonMap = new Map();

      rawQuestions.forEach((q, index) => {
        const cleanTitle = this.cleanText(q.text);
        const correctOptions = q.options.filter(o => o.isCorrect);
        const reasons = [];

        if (!cleanTitle) {
          reasons.push('Nội dung câu hỏi rỗng');
        }

        if (q.options.length < 2) {
          reasons.push(`Thiếu phương án lựa chọn (chỉ có ${q.options.length} phương án)`);
        }

        if (correctOptions.length === 0) {
          reasons.push('Không có phương án nào được đánh dấu đáp án đúng (*)');
        } else if (correctOptions.length > 1) {
          reasons.push(`Có ${correctOptions.length} phương án được đánh dấu đúng (${correctOptions.map(o => o.letter).join(', ')})`);
        }

        const normalizedKey = this.normalizeForComparison(cleanTitle);

        if (reasons.length > 0) {
          invalidQuestions.push({
            question: q,
            reasons,
            topicId,
            origNumber: q.origNumber,
            cleanTitle,
          });
          return;
        }

        // Check for duplicate question content within topic
        if (seenComparisonMap.has(normalizedKey)) {
          const canonical = seenComparisonMap.get(normalizedKey);
          duplicateQuestions.push({
            duplicateQuestion: q,
            canonicalId: canonical.id,
            canonicalOrigNumber: canonical.origNumber,
            topicId,
            cleanTitle,
          });
          return; // Skip duplicate to ensure questions in the bank are unique
        }

        // Build standardized question object with stable IDs
        const questionId = `${topicId}_q${q.origNumber}_${index + 1}`;
        const optionsWithStableIds = q.options.map((opt, optIdx) => ({
          id: `${questionId}_opt${optIdx + 1}`,
          origIndex: optIdx,
          origLetter: opt.letter,
          text: this.cleanText(opt.text),
          isCorrect: opt.isCorrect,
        }));

        const correctOpt = optionsWithStableIds.find(o => o.isCorrect);

        const standardizedQuestion = {
          id: questionId,
          topicId,
          topicTitle: topicTitle || topicId.toUpperCase(),
          origNumber: q.origNumber,
          cleanText: cleanTitle,
          explanation: q.explanation || '',
          options: optionsWithStableIds,
          correctOptionId: correctOpt ? correctOpt.id : null,
          correctText: correctOpt ? correctOpt.text : '',
          origCorrectLetter: correctOpt ? correctOpt.origLetter : '',
          lineNumber: q.lineNumber,
        };

        seenComparisonMap.set(normalizedKey, standardizedQuestion);
        validQuestions.push(standardizedQuestion);
      });

      return {
        topicId,
        topicTitle: topicTitle || topicId.toUpperCase(),
        totalParsed: rawQuestions.length,
        validCount: validQuestions.length,
        invalidCount: invalidQuestions.length,
        duplicateCount: duplicateQuestions.length,
        validQuestions,
        invalidQuestions,
        duplicateQuestions,
      };
    }
  }

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuestionParser;
  } else {
    global.QuestionParser = QuestionParser;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis));
