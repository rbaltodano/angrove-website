// Mac page: the hero heading arrives the way one does on a Board (WorktreeBoard.addHeading). A
// cursor comes in and clicks, "/heading Built for a Bigger Desk." is typed with the command
// sweeping green as in WorktreeTextEditor, Return turns it into the heading with one dot-grid
// pulse, and the cursor takes the heading's grip and drags it to the center, where it snaps to
// an alignment guide. Then the cursor lets go and fades out with a blur.
// The inline script in the page's head adds .heading-demo (skipped for reduced motion).
(function () {
  var root = document.documentElement;
  var heading = document.querySelector('[data-heading-demo]');
  if (!heading || !root.classList.contains('heading-demo')) return;
  var hero = heading.closest('[data-dot-field]');
  var stage = heading.parentElement;
  var title = heading.textContent.trim();
  var COMMAND = '/heading';
  var SPRING = 'cubic-bezier(0.22, 1, 0.36, 1)';
  var SWEEP_MS = 1000;       // the editor's command sweep
  var SNAP = 8;              // WorktreeItemView: 8pt snapping
  var GUIDE_OVERHANG = 84;   // and an 84pt guide overhang

  function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
  function animate(el, frames, options) {
    return el.animate(frames, Object.assign({ fill: 'forwards' }, options)).finished;
  }
  function translate(x, y) { return 'translate(' + x + 'px, ' + y + 'px)'; }
  function fade(el, to, ms) { return animate(el, [{ opacity: to }], { duration: ms || 150, easing: 'ease-out' }); }

  // The pointer: an arrow placed so its tip sits at the wrapper's origin.
  var cursor = document.createElement('span');
  cursor.className = 'demo-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML = '<span class="demo-cursor__art">' +
    '<svg class="demo-cursor__arrow" viewBox="0 0 24 24"><path d="M5 2.5v16.2l4.1-3.9 2.6 6.1 2.6-1.1-2.6-6h5.8z"/></svg>' +
    '</span>';
  var art = cursor.firstChild;
  function placeCursor(x, y) { cursor.style.transform = translate(x, y); }
  function moveCursor(x, y, ms) { return animate(cursor, [{ transform: translate(x, y) }], { duration: ms, easing: SPRING }); }
  function press() { return animate(art, [{ transform: 'scale(1)' }, { transform: 'scale(0.9)' }, { transform: 'scale(1)' }], { duration: 180 }); }

  // The command field: the Board's bare canvas text, with a caret.
  var field = document.createElement('p');
  field.className = 'demo-cmd';
  field.setAttribute('aria-hidden', 'true');
  field.innerHTML = '<span class="demo-cmd__command"></span><span class="demo-cmd__text"></span><span class="demo-cmd__caret"></span>';
  var command = field.children[0], text = field.children[1];

  // The heading's move grip (the app's WorktreeGrip), just before its text.
  var grip = document.createElement('span');
  grip.className = 'demo-grip';
  grip.setAttribute('aria-hidden', 'true');
  grip.innerHTML = '<svg viewBox="0 0 7.5 12"><circle cx="1.5" cy="1.5" r="1.5"/><circle cx="1.5" cy="6" r="1.5"/><circle cx="1.5" cy="10.5" r="1.5"/><circle cx="6" cy="1.5" r="1.5"/><circle cx="6" cy="6" r="1.5"/><circle cx="6" cy="10.5" r="1.5"/></svg>';

  // The heading's resize box (WorktreeBoxChrome): a 1px outline with 7px corner squares, shown
  // only inside a soft circle around the pointer while the pointer is within 48px of it.
  var REVEAL = 48;
  var frame = document.createElement('span');
  frame.className = 'demo-box';
  frame.setAttribute('aria-hidden', 'true');
  frame.innerHTML = '<i></i><i></i><i></i><i></i>';
  var tracking = false;
  function track() {
    if (!tracking) return;
    var c = cursor.getBoundingClientRect(), r = frame.getBoundingClientRect();
    var px = c.left - r.left, py = c.top - r.top;
    var ox = Math.max(-px, 0, px - r.width), oy = Math.max(-py, 0, py - r.height);
    frame.style.setProperty('--px', px + 'px');
    frame.style.setProperty('--py', py + 'px');
    frame.classList.toggle('is-near', Math.hypot(ox, oy) <= REVEAL);
    requestAnimationFrame(track);
  }

  // The vertical alignment guide down the column's center.
  var guide = document.createElement('span');
  guide.className = 'demo-guide';
  guide.setAttribute('aria-hidden', 'true');

  stage.appendChild(field);
  stage.appendChild(guide);
  stage.appendChild(cursor);

  async function type(target, chars, perChar) {
    for (var i = 0; i < chars.length; i++) {
      target.textContent += chars[i];
      await wait(perChar);
    }
  }

  // WorktreeTextEditor.applyHighlight: a green band 40% of the command's width sweeps across it.
  function sweep() {
    var width = command.getBoundingClientRect().width;
    var band = Math.max(width * 0.4, 1);
    var start = performance.now();
    command.classList.add('is-sweeping');
    return new Promise(function (resolve) {
      (function frame(now) {
        var progress = Math.min(1, (now - start) / SWEEP_MS);
        var front = -band + (width + 2 * band) * progress;
        command.style.setProperty('--from', (front - band) + 'px');
        command.style.setProperty('--to', (front + band) + 'px');
        if (progress < 1) requestAnimationFrame(frame);
        else { command.classList.remove('is-sweeping'); command.classList.add('is-command'); resolve(); }
      })(start);
    });
  }

  function pulse(strength) {
    if (!hero) return;
    var r = heading.getBoundingClientRect();
    hero.dispatchEvent(new CustomEvent('dotfield:ripple', {
      detail: { x: r.left + r.width / 2, y: r.top + r.height / 2, strength: strength }
    }));
  }

  // The drag: a spring (damping 0.86) slower than the app's, as a person moves a mouse.
  function spring(t, response) {
    var w = 2 * Math.PI / response, z = 0.86, wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + z * w / wd * Math.sin(wd * t));
  }

  async function run() {
    var box = stage.getBoundingClientRect();
    var range = document.createRange();
    range.selectNodeContents(heading);
    var textRect = range.getBoundingClientRect();
    var headRect = heading.getBoundingClientRect();
    var lineHeight = parseFloat(getComputedStyle(heading).lineHeight) || headRect.height;
    // The heading is made a little left of and below where it ends up, then dragged home.
    var dx = -Math.min(200, box.width * 0.14, textRect.left - box.left - 40), dy = 14;
    var left = textRect.left - box.left + dx;
    // The field sits on the heading's first line, so the heading replaces it in place.
    var fieldHeight = field.getBoundingClientRect().height;
    var top = headRect.top - box.top + dy + (lineHeight - fieldHeight) / 2;
    field.style.left = left + 'px';
    field.style.top = top + 'px';
    var lineMid = top + fieldHeight / 2;

    // The grip, centered on the first line and 12px before the text.
    var gripW = 11, gripH = 18;
    grip.style.left = (textRect.left - headRect.left - gripW - 12) + 'px';
    grip.style.top = (lineHeight - gripH) / 2 + 'px';
    heading.appendChild(grip);
    // The box hugs the text with the Board's 8px text padding.
    frame.style.left = (textRect.left - headRect.left - 8) + 'px';
    frame.style.top = (textRect.top - headRect.top - 8) + 'px';
    frame.style.width = (textRect.width + 16) + 'px';
    frame.style.height = (textRect.height + 16) + 'px';
    heading.appendChild(frame);

    // The guide spans the centered column, from the eyebrow to the button, plus its overhang.
    var spanTop = Infinity, spanBottom = -Infinity;
    Array.prototype.forEach.call(stage.children, function (el) {
      if (el === field || el === guide || el === cursor) return;
      var r = el.getBoundingClientRect();
      spanTop = Math.min(spanTop, r.top); spanBottom = Math.max(spanBottom, r.bottom);
    });
    guide.style.left = Math.round(box.width / 2) + 'px';
    guide.style.top = (spanTop - box.top - GUIDE_OVERHANG / 2) + 'px';
    guide.style.height = (spanBottom - spanTop + GUIDE_OVERHANG) + 'px';

    // In: the cursor arrives from the lower right and clicks where the field opens.
    placeCursor(Math.min(box.width - 24, left + 420), top + 220);
    animate(art, [{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
    await moveCursor(left - 4, lineMid, 750);
    await press();
    field.classList.add('is-open');
    // The pointer steps aside so it doesn't cover the text being typed.
    moveCursor(left + 6, lineMid + 34, 400);
    await wait(250);

    await type(command, COMMAND, 75);
    var swept = sweep();
    await type(text, ' ' + title, 55);
    await swept;
    await wait(450);

    // Return: the command closes and the heading takes its place, blurring in, with one pulse.
    animate(field, [{ opacity: 1 }, { opacity: 0 }], { duration: 120 });
    heading.style.transform = translate(dx, dy);
    await animate(heading, [{ opacity: 0, filter: 'blur(8px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 450, easing: 'ease-out' });
    pulse(1.5);
    tracking = true;
    track();
    await wait(500);

    // To the grip: it shows as the pointer comes near, and the pointer presses it.
    var g = grip.getBoundingClientRect();
    var grabX = g.left - box.left + g.width / 2, grabY = g.top - box.top + g.height / 2;
    var toGrip = moveCursor(grabX, grabY, 650);
    await wait(350);
    fade(grip, 1);
    await toGrip;
    await wait(220);
    animate(art, [{ transform: 'scale(1)' }, { transform: 'scale(0.9)' }], { duration: 120 });
    // From here the drag sets the pointer each frame, so its earlier moves must not hold it.
    placeCursor(grabX, grabY);
    cursor.getAnimations().forEach(function (a) { a.cancel(); });
    await wait(120);

    // Drag home. Within 8px of the center the heading snaps there and the guide draws in.
    var start = performance.now(), snapped = false;
    await new Promise(function (resolve) {
      (function frame(now) {
        var t = (now - start) / 1000;
        var s = Math.min(1, spring(t, 0.8));
        var x = dx * (1 - s), y = dy * (1 - s);
        cursor.style.transform = translate(grabX - dx + x, grabY - dy + y);
        if (!snapped && Math.abs(x) <= SNAP) {
          snapped = true;
          guide.classList.add('is-shown');
        }
        heading.style.transform = translate(snapped ? 0 : x, y);
        if (t < 1.1) requestAnimationFrame(frame);
        else { heading.style.transform = translate(0, 0); resolve(); }
      })(start);
    });
    await wait(150);

    // Let go: the guide fades, and the pointer blurs away, growing slightly.
    await animate(art, [{ transform: 'scale(0.9)' }, { transform: 'scale(1)' }], { duration: 120 });
    guide.classList.remove('is-shown');
    guide.classList.add('is-leaving');
    await wait(300);
    fade(grip, 0, 300);
    await animate(art, [
      { opacity: 1, filter: 'blur(0)', transform: 'scale(1)' },
      { opacity: 0, filter: 'blur(6px)', transform: 'scale(1.05)' }
    ], { duration: 420, easing: 'ease-out' });
    finish();
  }

  // The resting state, also used if anything above fails.
  function finish() {
    tracking = false;
    heading.getAnimations().forEach(function (a) { a.cancel(); });
    heading.style.transform = '';
    [cursor, field, guide, grip, frame].forEach(function (el) { el.remove(); });
    root.classList.remove('heading-demo');
  }

  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(function () { return wait(400); }).then(run).catch(finish);
})();
