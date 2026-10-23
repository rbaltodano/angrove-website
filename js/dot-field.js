// Dot-grid background for [data-dot-field] sections: the app's AnimatedDotGridBackground (the same
// drifting brightness the Insight Tree uses). While the pointer is over a section it sends a ripple
// out from the pointer every 2 seconds, the cadence of the app's hover pulse on an Insight.
// data-dot-color sets the dot color as "r, g, b". A "dotfield:ripple" event on the section, with
// detail { x, y, strength } in client coordinates, sends the app's ripple out across the dots.
// data-dot-rest="hidden" leaves the dots unseen between ripples.
(function () {
  var fields = document.querySelectorAll('[data-dot-field]');
  if (!fields.length) return;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SPACING = 16;

  // AnimatedDotGridBackground.blobOpacity (js/insight-tree.js), stretched out and thresholded so
  // only a few, widely spaced patches light up at a time.
  var HOVER_PULSE_MS = 2000;   // InsightTreeCanvasView's hover pulse: a ripple every 2 s
  function blobOpacity(wx, wy, time) {
    var x = wx * 0.011, y = wy * 0.011;
    var w1 = Math.sin(x * 1.1 + time * 0.22) * Math.cos(y * 0.95 + time * 0.17);
    var w2 = Math.sin(x * 0.65 - y * 0.75 + time * 0.31) * 0.55;
    var w3 = Math.cos(x * 1.4 + y * 1.05 - time * 0.19) * 0.38;
    var n = ((w1 + w2 + w3) / 1.93 + 1) / 2;
    var peak = Math.max(0, (n - 0.62) / 0.38);
    return 0.01 + Math.pow(peak, 2.2) * 0.3;
  }

  Array.prototype.forEach.call(fields, function (root) {
    var color = root.getAttribute('data-dot-color') || '255, 250, 240';
    // data-dot-rest="hidden": the dots rest invisible and only show in a ripple, as on a Board.
    var restsHidden = root.getAttribute('data-dot-rest') === 'hidden';
    var canvas = document.createElement('canvas');
    canvas.className = 'dot-field';
    canvas.setAttribute('aria-hidden', 'true');
    root.insertBefore(canvas, root.firstChild);
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, DPR = 1, running = false, visible = false;
    var cols = 0, rows = 0, ox = 0, oy = 0;
    // Ripples, as in the Insight Tree: a bright ring that expands and fades.
    var ripples = [];
    root.addEventListener('dotfield:ripple', function (e) {
      if (reduceMotion) return;
      var d = e.detail || {}, rect = root.getBoundingClientRect(), strength = d.strength || 1;
      ripples.push({ x: d.x - rect.left, y: d.y - rect.top, start: performance.now() / 1000, strength: strength,
        duration: 2.4 * (0.5 + 0.9 * strength) });
      if (visible) start();
    });
    // The pointer's position inside the section, and the timer that pulses from it while it's there.
    var hover = { x: 0, y: 0, timer: null };

    function resize() {
      var r = root.getBoundingClientRect();
      W = r.width; H = r.height;
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      cols = Math.ceil(W / SPACING); rows = Math.ceil(H / SPACING);
      ox = (W - (cols - 1) * SPACING) / 2; oy = (H - (rows - 1) * SPACING) / 2;
      if (!running) draw(performance.now());
    }

    function draw(now) {
      var time = reduceMotion ? 0 : now / 1000;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var secs = now / 1000;
      ripples = ripples.filter(function (rp) { return secs - rp.start < rp.duration; });
      var waves = ripples.map(function (rp) {
        var progress = (secs - rp.start) / rp.duration;
        var exponent = 4 + Math.max(0, rp.strength - 1) * 3;
        return {
          x: rp.x, y: rp.y,
          radius: 400 * rp.strength * (1 - Math.pow(1 - progress, exponent)),
          width: 95 * (0.6 + 0.4 * rp.strength),
          gain: (1 - Math.pow(progress, 2.2)) * 0.06 * rp.strength
        };
      });
      for (var i = 0; i < cols; i++) {
        for (var j = 0; j < rows; j++) {
          var x = ox + i * SPACING, y = oy + j * SPACING;
          var boost = 0;
          for (var w = 0; w < waves.length; w++) {
            var wv = waves[w];
            var front = Math.hypot(x - wv.x, y - wv.y) - wv.radius;
            if (front > -wv.width && front < 8) {
              var bump = Math.cos(Math.max(-1, front / wv.width) * Math.PI / 2);
              boost += bump * bump * wv.gain;
            }
          }
          var o = ((restsHidden ? 0 : blobOpacity(x, y, time)) + boost) * 1.6;
          if (o < 0.012) continue;
          ctx.fillStyle = 'rgba(' + color + ',' + Math.min(o, 0.7).toFixed(3) + ')';
          ctx.fillRect(x - 0.9, y - 0.9, 1.8, 1.8);
        }
      }
    }

    var last = performance.now();
    function tick(now) {
      if (!visible) { running = false; return; }
      draw(now);
      requestAnimationFrame(tick);
    }
    function start() {
      if (running) return;
      running = true;
      last = performance.now();
      requestAnimationFrame(tick);
    }

    function pulse() {
      var rect = root.getBoundingClientRect();
      root.dispatchEvent(new CustomEvent('dotfield:ripple', {
        detail: { x: rect.left + hover.x, y: rect.top + hover.y, strength: 1 }
      }));
    }
    root.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var r = root.getBoundingClientRect();
      hover.x = e.clientX - r.left; hover.y = e.clientY - r.top;
      if (!hover.timer) hover.timer = setInterval(pulse, HOVER_PULSE_MS);
    });
    root.addEventListener('pointerleave', function () {
      clearInterval(hover.timer); hover.timer = null;
    });
    // A click or tap sends the same ripple out from that spot, as tapping the canvas does in the app.
    root.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('a, button')) return;
      root.dispatchEvent(new CustomEvent('dotfield:ripple', { detail: { x: e.clientX, y: e.clientY, strength: 1 } }));
    });

    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(root);
    else window.addEventListener('resize', resize);
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start();
    }, { rootMargin: '100px' }).observe(root);
  });
})();
