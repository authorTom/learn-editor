/* Learn Editor course player. Expects window.COURSE (course JSON) and
   window.SCORM_VERSION ('1.2' | '2004' | 'preview'). */
(function () {
  'use strict';

  var COURSE = window.COURSE;
  var SCORM_VERSION = window.SCORM_VERSION || 'preview';

  /* ================= SCORM adapter ================= */

  function findAPI(win, name) {
    var tries = 0;
    while (win && tries < 15) {
      if (win[name]) return win[name];
      if (win.parent && win.parent !== win) { win = win.parent; tries++; continue; }
      break;
    }
    try {
      if (window.opener) {
        var w = window.opener; tries = 0;
        while (w && tries < 15) {
          if (w[name]) return w[name];
          if (w.parent && w.parent !== w) { w = w.parent; tries++; continue; }
          break;
        }
      }
    } catch (e) { /* cross-origin opener */ }
    return null;
  }

  var scorm = {
    api: null,
    version: SCORM_VERSION,
    connected: false,

    init: function () {
      if (SCORM_VERSION === '1.2') {
        this.api = findAPI(window, 'API');
        if (this.api) this.connected = this.api.LMSInitialize('') !== 'false';
      } else if (SCORM_VERSION === '2004') {
        this.api = findAPI(window, 'API_1484_11');
        if (this.api) this.connected = this.api.Initialize('') !== 'false';
      }
      if (this.connected && SCORM_VERSION === '1.2') {
        var status = this.api.LMSGetValue('cmi.core.lesson_status');
        if (status === 'not attempted' || status === '') {
          this.api.LMSSetValue('cmi.core.lesson_status', 'incomplete');
        }
      } else if (this.connected && SCORM_VERSION === '2004') {
        var cs = this.api.GetValue('cmi.completion_status');
        if (cs === 'not attempted' || cs === 'unknown' || cs === '') {
          this.api.SetValue('cmi.completion_status', 'incomplete');
        }
      }
      return this.connected;
    },

    getSuspendData: function () {
      var raw = '';
      if (this.connected) {
        raw = SCORM_VERSION === '1.2'
          ? this.api.LMSGetValue('cmi.suspend_data')
          : this.api.GetValue('cmi.suspend_data');
      } else {
        raw = localStorage.getItem('le-progress-' + COURSE.id) || '';
      }
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (e) { return null; }
    },

    save: function (state, progress) {
      var raw = JSON.stringify(state);
      if (this.connected) {
        if (SCORM_VERSION === '1.2') {
          this.api.LMSSetValue('cmi.suspend_data', raw);
          this.api.LMSSetValue('cmi.core.lesson_location', state.cur || '');
          if (progress.scored) {
            this.api.LMSSetValue('cmi.core.score.min', '0');
            this.api.LMSSetValue('cmi.core.score.max', '100');
            this.api.LMSSetValue('cmi.core.score.raw', String(progress.score));
          }
          if (progress.finished) {
            this.api.LMSSetValue('cmi.core.lesson_status',
              progress.scored ? (progress.passed ? 'passed' : 'failed') : 'completed');
          }
          this.api.LMSCommit('');
        } else {
          this.api.SetValue('cmi.suspend_data', raw);
          this.api.SetValue('cmi.location', state.cur || '');
          if (progress.scored) {
            this.api.SetValue('cmi.score.min', '0');
            this.api.SetValue('cmi.score.max', '100');
            this.api.SetValue('cmi.score.raw', String(progress.score));
            this.api.SetValue('cmi.score.scaled', String(progress.score / 100));
            this.api.SetValue('cmi.success_status', progress.passed ? 'passed' : 'failed');
          }
          if (progress.finished) this.api.SetValue('cmi.completion_status', 'completed');
          this.api.Commit('');
        }
      } else {
        localStorage.setItem('le-progress-' + COURSE.id, raw);
      }
    },

    finish: function () {
      if (!this.connected) return;
      if (SCORM_VERSION === '1.2') { this.api.LMSCommit(''); this.api.LMSFinish(''); }
      else { this.api.Commit(''); this.api.Terminate(''); }
      this.connected = false;
    }
  };

  /* ================= state ================= */

  var state = {
    cur: '',            // current lesson id
    done: {},           // lessonId -> true
    quiz: {}            // quizBlockId -> { score: 0-100, passed: bool }
  };

  var saved = null;

  function totalQuizzes() {
    var n = 0;
    COURSE.lessons.forEach(function (l) {
      l.blocks.forEach(function (b) { if (b.type === 'quiz') n++; });
    });
    return n;
  }

  function computeProgress() {
    var doneCount = 0;
    COURSE.lessons.forEach(function (l) { if (state.done[l.id]) doneCount++; });
    var finished = doneCount === COURSE.lessons.length;
    var quizIds = [];
    COURSE.lessons.forEach(function (l) {
      l.blocks.forEach(function (b) { if (b.type === 'quiz') quizIds.push(b.id); });
    });
    var scored = quizIds.length > 0;
    var score = 0, passed = true;
    if (scored) {
      var sum = 0;
      quizIds.forEach(function (id) {
        var q = state.quiz[id];
        sum += q ? q.score : 0;
        if (!q || !q.passed) passed = false;
      });
      score = Math.round(sum / quizIds.length);
    }
    return {
      pct: Math.round((doneCount / COURSE.lessons.length) * 100),
      finished: finished,
      scored: scored,
      score: score,
      passed: passed && finished
    };
  }

  function persist() {
    scorm.save(state, computeProgress());
    renderSidebarState();
  }

  /* ================= helpers ================= */

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function shuffleArr(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ================= block renderers ================= */

  function renderBlock(b) {
    var w = el('div', 'block b-' + b.type.toLowerCase());
    switch (b.type) {
      case 'text':
        w.innerHTML = '<div class="rich">' + b.html + '</div>';
        break;
      case 'heading': {
        var h = el('h' + b.level, '', esc(b.text));
        w.className += ' b-heading' + (b.align === 'center' ? ' center' : '');
        w.appendChild(h);
        break;
      }
      case 'statement':
        w.className = 'block b-statement style-' + b.style;
        w.innerHTML = '<div class="inner rich">' + b.html + '</div>';
        break;
      case 'quote':
        w.className = 'block b-quote';
        w.innerHTML = '<div class="q-text rich">' + b.html + '</div>' +
          (b.attribution ? '<div class="q-attr">— ' + esc(b.attribution) + '</div>' : '');
        break;
      case 'list': {
        w.className = 'block b-list' + (b.style === 'check' ? ' checks' : '');
        var tag = b.style === 'number' ? 'ol' : 'ul';
        w.innerHTML = '<' + tag + '>' + b.items.map(function (it) {
          return '<li><span class="rich">' + it + '</span></li>';
        }).join('') + '</' + tag + '>';
        break;
      }
      case 'image':
        if (!b.src) return null;
        w.className = 'block b-image ' + b.width;
        w.innerHTML = '<img src="' + esc(b.src) + '" alt="' + esc(b.alt) + '" loading="lazy">' +
          (b.caption ? '<div class="b-caption">' + esc(b.caption) + '</div>' : '');
        break;
      case 'imageText':
        w.className = 'block b-imagetext' + (b.imageSide === 'right' ? ' right' : '');
        w.innerHTML = (b.src ? '<img src="' + esc(b.src) + '" alt="' + esc(b.alt) + '" loading="lazy">' : '') +
          '<div class="it-text rich">' + b.html + '</div>';
        break;
      case 'gallery':
        if (!b.images.length) return null;
        w.className = 'block b-gallery cols-' + b.columns;
        w.innerHTML = b.images.map(function (im) {
          return '<figure><img src="' + esc(im.src) + '" alt="' + esc(im.alt) + '" loading="lazy">' +
            (im.caption ? '<figcaption>' + esc(im.caption) + '</figcaption>' : '') + '</figure>';
        }).join('');
        break;
      case 'video':
        if (!b.embedUrl) return null;
        w.innerHTML = '<div class="video-frame"><iframe src="' + esc(b.embedUrl) +
          '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>' +
          (b.caption ? '<div class="b-caption">' + esc(b.caption) + '</div>' : '');
        break;
      case 'embed':
        if (!b.url) return null;
        w.innerHTML = '<div class="embed-frame"><iframe src="' + esc(b.url) +
          '" style="height:' + (parseInt(b.height, 10) || 480) + 'px" loading="lazy"></iframe></div>' +
          (b.caption ? '<div class="b-caption">' + esc(b.caption) + '</div>' : '');
        break;
      case 'audio':
        if (!b.src) return null;
        w.className = 'block b-audio';
        w.innerHTML = (b.title ? '<div class="a-title">' + esc(b.title) + '</div>' : '') +
          '<audio controls src="' + esc(b.src) + '"></audio>';
        break;
      case 'divider':
        w.className = 'block b-divider ' + b.style;
        if (b.style === 'numbered') w.innerHTML = '<div class="num">' + esc(b.number || 1) + '</div>';
        break;
      case 'button':
        if (!b.label) return null;
        w.className = 'block b-button ' + b.align;
        w.innerHTML = '<a class="' + b.variant + '" href="' + esc(b.url || '#') + '" target="_blank" rel="noopener">' + esc(b.label) + '</a>';
        break;
      case 'note': {
        var icons = { info: 'ℹ️', success: '✅', warning: '⚠️', danger: '⛔' };
        w.className = 'block b-note ' + b.tone;
        w.innerHTML = (b.title ? '<div class="n-title">' + icons[b.tone] + ' ' + esc(b.title) + '</div>' : '') +
          '<div class="rich">' + b.html + '</div>';
        break;
      }
      case 'columns':
        w.className = 'block b-columns';
        w.style.setProperty('--cols', b.columns.length);
        w.innerHTML = b.columns.map(function (c) {
          return '<div class="rich">' + c.html + '</div>';
        }).join('');
        break;
      case 'accordion':
        renderAccordion(w, b);
        break;
      case 'tabs':
        renderTabs(w, b);
        break;
      case 'flashcards':
        renderFlashcards(w, b);
        break;
      case 'quiz':
        renderQuiz(w, b);
        break;
      default:
        return null;
    }
    return w;
  }

  function renderAccordion(w, b) {
    w.className = 'block b-accordion';
    b.items.forEach(function (item) {
      var it = el('div', 'acc-item');
      var head = el('button', 'acc-head');
      head.innerHTML = '<span>' + esc(item.title) + '</span><span class="chev">▾</span>';
      head.addEventListener('click', function () { it.classList.toggle('open'); });
      it.appendChild(head);
      it.appendChild(el('div', 'acc-body rich', item.html));
      w.appendChild(it);
    });
  }

  function renderTabs(w, b) {
    w.className = 'block b-tabs';
    var list = el('div', 'tab-list');
    var panels = [];
    b.items.forEach(function (item, i) {
      var btn = el('button', i === 0 ? 'active' : '', esc(item.title));
      var panel = el('div', 'tab-panel rich' + (i === 0 ? ' active' : ''), item.html);
      btn.addEventListener('click', function () {
        list.querySelectorAll('button').forEach(function (x) { x.classList.remove('active'); });
        panels.forEach(function (p) { p.classList.remove('active'); });
        btn.classList.add('active');
        panel.classList.add('active');
      });
      list.appendChild(btn);
      panels.push(panel);
    });
    w.appendChild(list);
    panels.forEach(function (p) { w.appendChild(p); });
  }

  function renderFlashcards(w, b) {
    w.className = 'block b-flashcards';
    b.cards.forEach(function (c) {
      var card = el('div', 'fcard');
      card.innerHTML =
        '<div class="fcard-inner">' +
          '<div class="fcard-face fcard-front">' +
            (c.frontImage ? '<img src="' + esc(c.frontImage) + '" alt="">' : '') +
            '<div>' + esc(c.front) + '</div><div class="fcard-hint">Tap to flip</div>' +
          '</div>' +
          '<div class="fcard-face fcard-back"><div>' + esc(c.back) + '</div><div class="fcard-hint">Tap to flip back</div></div>' +
        '</div>';
      card.addEventListener('click', function () { card.classList.toggle('flipped'); });
      w.appendChild(card);
    });
  }

  /* ================= quiz ================= */

  function renderQuiz(w, b) {
    w.className = 'block b-quiz';
    var head = el('div', 'quiz-head');
    head.innerHTML = '<h3>' + esc(b.title) + '</h3><div class="quiz-meta">' +
      b.questions.length + ' question' + (b.questions.length === 1 ? '' : 's') +
      ' · pass mark ' + b.passingScore + '%</div>';
    w.appendChild(head);

    var prior = state.quiz[b.id];
    var body = el('div');
    w.appendChild(body);

    function start() {
      body.innerHTML = '';
      var questions = b.shuffle ? shuffleArr(b.questions) : b.questions;
      var answers = {}; // qid -> Set of choice ids | string
      var submitted = {};
      var correctCount = 0;
      var submittedCount = 0;

      questions.forEach(function (q, qi) {
        var qEl = el('div', 'q-item');
        qEl.innerHTML = '<div class="q-num">Question ' + (qi + 1) + ' of ' + questions.length + '</div>' +
          '<div class="q-text">' + esc(q.text) + '</div>';
        var zone = el('div');
        qEl.appendChild(zone);
        var fb = el('div');
        qEl.appendChild(fb);
        var actions = el('div');
        actions.style.marginTop = '16px';
        var submitBtn = el('button', 'quiz-btn', 'Submit');
        submitBtn.disabled = true;
        actions.appendChild(submitBtn);
        qEl.appendChild(actions);

        function grade() {
          var correct = false;
          if (q.type === 'fillin') {
            var val = (answers[q.id] || '').trim().toLowerCase();
            correct = q.answers.some(function (a) { return a.trim().toLowerCase() === val && val !== ''; });
          } else if (q.type === 'multiple') {
            var sel = answers[q.id] || {};
            correct = q.choices.every(function (c) { return !!sel[c.id] === !!c.correct; });
          } else {
            var selId = answers[q.id];
            var chosen = q.choices.filter(function (c) { return c.id === selId; })[0];
            correct = !!(chosen && chosen.correct);
          }
          return correct;
        }

        submitBtn.addEventListener('click', function () {
          if (submitted[q.id]) return;
          submitted[q.id] = true;
          submittedCount++;
          var ok = grade();
          if (ok) correctCount++;
          // mark choices
          zone.querySelectorAll('.q-choice').forEach(function (cEl) {
            var cid = cEl.getAttribute('data-cid');
            var choice = q.choices.filter(function (c) { return c.id === cid; })[0];
            var input = cEl.querySelector('input');
            input.disabled = true;
            if (choice && choice.correct) cEl.classList.add('correct');
            else if (input.checked) cEl.classList.add('incorrect');
          });
          var fillEl = zone.querySelector('.q-fillin input');
          if (fillEl) fillEl.disabled = true;
          if (b.showFeedback) {
            fb.className = 'q-feedback ' + (ok ? 'ok' : 'bad');
            var msg = ok ? (q.feedbackCorrect || 'Correct!') : (q.feedbackIncorrect || 'Incorrect.');
            if (!ok && q.type === 'fillin') msg += ' Accepted answer: ' + q.answers.filter(Boolean)[0];
            fb.textContent = (ok ? '✓ ' : '✗ ') + msg;
          }
          submitBtn.style.display = 'none';
          if (submittedCount === questions.length) showResult();
        });

        if (q.type === 'fillin') {
          var fz = el('div', 'q-fillin');
          var input = document.createElement('input');
          input.type = 'text';
          input.placeholder = 'Type your answer…';
          input.addEventListener('input', function () {
            answers[q.id] = input.value;
            submitBtn.disabled = input.value.trim() === '';
          });
          fz.appendChild(input);
          zone.appendChild(fz);
        } else {
          var cz = el('div', 'q-choices');
          var multi = q.type === 'multiple';
          q.choices.forEach(function (c) {
            var lab = el('label', 'q-choice');
            lab.setAttribute('data-cid', c.id);
            var input = document.createElement('input');
            input.type = multi ? 'checkbox' : 'radio';
            input.name = 'q-' + b.id + '-' + q.id;
            input.addEventListener('change', function () {
              if (multi) {
                answers[q.id] = answers[q.id] || {};
                answers[q.id][c.id] = input.checked;
                submitBtn.disabled = !Object.keys(answers[q.id]).some(function (k) { return answers[q.id][k]; });
              } else {
                answers[q.id] = c.id;
                submitBtn.disabled = false;
              }
              cz.querySelectorAll('.q-choice').forEach(function (x) {
                var inp = x.querySelector('input');
                x.classList.toggle('sel', inp.checked);
              });
            });
            lab.appendChild(input);
            lab.appendChild(el('span', '', esc(c.text)));
            cz.appendChild(lab);
          });
          zone.appendChild(cz);
        }
        body.appendChild(qEl);
      });

      function showResult() {
        var score = Math.round((correctCount / questions.length) * 100);
        var passed = score >= b.passingScore;
        state.quiz[b.id] = { score: score, passed: passed };
        persist();
        var res = el('div', 'quiz-result');
        res.innerHTML = '<div class="quiz-score ' + (passed ? 'pass' : 'fail') + '">' + score + '%</div>' +
          '<div class="quiz-verdict">' + (passed
            ? 'Nice work — you passed! (' + correctCount + ' of ' + questions.length + ' correct)'
            : 'You need ' + b.passingScore + '% to pass. (' + correctCount + ' of ' + questions.length + ' correct)') + '</div>';
        var retry = el('button', 'quiz-btn ghost', 'Try again');
        retry.addEventListener('click', start);
        res.appendChild(retry);
        body.appendChild(res);
        res.scrollIntoView({ behavior: 'smooth', block: 'center' });
        updateFooterGate();
      }
    }

    if (prior) {
      var res = el('div', 'quiz-result');
      res.innerHTML = '<div class="quiz-score ' + (prior.passed ? 'pass' : 'fail') + '">' + prior.score + '%</div>' +
        '<div class="quiz-verdict">Previous result' + (prior.passed ? ' — passed' : '') + '</div>';
      var retry = el('button', 'quiz-btn ghost', 'Take again');
      retry.addEventListener('click', start);
      res.appendChild(retry);
      body.appendChild(res);
    } else {
      start();
    }
  }

  /* ================= layout & navigation ================= */

  var root = document.getElementById('app');
  var sidebarNav, progressFill, progressPct, footerNextBtn, gateMsg;

  function lessonQuizzes(lesson) {
    return lesson.blocks.filter(function (b) { return b.type === 'quiz'; });
  }

  function quizzesDone(lesson) {
    return lessonQuizzes(lesson).every(function (q) { return !!state.quiz[q.id]; });
  }

  function updateFooterGate() {
    if (!footerNextBtn) return;
    var lesson = COURSE.lessons.filter(function (l) { return l.id === state.cur; })[0];
    if (!lesson) return;
    var ok = quizzesDone(lesson);
    footerNextBtn.disabled = !ok;
    if (gateMsg) gateMsg.style.display = ok ? 'none' : '';
  }

  function renderSidebarState() {
    var prog = computeProgress();
    if (progressFill) progressFill.style.width = prog.pct + '%';
    if (progressPct) progressPct.textContent = prog.pct + '%';
    if (sidebarNav) {
      sidebarNav.querySelectorAll('button').forEach(function (btn) {
        var id = btn.getAttribute('data-id');
        btn.classList.toggle('active', id === state.cur);
        btn.classList.toggle('done', !!state.done[id]);
        btn.querySelector('.check').textContent = state.done[id] ? '✓' : '';
      });
    }
  }

  function openLesson(id) {
    state.cur = id;
    var idx = COURSE.lessons.findIndex(function (l) { return l.id === id; });
    var lesson = COURSE.lessons[idx];
    var content = root.querySelector('.content');
    content.innerHTML = '';

    // mobile topbar
    var topbar = el('div', 'topbar');
    var menuBtn = el('button', 'menu-btn', '☰');
    menuBtn.setAttribute('aria-label', 'Open course menu');
    menuBtn.addEventListener('click', function () { root.classList.add('nav-open'); });
    topbar.appendChild(menuBtn);
    topbar.appendChild(el('div', 't-title', esc(COURSE.title)));
    content.appendChild(topbar);

    var hero = el('div', 'lesson-hero');
    hero.innerHTML = '<div class="kicker">Lesson ' + (idx + 1) + ' of ' + COURSE.lessons.length + '</div>' +
      '<h2>' + esc(lesson.title) + '</h2>';
    content.appendChild(hero);

    var blocksWrap = el('div', 'blocks');
    if (computeProgress().finished) {
      blocksWrap.appendChild(el('div', 'complete-banner', '🎉 <span>Course complete — great job!</span>'));
    }
    lesson.blocks.forEach(function (b) {
      var node = renderBlock(b);
      if (node) blocksWrap.appendChild(node);
    });

    // footer nav
    var footer = el('div', 'lesson-footer');
    var prevBtn = el('button', 'nav-btn prev', '← Previous');
    prevBtn.disabled = idx === 0;
    prevBtn.addEventListener('click', function () {
      openLesson(COURSE.lessons[idx - 1].id);
    });
    var right = el('div');
    right.style.cssText = 'display:flex;flex-direction:column;gap:8px;align-items:flex-end;';
    var isLast = idx === COURSE.lessons.length - 1;
    footerNextBtn = el('button', 'nav-btn', isLast ? 'Finish course ✓' : 'Continue →');
    gateMsg = el('div', 'quiz-gate-msg', 'Complete the quiz above to continue');
    footerNextBtn.addEventListener('click', function () {
      state.done[lesson.id] = true;
      persist();
      if (isLast) {
        openLesson(lesson.id); // re-render to show completion banner
        window.scrollTo({ top: 0 });
      } else {
        openLesson(COURSE.lessons[idx + 1].id);
      }
    });
    right.appendChild(footerNextBtn);
    right.appendChild(gateMsg);
    footer.appendChild(prevBtn);
    footer.appendChild(right);
    blocksWrap.appendChild(footer);
    content.appendChild(blocksWrap);

    updateFooterGate();
    renderSidebarState();
    persist();
    root.classList.remove('nav-open');
    window.scrollTo({ top: 0 });
  }

  function build() {
    var theme = COURSE.theme || {};
    if (theme.primaryColor) document.documentElement.style.setProperty('--accent', theme.primaryColor);
    if (theme.headingWeight === 'bold') document.documentElement.style.setProperty('--heading-weight', '700');
    if (theme.font === 'serif') document.body.classList.add('font-serif');
    document.title = COURSE.title;

    root.className = 'player';

    var sidebar = el('aside', 'sidebar');
    var head = el('div', 'sidebar-head');
    head.innerHTML = '<h1>' + esc(COURSE.title) + '</h1>' +
      (COURSE.author ? '<div class="byline">by ' + esc(COURSE.author) + '</div>' : '') +
      '<div class="progress-wrap"><div class="progress-label"><span>Progress</span><span class="ppct">0%</span></div>' +
      '<div class="progress-bar"><div class="progress-fill"></div></div></div>';
    sidebar.appendChild(head);

    sidebarNav = el('nav', 'lesson-nav');
    COURSE.lessons.forEach(function (l) {
      var btn = el('button');
      btn.setAttribute('data-id', l.id);
      btn.innerHTML = '<span class="check"></span><span class="lesson-icon">' + esc(l.icon || '') +
        '</span><span>' + esc(l.title) + '</span>';
      btn.addEventListener('click', function () { openLesson(l.id); });
      sidebarNav.appendChild(btn);
    });
    sidebar.appendChild(sidebarNav);
    root.appendChild(sidebar);

    var scrim = el('div', 'scrim');
    scrim.addEventListener('click', function () { root.classList.remove('nav-open'); });
    root.appendChild(scrim);

    root.appendChild(el('main', 'content'));

    progressFill = head.querySelector('.progress-fill');
    progressPct = head.querySelector('.ppct');

    scorm.init();
    saved = scorm.getSuspendData();
    if (saved) {
      state.done = saved.done || {};
      state.quiz = saved.quiz || {};
      state.cur = saved.cur || '';
    }
    var startLesson = COURSE.lessons.filter(function (l) { return l.id === state.cur; })[0];
    openLesson(startLesson ? startLesson.id : COURSE.lessons[0].id);
  }

  window.addEventListener('beforeunload', function () {
    scorm.save(state, computeProgress());
    scorm.finish();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
