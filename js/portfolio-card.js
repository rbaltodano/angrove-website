// Home portfolio card: slides in once the boot screen and entrance have finished, and stays
// dismissed for this browser after the close button is pressed. CSS hides it below 992px.
// Turn it on or off with the card's data-enabled attribute in index.html.
(function () {
  var card = document.querySelector('.portfolio-card');
  if (!card) return;
  if (card.dataset.enabled !== 'true') { card.remove(); return; }
  card.hidden = false;
  var KEY = 'angrove.portfolioCardDismissed';

  try { if (localStorage.getItem(KEY) === '1') { card.remove(); return; } } catch (e) {}

  card.querySelector('.portfolio-card__close').addEventListener('click', function () {
    card.classList.remove('is-shown');
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    setTimeout(function () { card.remove(); }, 600);
  });

  function settled() {
    var root = document.documentElement.classList;
    return !root.contains('is-booting') && !root.contains('is-entering');
  }
  function show() {
    if (!settled()) { setTimeout(show, 250); return; }
    setTimeout(function () { card.classList.add('is-shown'); }, 1200);
  }
  if (document.readyState === 'complete') show();
  else window.addEventListener('load', show);
})();
