// Guide: the Model Tasks example, after the app's UserGuideModelTasksExample. The card is
// ModelTasksCard on its own practice queue: tasks run one at a time for 5–7 s, the running one
// can be stopped, waiting ones removed or dragged to a new place, and finished tasks clear
// 0.7 s after the queue goes idle. Nothing here touches a model.
(function () {
  var root = document.querySelector('[data-guide-tasks]');
  if (!root) return;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rowsEl = root.querySelector('[data-mt-rows]');
  var countEl = root.querySelector('[data-mt-count]');
  var card = root.querySelector('.mt-card');
  var NS = 'http://www.w3.org/2000/svg';
  var WORDS = ['prudence', 'grace', 'virtue', 'charity', 'habit'];
  var EXIT = 240, CLEAR_AFTER = 700;

  var completed = [], current = null, upcoming = [];
  var nextId = 1, wordIndex = 0, runTimer = null, clearTimer = null;
  var rows = {};   // id → row element

  function all() { return completed.concat(current ? [current] : [], upcoming); }

  function title(kind) {
    if (kind === 'question') return 'User Question';
    if (kind === 'define') {
      var w = WORDS[wordIndex++ % WORDS.length];
      return 'Define “' + w.charAt(0).toUpperCase() + w.slice(1) + '”';
    }
    if (kind === 'midpoint') return 'Create Midpoint';
    return 'Update Insight Tree';
  }

  // ---------- Queue ----------

  function enqueue(kind) {
    clearTimeout(clearTimer);
    upcoming.push({ id: nextId++, title: title(kind) });
    startNext();
    render();
  }
  function startNext() {
    if (current || !upcoming.length) return;
    current = upcoming.shift();
    clearTimeout(runTimer);
    runTimer = setTimeout(finish, 5000 + Math.random() * 2000);
  }
  function finish() {
    if (!current) return;
    completed.push(current);
    current = null;
    startNext();
    idleCheck();
    render();
  }
  function stop() {
    clearTimeout(runTimer);
    current = null;
    startNext();
    idleCheck();
    render();
  }
  function remove(id) {
    upcoming = upcoming.filter(function (t) { return t.id !== id; });
    idleCheck();
    render();
  }
  function idleCheck() {
    if (current || !completed.length) return;
    clearTimeout(clearTimer);
    clearTimer = setTimeout(function () {
      if (current) return;
      completed = [];
      render();
    }, CLEAR_AFTER);
  }

  // ---------- Icons ----------

  function svg(markup, cls) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 14 14');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('class', cls);
    s.innerHTML = markup;
    return s;
  }
  var ICON = {
    // checkmark.circle.fill
    completed: '<circle cx="7" cy="7" r="6.5" fill="currentColor"/><path d="M4.3 7.2 6.2 9l3.5-4" fill="none" stroke="var(--canvas-secondary)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    // ContextUsageIcon spinning: a faint 3 pt ring and a quarter arc, one turn per 1.1 s.
    // The arc spins inside its own HTML wrapper (Safari won't animate a transform on a shape
    // inside an SVG).
    current: '<circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-opacity="0.2" stroke-width="3"/>',
    arc: '<circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" pathLength="100" stroke-dasharray="25 100" transform="rotate(-90 7 7)"/>',
    // circle.dotted
    upcoming: '<circle cx="7" cy="7" r="5.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" pathLength="24" stroke-dasharray="0 2"/>',
    // stop.circle.fill, hierarchical
    stop: '<circle cx="7" cy="7" r="7" fill="currentColor" fill-opacity="0.3"/><rect x="4.6" y="4.6" width="4.8" height="4.8" rx="0.9" fill="currentColor"/>',
    // xmark, 11 pt bold
    remove: '<path d="M3.5 3.5l7 7M10.5 3.5l-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
  };

  // ---------- Rows ----------

  function makeRow(task) {
    var row = document.createElement('div');
    row.className = 'mt-row';
    row.dataset.id = task.id;
    var status = document.createElement('span');
    status.className = 'mt-row__status';
    var name = document.createElement('span');
    name.className = 'mt-row__title';
    name.textContent = task.title;
    var action = document.createElement('button');
    action.type = 'button';
    action.className = 'mt-row__action';
    action.addEventListener('click', function (e) {
      e.stopPropagation();
      if (row.dataset.phase === 'current') stop();
      else if (row.dataset.phase === 'upcoming') remove(task.id);
    });
    row.appendChild(status); row.appendChild(name); row.appendChild(action);
    row.addEventListener('pointerdown', function (e) { beginDrag(e, row, task); });
    return row;
  }

  function setPhase(row, phase) {
    if (row.dataset.phase === phase) return;
    row.dataset.phase = phase;
    var status = row.querySelector('.mt-row__status');
    status.innerHTML = '';
    status.appendChild(svg(ICON[phase], 'mt-icon mt-icon--' + phase));
    if (phase === 'current') {
      var spin = document.createElement('span');
      spin.className = 'mt-spin';
      spin.appendChild(svg(ICON.arc, 'mt-icon'));
      status.appendChild(spin);
    }
    var action = row.querySelector('.mt-row__action');
    action.innerHTML = '';
    action.hidden = phase === 'completed';
    if (phase === 'current') { action.appendChild(svg(ICON.stop, 'mt-icon')); action.setAttribute('aria-label', 'Stop current model task'); }
    if (phase === 'upcoming') { action.appendChild(svg(ICON.remove, 'mt-icon mt-icon--x')); action.setAttribute('aria-label', 'Remove queued model task'); }
  }

  var empty = document.createElement('div');
  empty.className = 'mt-row mt-row--empty';
  empty.appendChild(svg(ICON.upcoming, 'mt-icon mt-icon--small'));
  empty.appendChild(document.createTextNode('Model is currently idle...'));

  function render() {
    var tasks = all();
    // FLIP: remember where rows were, so the rest slide into place (springLively).
    var before = {};
    Object.keys(rows).forEach(function (id) { before[id] = rows[id].getBoundingClientRect().top; });

    // Keep each departing row in its slot while it fades and blurs. Its removal
    // starts the height/reflow animation only after the visual exit has finished.
    var keep = {};
    tasks.forEach(function (t) { keep[t.id] = true; });
    var leaving = Object.keys(rows).filter(function (id) {
      return !keep[id] && !rows[id].classList.contains('is-leaving');
    });
    leaving.forEach(function (id) {
      var row = rows[id];
      row.classList.add('is-leaving');
      row.inert = true;
      row.setAttribute('aria-hidden', 'true');
    });
    if (leaving.length) setTimeout(function () {
      var positions = rowPositions();
      leaving.forEach(function (id) { rows[id].remove(); delete rows[id]; });
      updateEmpty();
      fitCard();
      animateReflow(positions);
    }, reduceMotion ? 0 : EXIT);

    tasks.forEach(function (t, i) {
      var row = rows[t.id];
      if (!row) {
        row = rows[t.id] = makeRow(t);
        row.classList.add('is-entering');
        requestAnimationFrame(function () { requestAnimationFrame(function () { row.classList.remove('is-entering'); }); });
      }
      setPhase(row, t === current ? 'current' : completed.indexOf(t) >= 0 ? 'completed' : 'upcoming');
      row.classList.toggle('is-dragging', drag && drag.id === t.id);
    });
    // Reorder live rows around the slots still occupied by departing rows.
    var ordered = tasks.map(function (t) { return rows[t.id]; });
    var slots = Array.prototype.slice.call(rowsEl.children).filter(function (row) {
      return row !== empty && row.classList.contains('is-leaving');
    });
    var layout = ordered.slice();
    slots.forEach(function (row) {
      var index = Array.prototype.indexOf.call(rowsEl.children, row);
      layout.splice(Math.min(index, layout.length), 0, row);
    });
    layout.forEach(function (row, i) {
      var at = rowsEl.children[i];
      if (at !== row) rowsEl.insertBefore(row, at || null);
    });
    updateEmpty();

    countEl.hidden = !tasks.length;
    countEl.textContent = (completed.length + (current ? 1 : 0)) + ' of ' + tasks.length;
    fitCard();

    animateReflow(before);
  }

  function updateEmpty() {
    // Show idle only once the last departing row has faded away.
    if (!Object.keys(rows).length) {
      if (!empty.parentNode) rowsEl.appendChild(empty);
    } else if (empty.parentNode) empty.remove();
  }

  function rowPositions() {
    var positions = {};
    Object.keys(rows).forEach(function (id) { positions[id] = rows[id].getBoundingClientRect().top; });
    return positions;
  }

  function animateReflow(before) {
    if (reduceMotion) return;
    Object.keys(rows).forEach(function (id) {
      var row = rows[id];
      if (row.classList.contains('is-leaving')) return;
      var was = before[id];
      if (was === undefined) return;
      var dy = was - row.getBoundingClientRect().top;
      if (!dy) return;
      // Animate translate alone so an interrupted reorder cannot suppress a row's fade.
      if (row.reflow) row.reflow.cancel();
      row.reflow = row.animate([
        { translate: '0 ' + dy + 'px' }, { translate: '0 0' }
      ], { duration: 360, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });
    });
  }

  // The card animates between its old and new heights as rows come and go.
  function fitCard() {
    var from = card.getBoundingClientRect().height;
    card.style.height = 'auto';
    var to = card.getBoundingClientRect().height;
    card.style.height = from + 'px';
    void card.offsetHeight;
    card.style.height = to + 'px';
  }
  window.addEventListener('resize', fitCard);
  if (document.fonts) document.fonts.ready.then(fitCard);

  // ---------- Drag to reorder (waiting tasks only) ----------

  var drag = null;
  function beginDrag(e, row, task) {
    if (row.classList.contains('is-leaving') || row.dataset.phase !== 'upcoming' || e.target.closest('button')) return;
    e.preventDefault();
    drag = { id: task.id, y: e.clientY, started: false, pointer: e.pointerId, row: row };
    row.setPointerCapture(e.pointerId);
  }
  rowsEl.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.pointer) return;
    if (!drag.started) {
      if (Math.abs(e.clientY - drag.y) < 4) return;
      drag.started = true;
      render();
    }
    var target = upcoming.filter(function (t) {
      if (t.id === drag.id || !rows[t.id]) return false;
      var r = rows[t.id].getBoundingClientRect();
      return e.clientY >= r.top && e.clientY <= r.bottom;
    })[0];
    if (!target) return;
    var from = upcoming.findIndex(function (t) { return t.id === drag.id; });
    var to = upcoming.indexOf(target);
    var moved = upcoming.splice(from, 1)[0];
    upcoming.splice(to, 0, moved);
    render();
  });
  function endDrag() {
    if (!drag) return;
    drag = null;
    render();
  }
  rowsEl.addEventListener('pointerup', endDrag);
  rowsEl.addEventListener('pointercancel', endDrag);

  root.querySelectorAll('[data-practice]').forEach(function (button) {
    button.addEventListener('click', function () { enqueue(button.dataset.practice); });
  });

  render();
})();
