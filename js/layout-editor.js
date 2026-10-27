// Layout editor for mac.html: move, resize and align the page's boxes, headings and text the way
// a Board does in the Mac app. Edits are kept per page in this browser.
//
// Like a Board, the page is always editable:
// - Drag a box, heading or paragraph to move it. Its left, centre or right (and top, centre or bottom) snap to
//   another box's within 6px, and a green guide shows each alignment. A plain click still clicks.
// - Only the part of a box's frame within 48px of the cursor lights up.
// - The box under the cursor resizes from its edges and corners. Text wraps at its new width and
//   its height is a minimum, so text never overflows. A photo or video's sides crop it and its
//   corners scale it proportionally.
// - A resize never moves anything else: the box keeps the space it had in the page, so a heading
//   that wraps onto another line doesn't push the rest of the section down.
// - Option-drag moves the box around the one under the pointer. ⌘Z undoes.
// - Whenever the page is off its default layout, a Reset button waits at the bottom left.
(function () {
  var KEY = 'angrove-layout:' + location.pathname;
  var SNAP = 6, OVERHANG = 12, MIN = 24;
  var REVEAL = 48, FEATHER = 24;   // spotlight radius and its soft edge, as WorktreeTextBoxResize
  var GREEN = '134, 128, 62';   // AngroveTheme lightGreen

  var state = load();           // selector -> { x, y, w, h }
  var history = [];
  var hovered = null;           // the box whose edges resize
  var active = null;            // the box being moved or resized
  var pointer = null;           // { x, y } in the viewport
  var candidates = [], candidatesAt = 0, rects = [], rectsAt = 0, rectsScroll = -1;
  var gesture = null;
  var swallowClick = false;     // the click that ends a drag
  var editableCache = new WeakMap();
  var baseTranslate = new WeakMap();

  // ---------- Styles ----------
  var css = document.createElement('style');
  css.textContent = [
    'html, html * { user-select: none !important; -webkit-user-select: none !important; }',
    '.le-moving, .le-moving * { transition: none !important; }',
    '.le-ui { position: fixed; z-index: 2147483000; pointer-events: none; }',
    // The frame is padded 4px past the box so a spotlight mask keeps the corner squares.
    '.le-frame { position: fixed; pointer-events: none; opacity: 0; transition: opacity 0.15s ease-out; }',
    '.le-frame.is-shown { opacity: 1; }',
    '.le-line { position: absolute; inset: 4px; border: 1px solid rgba(' + GREEN + ', 0.5); }',
    '.le-frame.is-selected .le-line { border-color: rgba(' + GREEN + ', 0.9); }',
    '.le-sq { position: absolute; width: 7px; height: 7px; box-sizing: border-box; background: #fff; border: 1px solid rgba(' + GREEN + ', 0.9); }',
    '.le-sq.tl { left: 0; top: 0; } .le-sq.tr { right: 0; top: 0; } .le-sq.bl { left: 0; bottom: 0; } .le-sq.br { right: 0; bottom: 0; }',
    '.le-size { position: absolute; left: 50%; bottom: -20px; translate: -50% 0; padding: 2px 6px; border-radius: 4px; background: rgb(' + GREEN + '); color: #fff; font: 600 11px/1.4 -apple-system, system-ui, sans-serif; white-space: nowrap; display: none; }',
    '.le-frame.is-resizing .le-size { display: block; }',
    '.le-handle { position: fixed; pointer-events: auto; }',
    '.le-guide { position: fixed; pointer-events: none; opacity: 0.6; transition: opacity 0.15s ease-out; }',
    '.le-guide.v { width: 1px; background: linear-gradient(to bottom, rgba(' + GREEN + ', 0), rgb(' + GREEN + ') 25%, rgb(' + GREEN + ') 75%, rgba(' + GREEN + ', 0)); }',
    '.le-guide.h { height: 1px; background: linear-gradient(to right, rgba(' + GREEN + ', 0), rgb(' + GREEN + ') 25%, rgb(' + GREEN + ') 75%, rgba(' + GREEN + ', 0)); }',
    // Arrives like the app's search field: from 1.05 and an 8pt blur, easing out over 0.17s;
    // leaves the same way in reverse, easing in.
    '.le-reset { all: unset; box-sizing: border-box; position: fixed; left: 16px; bottom: 16px; z-index: 2147483001; padding: 12px 20px; border-radius: 999px; background: rgba(18, 15, 12, 0.88); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); box-shadow: 0 4px 18px rgba(0,0,0,0.18); color: #F7F3EA; font: 600 13px/1 -apple-system, system-ui, sans-serif; cursor: pointer; opacity: 0; scale: 1.05; filter: blur(8px); pointer-events: none; visibility: hidden; transition: opacity 0.17s ease-in, scale 0.17s ease-in, filter 0.17s ease-in, visibility 0s linear 0.17s; }',
    '.le-reset.is-shown { opacity: 1; scale: 1; filter: blur(0); pointer-events: auto; visibility: visible; transition: opacity 0.17s ease-out, scale 0.17s ease-out, filter 0.17s ease-out, visibility 0s; }',
    '@media (prefers-reduced-motion: reduce) { .le-reset, .le-reset.is-shown { scale: 1; filter: none; } }'
  ].join('\n');
  document.head.appendChild(css);

  var layer = el('div', 'le-ui');
  var spotFrames = [];
  var activeFrame = null;
  var handles = [];
  var guides = [];

  var resetButton = el('button', 'le-reset');
  resetButton.type = 'button';
  resetButton.textContent = 'Reset layout';
  resetButton.addEventListener('click', resetPage);

  function ready() {
    document.body.appendChild(layer);
    document.body.appendChild(resetButton);
    activeFrame = frame();
    activeFrame.classList.add('is-selected');
    applyAll();
    updateReset();
    requestAnimationFrame(draw);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
  // Late layout (fonts, images, reveals) can shift flow; re-apply once things settle.
  window.addEventListener('load', applyAll);

  // ---------- What can be edited ----------
  function isUI(node) { return node && node.closest && node.closest('.le-ui, .le-reset, .lightbox'); }

  function isEditable(node) {
    if (!node || node.nodeType !== 1 || isUI(node)) return false;
    if (editableCache.has(node)) return editableCache.get(node);
    var result = judge(node);
    editableCache.set(node, result);
    return result;
  }

  function judge(node) {
    var tag = node.tagName;
    if (/^(HTML|BODY|HEAD|SCRIPT|STYLE|NOSCRIPT|BR|SOURCE|TRACK|OPTION|PATH|G|USE)$/.test(tag)) return false;
    var cs = getComputedStyle(node);
    if (cs.display === 'none' || cs.display === 'contents' || cs.position === 'fixed') return false;
    var r = node.getBoundingClientRect();
    if (r.width < 16 || r.height < 12) return false;
    if (isText(node)) return true;
    var replaced = /^(IMG|VIDEO|CANVAS|IFRAME|PICTURE|FIGURE)$/.test(tag) || tag.toLowerCase() === 'svg';
    if (cs.display === 'inline' && !replaced) return false;
    if (replaced) return r.width >= 40 && r.height >= 40;
    // A box: something drawn (fill, image, border or shadow), not full-bleed.
    if (r.width >= document.documentElement.clientWidth * 0.94) return false;
    var filled = alpha(cs.backgroundColor) > 0 || cs.backgroundImage !== 'none';
    var bordered = ['Top', 'Right', 'Bottom', 'Left'].some(function (s) {
      return parseFloat(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none' && alpha(cs['border' + s + 'Color']) > 0;
    });
    var shadowed = cs.boxShadow && cs.boxShadow !== 'none';
    return filled || bordered || shadowed;
  }

  function alpha(color) {
    var m = /rgba?\(([^)]+)\)/.exec(color || '');
    if (!m) return color === 'transparent' ? 0 : 1;
    var parts = m[1].split(/[ ,/]+/).filter(Boolean);
    return parts.length > 3 ? parseFloat(parts[3]) : 1;
  }

  function editableFrom(node) {
    while (node && node !== document.documentElement) {
      if (isEditable(node)) return node;
      node = node.parentElement;
    }
    return null;
  }

  function isText(node) { return /^(H[1-6]|P|LI|BLOCKQUOTE|FIGCAPTION)$/.test(node.tagName); }

  // A heading or paragraph's box is its text, as on a Board, until it is given a width of its own.
  var textRange = document.createRange();
  function rectOf(node) {
    if (isText(node) && (entry(node).w == null)) {
      textRange.selectNodeContents(node);
      var t = textRange.getBoundingClientRect();
      if (t.width && t.height) return t;
    }
    return node.getBoundingClientRect();
  }

  function isMedia(node) { return /^(IMG|VIDEO|CANVAS|PICTURE|IFRAME)$/.test(node.tagName); }

  // A stable path from the nearest id, so an edit finds its element again on reload.
  function selectorFor(node) {
    var parts = [];
    while (node && node.nodeType === 1 && node !== document.body) {
      if (node.id) { parts.unshift('#' + CSS.escape(node.id)); return parts.join(' > '); }
      var tag = node.tagName.toLowerCase(), i = 1, sib = node;
      while ((sib = sib.previousElementSibling)) if (sib.tagName === node.tagName) i++;
      parts.unshift(tag + ':nth-of-type(' + i + ')');
      node = node.parentElement;
    }
    parts.unshift('body');
    return parts.join(' > ');
  }

  // ---------- Applying edits ----------
  function base(node) {
    if (!baseTranslate.has(node)) {
      var prev = node.style.getPropertyValue('translate');
      node.style.removeProperty('translate');
      var t = getComputedStyle(node).translate;
      if (prev) node.style.setProperty('translate', prev, 'important');
      var p = !t || t === 'none' ? [] : t.split(' ');
      baseTranslate.set(node, { x: p[0] || '0px', y: p[1] || '0px' });
    }
    return baseTranslate.get(node);
  }

  var SIZING = ['width', 'height', 'min-height', 'max-width', 'max-height', 'flex', 'object-fit', 'margin-bottom', 'margin-right'];

  function apply(node, e) {
    var s = node.style;
    SIZING.forEach(function (p) { s.removeProperty(p); });
    if (!e) { s.removeProperty('translate'); return; }
    var b = base(node);
    if (e.x || e.y) s.setProperty('translate', 'calc(' + b.x + ' + ' + (e.x || 0) + 'px) calc(' + b.y + ' + ' + (e.y || 0) + 'px)', 'important');
    else s.removeProperty('translate');
    if (e.w == null && e.h == null) return;
    var probe = footprint(node), before = probe.read();
    if (e.w != null) {
      s.setProperty('width', e.w + 'px', 'important');
      s.setProperty('max-width', 'none', 'important');
      s.setProperty('flex', 'none', 'important');
    }
    if (e.h != null) {
      if (isMedia(node)) {
        s.setProperty('height', e.h + 'px', 'important');
        s.setProperty('max-height', 'none', 'important');
        s.setProperty('object-fit', 'cover', 'important');
      } else {
        s.setProperty('min-height', e.h + 'px', 'important');
      }
    }
    hold(node, probe, before);
  }

  // Where the content after a box sits: the next box's top in a column, or the container's bottom
  // (a grid or flex row's height); across a flex row, the next box's left edge too.
  function footprint(node) {
    var parent = node.parentElement, pcs = getComputedStyle(parent);
    var row = /flex/.test(pcs.display) && !/column/.test(pcs.flexDirection);
    var stack = !row && !/grid/.test(pcs.display);
    var next = node.nextElementSibling;
    while (next && /^(absolute|fixed)$/.test(getComputedStyle(next).position)) next = next.nextElementSibling;
    return {
      read: function () {
        var p = parent.getBoundingClientRect(), n = next && next.getBoundingClientRect();
        return {
          v: stack && n ? n.top : p.bottom,
          h: row ? (n ? n.left : p.right) : null
        };
      }
    };
  }

  // A resized box keeps the space it had: its margins take up the difference, so nothing after it
  // moves. Collapsing margins make one pass inexact, so settle over a few.
  function hold(node, probe, before) {
    for (var i = 0; i < 6; i++) {
      var now = probe.read(), cs = getComputedStyle(node);
      var dv = now.v - before.v, dh = before.h == null ? 0 : now.h - before.h;
      if (Math.abs(dv) < 0.5 && Math.abs(dh) < 0.5) return;
      if (Math.abs(dv) >= 0.5) node.style.setProperty('margin-bottom', (parseFloat(cs.marginBottom) - dv) + 'px', 'important');
      if (Math.abs(dh) >= 0.5) node.style.setProperty('margin-right', (parseFloat(cs.marginRight) - dh) + 'px', 'important');
    }
  }

  function applyAll() {
    Object.keys(state).forEach(function (sel) {
      var node = find(sel);
      if (node) apply(node, state[sel]);
    });
  }

  function find(sel) { try { return document.querySelector(sel); } catch (_) { return null; } }

  function entry(node) { return state[selectorFor(node)] || { x: 0, y: 0 }; }

  function set(node, e) {
    var sel = selectorFor(node);
    var empty = !e.x && !e.y && e.w == null && e.h == null;
    if (empty) delete state[sel]; else state[sel] = e;
    apply(node, empty ? null : e);
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) { return {}; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
    updateReset();
  }
  function checkpoint() {
    history.push(JSON.stringify(state));
    if (history.length > 100) history.shift();
  }
  function restore(json) {
    var prev = state;
    state = JSON.parse(json);
    Object.keys(prev).forEach(function (sel) { if (!state[sel]) { var n = find(sel); if (n) apply(n, null); } });
    applyAll();
    save();
  }
  function undo() { if (history.length) restore(history.pop()); }
  function resetPage() {
    if (!Object.keys(state).length) return;
    checkpoint();
    restore('{}');
  }

  function updateReset() {
    resetButton.classList.toggle('is-shown', Object.keys(state).length > 0);
  }

  // ---------- Input ----------
  // Native drags of links and images would take over a move.
  window.addEventListener('dragstart', function (e) { if (!isUI(e.target)) e.preventDefault(); }, true);
  window.addEventListener('click', function (e) {
    if (!swallowClick) return;
    swallowClick = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  window.addEventListener('pointermove', function (e) {
    pointer = { x: e.clientX, y: e.clientY };
    if (gesture) { e.preventDefault(); gesture.move(e); return; }
    // Over a resize handle, keep its box.
    if (e.target.classList && e.target.classList.contains('le-handle')) return;
    hovered = isUI(e.target) ? null : editableFrom(e.target);
  }, true);

  document.addEventListener('pointerleave', function () { pointer = null; hovered = null; });
  window.addEventListener('blur', function () { pointer = null; hovered = null; });

  window.addEventListener('pointerdown', function (e) {
    swallowClick = false;
    if (isUI(e.target) || e.button !== 0) return;
    var target = editableFrom(e.target);
    if (target && e.altKey) target = editableFrom(target.parentElement) || target;
    if (target) gesture = moveGesture(target, e);
  }, true);

  window.addEventListener('pointerup', function () {
    if (!gesture) return;
    gesture.end();
    gesture = null;
    active = null;
    clearGuides();
  }, true);

  window.addEventListener('keydown', function (e) {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName)) return;
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && history.length) { e.preventDefault(); undo(); }
  }, true);

  // ---------- Gestures ----------
  // Snap targets: other editable boxes and the page's containers, near the screen.
  function targets(exclude) {
    var vh = window.innerHeight, list = [];
    var nodes = document.querySelectorAll('body *');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (isUI(n)) continue;
      if (exclude.some(function (x) { return x === n || x.contains(n); })) continue;
      if (!n.classList.contains('container') && !isEditable(n)) continue;
      var r = n.classList.contains('container') ? n.getBoundingClientRect() : rectOf(n);
      if (r.bottom < -vh || r.top > vh * 2 || r.width === 0) continue;
      list.push(r);
    }
    var w = document.documentElement.clientWidth;
    list.push({ left: w / 2, right: w / 2, top: 0, bottom: vh, width: 0, height: vh });   // page centre
    return list;
  }

  function edges(r, axis) {
    return axis === 'v' ? [r.left, r.left + r.width / 2, r.right] : [r.top, r.top + r.height / 2, r.bottom];
  }

  function snapDelta(rect, others, axis, which) {
    var mine = edges(rect, axis), best = null;
    if (which) mine = which.map(function (i) { return mine[i]; });
    others.forEach(function (o) {
      var theirs = edges(o, axis);
      if (o.width === 0) theirs = [theirs[0]];
      mine.forEach(function (m) {
        theirs.forEach(function (t) {
          if (Math.abs(t - m) <= SNAP && (best === null || Math.abs(t - m) < Math.abs(best))) best = t - m;
        });
      });
    });
    return best;
  }

  function showGuides(rect, others) {
    var next = [];
    ['v', 'h'].forEach(function (axis) {
      edges(rect, axis).forEach(function (value) {
        var aligned = others.filter(function (o) {
          return edges(o, axis).some(function (t) { return Math.abs(t - value) < 0.5; });
        });
        if (!aligned.length) return;
        var lo = Infinity, hi = -Infinity;
        aligned.concat([rect]).forEach(function (o) {
          lo = Math.min(lo, axis === 'v' ? o.top : o.left);
          hi = Math.max(hi, axis === 'v' ? o.bottom : o.right);
        });
        next.push({ axis: axis, pos: value, lo: lo - OVERHANG, hi: hi + OVERHANG });
      });
    });
    clearGuides();
    next.forEach(function (g) {
      var line = el('div', 'le-guide ' + g.axis);
      if (g.axis === 'v') { line.style.left = Math.round(g.pos) + 'px'; line.style.top = g.lo + 'px'; line.style.height = (g.hi - g.lo) + 'px'; }
      else { line.style.top = Math.round(g.pos) + 'px'; line.style.left = g.lo + 'px'; line.style.width = (g.hi - g.lo) + 'px'; }
      layer.appendChild(line);
      guides.push(line);
    });
  }

  function clearGuides() {
    guides.forEach(function (g) { g.remove(); });
    guides = [];
  }

  function moveGesture(anchor, start) {
    var nodes = [anchor];
    var starts = nodes.map(function (n) { return Object.assign({}, entry(n)); });
    var rect0 = rectOf(anchor);
    var others = null, began = false, scroll0 = window.scrollY;
    return {
      move: function (e) {
        var dx = e.clientX - start.clientX, dy = e.clientY - start.clientY + (window.scrollY - scroll0);
        if (!began) {
          if (Math.hypot(dx, dy) < 3) return;
          began = true;
          active = anchor;
          swallowClick = true;
          checkpoint();
          others = targets(nodes);
          nodes.forEach(function (n) { n.classList.add('le-moving'); });
        }
        // Rects are compared in viewport space at the start's scroll.
        var rect = { left: rect0.left + dx, right: rect0.right + dx, top: rect0.top + dy, bottom: rect0.bottom + dy, width: rect0.width, height: rect0.height };
        var sx = e.altKey ? null : snapDelta(rect, others, 'v');
        var sy = e.altKey ? null : snapDelta(rect, others, 'h');
        dx += sx || 0; dy += sy || 0;
        nodes.forEach(function (n, i) {
          set(n, Object.assign({}, starts[i], { x: Math.round((starts[i].x || 0) + dx), y: Math.round((starts[i].y || 0) + dy) }));
        });
        if (sx != null || sy != null) {
          var shift = scroll0 - window.scrollY;
          var moved = { left: rect0.left + dx, right: rect0.right + dx, top: rect0.top + dy + shift, bottom: rect0.bottom + dy + shift, width: rect0.width, height: rect0.height };
          showGuides(moved, others.map(function (o) {
            return o.width === 0 ? o : { left: o.left, right: o.right, top: o.top + shift, bottom: o.bottom + shift, width: o.width, height: o.height };
          }));
        } else {
          clearGuides();
        }
      },
      end: function () {
        nodes.forEach(function (n) { n.classList.remove('le-moving'); });
        if (began) save();
      }
    };
  }

  // handle: { l, r, t, b } — which edges move.
  function resizeGesture(node, h, start) {
    checkpoint();
    active = node;
    swallowClick = true;
    var e0 = Object.assign({}, entry(node));
    var r0 = rectOf(node);
    var fitted = r0 !== null && entry(node).w == null && isText(node);
    var w0 = fitted ? r0.width : node.offsetWidth || r0.width;
    var h0 = fitted ? r0.height : node.offsetHeight || r0.height;
    var others = targets([node]);
    var corner = (h.l || h.r) && (h.t || h.b);
    var keepAspect = corner && isMedia(node);
    var frameEl = activeFrame;
    if (frameEl) frameEl.classList.add('is-resizing');
    node.classList.add('le-moving');
    return {
      resizing: true,
      move: function (e) {
        var dx = e.clientX - start.clientX, dy = e.clientY - start.clientY;
        // The dragged edges snap to other boxes' edges.
        var left = r0.left + (h.l ? dx : 0), right = r0.right + (h.r ? dx : 0);
        var top = r0.top + (h.t ? dy : 0), bottom = r0.bottom + (h.b ? dy : 0);
        var probe = { left: left, right: right, top: top, bottom: bottom, width: right - left, height: bottom - top };
        if (!e.altKey && !keepAspect) {
          var sx = (h.l || h.r) ? snapDelta(probe, others, 'v', [h.l ? 0 : 2]) : null;
          var sy = (h.t || h.b) ? snapDelta(probe, others, 'h', [h.t ? 0 : 2]) : null;
          if (sx != null) { if (h.l) left += sx; else right += sx; }
          if (sy != null) { if (h.t) top += sy; else bottom += sy; }
        }
        var w = Math.max(MIN, w0 + (right - left) - r0.width);
        var ht = Math.max(MIN, h0 + (bottom - top) - r0.height);
        if (keepAspect) {
          var scale = Math.max(w / w0, ht / h0);
          w = Math.max(MIN, w0 * scale); ht = Math.max(MIN, h0 * scale);
        }
        var next = Object.assign({}, e0);
        if (h.l || h.r || fitted) next.w = Math.round(w);
        if (h.t || h.b || keepAspect) next.h = Math.round(ht);
        set(node, next);
        // Resizing reflows the box (a centred box re-centres), so pin the opposite edges.
        var r = node.getBoundingClientRect();
        var wantLeft = h.l ? r0.right - r.width : r0.left;
        var wantTop = h.t ? r0.bottom - r.height : r0.top;
        next.x = Math.round((next.x || 0) + wantLeft - r.left);
        next.y = Math.round((next.y || 0) + wantTop - r.top);
        set(node, next);
        var moved = node.getBoundingClientRect();
        if (!e.altKey) showGuides(moved, others); else clearGuides();
        if (frameEl) frameEl.querySelector('.le-size').textContent = Math.round(moved.width) + ' × ' + Math.round(moved.height);
      },
      end: function () {
        if (frameEl) frameEl.classList.remove('is-resizing');
        node.classList.remove('le-moving');
        save();
      }
    };
  }

  // ---------- Drawing the chrome ----------
  var HANDLES = [
    { l: 1, t: 1, cursor: 'nwse-resize' }, { r: 1, t: 1, cursor: 'nesw-resize' },
    { l: 1, b: 1, cursor: 'nesw-resize' }, { r: 1, b: 1, cursor: 'nwse-resize' },
    { l: 1, cursor: 'ew-resize' }, { r: 1, cursor: 'ew-resize' },
    { t: 1, cursor: 'ns-resize' }, { b: 1, cursor: 'ns-resize' }
  ];

  function draw() {
    if (active && !active.isConnected) active = null;
    if (hovered && !hovered.isConnected) hovered = null;
    // The box being moved or resized shows its whole frame.
    activeFrame.classList.toggle('is-shown', !!active);
    if (active) place(activeFrame, rectOf(active));

    spotlight();

    // The box under the cursor (or being resized) takes the resize handles.
    var owner = active || hovered;
    if (owner && !(gesture && !gesture.resizing)) {
      if (!handles.length) HANDLES.forEach(function (h) {
        var x = el('div', 'le-handle');
        x.style.cursor = h.cursor;
        x.addEventListener('pointerdown', function (e) {
          if (e.button !== 0 || !hovered) return;
          e.preventDefault();
          e.stopPropagation();
          gesture = resizeGesture(hovered, h, e);
        });
        layer.appendChild(x);
        handles.push(x);
      });
      var r = rectOf(owner);
      handles.forEach(function (x, i) {
        var h = HANDLES[i], corner = (h.l || h.r) && (h.t || h.b), s = 14, t = 8;
        var w = corner ? s : (h.l || h.r) ? t : Math.max(0, r.width - s * 2);
        var ht = corner ? s : (h.t || h.b) ? t : Math.max(0, r.height - s * 2);
        var cx = h.l ? r.left : h.r ? r.right : r.left + r.width / 2;
        var cy = h.t ? r.top : h.b ? r.bottom : r.top + r.height / 2;
        x.style.left = (cx - w / 2) + 'px'; x.style.top = (cy - ht / 2) + 'px';
        x.style.width = w + 'px'; x.style.height = ht + 'px';
      });
    } else if (handles.length) {
      handles.forEach(function (x) { x.remove(); });
      handles = [];
    }
    requestAnimationFrame(draw);
  }

  // Every box within REVEAL of the cursor shows just the part of its frame inside that circle.
  function spotlight() {
    var now = performance.now();
    if (now - candidatesAt > 1000) {
      candidates = [];
      var all = document.querySelectorAll('body *');
      for (var i = 0; i < all.length; i++) if (isEditable(all[i])) candidates.push(all[i]);
      candidatesAt = now;
      rectsAt = 0;
    }
    if (now - rectsAt > 250 || window.scrollY !== rectsScroll || gesture) {
      rects = candidates.map(rectOf);
      rectsAt = now;
      rectsScroll = window.scrollY;
    }
    var near = [];
    if (pointer) rects.forEach(function (r, i) {
      if (candidates[i] === active) return;
      var dx = Math.max(r.left - pointer.x, 0, pointer.x - r.right);
      var dy = Math.max(r.top - pointer.y, 0, pointer.y - r.bottom);
      if (Math.hypot(dx, dy) <= REVEAL) near.push(r);
    });
    while (spotFrames.length < near.length) spotFrames.push(frame());
    spotFrames.forEach(function (f, i) {
      var r = near[i];
      f.classList.toggle('is-shown', !!r);
      if (!r) return;
      place(f, r);
      var mask = 'radial-gradient(circle ' + REVEAL + 'px at ' + (pointer.x - r.left + 4) + 'px ' + (pointer.y - r.top + 4) +
        'px, #000 ' + (REVEAL - FEATHER) + 'px, transparent ' + REVEAL + 'px)';
      f.style.webkitMaskImage = mask;
      f.style.maskImage = mask;
    });
  }

  function place(f, r) {
    f.style.left = (r.left - 4) + 'px'; f.style.top = (r.top - 4) + 'px';
    f.style.width = (r.width + 8) + 'px'; f.style.height = (r.height + 8) + 'px';
  }

  function frame() {
    var f = el('div', 'le-frame');
    f.appendChild(el('span', 'le-line'));
    ['tl', 'tr', 'bl', 'br'].forEach(function (c) { f.appendChild(el('span', 'le-sq ' + c)); });
    f.appendChild(el('span', 'le-size'));
    layer.appendChild(f);
    return f;
  }

  function el(tag, cls) {
    var n = document.createElement(tag);
    n.className = cls;
    return n;
  }
})();
