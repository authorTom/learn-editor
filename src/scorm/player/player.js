/* Learn Editor course player. Expects window.COURSE (course JSON),
   window.SCORM_VERSION ('1.2' | '2004' | 'preview') and window.LESSON_THEMES
   (lessonId -> CSS custom properties, for per-lesson style overrides). */
(function () {
  'use strict';

  var COURSE = window.COURSE;
  var SCORM_VERSION = window.SCORM_VERSION || 'preview';
  var LESSON_THEMES = window.LESSON_THEMES || {};
  var COMPLETION = COURSE.completion ||
    { allLessons: true, quizPass: false, minScore: 0, minMinutes: 0 };
  /* Layout settings the player reads at runtime. The exporter has already run
     these through normalizeTheme, so every field is present and valid — the
     fallbacks here only cover a hand-assembled COURSE object. */
  var THEME = COURSE.theme || {};
  var COVER_ID = '__cover'; // state.cur when the title page is showing
  var startedAt = Date.now();
  var priorMins = 0; // minutes from earlier sessions, restored from suspend data
  var interactionCount = 0; // next free cmi.interactions index

  /* Media lives once in COURSE.assets; blocks point at it with `asset:<id>`. */
  var ASSETS = {};
  (COURSE.assets || []).forEach(function (a) { ASSETS[a.id] = a.src; });

  function src(s) {
    if (!s) return '';
    return s.indexOf('asset:') === 0 ? (ASSETS[s.slice(6)] || '') : s;
  }

  /** Total minutes in the course: this session plus any earlier ones. */
  function elapsedMinutes() {
    return priorMins + (Date.now() - startedAt) / 60000;
  }

  function scormTime(totalSeconds) {
    var h = Math.floor(totalSeconds / 3600);
    var m = Math.floor((totalSeconds % 3600) / 60);
    var s = Math.floor(totalSeconds % 60);
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return SCORM_VERSION === '1.2'
      ? pad(h) + ':' + pad(m) + ':' + pad(s)
      : 'PT' + h + 'H' + m + 'M' + s + 'S';
  }

  /* ================= suspend data ==================
     SCORM 1.2 guarantees only 4096 characters of cmi.suspend_data, and an LMS
     that keeps exactly that is conformant. The obvious encoding —
     {cur, done:{id:true}, quiz:{id:{score,passed}}} — spends ~21 characters per
     finished lesson and ~42 per quiz on repeating the ids, which puts a long
     compliance course over the limit. Past it, most LMSs truncate rather than
     fail, so bookmarking dies silently and nothing in the course can tell.

     v2 drops the ids entirely and positions everything by index into
     COURSE.lessons and the course's quiz blocks, which is stable for a given
     package. A 100-lesson course with 40 quizzes fits in a few hundred
     characters. v1 payloads are still read, so a learner mid-course through an
     already-published package resumes correctly. */

  function quizIdList() {
    var ids = [];
    COURSE.lessons.forEach(function (l) {
      l.blocks.forEach(function (b) { if (b.type === 'quiz') ids.push(b.id); });
    });
    return ids;
  }

  function packState(state) {
    var lessons = COURSE.lessons;
    var quizIds = quizIdList();
    // done -> a bitmask string of '1'/'0', one character per lesson
    var done = '';
    for (var i = 0; i < lessons.length; i++) done += state.done[lessons[i].id] ? '1' : '0';
    // quiz -> [score, passed] pairs by quiz index; null where unattempted
    var quiz = quizIds.map(function (id) {
      var q = state.quiz[id];
      return q ? [q.score, q.passed ? 1 : 0] : 0;
    });
    // trailing unattempted quizzes carry no information
    while (quiz.length && quiz[quiz.length - 1] === 0) quiz.pop();
    var curIdx = lessons.findIndex(function (l) { return l.id === state.cur; });
    return {
      v: 2,
      c: state.cur === COVER_ID ? -2 : curIdx,
      d: done,
      q: quiz,
      m: Math.round(state.mins * 100) / 100
    };
  }

  function expandState(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.v !== 2) {
      // v1: ids in full. Read as-is.
      return { done: raw.done || {}, quiz: raw.quiz || {}, cur: raw.cur || '', mins: raw.mins || 0 };
    }
    var lessons = COURSE.lessons;
    var quizIds = quizIdList();
    var done = {};
    var d = raw.d || '';
    for (var i = 0; i < lessons.length; i++) if (d.charAt(i) === '1') done[lessons[i].id] = true;
    var quiz = {};
    (raw.q || []).forEach(function (entry, i) {
      if (!entry || !quizIds[i]) return;
      quiz[quizIds[i]] = { score: entry[0], passed: !!entry[1] };
    });
    var cur = raw.c === -2 ? COVER_ID : (lessons[raw.c] ? lessons[raw.c].id : '');
    return { done: done, quiz: quiz, cur: cur, mins: raw.m || 0 };
  }

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
        // No LMS: fall back to the browser. Storage is denied outright in some
        // private windows and file:// contexts, where even *reading* throws — so
        // this can never be left unguarded, or the course dies on load.
        try { raw = localStorage.getItem('le-progress-' + COURSE.id) || ''; }
        catch (e) { raw = ''; }
      }
      if (!raw) return null;
      try { return expandState(JSON.parse(raw)); } catch (e) { return null; }
    },

    save: function (state, progress) {
      var raw = JSON.stringify(packState(state));
      if (this.connected) {
        if (SCORM_VERSION === '1.2') {
          this.api.LMSSetValue('cmi.suspend_data', raw);
          this.api.LMSSetValue('cmi.core.lesson_location', state.cur || '');
          this.api.LMSSetValue('cmi.core.session_time',
            scormTime((Date.now() - startedAt) / 1000));
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
          this.api.SetValue('cmi.session_time', scormTime((Date.now() - startedAt) / 1000));
          if (progress.scored) {
            this.api.SetValue('cmi.score.min', '0');
            this.api.SetValue('cmi.score.max', '100');
            this.api.SetValue('cmi.score.raw', String(progress.score));
            this.api.SetValue('cmi.score.scaled', String(progress.score / 100));
          }
          // success_status stays 'unknown' until the outcome is actually
          // decided. It used to be written on every save, which meant the LMS
          // was told the learner had *failed* the moment they opened a course
          // containing a quiz — `passed` is false until the whole course is
          // finished. Plenty of LMSs latch the first definite value they see,
          // or surface it on a dashboard, so a learner three lessons in showed
          // as a failure. 1.2 never had the bug: lesson_status below is gated
          // on `finished`, and this now matches it.
          if (progress.finished) {
            this.api.SetValue('cmi.completion_status', 'completed');
            if (progress.scored) {
              this.api.SetValue('cmi.success_status', progress.passed ? 'passed' : 'failed');
            }
          }
          this.api.Commit('');
        }
      } else {
        // Progress simply isn't kept if the browser refuses storage; that beats
        // throwing on every page turn.
        try { localStorage.setItem('le-progress-' + COURSE.id, raw); }
        catch (e) { /* storage denied — carry on without resume */ }
      }
    },

    /**
     * Report one answered question as a cmi.interactions record.
     *
     * Without this the LMS receives a single score per attempt and nothing
     * else, so "which question does everyone get wrong" is unanswerable in
     * every LMS report — the data was never sent. Interactions are the standard
     * place for it and every LMS with reporting reads them.
     *
     * `id` is capped and sanitised because SCORM 1.2 allows only 255 characters
     * of CMIIdentifier and forbids whitespace.
     */
    reportInteraction: function (rec) {
      if (!this.connected) return;
      var i = interactionCount++;
      var is12 = SCORM_VERSION === '1.2';
      var set = is12
        ? this.api.LMSSetValue.bind(this.api)
        : this.api.SetValue.bind(this.api);
      var base = 'cmi.interactions.' + i + '.';
      var id = String(rec.id).replace(/\s+/g, '-').slice(0, 250);
      var typeMap12 = { choice: 'choice', multiple: 'choice', truefalse: 'true-false', fillin: 'fill-in' };
      var typeMap04 = { choice: 'choice', multiple: 'choice', truefalse: 'true-false', fillin: 'fill-in' };

      set(base + 'id', id);
      set(base + 'type', (is12 ? typeMap12 : typeMap04)[rec.type] || 'other');
      // 1.2 spells it student_response and has no description element.
      set(base + (is12 ? 'student_response' : 'learner_response'), String(rec.response).slice(0, 250));
      set(base + 'result', rec.correct ? 'correct' : 'wrong');
      if (!is12) {
        set(base + 'description', String(rec.text || '').slice(0, 250));
        set(base + 'timestamp', new Date().toISOString());
      } else {
        set(base + 'time', new Date().toTimeString().slice(0, 8));
      }
      set(base + 'weighting', '1');
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
    quiz: {},           // quizBlockId -> { score: 0-100, passed: bool }
    mins: 0             // minutes carried over from previous sessions
  };

  var saved = null;

  /** Evaluate the author's completion rules. `outstanding` explains, in the
      learner's words, whatever is still missing. */
  function computeProgress() {
    var doneCount = 0;
    COURSE.lessons.forEach(function (l) { if (state.done[l.id]) doneCount++; });
    var allLessonsDone = doneCount === COURSE.lessons.length;

    var quizIds = [];
    COURSE.lessons.forEach(function (l) {
      l.blocks.forEach(function (b) { if (b.type === 'quiz') quizIds.push(b.id); });
    });
    var scored = quizIds.length > 0;
    var score = 0, allQuizzesPassed = true;
    if (scored) {
      var sum = 0;
      quizIds.forEach(function (id) {
        var q = state.quiz[id];
        sum += q ? q.score : 0;
        if (!q || !q.passed) allQuizzesPassed = false;
      });
      score = Math.round(sum / quizIds.length);
    }

    var mins = elapsedMinutes();
    var outstanding = [];
    if (COMPLETION.allLessons && !allLessonsDone) {
      outstanding.push('finish all ' + COURSE.lessons.length + ' lessons (' +
        doneCount + ' done)');
    }
    if (COMPLETION.quizPass && scored && !allQuizzesPassed) {
      outstanding.push('pass every quiz');
    }
    if (COMPLETION.minScore > 0 && scored && score < COMPLETION.minScore) {
      outstanding.push('reach ' + COMPLETION.minScore + '% average quiz score (now ' + score + '%)');
    }
    if (COMPLETION.minMinutes > 0 && mins < COMPLETION.minMinutes) {
      outstanding.push('spend ' + COMPLETION.minMinutes + ' minutes in the course (' +
        Math.floor(mins) + ' so far)');
    }

    var finished = outstanding.length === 0;
    // A scored course is passed only once it is complete and the quiz bar is met.
    var passed = finished && (!scored || (allQuizzesPassed || score >= (COMPLETION.minScore || 0)));

    return {
      pct: Math.round((doneCount / COURSE.lessons.length) * 100),
      finished: finished,
      outstanding: outstanding,
      scored: scored,
      score: score,
      passed: passed
    };
  }

  function persist() {
    state.mins = elapsedMinutes();
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

  /* Per-block background: 'panel' and 'tint' follow the theme; anything else
     is a CSS colour, where we also pick a readable ink for it. */
  function applyBlockBg(w, bg) {
    w.classList.add('has-bg');
    if (bg === 'panel') { w.classList.add('bg-panel'); return; }
    if (bg === 'tint') { w.classList.add('bg-tint'); return; }
    w.style.background = bg;
    var m = /^#?([0-9a-f]{6})$/i.exec(bg.replace('#', ''));
    if (m) {
      var r = parseInt(m[1].slice(0, 2), 16), g = parseInt(m[1].slice(2, 4), 16), bl = parseInt(m[1].slice(4, 6), 16);
      var lum = (0.299 * r + 0.587 * g + 0.114 * bl) / 255;
      w.style.color = lum > 0.55 ? '#1f2437' : '#f5f6fa';
    }
  }

  function renderBlock(b) {
    var w = el('div', 'block b-' + b.type.toLowerCase());
    w.setAttribute('data-bid', b.id); // review layer anchors comments to this
    switch (b.type) {
      case 'text':
        if (b.layout && b.layout !== 'normal') w.className += ' layout-' + b.layout;
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
        if (!src(b.src)) return null;
        w.className = 'block b-image ' + b.width;
        w.innerHTML = '<img src="' + esc(src(b.src)) + '" alt="' + esc(b.alt) + '" loading="lazy">' +
          (b.caption ? '<div class="b-caption">' + esc(b.caption) + '</div>' : '');
        break;
      case 'imageText':
        w.className = 'block b-imagetext' + (b.imageSide === 'right' ? ' right' : '');
        w.innerHTML = (src(b.src) ? '<img src="' + esc(src(b.src)) + '" alt="' + esc(b.alt) + '" loading="lazy">' : '') +
          '<div class="it-text rich">' + b.html + '</div>';
        break;
      case 'gallery':
        if (!b.images.length) return null;
        w.className = 'block b-gallery cols-' + b.columns;
        w.innerHTML = b.images.map(function (im) {
          return '<figure><img src="' + esc(src(im.src)) + '" alt="' + esc(im.alt) + '" loading="lazy">' +
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
        if (!src(b.src)) return null;
        w.className = 'block b-audio';
        w.innerHTML = (b.title ? '<div class="a-title">' + esc(b.title) + '</div>' : '') +
          '<audio controls src="' + esc(src(b.src)) + '"></audio>';
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
        // An uneven split is only meaningful across two columns; three or four
        // always divide evenly, so the class is simply not emitted there.
        w.className = 'block b-columns gap-' + (b.gap || 'md') +
          (b.columns.length === 2 && b.ratio && b.ratio !== 'equal' ? ' ' + b.ratio : '') +
          (b.valign === 'center' ? ' v-center' : '');
        w.style.setProperty('--cols', b.columns.length);
        w.innerHTML = b.columns.map(function (c) {
          return '<div class="rich">' + c.html + '</div>';
        }).join('');
        break;
      case 'cards':
        if (!renderCards(w, b)) return null;
        break;
      case 'steps':
        if (!renderSteps(w, b)) return null;
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
      case 'sorting':
        renderSorting(w, b);
        break;
      case 'matching':
        renderMatching(w, b);
        break;
      case 'hotspot':
        if (!renderHotspot(w, b)) return null;
        break;
      case 'quiz':
        renderQuiz(w, b);
        break;
      case 'html': {
        if (!b.code || !b.code.trim()) return null;
        w.className = 'block b-html';
        w.innerHTML = b.code;
        // innerHTML never executes <script> tags — recreate them so embed codes work
        var scripts = w.querySelectorAll('script');
        scripts.forEach(function (old) {
          var s = document.createElement('script');
          for (var i = 0; i < old.attributes.length; i++) {
            s.setAttribute(old.attributes[i].name, old.attributes[i].value);
          }
          s.textContent = old.textContent;
          old.parentNode.replaceChild(s, old);
        });
        break;
      }
      default:
        return null;
    }
    // Applied after the switch, not inside it: most cases overwrite className
    // outright, so anything set before them would be thrown away.
    if (b.width && b.width !== 'normal') w.classList.add('w-' + b.width);
    if (b.space && b.space !== 'normal') w.classList.add('sp-' + b.space);
    if (b.bg) applyBlockBg(w, b.bg);
    return w;
  }

  /* A card needs at least one of its four fields to be worth a box. */
  function renderCards(w, b) {
    var items = (b.items || []).filter(function (c) {
      return c.title || c.html || c.icon || src(c.src);
    });
    if (!items.length) return false;
    w.className = 'block b-cards cols-' + b.columns + ' style-' + b.style +
      (b.align === 'center' ? ' center' : '');
    w.innerHTML = items.map(function (c) {
      var img = src(c.src);
      return '<div class="card">' +
        (img ? '<img class="card-img" src="' + esc(img) + '" alt="" loading="lazy">' : '') +
        (c.icon ? '<div class="card-icon">' + esc(c.icon) + '</div>' : '') +
        (c.title ? '<h3 class="card-title">' + esc(c.title) + '</h3>' : '') +
        (c.html ? '<div class="card-text rich">' + c.html + '</div>' : '') +
        '</div>';
    }).join('');
    return true;
  }

  function renderSteps(w, b) {
    var items = (b.items || []).filter(function (s) { return s.title || s.html; });
    if (!items.length) return false;
    var dots = b.marker === 'dot';
    w.className = 'block b-steps ' + (b.layout === 'horizontal' ? 'horizontal' : 'vertical') +
      (dots ? ' dots' : '');
    // An ordered list, so the sequence survives for a screen reader even when
    // the markers are drawn as bare dots.
    w.innerHTML = '<ol class="steps-list">' + items.map(function (s, i) {
      // div rather than span for the body: the rich text inside is <p> markup,
      // which cannot legally live in a span and would be split out of it.
      return '<li class="step">' +
        '<span class="step-marker" aria-hidden="true">' + (dots ? '' : (i + 1)) + '</span>' +
        '<div class="step-body">' +
        (s.title ? '<h3 class="step-title">' + esc(s.title) + '</h3>' : '') +
        (s.html ? '<div class="rich">' + s.html + '</div>' : '') +
        '</div></li>';
    }).join('') + '</ol>';
    return true;
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
            (c.frontImage ? '<img src="' + esc(src(c.frontImage)) + '" alt="">' : '') +
            '<div>' + esc(c.front) + '</div><div class="fcard-hint">Tap to flip</div>' +
          '</div>' +
          '<div class="fcard-face fcard-back"><div>' + esc(c.back) + '</div><div class="fcard-hint">Tap to flip back</div></div>' +
        '</div>';
      card.addEventListener('click', function () { card.classList.toggle('flipped'); });
      w.appendChild(card);
    });
  }

  /* ================= interactions ================= */

  /* Sequence: shuffled steps the learner reorders with the arrow buttons.
     Buttons rather than drag-and-drop, so it works with touch and a keyboard. */
  function renderSorting(w, b) {
    w.className = 'block b-sorting';
    var items = b.items.filter(function (i) { return (i.text || '').trim(); });
    if (!items.length) { w.innerHTML = ''; return; }

    var order = shuffleArr(items);
    if (order.length > 1 && order.every(function (it, i) { return it.id === items[i].id; })) {
      order.push(order.shift()); // never open already solved
    }

    if (b.title) w.appendChild(el('div', 'ix-title', esc(b.title)));
    var list = el('div', 'sort-list');
    var fb = el('div');
    var check = el('button', 'quiz-btn', 'Check order');

    function draw() {
      list.innerHTML = '';
      order.forEach(function (it, i) {
        var row = el('div', 'sort-row');
        row.appendChild(el('span', 'sort-num', String(i + 1)));
        row.appendChild(el('span', 'sort-text', esc(it.text)));
        var up = el('button', 'sort-move', '&uarr;');
        up.setAttribute('aria-label', 'Move “' + it.text + '” up');
        up.disabled = i === 0;
        up.addEventListener('click', function () {
          order.splice(i - 1, 0, order.splice(i, 1)[0]);
          draw();
        });
        var down = el('button', 'sort-move', '&darr;');
        down.setAttribute('aria-label', 'Move “' + it.text + '” down');
        down.disabled = i === order.length - 1;
        down.addEventListener('click', function () {
          order.splice(i + 1, 0, order.splice(i, 1)[0]);
          draw();
        });
        row.appendChild(up);
        row.appendChild(down);
        list.appendChild(row);
      });
    }

    check.addEventListener('click', function () {
      var ok = order.every(function (it, i) { return it.id === items[i].id; });
      list.querySelectorAll('.sort-row').forEach(function (row, i) {
        row.classList.remove('correct', 'incorrect');
        row.classList.add(order[i].id === items[i].id ? 'correct' : 'incorrect');
      });
      fb.className = 'q-feedback ' + (ok ? 'ok' : 'bad');
      fb.textContent = (ok ? '✓ ' : '✗ ') +
        (ok ? (b.feedbackCorrect || 'Correct!') : (b.feedbackIncorrect || 'Not quite — try again.'));
    });

    draw();
    w.appendChild(list);
    w.appendChild(fb);
    var actions = el('div', 'ix-actions');
    actions.appendChild(check);
    w.appendChild(actions);
  }

  /* Matching: click a prompt, then click its partner. Click a made pair to undo it. */
  function renderMatching(w, b) {
    w.className = 'block b-matching';
    var pairs = b.pairs.filter(function (p) { return (p.left || '').trim() && (p.right || '').trim(); });
    if (!pairs.length) { w.innerHTML = ''; return; }

    if (b.title) w.appendChild(el('div', 'ix-title', esc(b.title)));

    var rights = shuffleArr(pairs);
    var links = {};        // leftId -> rightId (a right is identified by its pair id)
    var activeLeft = null;

    var grid = el('div', 'match-grid');
    var leftCol = el('div', 'match-col');
    var rightCol = el('div', 'match-col');
    grid.appendChild(leftCol);
    grid.appendChild(rightCol);

    var fb = el('div');
    var check = el('button', 'quiz-btn', 'Check answers');

    function linkedLeftOf(rightId) {
      var found = null;
      Object.keys(links).forEach(function (l) { if (links[l] === rightId) found = l; });
      return found;
    }

    function draw() {
      leftCol.innerHTML = '';
      rightCol.innerHTML = '';
      pairs.forEach(function (p, i) {
        var btn = el('button', 'match-item');
        btn.innerHTML = '<span class="match-badge">' + (links[p.id] ? '🔗' : String.fromCharCode(65 + i)) +
          '</span><span>' + esc(p.left) + '</span>';
        if (links[p.id]) btn.classList.add('linked');
        if (activeLeft === p.id) btn.classList.add('active');
        btn.addEventListener('click', function () {
          if (links[p.id]) { delete links[p.id]; activeLeft = null; }
          else activeLeft = activeLeft === p.id ? null : p.id;
          fb.className = '';
          fb.textContent = '';
          draw();
        });
        leftCol.appendChild(btn);
      });

      rights.forEach(function (p) {
        var btn = el('button', 'match-item');
        var owner = linkedLeftOf(p.id);
        btn.innerHTML = '<span>' + esc(p.right) + '</span>';
        if (owner) btn.classList.add('linked');
        btn.addEventListener('click', function () {
          if (owner) { delete links[owner]; activeLeft = null; }
          else if (activeLeft) { links[activeLeft] = p.id; activeLeft = null; }
          fb.className = '';
          fb.textContent = '';
          draw();
        });
        rightCol.appendChild(btn);
      });

      check.disabled = Object.keys(links).length !== pairs.length;
    }

    check.addEventListener('click', function () {
      var wrong = 0;
      pairs.forEach(function (p) { if (links[p.id] !== p.id) wrong++; });
      draw();
      leftCol.querySelectorAll('.match-item').forEach(function (btn, i) {
        btn.classList.add(links[pairs[i].id] === pairs[i].id ? 'correct' : 'incorrect');
      });
      fb.className = 'q-feedback ' + (wrong === 0 ? 'ok' : 'bad');
      fb.textContent = (wrong === 0 ? '✓ ' : '✗ ') +
        (wrong === 0
          ? (b.feedbackCorrect || 'All matched correctly.')
          : (b.feedbackIncorrect || 'Some pairs aren’t right.') + ' (' + wrong + ' to fix)');
    });

    draw();
    w.appendChild(grid);
    w.appendChild(el('div', 'ix-hint', 'Select a prompt, then select its match. Select a linked item to unlink it.'));
    w.appendChild(fb);
    var actions = el('div', 'ix-actions');
    actions.appendChild(check);
    w.appendChild(actions);
  }

  /* Hotspots: markers over an image; selecting one reveals its detail panel. */
  function renderHotspot(w, b) {
    var url = src(b.src);
    if (!url || !b.spots.length) return false;
    w.className = 'block b-hotspot';
    if (b.title) w.appendChild(el('div', 'ix-title', esc(b.title)));

    var stage = el('div', 'hs-stage');
    stage.innerHTML = '<img src="' + esc(url) + '" alt="' + esc(b.alt) + '">';
    var panel = el('div', 'hs-panel');
    panel.innerHTML = '<div class="hs-empty">Select a marker to learn more.</div>';

    b.spots.forEach(function (s, i) {
      var dot = el('button', 'hs-dot', String(i + 1));
      dot.style.left = s.x + '%';
      dot.style.top = s.y + '%';
      dot.setAttribute('aria-label', s.label || 'Hotspot ' + (i + 1));
      dot.addEventListener('click', function () {
        stage.querySelectorAll('.hs-dot').forEach(function (d) { d.classList.remove('active'); });
        dot.classList.add('active', 'seen');
        panel.innerHTML = '<div class="hs-label">' + esc(s.label || 'Hotspot ' + (i + 1)) +
          '</div><div class="rich">' + (s.html || '') + '</div>';
      });
      stage.appendChild(dot);
    });

    w.appendChild(stage);
    w.appendChild(panel);
    return true;
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

        /* What the learner actually chose, as text an LMS report can show.
           Choice ids mean nothing outside this package, so they are resolved to
           the answer text before being sent. */
        function describeAnswer(q, given) {
          if (q.type === 'fillin') return String(given || '');
          if (q.type === 'multiple') {
            var sel = given || {};
            return q.choices.filter(function (c) { return sel[c.id]; })
              .map(function (c) { return c.text; }).join(', ');
          }
          var chosen = q.choices.filter(function (c) { return c.id === given; })[0];
          return chosen ? chosen.text : '';
        }

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
          scorm.reportInteraction({
            id: b.id + '-' + q.id,
            type: q.type,
            text: q.text,
            response: describeAnswer(q, answers[q.id]),
            correct: ok
          });
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
  var sidebarNav, progressFill, progressPct, progressSteps, footerNextBtn, gateMsg;

  function isLastLesson(idx) {
    return idx === COURSE.lessons.length - 1;
  }

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
    if (progressSteps) {
      progressSteps.querySelectorAll('.pstep').forEach(function (dot) {
        var id = dot.getAttribute('data-id');
        dot.classList.toggle('done', !!state.done[id]);
        dot.classList.toggle('at', id === state.cur);
      });
    }
    if (sidebarNav) {
      sidebarNav.querySelectorAll('button').forEach(function (btn) {
        var id = btn.getAttribute('data-id');
        btn.classList.toggle('active', id === state.cur);
        btn.classList.toggle('done', !!state.done[id]);
        var check = btn.querySelector('.check');
        if (check) check.textContent = state.done[id] ? '✓' : '';
      });
    }
  }

  /**
   * Per-lesson style overrides: CSS custom properties precomputed at export
   * time, applied to the player root while that lesson is open.
   *
   * Returns the header treatment in force, which openLesson needs to build the
   * right markup — a `split` header is a different shape, not just different
   * paint, and an `image` header degrades to `gradient` when the course has no
   * picture to put behind it.
   */
  function applyLessonTheme(id) {
    var t = LESSON_THEMES[id];
    var base = LESSON_THEMES.__base || {};
    var vars = {};
    Object.keys(base).forEach(function (k) { vars[k] = base[k]; });
    Object.keys(t || {}).forEach(function (k) { vars[k] = t[k]; });
    // Set these on <html>, not on #app: `body { color: var(--ink) }` resolves
    // against :root, so overriding lower down would leave body text stale.
    Object.keys(vars).forEach(function (k) {
      if (k === 'dark' || k === 'hero' || k === 'heroImage') return;
      document.documentElement.style.setProperty(k, vars[k]);
    });
    document.body.classList.toggle('theme-dark', !!vars.dark);

    var image = src(vars.heroImage || '') || COURSE.coverImage || '';
    var hero = vars.hero || 'gradient';
    if (hero === 'image' && !image) hero = 'gradient';
    ['gradient', 'solid', 'minimal', 'image', 'split'].forEach(function (h) {
      document.body.classList.toggle('hero-' + h, hero === h);
    });
    return { hero: hero, image: image };
  }

  /* Narrow-screen bar. With `nav: none` there is no menu to open, so it carries
     the course title alone rather than a button that reveals nothing. */
  function buildTopbar() {
    var topbar = el('div', 'topbar');
    if (THEME.nav !== 'none') {
      var menuBtn = el('button', 'menu-btn', '☰');
      menuBtn.setAttribute('aria-label', 'Open course menu');
      menuBtn.addEventListener('click', function () { root.classList.add('nav-open'); });
      topbar.appendChild(menuBtn);
    }
    topbar.appendChild(el('div', 't-title', esc(COURSE.title)));
    return topbar;
  }

  /* The line above a lesson title: its position in the course, its module name,
     or — when the author has turned numbering off and set no sections — nothing
     at all, rather than an empty band of uppercase letter-spacing. */
  function heroKicker(lesson, idx) {
    if (THEME.lessonNumbers) return 'Lesson ' + (idx + 1) + ' of ' + COURSE.lessons.length;
    return (lesson.section || '').trim();
  }

  function openLesson(id) {
    state.cur = id;
    var idx = COURSE.lessons.findIndex(function (l) { return l.id === id; });
    var lesson = COURSE.lessons[idx];
    var content = root.querySelector('.content');
    content.innerHTML = '';
    var look = applyLessonTheme(id);

    content.appendChild(buildTopbar());

    var hero = el('div', 'lesson-hero');
    var kicker = heroKicker(lesson, idx);
    // `split` puts the title and the kicker in separate panels, so it needs a
    // wrapper the other treatments do not.
    hero.innerHTML = '<div class="hero-inner">' +
      (kicker ? '<div class="kicker">' + esc(kicker) + '</div>' : '') +
      '<h2>' + esc(lesson.title) + '</h2></div>';
    if (look.hero === 'image') {
      hero.style.backgroundImage = 'url("' + look.image.replace(/"/g, '%22') + '")';
    }
    content.appendChild(hero);

    var blocksWrap = el('div', 'blocks');
    blocksWrap.setAttribute('data-lid', lesson.id);
    var prog = computeProgress();
    if (prog.finished) {
      blocksWrap.appendChild(el('div', 'complete-banner', '🎉 <span>Course complete — great job!</span>'));
    } else if (isLastLesson(idx) && state.done[lesson.id]) {
      // Reached the end but a completion rule is still outstanding — say which.
      blocksWrap.appendChild(el('div', 'complete-banner pending',
        '⏳ <span>Almost there — to complete this course you still need to ' +
        prog.outstanding.join(', and ') + '.</span>'));
    }
    lesson.blocks.forEach(function (b) {
      var node = renderBlock(b);
      if (node) blocksWrap.appendChild(node);
    });

    // footer nav
    var footer = el('div', 'lesson-footer');
    // From lesson 1, Previous goes back to the title page when there is one,
    // rather than being a dead control.
    var toCover = idx === 0 && THEME.titlePage;
    var prevBtn = el('button', 'nav-btn prev', toCover ? '← Course home' : '← Previous');
    prevBtn.disabled = idx === 0 && !toCover;
    prevBtn.addEventListener('click', function () {
      if (toCover) openCover();
      else openLesson(COURSE.lessons[idx - 1].id);
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

  /**
   * The course title page.
   *
   * Optional, and off by default — dropping the learner straight into lesson 1
   * is still the right shape for a five-minute refresher. For anything longer,
   * an opening page is where the description, the author and the contents can
   * finally be seen; before this they existed in the course data but the
   * learner never saw any of them.
   */
  function openCover() {
    state.cur = COVER_ID;
    var content = root.querySelector('.content');
    content.innerHTML = '';
    applyLessonTheme(null);
    // No lesson is open, so there is no footer to gate.
    footerNextBtn = null;
    gateMsg = null;

    content.appendChild(buildTopbar());

    var image = COURSE.coverImage || '';
    var logo = src((COURSE.theme && COURSE.theme.logo) || '');
    var cover = el('div', 'cover' + (image ? ' has-image' : ''));
    if (image) cover.style.backgroundImage = 'url("' + image.replace(/"/g, '%22') + '")';
    cover.innerHTML = '<div class="cover-inner">' +
      (logo ? '<img class="course-logo" src="' + esc(logo) + '" alt="">' : '') +
      '<h1>' + esc(COURSE.title) + '</h1>' +
      (COURSE.author ? '<div class="cover-by">' + esc(COURSE.author) + '</div>' : '') +
      (COURSE.description ? '<p class="cover-desc">' + esc(COURSE.description) + '</p>' : '') +
      '</div>';
    content.appendChild(cover);

    var body = el('div', 'blocks cover-body');
    var contents = el('div', 'cover-contents');
    contents.innerHTML = '<h2>What this course covers</h2>';
    var list = el('ol', 'cover-list');
    var lastSection = null;
    COURSE.lessons.forEach(function (l, i) {
      var sec = (l.section || '').trim();
      if (sec && sec !== lastSection) list.appendChild(el('li', 'cover-section', esc(sec)));
      lastSection = sec;
      var li = el('li', 'cover-item' + (state.done[l.id] ? ' done' : ''));
      li.innerHTML = '<span class="ci-mark">' + (state.done[l.id] ? '✓' : esc(l.icon || '')) + '</span>' +
        '<span class="ci-title">' + (THEME.lessonNumbers ? (i + 1) + '. ' : '') + esc(l.title) + '</span>';
      list.appendChild(li);
    });
    contents.appendChild(list);
    body.appendChild(contents);

    var startIdx = 0;
    for (var i = 0; i < COURSE.lessons.length; i++) {
      if (!state.done[COURSE.lessons[i].id]) { startIdx = i; break; }
    }
    var resuming = startIdx > 0;
    var start = el('button', 'nav-btn cover-start', resuming ? 'Resume course →' : 'Start course →');
    start.addEventListener('click', function () { openLesson(COURSE.lessons[startIdx].id); });
    var actions = el('div', 'cover-actions');
    actions.appendChild(start);
    body.appendChild(actions);
    content.appendChild(body);

    renderSidebarState();
    persist();
    root.classList.remove('nav-open');
    window.scrollTo({ top: 0 });
  }

  function buildSidebar() {
    var sidebar = el('aside', 'sidebar');
    var head = el('div', 'sidebar-head');
    var logo = src((COURSE.theme && COURSE.theme.logo) || '');
    var progressHtml = '';
    if (THEME.progress === 'bar') {
      progressHtml = '<div class="progress-wrap"><div class="progress-label">' +
        '<span>Progress</span><span class="ppct">0%</span></div>' +
        '<div class="progress-bar"><div class="progress-fill"></div></div></div>';
    } else if (THEME.progress === 'steps') {
      progressHtml = '<div class="progress-wrap"><div class="progress-steps">' +
        COURSE.lessons.map(function (l) {
          return '<span class="pstep" data-id="' + esc(l.id) + '"></span>';
        }).join('') + '</div></div>';
    }
    head.innerHTML = (logo ? '<img class="course-logo" src="' + esc(logo) + '" alt="">' : '') +
      '<h1>' + esc(COURSE.title) + '</h1>' +
      (COURSE.author ? '<div class="byline">by ' + esc(COURSE.author) + '</div>' : '') +
      progressHtml;
    sidebar.appendChild(head);

    sidebarNav = el('nav', 'lesson-nav');
    if (THEME.titlePage) {
      var home = el('button', 'nav-home');
      home.setAttribute('data-id', COVER_ID);
      home.innerHTML = '<span class="lesson-icon">⌂</span><span class="nav-label">Course home</span>';
      home.addEventListener('click', openCover);
      sidebarNav.appendChild(home);
    }
    // Consecutive lessons sharing a section name sit under one heading. A blank
    // section resets the run, so an author can group only part of a course.
    var lastSection = null;
    COURSE.lessons.forEach(function (l, i) {
      var sec = (l.section || '').trim();
      if (sec && sec !== lastSection) sidebarNav.appendChild(el('div', 'nav-section', esc(sec)));
      lastSection = sec;
      var btn = el('button');
      btn.setAttribute('data-id', l.id);
      btn.innerHTML = '<span class="check"></span><span class="lesson-icon">' + esc(l.icon || '') +
        '</span><span class="nav-label">' +
        (THEME.lessonNumbers ? (i + 1) + '. ' : '') + esc(l.title) + '</span>';
      btn.addEventListener('click', function () { openLesson(l.id); });
      sidebarNav.appendChild(btn);
    });
    sidebar.appendChild(sidebarNav);

    progressFill = head.querySelector('.progress-fill');
    progressPct = head.querySelector('.ppct');
    progressSteps = head.querySelector('.progress-steps');
    return sidebar;
  }

  function build() {
    // Theme (colors, fonts, layout classes) is baked into the page at export time.
    document.title = COURSE.title;

    root.className = 'player';

    // With `nav: none` the menu is not built at all rather than hidden with
    // CSS: a drawer that is only reachable by tabbing into it is worse than no
    // drawer, and the learner is meant to move with Previous / Continue.
    if (THEME.nav !== 'none') {
      root.appendChild(buildSidebar());
      var scrim = el('div', 'scrim');
      scrim.addEventListener('click', function () { root.classList.remove('nav-open'); });
      root.appendChild(scrim);
    }

    root.appendChild(el('main', 'content'));

    scorm.init();
    saved = scorm.getSuspendData();
    if (saved) {
      state.done = saved.done || {};
      state.quiz = saved.quiz || {};
      state.cur = saved.cur || '';
      priorMins = saved.mins || 0;
    }
    var startLesson = COURSE.lessons.filter(function (l) { return l.id === state.cur; })[0];
    if (startLesson) openLesson(startLesson.id);
    else if (THEME.titlePage) openCover();
    else openLesson(COURSE.lessons[0].id);

    // A time-based rule can come good while the learner is simply reading.
    if (COMPLETION.minMinutes > 0) {
      setInterval(function () {
        if (!computeProgress().finished) persist();
        else if (!state.reported) { state.reported = true; persist(); }
      }, 30000);
    }
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
