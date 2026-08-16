/* Quoin review layer.

   Runs on top of the normal course player inside a review build. Lets a reviewer
   highlight text in the real rendered course, comment on it, suggest a rewrite,
   and download their feedback as a small JSON file to send back to the author.

   Expects window.REVIEW = { reviewId, courseId, courseTitle, reviewName }.
   Work in progress is kept in localStorage, so a reviewer can close the tab and
   come back to it. Nothing is sent anywhere — there is no server. */
(function () {
  'use strict';

  var REVIEW = window.REVIEW;
  if (!REVIEW || !REVIEW.reviewId) return;

  var NAME_KEY = 'le-rv-name';
  var DATA_KEY = 'le-rv-' + REVIEW.reviewId;
  var CONTEXT = 32; // chars of context kept either side of a quote
  var MAX_QUOTE = 400;

  var state = { reviewer: '', comments: [] };
  var curLesson = '';
  var pending = null; // selection captured, waiting on the composer
  var storageOk = true; // false on file:// and in some private windows
  var bubble, composer, rail, bar, countEl;

  /* ================= storage ================= */

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  /* Every localStorage read has to sit inside the try: in a browser that blocks
     storage outright, *getting* an item throws just as readily as setting one,
     and an escaped exception here would kill the whole review layer before any
     of its UI exists. */
  function load() {
    if (!storageOk) return;
    try {
      var raw = localStorage.getItem(DATA_KEY);
      if (raw) {
        var d = JSON.parse(raw);
        state.comments = d.comments || [];
        state.reviewer = d.reviewer || '';
      }
      if (!state.reviewer) state.reviewer = localStorage.getItem(NAME_KEY) || '';
    } catch (e) { /* corrupt or unavailable storage — start clean */ }
  }

  /* Browsers restrict localStorage on file:// origins and in private windows. A
     reviewer who opened this straight from an email attachment would then lose
     every comment on refresh, silently — so find out up front and say so, rather
     than letting them discover it the hard way. */
  function probeStorage() {
    try {
      localStorage.setItem(DATA_KEY + ':probe', '1');
      localStorage.removeItem(DATA_KEY + ':probe');
      return true;
    } catch (e) {
      return false;
    }
  }

  function save() {
    if (!storageOk) return; // nothing to do; the reviewer has been warned
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(state));
      if (state.reviewer) localStorage.setItem(NAME_KEY, state.reviewer);
    } catch (e) {
      storageOk = false;
      warnNoStorage();
    }
  }

  /** A standing, non-dismissable warning: their work only exists in this tab. */
  function warnNoStorage() {
    if (document.querySelector('.rv-nostore')) return;
    var w = el('div', 'rv-nostore rv-ui',
      '⚠️ <strong>This browser will not remember your comments.</strong> They are held in this ' +
      'tab only — if you reload or close it, they are gone. Click <strong>Send feedback</strong> ' +
      'before you leave. (Opening the file from a web address, rather than straight from an ' +
      'email attachment, fixes this.)');
    document.body.appendChild(w);
    measureChrome();
  }

  /* Height of the fixed review chrome, published as --rv-top so the player's own
     fixed sidebar and sticky topbar can be pushed clear of it. Measured, not
     assumed: the storage warning wraps to a different number of lines depending
     on the viewport, and a hardcoded offset would let it cover the sidebar. */
  function measureChrome() {
    var h = bar ? bar.offsetHeight : 48;
    var w = document.querySelector('.rv-nostore');
    if (w) h += w.offsetHeight;
    document.documentElement.style.setProperty('--rv-top', h + 'px');
  }

  /* ================= text anchoring =================
     Mirrors src/review/anchor.ts. A comment remembers the text it was made
     against plus a little context, never a character offset, so it can be found
     again after the author edits the course around it. */

  function textNodes(root) {
    var out = [];
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var n;
    while ((n = w.nextNode())) {
      if (n.parentNode && n.parentNode.closest && n.parentNode.closest('.rv-ui')) continue;
      out.push(n);
    }
    return out;
  }

  function fullText(root) {
    return textNodes(root).map(function (n) { return n.data; }).join('');
  }

  function commonSuffixLen(a, b) {
    var n = 0;
    while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
    return n;
  }

  function commonPrefixLen(a, b) {
    var n = 0;
    while (n < a.length && n < b.length && a[n] === b[n]) n++;
    return n;
  }

  function findQuote(text, sel) {
    if (!sel || !sel.quote) return -1;
    var hits = [];
    for (var i = text.indexOf(sel.quote); i !== -1; i = text.indexOf(sel.quote, i + 1)) hits.push(i);
    if (hits.length <= 1) return hits.length ? hits[0] : -1;
    var best = hits[0], bestScore = -1;
    hits.forEach(function (idx) {
      var before = text.slice(Math.max(0, idx - CONTEXT), idx);
      var after = text.slice(idx + sel.quote.length, idx + sel.quote.length + CONTEXT);
      var score = commonSuffixLen(before, sel.prefix || '') + commonPrefixLen(after, sel.suffix || '');
      if (score > bestScore) { bestScore = score; best = idx; }
    });
    return best;
  }

  /** Character offset of (node, offset) within root's text. */
  function offsetIn(root, node, offset) {
    var nodes = textNodes(root), pos = 0;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i] === node) return pos + offset;
      pos += nodes[i].data.length;
    }
    return -1;
  }

  function wrapRange(root, start, end, cid) {
    var nodes = textNodes(root), pos = 0, targets = [];
    nodes.forEach(function (n) {
      var from = pos, to = pos + n.data.length;
      pos = to;
      if (to <= start || from >= end) return;
      targets.push({ node: n, from: Math.max(start, from) - from, to: Math.min(end, to) - from });
    });
    targets.forEach(function (t) {
      var n = t.node;
      if (t.to < n.data.length) n.splitText(t.to);
      var mid = t.from > 0 ? n.splitText(t.from) : n;
      var mark = document.createElement('mark');
      mark.className = 'rv-hl';
      mark.setAttribute('data-cid', cid);
      mid.parentNode.insertBefore(mark, mid);
      mark.appendChild(mid);
    });
  }

  function clearHighlights(scope) {
    var ms = scope.querySelectorAll('mark.rv-hl');
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i], p = m.parentNode;
      while (m.firstChild) p.insertBefore(m.firstChild, m);
      p.removeChild(m);
      p.normalize();
    }
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

  function lessonTitle(id) {
    var ls = (window.COURSE && window.COURSE.lessons) || [];
    for (var i = 0; i < ls.length; i++) if (ls[i].id === id) return (i + 1) + '. ' + ls[i].title;
    return 'Lesson';
  }

  function mine(c) { return c.target.lessonId === curLesson; }

  /* ================= capturing a selection ================= */

  function captureSelection() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    var range = sel.getRangeAt(0);
    if (!sel.toString().trim()) return null;

    var node = range.startContainer;
    var host = (node.nodeType === 1 ? node : node.parentNode);
    var block = host && host.closest ? host.closest('[data-bid]') : null;
    if (!block || block.closest('.rv-ui')) return null;

    // The quote is sliced out of the block's own text, NOT from sel.toString():
    // the selection API inserts newlines at element boundaries, so a selection
    // spanning two paragraphs would produce a string that appears nowhere in the
    // block's text and could never be anchored again. Slicing by offset makes the
    // quote a literal substring of what findQuote() will later search.
    var text = fullText(block);
    var start = offsetIn(block, range.startContainer, range.startOffset);
    var end = offsetIn(block, range.endContainer, range.endOffset);
    if (start < 0 || end < 0 || end <= start) return null;
    if (end - start > MAX_QUOTE) end = start + MAX_QUOTE;

    var quote = text.slice(start, end);
    if (!quote.trim()) return null;

    return {
      lessonId: curLesson,
      blockId: block.getAttribute('data-bid'),
      text: {
        quote: quote,
        prefix: text.slice(Math.max(0, start - CONTEXT), start),
        suffix: text.slice(end, end + CONTEXT)
      },
      rect: range.getBoundingClientRect()
    };
  }

  /* ================= floating selection bubble ================= */

  function showBubble(rect) {
    bubble.style.display = 'flex';
    var top = rect.top + window.scrollY - bubble.offsetHeight - 10;
    if (top < window.scrollY + 8) top = rect.bottom + window.scrollY + 10;
    bubble.style.top = top + 'px';
    bubble.style.left = Math.max(8, rect.left + window.scrollX) + 'px';
  }

  function hideBubble() { bubble.style.display = 'none'; }

  /* ================= composer ================= */

  function openComposer(target, mode, existing) {
    pending = { target: target, mode: mode, editing: existing || null };
    hideBubble();

    var isSuggest = mode === 'suggest';
    var quoted = target.text ? target.text.quote : '';
    var scope = !target.blockId
      ? 'this lesson'
      : (target.text ? 'the highlighted text' : 'this block');

    composer.innerHTML =
      '<div class="rv-c-head">' +
        (isSuggest ? 'Suggest an edit' : 'Comment on ' + esc(scope)) +
      '</div>' +
      (quoted ? '<blockquote class="rv-quote">' + esc(quoted) + '</blockquote>' : '') +
      (isSuggest
        ? '<label class="rv-lab">Replace it with</label>' +
          '<textarea class="rv-sug" rows="3"></textarea>'
        : '') +
      '<label class="rv-lab">' + (isSuggest ? 'Why? (optional)' : 'Your comment') + '</label>' +
      '<textarea class="rv-body" rows="3" placeholder="' +
        (isSuggest ? 'Explain the change…' : 'What needs to change?') + '"></textarea>' +
      '<div class="rv-c-foot">' +
        '<button class="rv-btn ghost" data-act="cancel">Cancel</button>' +
        '<button class="rv-btn primary" data-act="save">' +
          (existing ? 'Save changes' : (isSuggest ? 'Add suggestion' : 'Add comment')) +
        '</button>' +
      '</div>';

    var sug = composer.querySelector('.rv-sug');
    var body = composer.querySelector('.rv-body');
    if (sug) sug.value = existing && existing.suggestion !== undefined ? existing.suggestion : quoted;
    if (existing) body.value = existing.body || '';

    composer.style.display = 'block';
    var rect = target.rect || { bottom: window.innerHeight / 3, left: window.innerWidth / 2 - 170 };
    var top = rect.bottom + window.scrollY + 10;
    composer.style.top = top + 'px';
    composer.style.left =
      Math.min(
        Math.max(8, rect.left + window.scrollX),
        window.scrollX + window.innerWidth - composer.offsetWidth - 16
      ) + 'px';

    (sug || body).focus();

    composer.onclick = function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (act === 'cancel') closeComposer();
      if (act === 'save') saveComposer();
    };
  }

  function closeComposer() {
    composer.style.display = 'none';
    composer.innerHTML = '';
    pending = null;
    var sel = window.getSelection();
    if (sel) sel.removeAllRanges();
  }

  function saveComposer() {
    if (!pending) return;
    var bodyEl = composer.querySelector('.rv-body');
    var sugEl = composer.querySelector('.rv-sug');
    var body = bodyEl ? bodyEl.value.trim() : '';
    var suggestion = sugEl ? sugEl.value : null;

    if (pending.mode === 'suggest') {
      if (suggestion === null || !suggestion.trim()) return; // nothing proposed
    } else if (!body) {
      bodyEl.focus();
      return;
    }

    if (pending.editing) {
      pending.editing.body = body;
      if (pending.mode === 'suggest') pending.editing.suggestion = suggestion;
    } else {
      var t = pending.target;
      state.comments.push({
        id: uid(),
        reviewId: REVIEW.reviewId,
        author: state.reviewer,
        createdAt: Date.now(),
        target: { lessonId: t.lessonId, blockId: t.blockId, text: t.text },
        body: body,
        suggestion: pending.mode === 'suggest' ? suggestion : undefined,
        status: 'open',
        replies: []
      });
    }

    save();
    closeComposer();
    decorate();
  }

  /* ================= rail ================= */

  function renderRail() {
    var list = rail.querySelector('.rv-list');
    var here = state.comments.filter(mine);
    var elsewhere = state.comments.length - here.length;

    if (!state.comments.length) {
      list.innerHTML =
        '<div class="rv-empty">' +
          '<p><strong>Nothing yet.</strong></p>' +
          '<p>Select any text in the course to comment on it or suggest a rewrite. ' +
          'You can also use the <span class="rv-chip">+</span> button beside a block to ' +
          'comment on it as a whole.</p>' +
        '</div>';
    } else {
      list.innerHTML = '';
      if (here.length) {
        list.appendChild(el('div', 'rv-group', esc(lessonTitle(curLesson))));
        here.forEach(function (c) { list.appendChild(commentCard(c)); });
      }
      if (elsewhere) {
        list.appendChild(
          el('div', 'rv-other', elsewhere + ' comment' + (elsewhere === 1 ? '' : 's') +
            ' on other lessons — they are all included when you send your feedback.')
        );
      }
    }
    countEl.textContent = state.comments.length;
    countEl.style.display = state.comments.length ? 'inline-flex' : 'none';
  }

  function commentCard(c) {
    var card = el('div', 'rv-card');
    card.setAttribute('data-cid', c.id);
    var isSug = typeof c.suggestion === 'string';
    card.innerHTML =
      '<div class="rv-card-top">' +
        '<span class="rv-tag' + (isSug ? ' sug' : '') + '">' +
          (isSug ? 'Suggested edit' : 'Comment') + '</span>' +
        '<span class="rv-card-acts">' +
          '<button class="rv-mini" data-act="edit" title="Edit">Edit</button>' +
          '<button class="rv-mini" data-act="del" title="Delete">Delete</button>' +
        '</span>' +
      '</div>' +
      (c.target.text ? '<blockquote class="rv-quote">' + esc(c.target.text.quote) + '</blockquote>' : '') +
      (isSug ? '<div class="rv-sug-new">→ ' + esc(c.suggestion) + '</div>' : '') +
      (c.body ? '<div class="rv-body-txt">' + esc(c.body) + '</div>' : '');

    card.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (act === 'del') {
        state.comments = state.comments.filter(function (x) { return x.id !== c.id; });
        save();
        decorate();
        return;
      }
      if (act === 'edit') {
        var bl = document.querySelector('[data-bid="' + c.target.blockId + '"]');
        openComposer(
          {
            lessonId: c.target.lessonId,
            blockId: c.target.blockId,
            text: c.target.text,
            rect: bl ? bl.getBoundingClientRect() : null
          },
          isSug ? 'suggest' : 'comment',
          c
        );
        return;
      }
      focusComment(c.id);
    });
    return card;
  }

  /* Scroll to what a comment points at: its highlight if it has one, otherwise
     the block itself. The block lookup has to match this comment's own block id —
     an attribute-presence selector would just find the first block on the page. */
  function focusComment(cid) {
    var c = null;
    for (var i = 0; i < state.comments.length; i++) {
      if (state.comments[i].id === cid) { c = state.comments[i]; break; }
    }
    var mark = document.querySelector('mark.rv-hl[data-cid="' + cid + '"]');
    if (mark) {
      mark.scrollIntoView({ block: 'center', behavior: 'smooth' });
      mark.classList.add('flash');
      setTimeout(function () { mark.classList.remove('flash'); }, 1200);
      return;
    }
    if (!c || !c.target.blockId) return; // lesson-level comment — nothing to scroll to
    var block = document.querySelector('[data-bid="' + c.target.blockId + '"]');
    if (!block) return;
    block.scrollIntoView({ block: 'center', behavior: 'smooth' });
    block.classList.add('rv-flash-block');
    setTimeout(function () { block.classList.remove('rv-flash-block'); }, 1200);
  }

  /* ================= decorate the rendered lesson ================= */

  function decorate() {
    var wrap = document.querySelector('.blocks[data-lid]');
    if (!wrap) return;
    curLesson = wrap.getAttribute('data-lid');

    clearHighlights(wrap);
    var olds = wrap.querySelectorAll('.rv-add');
    for (var i = 0; i < olds.length; i++) olds[i].parentNode.removeChild(olds[i]);

    // Highlights first, while no review UI is in the block to pollute its text.
    state.comments.forEach(function (c) {
      if (c.target.lessonId !== curLesson || !c.target.blockId || !c.target.text) return;
      var block = wrap.querySelector('[data-bid="' + c.target.blockId + '"]');
      if (!block) return;
      var start = findQuote(fullText(block), c.target.text);
      if (start < 0) return; // author's copy no longer has this text — skip quietly
      wrapRange(block, start, start + c.target.text.quote.length, c.id);
    });

    var blocks = wrap.querySelectorAll('[data-bid]');
    for (var j = 0; j < blocks.length; j++) addBlockButton(blocks[j]);

    renderRail();
  }

  function addBlockButton(block) {
    var btn = el('button', 'rv-add rv-ui', '+');
    btn.title = 'Comment on this block';
    btn.setAttribute('data-cid-block', block.getAttribute('data-bid'));
    var n = state.comments.filter(function (c) {
      return c.target.blockId === block.getAttribute('data-bid');
    }).length;
    if (n) {
      btn.textContent = String(n);
      btn.classList.add('has');
    }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      openComposer(
        {
          lessonId: curLesson,
          blockId: block.getAttribute('data-bid'),
          text: null,
          rect: btn.getBoundingClientRect()
        },
        'comment'
      );
    });
    block.appendChild(btn);
  }

  /* ================= sending feedback ================= */

  function bundle() {
    return {
      kind: 'quoin-review',
      version: 1,
      reviewId: REVIEW.reviewId,
      courseId: REVIEW.courseId,
      courseTitle: REVIEW.courseTitle,
      reviewer: state.reviewer,
      submittedAt: Date.now(),
      comments: state.comments.map(function (c) {
        return {
          id: c.id,
          reviewId: REVIEW.reviewId,
          author: state.reviewer,
          createdAt: c.createdAt,
          target: c.target,
          body: c.body,
          suggestion: c.suggestion,
          status: 'open',
          replies: []
        };
      })
    };
  }

  function slug(s) {
    return String(s || 'review').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'review';
  }

  function sendFeedback() {
    if (!state.comments.length) {
      alert('You have not left any comments yet.');
      return;
    }
    var blob = new Blob([JSON.stringify(bundle(), null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = slug(REVIEW.courseTitle) + '-' + slug(state.reviewer) + '.review.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
    toast('Feedback file downloaded — send it back to the course author.');
  }

  function copyFeedback() {
    var text = JSON.stringify(bundle());
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast('Feedback copied — paste it to the course author.');
      });
    }
  }

  function toast(msg) {
    var t = el('div', 'rv-toast rv-ui', esc(msg));
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('in'); }, 10);
    setTimeout(function () {
      t.classList.remove('in');
      setTimeout(function () { t.remove(); }, 300);
    }, 3200);
  }

  /* ================= chrome ================= */

  function askName(force) {
    if (state.reviewer && !force) return;
    var gate = el('div', 'rv-gate rv-ui');
    gate.innerHTML =
      '<div class="rv-gate-box">' +
        '<h2>You have been asked to review this course</h2>' +
        '<p>' + esc(REVIEW.courseTitle) + (REVIEW.reviewName ? ' — ' + esc(REVIEW.reviewName) : '') + '</p>' +
        '<p class="rv-gate-how">Read it as a learner would. Select any text to comment on it or ' +
        'suggest a rewrite. When you are done, click <strong>Send feedback</strong> and email the ' +
        'file back to the author. Nothing leaves this page until you do.</p>' +
        '<label class="rv-lab">Your name</label>' +
        '<input class="rv-name" placeholder="e.g. Dr Sarah Chen" />' +
        '<button class="rv-btn primary rv-go">Start reviewing</button>' +
      '</div>';
    document.body.appendChild(gate);
    var input = gate.querySelector('.rv-name');
    input.value = state.reviewer || '';
    input.focus();
    function go() {
      var v = input.value.trim();
      if (!v) { input.focus(); return; }
      state.reviewer = v;
      save();
      gate.remove();
      updateBar();
      decorate();
    }
    gate.querySelector('.rv-go').addEventListener('click', go);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  }

  function updateBar() {
    var who = bar.querySelector('.rv-who');
    who.innerHTML = 'Reviewing as <strong>' + esc(state.reviewer || '…') + '</strong> ' +
      '<button class="rv-mini" data-act="rename">change</button>';
  }

  function buildChrome() {
    document.body.classList.add('rv-on');

    bar = el('div', 'rv-bar rv-ui');
    bar.innerHTML =
      '<span class="rv-badge">Review</span>' +
      '<span class="rv-who"></span>' +
      '<span class="rv-bar-sp"></span>' +
      '<button class="rv-btn ghost" data-act="lesson">Comment on this lesson</button>' +
      '<button class="rv-btn ghost" data-act="toggle">Comments <span class="rv-count"></span></button>' +
      '<button class="rv-btn primary" data-act="send">Send feedback</button>';
    document.body.appendChild(bar);
    countEl = bar.querySelector('.rv-count');

    bar.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (act === 'rename') askName(true);
      if (act === 'send') sendFeedback();
      if (act === 'toggle') document.body.classList.toggle('rv-rail-open');
      if (act === 'lesson') {
        openComposer({ lessonId: curLesson, blockId: null, text: null, rect: null }, 'comment');
      }
    });

    rail = el('aside', 'rv-rail rv-ui');
    rail.innerHTML =
      '<div class="rv-rail-head">' +
        '<strong>Your feedback</strong>' +
        '<button class="rv-mini" data-act="close">Close</button>' +
      '</div>' +
      '<div class="rv-list"></div>' +
      '<div class="rv-rail-foot">' +
        '<button class="rv-btn primary" data-act="send">Send feedback</button>' +
        '<button class="rv-btn ghost" data-act="copy">Copy as text</button>' +
      '</div>';
    document.body.appendChild(rail);
    rail.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (act === 'close') document.body.classList.remove('rv-rail-open');
      if (act === 'send') sendFeedback();
      if (act === 'copy') copyFeedback();
    });

    bubble = el('div', 'rv-bubble rv-ui');
    bubble.innerHTML =
      '<button class="rv-btn ghost" data-act="comment">💬 Comment</button>' +
      '<button class="rv-btn ghost" data-act="suggest">✎ Suggest an edit</button>';
    document.body.appendChild(bubble);
    bubble.addEventListener('mousedown', function (e) { e.preventDefault(); }); // keep the selection
    bubble.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (act !== 'comment' && act !== 'suggest') return;
      var t = captureSelection();
      if (t) openComposer(t, act);
    });

    composer = el('div', 'rv-composer rv-ui');
    document.body.appendChild(composer);

    updateBar();
    measureChrome();
    // The bar and the warning both rewrap as the viewport narrows.
    window.addEventListener('resize', measureChrome);
  }

  /* ================= wiring ================= */

  function init() {
    storageOk = probeStorage();
    load();
    buildChrome();
    if (!storageOk) warnNoStorage();

    // Unsaved comments would die with the tab, so don't let it close quietly.
    window.addEventListener('beforeunload', function (e) {
      if (!storageOk && state.comments.length) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    document.addEventListener('mouseup', function (e) {
      if (e.target.closest && e.target.closest('.rv-ui')) return;
      setTimeout(function () {
        if (composer.style.display === 'block') return;
        var t = captureSelection();
        if (t) showBubble(t.rect);
        else hideBubble();
      }, 0);
    });

    document.addEventListener('mousedown', function (e) {
      if (e.target.closest && e.target.closest('.rv-ui')) return;
      hideBubble();
      if (composer.style.display === 'block') closeComposer();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { hideBubble(); closeComposer(); }
    });

    document.addEventListener('click', function (e) {
      var mark = e.target.closest && e.target.closest('mark.rv-hl');
      if (!mark) return;
      document.body.classList.add('rv-rail-open');
      var card = rail.querySelector('.rv-card[data-cid="' + mark.getAttribute('data-cid') + '"]');
      if (card) {
        card.scrollIntoView({ block: 'center' });
        card.classList.add('flash');
        setTimeout(function () { card.classList.remove('flash'); }, 1200);
      }
    });

    // The player rebuilds `.content`'s children on every lesson change. Watching
    // only direct children means our own marks (deeper in the tree) don't retrigger us.
    var content = document.querySelector('.content');
    if (content) {
      new MutationObserver(function () { decorate(); })
        .observe(content, { childList: true, subtree: false });
    }

    decorate();
    askName(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 0); });
  } else {
    setTimeout(init, 0);
  }
})();
