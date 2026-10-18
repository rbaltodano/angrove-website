// Listening cards scale in place when selected. Their order stays fixed.
(function () {
  var shelf = document.querySelector('[data-listen-shelf]');
  if (!shelf) return;

  var playing = shelf.querySelector('.listen-card.is-playing');

  function setState(card, on) {
    card.classList.toggle('is-playing', on);
    card.querySelector('.listen-card__pill').setAttribute('aria-pressed', on ? 'true' : 'false');
    card.querySelector('[data-listen-label]').textContent = on ? 'Listening' : 'Listen';
  }

  // Anywhere on a card selects it; its Listen pill can also pause it.
  shelf.addEventListener('click', function (event) {
    var card = event.target.closest('.listen-card');
    if (!card) return;
    if (card === playing) {
      if (event.target.closest('.listen-card__pill')) {
        setState(card, false);
        playing = null;
      }
      return;
    }
    if (playing) setState(playing, false);
    playing = card;
    setState(card, true);
  });
})();
