// Site-wide behavior: the mobile nav menu, smooth scrolling, the footer wordmark's parallax,
// and headline reveals.
(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var nav = document.querySelector('.nav');
  var toggle = document.querySelector('.nav__toggle');
  if (nav && toggle) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
  }

  // ---------- Smooth scrolling ----------
  // Wheel and trackpad input sets a target and the page eases toward it, so scrolling glides
  // instead of stepping. Touch, keyboard, the scrollbar, and anchor links stay native, and the
  // target re-syncs whenever one of them moves the page.
  if (!reduceMotion) {
    var EASE = 0.11;              // share of the remaining distance covered each frame
    var target = window.scrollY, current = window.scrollY, gliding = false;
    function startupLocked() {
      return document.documentElement.classList.contains('is-booting') || document.documentElement.classList.contains('is-entering');
    }
    var limit = function () { return document.documentElement.scrollHeight - window.innerHeight; };
    function glide() {
      if (!gliding) return;
      if (startupLocked()) { gliding = false; return; }
      current += (target - current) * EASE;
      if (Math.abs(target - current) < 0.4) { current = target; gliding = false; }
      window.scrollTo({ top: current, behavior: 'instant' });
      if (gliding) requestAnimationFrame(glide);
    }
    window.addEventListener('wheel', function (e) {
      if (startupLocked()) { e.preventDefault(); gliding = false; return; }
      if (e.defaultPrevented) { gliding = false; return; }
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;   // zoom, sideways
      e.preventDefault();
      if (!gliding) { target = current = window.scrollY; }
      var delta = e.deltaY * (e.deltaMode === 1 ? 36 : e.deltaMode === 2 ? window.innerHeight : 1);
      target = Math.max(0, Math.min(limit(), target + delta));
      if (!gliding) { gliding = true; requestAnimationFrame(glide); }
    }, { passive: false });
    window.addEventListener('site:entrance', function () {
      gliding = false;
      target = current = window.scrollY;
    });
    // A press, key, or anchor jump takes over at once: drop any glide in progress.
    ['pointerdown', 'keydown', 'touchstart', 'hashchange'].forEach(function (type) {
      window.addEventListener(type, function () { gliding = false; }, { passive: true });
    });
  }

  // ---------- Footer wordmark parallax ----------
  // The oversized wordmark travels 5% slower than the footer it sits in, settling into its
  // resting place when the page reaches the bottom.
  var wordmark = document.querySelector('.footer__wordmark');
  if (wordmark && !reduceMotion) {
    var footer = wordmark.closest('.footer');
    var LAG = 0.05, pending = false;
    function drift() {
      pending = false;
      // How far the footer still has to travel before the page reaches its end.
      var remaining = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
      if (footer.getBoundingClientRect().top > window.innerHeight) return;
      wordmark.style.transform = 'translate3d(0,' + (-LAG * remaining).toFixed(2) + 'px,0)';
    }
    function queue() { if (!pending) { pending = true; requestAnimationFrame(drift); } }
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    drift();
  }

  // ---------- Large footer wordmark entrance ----------
  // Reveal the large wordmark once it enters view; the small brand logo stays visible.
  if (wordmark && !reduceMotion && 'IntersectionObserver' in window) {
    wordmark.classList.add('logo-enter');
    var wordmarkSeen = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      wordmark.classList.add('is-in');
      wordmarkSeen.disconnect();
    }, { threshold: 0.25 });
    wordmarkSeen.observe(wordmark);
  }

  // ---------- Founder quote mark ----------
  // The quotation mark enters the way a new Insight does in the app (a relaxed spring up out of a
  // blur), and the dot grid behind it ripples out from the mark at the same moment.
  var quoteMark = document.querySelector('.why__mark');
  if (quoteMark && !reduceMotion && 'IntersectionObserver' in window) {
    quoteMark.classList.add('will-enter');
    var markSeen = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      markSeen.disconnect();
      quoteMark.classList.add('is-in');
      var field = quoteMark.closest('[data-dot-field]');
      if (field) {
        var q = quoteMark.getBoundingClientRect();
        field.dispatchEvent(new CustomEvent('dotfield:ripple', {
          detail: { x: q.left + q.width / 2, y: q.top + q.height / 2, strength: 1.6 }
        }));
      }
    }, { threshold: 0.5, rootMargin: '0px 0px -8% 0px' });
    markSeen.observe(quoteMark);
  }

  // ---------- Headline reveal ----------
  // Each word of a headline resolves from a blur, in order, the first time it comes into view.
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var headlines = document.querySelectorAll('h1.display, h2.display, .row__copy h2, .cta__copy h2, .why__quote blockquote p');
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        seen.unobserve(entry.target);
      });
    }, { threshold: 0.4, rootMargin: '0px 0px -8% 0px' });
    Array.prototype.forEach.call(headlines, function (headline) {
      // The Mac page's heading has its own entrance (js/heading-demo.js).
      if (headline.hasAttribute('data-heading-demo')) return;
      var count = 0;
      (function walk(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (child) {
          if (child.nodeType === 3) {
            var frag = document.createDocumentFragment();
            child.textContent.split(/(\s+)/).forEach(function (part) {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
              var word = document.createElement('span');
              word.className = 'rw';
              word.style.setProperty('--i', count++);
              word.textContent = part;
              frag.appendChild(word);
            });
            child.replaceWith(frag);
          } else if (child.nodeType === 1 && child.tagName !== 'BR') { walk(child); }
        });
      })(headline);
      headline.classList.add('reveal');
      seen.observe(headline);
    });
  }
})();

// FAQ: each <details> opens like the Guide's Technical Details. The answer's height animates on
// the mobile menu's timing and curve (0.6s, --ease-menu) while its text fades and slides in.
(function () {
  var items = document.querySelectorAll('details.faq-item');
  if (!items.length) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EASE = 'cubic-bezier(0.55, 0, 0.17, 1)';
  Array.prototype.forEach.call(items, function (item) {
    var summary = item.querySelector('summary');
    var answer = item.querySelector('.faq-item__a');
    var anim = null;
    if (item.open) item.classList.add('is-open');
    function run(from, to, done) {
      if (anim) anim.cancel();
      anim = answer.animate([{ height: from + 'px' }, { height: to + 'px' }], { duration: reduce ? 0 : 600, easing: EASE });
      anim.onfinish = function () { anim = null; if (done) done(); };
    }
    summary.addEventListener('click', function (e) {
      e.preventDefault();
      var start = answer.getBoundingClientRect().height;
      if (!item.classList.contains('is-open')) {
        item.open = true;
        item.classList.add('is-open');
        run(anim ? start : 0, answer.scrollHeight);
      } else {
        item.classList.remove('is-open');
        run(start, 0, function () { item.open = false; });
      }
    });
    // Opened some other way (find in page, a link): keep the class in step.
    item.addEventListener('toggle', function () {
      if (item.open && !anim) item.classList.add('is-open');
    });
  });
})();

// Videos marked data-play-in-view play once, muted and without controls, the first time most of
// the video is on screen. With reduced motion they rest on their poster frame.
(function () {
  var videos = document.querySelectorAll('video[data-play-in-view]');
  if (!videos.length || !('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var seen = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      seen.unobserve(entry.target);
      var playing = entry.target.play();
      if (playing && playing.catch) playing.catch(function () {});
    });
  }, { threshold: 0.6 });
  Array.prototype.forEach.call(videos, function (video) { seen.observe(video); });
})();
