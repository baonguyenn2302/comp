/**
 * Main Quiz Application Controller
 * Handles UI interactions, state management, timer, scoring, and tabs.
 */

(function () {
  'use strict';

  // APPLICATION CONFIGURATION & STATE
  const CONFIG = {
    defaultNumTests: 7,
    timeLimitSeconds: 30 * 60,
    topics: [
      { id: 'vcx', title: 'Chủ nghĩa xã hội khoa học', file: 'topic/vcx.md', pillClass: 'topic-pill-vcx' },
      { id: 'vhm', title: 'Triết học Mác - Lênin', file: 'topic/vhm.md', pillClass: 'topic-pill-vhm' },
      { id: 'vkq', title: 'Kinh tế chính trị Mác - Lênin', file: 'topic/vkq.md', pillClass: 'topic-pill-vkq' }
    ]
  };

  const STATE = {
    topicBanks: [],
    quizData: null,
    currentTestIdx: 0,
    numTests: CONFIG.defaultNumTests,
    mode: 'combined',
    topicId: 'vcx',
    questionCount: 20,
    // Per-test state
    answers: {},       // { [testIdx]: { [qNum]: optionId } }
    submitted: {},     // { [testIdx]: boolean }
    scores: {},        // { [testIdx]: scoreObject }
    // Timer
    secondsLeft: CONFIG.timeLimitSeconds,
    timerInterval: null,
  };

  // DOM REFERENCES
  const DOM = {};

  function cacheDom() {
    DOM.themeToggle = document.getElementById('themeToggle');
    DOM.themeIcon = document.getElementById('themeIcon');
    DOM.btnReroll = document.getElementById('btnReroll');
    DOM.btnConfig = document.getElementById('btnConfig');
    DOM.btnDataReport = document.getElementById('btnDataReport');

    DOM.navTabs = document.getElementById('navTabs');
    DOM.quizContentArea = document.getElementById('quizContentArea');
    DOM.sidebar = document.getElementById('sidebar');

    DOM.quizInfoBar = document.getElementById('quizInfoBar');
    DOM.currentTestTitle = document.getElementById('currentTestTitle');
    DOM.testTopicBadges = document.getElementById('testTopicBadges');
    DOM.timerBadge = document.getElementById('timerBadge');
    DOM.timerText = document.getElementById('timerText');

    DOM.questionsContainer = document.getElementById('questionsContainer');
    DOM.matrixContainer = document.getElementById('matrixContainer');
    DOM.bankContainer = document.getElementById('bankContainer');
    DOM.reportContainer = document.getElementById('reportContainer');

    DOM.progressFill = document.getElementById('progressFill');
    DOM.progressPercent = document.getElementById('progressPercent');
    DOM.answeredCount = document.getElementById('answeredCount');
    DOM.questionGrid = document.getElementById('questionGrid');

    DOM.btnSubmit = document.getElementById('btnSubmit');
    DOM.btnReset = document.getElementById('btnReset');
    DOM.btnDownloadTest = document.getElementById('btnDownloadTest');

    // Modals
    DOM.resultModal = document.getElementById('resultModal');
    DOM.modalScoreNum = document.getElementById('modalScoreNum');
    DOM.modalGradeText = document.getElementById('modalGradeText');
    DOM.modalFeedbackText = document.getElementById('modalFeedbackText');
    DOM.statCorrect = document.getElementById('statCorrect');
    DOM.statWrong = document.getElementById('statWrong');
    DOM.statSkipped = document.getElementById('statSkipped');
    DOM.modalTopicBreakdown = document.getElementById('modalTopicBreakdown');
    DOM.btnCloseResultModal = document.getElementById('btnCloseResultModal');
    DOM.btnModalRetake = document.getElementById('btnModalRetake');
    DOM.btnModalReview = document.getElementById('btnModalReview');

    // Config Modal
    DOM.configModal = document.getElementById('configModal');
    ['inputQuizMode', 'inputTopic', 'inputQuestionCount', 'questionCountValue', 'topicConfigFields', 'topicAvailability', 'configError', 'currentQuestionCount'].forEach(id => DOM[id] = document.getElementById(id));
    DOM.inputNumTests = document.getElementById('inputNumTests');
    DOM.btnSaveConfig = document.getElementById('btnSaveConfig');
    DOM.btnCloseConfig = document.getElementById('btnCloseConfig');

    // Data Quality Modal
    DOM.qualityModal = document.getElementById('qualityModal');
    DOM.qualityModalBody = document.getElementById('qualityModalBody');
    DOM.btnCloseQuality = document.getElementById('btnCloseQuality');
  }

  // DATA LOADING: TRY FETCH FIRST, FALLBACK TO TOPIC_DATA.JS
  async function loadTopicMarkdown(topicDef) {
    try {
      const resp = await fetch(topicDef.file);
      if (resp.ok) {
        const text = await resp.text();
        return text;
      }
    } catch (e) {
      // Fetch failed (likely file:// protocol CORS)
    }

    // Fallback to RAW_TOPIC_DATA
    if (window.RAW_TOPIC_DATA && window.RAW_TOPIC_DATA[topicDef.id]) {
      return window.RAW_TOPIC_DATA[topicDef.id].rawMarkdown;
    }
    throw new Error(`Không thể nạp dữ liệu cho chủ đề: ${topicDef.title} (${topicDef.file})`);
  }

  async function loadAllTopicBanks() {
    const banks = [];
    for (const topicDef of CONFIG.topics) {
      const mdContent = await loadTopicMarkdown(topicDef);
      const parsed = QuestionParser.parseTopicMarkdown(mdContent, topicDef.id, topicDef.title);
      banks.push(parsed);
    }
    return banks;
  }

  // INITIALIZATION
  async function initApp() {
    cacheDom();
    setupTheme();
    setupEventListeners();

    try {
      DOM.questionsContainer.innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
          <div style="font-size: 2rem; margin-bottom: 12px;">⏳</div>
          <h3>Đang nạp ngân hàng câu hỏi & chuẩn hóa dữ liệu...</h3>
          <p style="color: var(--text-muted); margin-top: 8px;">Đang phân tích 3 topic (VCX, VHM, VKQ) và lọc câu hỏi lỗi/trùng lặp</p>
        </div>
      `;

      STATE.topicBanks = await loadAllTopicBanks();
      generateAllQuizzes();
      renderTabs();
      switchTest(0);
    } catch (err) {
      console.error(err);
      DOM.questionsContainer.innerHTML = `
        <div style="background: var(--danger-bg); border: 1px solid var(--danger); border-radius: 12px; padding: 24px; color: var(--text-main);">
          <h3 style="color: var(--danger); margin-bottom: 8px;">⚠️ Lỗi Khởi Tạo Dữ Liệu</h3>
          <p>${escapeHtml(err.message)}</p>
        </div>
      `;
    }
  }

  function generateAllQuizzes(settings = STATE) {
    STATE.quizData = QuizGenerator.generateQuizzes(STATE.topicBanks, {
      numTests: settings.numTests,
      mode: settings.mode,
      topicId: settings.topicId,
      questionCount: settings.questionCount,
      avoidPreviousFingerprint: true,
    });

    STATE.numTests = settings.numTests;
    STATE.mode = settings.mode;
    STATE.topicId = settings.topicId;
    STATE.questionCount = settings.questionCount;

    // Reset test interaction states
    STATE.answers = {};
    STATE.submitted = {};
    STATE.scores = {};
    for (let i = 0; i < STATE.numTests; i++) {
      STATE.answers[i] = {};
      STATE.submitted[i] = false;
      STATE.scores[i] = null;
    }
  }

  // THEME SETUP
  function setupTheme() {
    const saved = localStorage.getItem('llct_quiz_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    DOM.themeIcon.textContent = saved === 'dark' ? '☀️' : '🌙';

    DOM.themeToggle.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('llct_quiz_theme', next);
      DOM.themeIcon.textContent = next === 'dark' ? '☀️' : '🌙';
    });
  }

  // TAB RENDERING
  function renderTabs() {
    let tabsHtml = '';
    for (let i = 0; i < STATE.numTests; i++) {
      tabsHtml += `
        <button class="tab-btn ${i === STATE.currentTestIdx ? 'active' : ''}" data-test="${i}">
          Đề ${i + 1}
          <span class="tab-badge">${STATE.quizData.tests[i].total_questions} câu</span>
        </button>
      `;
    }
    tabsHtml += `
      <button class="tab-btn" data-tab="matrix">📊 Bảng Đáp Án Chi Tiết</button>
      <button class="tab-btn" data-tab="bank">📚 Ngân Hàng Câu Hỏi Gốc</button>
      <button class="tab-btn" data-tab="report">📋 Báo Cáo Dữ Liệu</button>
    `;
    DOM.navTabs.innerHTML = tabsHtml;

    // Attach listeners
    DOM.navTabs.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        DOM.navTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (btn.dataset.test !== undefined) {
          switchTest(parseInt(btn.dataset.test, 10));
        } else if (btn.dataset.tab === 'matrix') {
          showMatrixTab();
        } else if (btn.dataset.tab === 'bank') {
          showBankTab();
        } else if (btn.dataset.tab === 'report') {
          showReportTab();
        }
      });
    });
  }

  function hideAllViews() {
    DOM.questionsContainer.style.display = 'none';
    DOM.matrixContainer.style.display = 'none';
    DOM.bankContainer.style.display = 'none';
    DOM.reportContainer.style.display = 'none';
  }

  function switchTest(testIdx) {
    STATE.currentTestIdx = testIdx;
    hideAllViews();

    DOM.quizInfoBar.style.display = 'flex';
    DOM.sidebar.style.display = 'flex';
    DOM.questionsContainer.style.display = 'block';

    renderCurrentTest();
    updateProgress();

    if (!STATE.submitted[testIdx]) {
      resetTimer();
      startTimer();
    } else {
      stopTimer();
      renderSubmittedReview();
    }
  }

  // RENDER CURRENT TEST QUESTIONS
  function renderCurrentTest() {
    const test = STATE.quizData.tests[STATE.currentTestIdx];
    DOM.currentTestTitle.textContent = test.title;
    DOM.currentQuestionCount.textContent = `${test.total_questions} câu hỏi`;

    // Render topic pills in info bar
    const dist = test.topic_distribution;
    DOM.testTopicBadges.innerHTML = CONFIG.topics.filter(t => dist[t.id]).map(t =>
      `<span class="topic-pill ${t.pillClass}">${t.id.toUpperCase()}: ${dist[t.id]} câu</span>`
    ).join('');

    const currentAnswers = STATE.answers[STATE.currentTestIdx] || {};
    const isSub = STATE.submitted[STATE.currentTestIdx];

    let html = '';
    test.questions.forEach(q => {
      const selectedOptId = currentAnswers[q.q_num];
      const pillClass = q.topic_id === 'vcx' ? 'topic-pill-vcx' : (q.topic_id === 'vhm' ? 'topic-pill-vhm' : 'topic-pill-vkq');

      html += `
        <div class="question-card" id="q-card-${q.q_num}">
          <div class="q-header">
            <div class="q-tags">
              <span class="q-number-pill">Câu ${q.q_num}</span>
              <span class="topic-pill ${pillClass}">${q.topic_title}</span>
              <span class="q-orig-tag">Nguồn: ${q.topic_id.toUpperCase()} Câu ${q.orig_id}</span>
            </div>
          </div>
          <div class="q-text">${escapeHtml(q.clean_text)}</div>
          <div class="options-grid" id="opt-group-${q.q_num}">
            ${q.choices.map(c => {
              const isSelected = selectedOptId === c.id;
              return `
                <div class="option-item ${isSelected ? 'selected' : ''} ${isSub ? 'disabled' : ''}"
                     data-q="${q.q_num}"
                     data-optid="${c.id}"
                     data-letter="${c.letter}"
                     onclick="window.QuizApp.selectOption(${q.q_num}, '${c.id}')">
                  <div class="opt-letter">${c.letter}</div>
                  <div class="opt-text">${escapeHtml(c.text)}</div>
                </div>
              `;
            }).join('')}
          </div>
          <div class="q-explanation" id="exp-${q.q_num}">
            <strong>Đáp án đúng: ${q.correct_letter}.</strong> ${escapeHtml(q.correct_text)}
            ${q.explanation ? `<div style="margin-top: 6px;"><em>Lời giải:</em> ${escapeHtml(q.explanation)}</div>` : ''}
          </div>
        </div>
      `;
    });

    DOM.questionsContainer.innerHTML = html;

    // Render sidebar grid
    renderSidebarGrid();
  }

  function renderSidebarGrid() {
    const currentAnswers = STATE.answers[STATE.currentTestIdx] || {};
    const isSub = STATE.submitted[STATE.currentTestIdx];
    const test = STATE.quizData.tests[STATE.currentTestIdx];

    let gridHtml = '';
    for (let i = 1; i <= test.total_questions; i++) {
      const hasAnswer = !!currentAnswers[i];
      let extraClass = hasAnswer ? 'answered' : '';

      if (isSub) {
        const q = test.questions[i - 1];
        const isCorrect = currentAnswers[i] === q.correct_option_id;
        extraClass = isCorrect ? 'grid-correct' : 'grid-wrong';
      }

      gridHtml += `
        <button class="grid-btn ${extraClass}" id="grid-btn-${i}" onclick="window.QuizApp.scrollToQuestion(${i})">
          ${i}
        </button>
      `;
    }
    DOM.questionGrid.innerHTML = gridHtml;
  }

  // USER ACTION: SELECT OPTION
  function selectOption(qNum, optionId) {
    const testIdx = STATE.currentTestIdx;
    if (STATE.submitted[testIdx]) return; // locked after submission

    STATE.answers[testIdx][qNum] = optionId;

    // Update UI
    const optGroup = document.getElementById(`opt-group-${qNum}`);
    if (optGroup) {
      optGroup.querySelectorAll('.option-item').forEach(el => {
        if (el.dataset.optid === optionId) {
          el.classList.add('selected');
        } else {
          el.classList.remove('selected');
        }
      });
    }

    const gridBtn = document.getElementById(`grid-btn-${qNum}`);
    if (gridBtn) {
      gridBtn.classList.add('answered');
    }

    updateProgress();
  }

  function scrollToQuestion(qNum) {
    const card = document.getElementById(`q-card-${qNum}`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function updateProgress() {
    const currentAnswers = STATE.answers[STATE.currentTestIdx] || {};
    const answered = Object.keys(currentAnswers).length;
    const total = STATE.quizData.tests[STATE.currentTestIdx].total_questions;
    DOM.answeredCount.innerHTML = `<strong>${answered}</strong> / ${total} câu`;
    const pct = Math.round((answered / total) * 100);
    DOM.progressFill.style.width = `${pct}%`;
    DOM.progressPercent.textContent = `${pct}%`;
  }

  // TIMER
  function startTimer() {
    clearInterval(STATE.timerInterval);
    STATE.timerInterval = setInterval(() => {
      if (STATE.secondsLeft > 0) {
        STATE.secondsLeft--;
        renderTimer();
      } else {
        clearInterval(STATE.timerInterval);
        submitCurrentTest();
      }
    }, 1000);
  }

  function stopTimer() {
    clearInterval(STATE.timerInterval);
  }

  function resetTimer() {
    stopTimer();
    STATE.secondsLeft = CONFIG.timeLimitSeconds;
    renderTimer();
    DOM.timerBadge.classList.remove('warning');
  }

  function renderTimer() {
    const mins = Math.floor(STATE.secondsLeft / 60);
    const secs = STATE.secondsLeft % 60;
    DOM.timerText.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    if (STATE.secondsLeft < 300) {
      DOM.timerBadge.classList.add('warning');
    } else {
      DOM.timerBadge.classList.remove('warning');
    }
  }

  // SUBMIT & SCORE
  function submitCurrentTest() {
    const testIdx = STATE.currentTestIdx;
    if (STATE.submitted[testIdx]) return;

    const currentAnswers = STATE.answers[testIdx] || {};
    const answeredCount = Object.keys(currentAnswers).length;

    if (answeredCount < STATE.quizData.tests[testIdx].total_questions) {
      const confirmSubmit = confirm(`Bạn mới làm được ${answeredCount}/${STATE.quizData.tests[testIdx].total_questions} câu hỏi. Bạn có chắc chắn muốn nộp bài ngay bây giờ?`);
      if (!confirmSubmit) return;
    }

    STATE.submitted[testIdx] = true;
    stopTimer();

    const test = STATE.quizData.tests[testIdx];
    const scoreResult = ScoringEngine.evaluateTest(test, currentAnswers);
    STATE.scores[testIdx] = scoreResult;

    renderSubmittedReview();
    openResultModal(scoreResult);
  }

  function renderSubmittedReview() {
    const testIdx = STATE.currentTestIdx;
    const test = STATE.quizData.tests[testIdx];
    const userAnswers = STATE.answers[testIdx] || {};

    test.questions.forEach(q => {
      const userChoiceId = userAnswers[q.q_num];
      const card = document.getElementById(`q-card-${q.q_num}`);
      const optGroup = document.getElementById(`opt-group-${q.q_num}`);
      const exp = document.getElementById(`exp-${q.q_num}`);

      if (exp) exp.classList.add('show');

      if (optGroup) {
        optGroup.querySelectorAll('.option-item').forEach(el => {
          el.classList.add('disabled');
          const optId = el.dataset.optid;

          if (optId === q.correct_option_id) {
            el.classList.add('correct-ans');
          } else if (optId === userChoiceId && userChoiceId !== q.correct_option_id) {
            el.classList.add('wrong-selected');
          } else {
            el.classList.add('dimmed');
          }
        });
      }

      if (card) {
        if (!userChoiceId) {
          card.classList.add('status-wrong');
        } else if (userChoiceId === q.correct_option_id) {
          card.classList.add('status-correct');
        } else {
          card.classList.add('status-wrong');
        }
      }
    });

    renderSidebarGrid();
  }

  function resetCurrentTest() {
    const testIdx = STATE.currentTestIdx;
    const confirmReset = confirm(`Bạn có chắc muốn làm lại Đề số ${testIdx + 1}? Mọi câu trả lời của đề này sẽ được làm mới.`);
    if (!confirmReset) return;

    STATE.answers[testIdx] = {};
    STATE.submitted[testIdx] = false;
    STATE.scores[testIdx] = null;

    renderCurrentTest();
    updateProgress();
    resetTimer();
    startTimer();
  }

  // MODALS
  function openResultModal(result) {
    DOM.modalScoreNum.textContent = result.score10;
    DOM.modalGradeText.textContent = `Xếp loại: ${result.grade}`;
    DOM.modalFeedbackText.textContent = result.feedback;

    DOM.statCorrect.textContent = result.correctCount;
    DOM.statWrong.textContent = result.wrongCount;
    DOM.statSkipped.textContent = result.unattemptedCount;

    // Topic breakdown
    let topicRows = '';
    result.topicBreakdown.forEach(tb => {
      const pct = Math.round((tb.correct / tb.total) * 100);
      topicRows += `
        <div class="topic-breakdown-row">
          <span><strong>${escapeHtml(tb.topicTitle)}</strong></span>
          <span>${tb.correct}/${tb.total} câu (${pct}%)</span>
        </div>
      `;
    });
    DOM.modalTopicBreakdown.innerHTML = topicRows;

    DOM.resultModal.classList.add('open');
  }

  // MATRIX TAB
  function showMatrixTab() {
    hideAllViews();
    DOM.quizInfoBar.style.display = 'none';
    DOM.sidebar.style.display = 'none';
    DOM.matrixContainer.style.display = 'block';

    const tests = STATE.quizData.tests;
    let tableHeadCols = '<th style="width: 70px;">Câu</th>';
    for (let t = 0; t < tests.length; t++) {
      tableHeadCols += `<th>Đề ${t + 1}</th>`;
    }

    let rowsHtml = '';
    for (let q = 1; q <= tests[0].total_questions; q++) {
      rowsHtml += `<tr><td><strong>Câu ${q}</strong></td>`;
      for (let t = 0; t < tests.length; t++) {
        const item = tests[t].questions[q - 1];
        rowsHtml += `<td><span class="ans-tag">${item.correct_letter}</span></td>`;
      }
      rowsHtml += `</tr>`;
    }

    DOM.matrixContainer.innerHTML = `
      <div class="quiz-info-bar">
        <div class="quiz-title-area">
          <h2>Bảng Ma Trận Đáp Án Toàn Bộ ${tests.length} Đề</h2>
          <div class="quiz-meta">
            <span>📚 ${tests.length} Đề • ${tests.reduce((sum, test) => sum + test.total_questions, 0)} Câu hỏi</span>
            <span>${escapeHtml(quizDescription())} • Phương án xáo trộn độc lập</span>
          </div>
        </div>
        <button id="btnDownloadAnswerMatrix" class="btn btn-primary" style="width: auto;">
          Tải Bảng Đáp Án (.txt)
        </button>
      </div>

      <div class="key-table-wrapper">
        <table class="key-table">
          <thead>
            <tr>${tableHeadCols}</tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('btnDownloadAnswerMatrix').addEventListener('click', downloadAnswerMatrix);
  }

  function downloadAnswerMatrix() {
    const tests = STATE.quizData.tests;
    const lines = [
      '========================================================================',
      `BẢNG ĐÁP ÁN ${tests.length} ĐỀ THI LÝ LUẬN CHÍNH TRỊ (VCX - VHM - VKQ)`,
      quizDescription(),
      '========================================================================\n',
    ];

    tests.forEach(test => {
      const counts = { A: 0, B: 0, C: 0, D: 0 };
      test.questions.forEach(q => counts[q.correct_letter] = (counts[q.correct_letter] || 0) + 1);

      lines.push(`=== ĐỀ SỐ ${test.test_num} ===`);
      lines.push(`Phân bổ đáp án đúng: A=${counts.A || 0}, B=${counts.B || 0}, C=${counts.C || 0}, D=${counts.D || 0}`);
      const row = test.questions.map(q => `${String(q.q_num).padStart(2, '0')}.${q.correct_letter}`).join('   ');
      lines.push(row);
      lines.push('');
    });

    downloadTextFile('dap_an_cac_de_quiz.txt', lines.join('\n'));
  }

  // BANK TAB (QUESTION EXPLORER)
  function showBankTab() {
    hideAllViews();
    DOM.quizInfoBar.style.display = 'none';
    DOM.sidebar.style.display = 'none';
    DOM.bankContainer.style.display = 'block';

    const allValidQuestions = [];
    STATE.topicBanks.forEach(tb => {
      tb.validQuestions.forEach(q => allValidQuestions.push(q));
    });

    // Check appearances in generated tests
    const appearancesMap = new Map();
    STATE.quizData.tests.forEach(test => {
      test.questions.forEach(q => {
        const list = appearancesMap.get(q.id) || [];
        list.push({ testNum: test.test_num, qNum: q.q_num, letter: q.correct_letter });
        appearancesMap.set(q.id, list);
      });
    });

    DOM.bankContainer.innerHTML = `
      <div class="quiz-info-bar">
        <div class="quiz-title-area">
          <h2>Ngân Hàng Câu Hỏi Gốc (${allValidQuestions.length} Câu Hợp Lệ)</h2>
          <div class="quiz-meta">
            <span>Tổng hợp từ 3 chủ đề: VCX (${STATE.topicBanks[0].validCount}), VHM (${STATE.topicBanks[1].validCount}), VKQ (${STATE.topicBanks[2].validCount})</span>
          </div>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <select id="bankTopicFilter" style="padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-main);">
            <option value="all">Tất cả chủ đề</option>
            <option value="vcx">Chủ nghĩa xã hội khoa học (VCX)</option>
            <option value="vhm">Triết học Mác - Lênin (VHM)</option>
            <option value="vkq">Kinh tế chính trị Mác - Lênin (VKQ)</option>
          </select>
          <input type="text" id="bankSearch" placeholder="🔍 Tìm kiếm câu hỏi..." style="padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-main); width: 260px;">
        </div>
      </div>
      <div id="bankCardsList"></div>
    `;

    function filterAndRenderBank() {
      const searchVal = (document.getElementById('bankSearch').value || '').toLowerCase().trim();
      const topicFilter = document.getElementById('bankTopicFilter').value;

      const filtered = allValidQuestions.filter(q => {
        if (topicFilter !== 'all' && q.topicId !== topicFilter) return false;
        if (!searchVal) return true;
        return q.cleanText.toLowerCase().includes(searchVal) || String(q.origNumber).includes(searchVal);
      });

      let cardsHtml = '';
      filtered.forEach(q => {
        const apps = appearancesMap.get(q.id) || [];
        const appBadges = apps.map(a =>
          `<span class="q-orig-tag" style="background: var(--primary-light); color: var(--accent);">Đề ${a.testNum} (C.${a.qNum})</span>`
        ).join(' ');

        const pillClass = q.topicId === 'vcx' ? 'topic-pill-vcx' : (q.topicId === 'vhm' ? 'topic-pill-vhm' : 'topic-pill-vkq');

        cardsHtml += `
          <div class="question-card">
            <div class="q-header">
              <div class="q-tags">
                <span class="topic-pill ${pillClass}">${q.topicTitle}</span>
                <span class="q-orig-tag">Câu ${q.origNumber} gốc</span>
                ${appBadges}
              </div>
            </div>
            <div class="q-text">${escapeHtml(q.cleanText)}</div>
            <div class="options-grid">
              ${q.options.map(opt => `
                <div class="option-item ${opt.isCorrect ? 'correct-ans' : ''} disabled">
                  <div class="opt-letter">${opt.origLetter}</div>
                  <div class="opt-text">${escapeHtml(opt.text)}</div>
                </div>
              `).join('')}
            </div>
            ${q.explanation ? `<div class="q-explanation show" style="margin-top: 12px;"><em>Lời giải:</em> ${escapeHtml(q.explanation)}</div>` : ''}
          </div>
        `;
      });

      document.getElementById('bankCardsList').innerHTML = cardsHtml || '<p style="text-align: center; padding: 40px; color: var(--text-muted);">Không tìm thấy câu hỏi phù hợp.</p>';
    }

    document.getElementById('bankSearch').addEventListener('input', filterAndRenderBank);
    document.getElementById('bankTopicFilter').addEventListener('change', filterAndRenderBank);
    filterAndRenderBank();
  }

  // REPORT TAB (DATA VALIDATION & QUALITY AUDIT)
  function showReportTab() {
    hideAllViews();
    DOM.quizInfoBar.style.display = 'none';
    DOM.sidebar.style.display = 'none';
    DOM.reportContainer.style.display = 'block';

    let totalParsed = 0;
    let totalValid = 0;
    let totalInvalid = 0;
    let totalDuplicates = 0;

    STATE.topicBanks.forEach(tb => {
      totalParsed += tb.totalParsed;
      totalValid += tb.validCount;
      totalInvalid += tb.invalidCount;
      totalDuplicates += tb.duplicateCount;
    });

    let badgesHtml = `
      <div class="quality-badge">
        <h4>Tổng Số Câu Đọc Được</h4>
        <div class="count" style="color: var(--text-main);">${totalParsed}</div>
      </div>
      <div class="quality-badge">
        <h4>Câu Hợp Lệ & Duy Nhất</h4>
        <div class="count" style="color: var(--success);">${totalValid}</div>
      </div>
      <div class="quality-badge">
        <h4>Câu Trùng Đã Lọc Bỏ</h4>
        <div class="count" style="color: var(--warning);">${totalDuplicates}</div>
      </div>
      <div class="quality-badge">
        <h4>Câu Lỗi Định Dạng</h4>
        <div class="count" style="color: var(--danger);">${totalInvalid}</div>
      </div>
    `;

    let tablesHtml = '';
    STATE.topicBanks.forEach(tb => {
      tablesHtml += `
        <div class="quality-card">
          <h3>📌 Chủ Đề: ${escapeHtml(tb.topicTitle)} (${tb.topicId.toUpperCase()})</h3>
          <p style="color: var(--text-muted); margin: 6px 0 16px;">
            Đọc được <strong>${tb.totalParsed}</strong> câu • Hợp lệ: <strong>${tb.validCount}</strong> • Trùng lặp: <strong>${tb.duplicateCount}</strong> • Lỗi: <strong>${tb.invalidCount}</strong>
          </p>
      `;

      if (tb.invalidCount > 0) {
        tablesHtml += `
          <h4 style="color: var(--danger); margin-bottom: 8px;">Danh sách câu hỏi lỗi định dạng (đã bị loại bỏ an toàn):</h4>
          <div class="key-table-wrapper" style="margin-bottom: 16px;">
            <table class="key-table">
              <thead>
                <tr>
                  <th style="width: 80px;">Câu gốc</th>
                  <th>Nội dung trích xuất</th>
                  <th style="width: 280px;">Lý do không hợp lệ</th>
                </tr>
              </thead>
              <tbody>
                ${tb.invalidQuestions.map(inv => `
                  <tr>
                    <td><strong>Câu ${inv.origNumber}</strong></td>
                    <td style="text-align: left;">${escapeHtml(inv.cleanTitle || '(Trống)')}</td>
                    <td style="text-align: left; color: var(--danger);">${inv.reasons.join('<br>')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      if (tb.duplicateCount > 0) {
        tablesHtml += `
          <h4 style="color: var(--warning); margin-bottom: 8px;">Thông tin câu hỏi trùng nội dung trong file gốc:</h4>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px;">
            Hệ thống phát hiện ${tb.duplicateCount} câu bị lặp lại nhiều lần (ví dụ trong ${tb.topicId.toUpperCase()}). Hệ thống đã tự động giữ 1 phiên bản chuẩn và lọc bỏ ${tb.duplicateCount} câu lặp để bảo đảm trong mỗi đề thi KHÔNG BAO GIỜ bị lặp câu.
          </p>
        `;
      }

      tablesHtml += `</div>`;
    });

    DOM.reportContainer.innerHTML = `
      <div class="quiz-info-bar">
        <div class="quiz-title-area">
          <h2>Báo Cáo Kiểm Tra Chất Lượng Dữ Liệu Ngân Hàng</h2>
          <div class="quiz-meta">
            <span>Tuân thủ nguyên tắc: Không tự bịa câu hỏi • Không âm thầm bù dữ liệu • Báo cáo rõ ràng</span>
          </div>
        </div>
      </div>
      <div class="quality-badge-grid">${badgesHtml}</div>
      ${tablesHtml}
    `;
  }

  // EVENT LISTENERS SETUP
  function setupEventListeners() {
    DOM.btnSubmit.addEventListener('click', submitCurrentTest);
    DOM.btnReset.addEventListener('click', resetCurrentTest);

    DOM.btnReroll.addEventListener('click', () => {
      const confirmReroll = confirm('Bạn có chắc muốn xáo trộn và sinh lại toàn bộ các đề thi mới ngẫu nhiên?');
      if (confirmReroll) {
        generateAllQuizzes();
        renderTabs();
        switchTest(0);
      }
    });

    DOM.btnConfig.addEventListener('click', () => {
      DOM.inputNumTests.value = STATE.numTests;
      DOM.inputQuizMode.value = STATE.mode;
      DOM.inputTopic.value = STATE.topicId;
      DOM.inputQuestionCount.value = STATE.questionCount;
      updateConfigFields();
      DOM.configModal.classList.add('open');
    });

    DOM.btnCloseConfig.addEventListener('click', () => DOM.configModal.classList.remove('open'));

    ['inputQuizMode', 'inputTopic', 'inputQuestionCount'].forEach(id => {
      DOM[id].addEventListener('input', updateConfigFields);
    });
    DOM.btnSaveConfig.addEventListener('click', () => {
      const settings = {
        numTests: Number(DOM.inputNumTests.value),
        mode: DOM.inputQuizMode.value,
        topicId: DOM.inputTopic.value,
        questionCount: Number(DOM.inputQuestionCount.value),
      };
      try {
        if (!Number.isInteger(settings.numTests) || settings.numTests < 1 || settings.numTests > 10) {
          throw new Error('Vui lòng chọn số lượng đề từ 1 đến 10!');
        }
        generateAllQuizzes(settings);
        STATE.currentTestIdx = 0;
        renderTabs();
        switchTest(0);
        DOM.configModal.classList.remove('open');
      } catch (err) {
        DOM.configError.textContent = err.message;
        DOM.configError.hidden = false;
      }
    });

    DOM.btnDataReport.addEventListener('click', showReportTab);

    DOM.btnCloseResultModal.addEventListener('click', () => DOM.resultModal.classList.remove('open'));
    DOM.btnModalReview.addEventListener('click', () => DOM.resultModal.classList.remove('open'));
    DOM.btnModalRetake.addEventListener('click', () => {
      DOM.resultModal.classList.remove('open');
      resetCurrentTest();
    });

    DOM.btnDownloadTest.addEventListener('click', () => {
      const test = STATE.quizData.tests[STATE.currentTestIdx];
      const lines = [
        `========================================================================`,
        `ĐỀ THI TRẮC NGHIỆM SỐ ${test.test_num} - LÝ LUẬN CHÍNH TRỊ`,
        quizDescription(),
        `========================================================================\n`,
      ];
      test.questions.forEach(q => {
        lines.push(`Câu ${q.q_num}: [${q.topic_title}] ${q.clean_text}`);
        q.choices.forEach(c => {
          lines.push(`  ${c.letter}. ${c.text}`);
        });
        lines.push('');
      });
      downloadTextFile(`de_so_${test.test_num}.txt`, lines.join('\n'));
    });
  }

  function updateConfigFields() {
    DOM.topicConfigFields.hidden = DOM.inputQuizMode.value !== 'topic';
    DOM.questionCountValue.textContent = `${DOM.inputQuestionCount.value} câu`;
    const bank = STATE.topicBanks.find(t => t.topicId === DOM.inputTopic.value);
    DOM.topicAvailability.textContent = bank ? `Chủ đề có ${bank.validQuestions.length} câu hỏi hợp lệ.` : '';
    DOM.configError.hidden = true;
  }

  function quizDescription() {
    if (STATE.mode === 'topic') {
      const topic = CONFIG.topics.find(t => t.id === STATE.topicId);
      return `Mỗi đề gồm ${STATE.questionCount} câu hỏi — ${topic.title}`;
    }
    return 'Mỗi đề gồm 30 câu hỏi: 10 VCX, 10 VHM, 10 VKQ';
  }

  // UTILITIES
  function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }

  function downloadTextFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Expose global namespace for onclick handlers
  window.QuizApp = {
    selectOption,
    scrollToQuestion,
  };

  // Launch on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
