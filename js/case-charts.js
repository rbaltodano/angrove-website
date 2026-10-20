// Case Studies phone charts: stacked bars with a hover/focus tooltip.
// Data comes from the Oct 8, 2026 iPhone 17 run (medians; see the table beside each chart).
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const SERIES = [
    { key: 'load', label: 'Loading the model', color: '#C8973A' },
    { key: 'write', label: 'Finding sources and writing', color: '#5F7020' },
  ];

  function el(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  }

  function legend(host) {
    const list = document.createElement('ul');
    list.className = 'case-chart__legend';
    for (const s of SERIES) {
      const item = document.createElement('li');
      item.innerHTML = `<span class="case-chart__swatch" style="background:${s.color}"></span>${s.label}`;
      list.appendChild(item);
    }
    host.appendChild(list);
  }

  // Appears like the app's docked Insight card (bottomDockCard): grows from 35% scale and 24 pt
  // lower, anchored at its bottom edge. Switching bars swaps cards the way the app does: the old
  // card shrinks away while a new one grows in from the newly hovered bar.
  function tooltip(host) {
    let current = null;
    let currentTarget = null;
    function retire(tip) {
      tip.classList.remove('is-open');
      setTimeout(() => tip.remove(), 350);
    }
    return {
      show(target, html) {
        if (current && currentTarget === target) return;
        if (current) retire(current);
        const tip = document.createElement('div');
        tip.className = 'case-chart__tip';
        tip.setAttribute('aria-hidden', 'true');
        tip.innerHTML = html;
        host.appendChild(tip);
        const box = host.getBoundingClientRect();
        const r = target.getBoundingClientRect();
        let x = r.left + r.width / 2 - box.left - tip.offsetWidth / 2;
        x = Math.max(0, Math.min(x, box.width - tip.offsetWidth));
        tip.style.left = `${x}px`;
        tip.style.top = `${r.top - box.top - tip.offsetHeight - 10}px`;
        tip.style.transformOrigin = `${r.left + r.width / 2 - box.left - x}px 100%`;
        tip.getBoundingClientRect(); // commit the closed state so the entrance animates
        tip.classList.add('is-open');
        current = tip;
        currentTarget = target;
      },
      hide() {
        if (current) retire(current);
        current = null;
        currentTarget = null;
      },
    };
  }

  // A hit target covering the whole bar, bigger than the thin marks.
  // `anchor` is the drawn mark the tooltip sits above.
  function hit(svg, tip, attrs, html, anchor) {
    const target = el('rect', { ...attrs, fill: 'transparent', tabindex: '0', role: 'img', 'aria-label': html.replace(/<[^>]+>/g, ' ') }, svg);
    target.addEventListener('mouseenter', () => tip.show(anchor, html));
    target.addEventListener('focus', () => tip.show(anchor, html));
    target.addEventListener('mouseleave', () => tip.hide());
    target.addEventListener('blur', () => tip.hide());
    return target;
  }

  // Rounded only on the data end (right for horizontal, top for vertical).
  function endRounded(x, y, w, h, r, horizontal) {
    r = Math.min(r, horizontal ? w : h, horizontal ? h / 2 : w / 2);
    if (horizontal) return `M${x},${y}h${w - r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 ${-r},${r}h${-(w - r)}z`;
    return `M${x},${y + h}v${-(h - r)}a${r},${r} 0 0 1 ${r},${-r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - r}z`;
  }

  function breakdown(host, W) {
    const rows = JSON.parse(host.parentElement.dataset.rows);
    const max = 30, rowH = 28, gap = 36, left = 0, top = 26;
    const H = top + rows.length * (rowH + gap) + 10;
    legend(host);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'case-chart__svg', 'aria-hidden': 'false' }, host);
    const tip = tooltip(host);
    const sx = (v) => (v / max) * W;
    for (let t = 0; t <= max; t += 5) {
      el('line', { x1: sx(t), x2: sx(t), y1: top - 6, y2: H - 10, class: 'case-chart__grid' }, svg);
    }
    rows.forEach((row, i) => {
      const y = top + i * (rowH + gap) + 18;
      el('text', { x: left, y: y - 8, class: 'case-chart__label' }, svg).textContent = row.label;
      let x = 0;
      const bar = el('g', { class: 'case-chart__grow case-chart__grow--x', style: `--i:${i}` }, svg);
      const labels = el('g', { class: 'case-chart__after', style: `--i:${i}` }, svg);
      SERIES.forEach((s, j) => {
        const w = sx(row[s.key]);
        const last = j === SERIES.length - 1;
        const width = last ? w : w - 2; // 2px surface gap between segments
        if (last) row.mark = el('path', { d: endRounded(x, y, width, rowH, 4, true), fill: s.color }, bar);
        else el('rect', { x, y, width, height: rowH, fill: s.color }, bar);
        const label = el('text', { x: x + width / 2, y: y + rowH / 2 + 4, class: 'case-chart__inlabel', 'text-anchor': 'middle' }, labels);
        label.textContent = `${row[s.key].toFixed(1)} s`;
        x += w;
      });
      hit(svg, tip, { x: 0, y: y - 22, width: W, height: rowH + 26 },
        `<strong>${row.label}</strong><br>Loading the model: ${row.load.toFixed(1)} s<br>Finding sources and writing: ${row.write.toFixed(1)} s`, row.mark);
    });
    const axis = el('g', {}, svg);
    for (let t = 0; t <= max; t += 10) {
      el('text', { x: sx(t), y: 12, class: 'case-chart__tick', 'text-anchor': t === 0 ? 'start' : t === max ? 'end' : 'middle' }, axis).textContent = `${t} s`;
    }
  }

  function sequence(host, W) {
    const turns = JSON.parse(host.parentElement.dataset.turns); // [write, reload]
    const max = 30, H = 240, top = 12, bottom = 26, left = 36;
    const plotH = H - top - bottom, plotW = W - left;
    const slot = plotW / turns.length, barW = Math.min(18, slot - 6);
    legend(host);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'case-chart__svg' }, host);
    const tip = tooltip(host);
    const sy = (v) => (v / max) * plotH;
    for (let t = 0; t <= max; t += 10) {
      const y = top + plotH - sy(t);
      el('line', { x1: left, x2: W, y1: y, y2: y, class: t === 0 ? 'case-chart__base' : 'case-chart__grid' }, svg);
      el('text', { x: left - 8, y: y + 4, class: 'case-chart__tick', 'text-anchor': 'end' }, svg).textContent = `${t} s`;
    }
    turns.forEach(([write, reload], i) => {
      const x = left + i * slot + (slot - barW) / 2;
      const y = top + plotH;
      const wh = sy(write);
      let mark;
      const bar = el('g', { class: 'case-chart__grow case-chart__grow--y', style: `--i:${i}` }, svg);
      if (reload > 0) {
        el('rect', { x, y: y - wh, width: barW, height: wh, fill: SERIES[1].color }, bar);
        const rh = sy(reload) - 2;
        mark = el('path', { d: endRounded(x, y - wh - 2 - rh, barW, rh, 4, false), fill: SERIES[0].color }, bar);
      } else {
        mark = el('path', { d: endRounded(x, y - wh, barW, wh, 4, false), fill: SERIES[1].color }, bar);
      }
      if (i === 0 || (i + 1) % 5 === 0) {
        el('text', { x: x + barW / 2, y: H - 8, class: 'case-chart__tick', 'text-anchor': 'middle' }, svg).textContent = i + 1;
      }
      const total = write + reload;
      hit(svg, tip, { x: left + i * slot, y: top, width: slot, height: plotH },
        `<strong>Answer ${i + 1}: ${total.toFixed(1)} s</strong>${reload ? `<br>Engine restart and reload: ${reload.toFixed(1)} s` : ''}<br>Finding sources and writing: ${write.toFixed(1)} s`, mark);
    });
  }

  // Scores out of 40, one or more bars per row. Series (colors and legend) and rows come from the
  // figure: data-series='[{"key","label","color"}]', data-rows='[{"label","note","bars":[{"key","value"}]}]'.
  function scores(host, W) {
    const figure = host.parentElement;
    const series = JSON.parse(figure.dataset.series);
    const rows = JSON.parse(figure.dataset.rows);
    const byKey = Object.fromEntries(series.map((s) => [s.key, s]));
    const max = 40, top = 26, labelH = 22, rowGap = 22;
    const barCount = Math.max(...rows.map((r) => r.bars.length));
    const barH = barCount > 1 ? 18 : 26, barGap = 4;
    const rowH = labelH + barCount * barH + (barCount - 1) * barGap;
    const H = top + rows.length * (rowH + rowGap);
    const list = document.createElement('ul');
    list.className = 'case-chart__legend';
    for (const s of series) {
      const item = document.createElement('li');
      item.innerHTML = `<span class="case-chart__swatch" style="background:${s.color}"></span>${s.label}`;
      list.appendChild(item);
    }
    host.appendChild(list);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'case-chart__svg', 'aria-hidden': 'false' }, host);
    const tip = tooltip(host);
    const sx = (v) => (v / max) * W;
    for (let t = 0; t <= max; t += 10) {
      el('line', { x1: sx(t), x2: sx(t), y1: top - 6, y2: H - rowGap + 4, class: 'case-chart__grid' }, svg);
      el('text', { x: sx(t), y: 12, class: 'case-chart__tick', 'text-anchor': t === 0 ? 'start' : t === max ? 'end' : 'middle' }, svg).textContent = `${t}`;
    }
    rows.forEach((row, i) => {
      const y0 = top + i * (rowH + rowGap);
      const title = el('text', { x: 0, y: y0 + 14, class: 'case-chart__label' }, svg);
      title.textContent = row.label;
      if (row.note) {
        const note = el('tspan', { class: 'case-chart__tick', dx: '8' }, title);
        note.textContent = row.note;
      }
      const bar = el('g', { class: 'case-chart__grow case-chart__grow--x', style: `--i:${i}` }, svg);
      const labels = el('g', { class: 'case-chart__after', style: `--i:${i}` }, svg);
      let lastMark;
      row.bars.forEach((b, j) => {
        const y = y0 + labelH + j * (barH + barGap);
        const w = sx(b.value);
        lastMark = el('path', { d: endRounded(0, y, w, barH, 4, true), fill: byKey[b.key].color }, bar);
        el('text', { x: w - 8, y: y + barH / 2 + 4, class: 'case-chart__inlabel', 'text-anchor': 'end' }, labels).textContent = `${b.value}`;
      });
      const detail = row.bars.map((b) => `${byKey[b.key].label}: ${b.value}/40`).join('<br>');
      hit(svg, tip, { x: 0, y: y0, width: W, height: rowH }, `<strong>${row.label}${row.note ? ` · ${row.note}` : ''}</strong><br>${detail}`, lastMark);
    });
  }

  const RENDER = { breakdown, sequence, scores };
  document.querySelectorAll('[data-case-chart]').forEach((figure) => {
    const plot = document.createElement('div');
    plot.className = 'case-chart__plot';
    figure.insertBefore(plot, figure.querySelector('figcaption'));
    let width = 0;
    const draw = () => {
      const w = Math.round(plot.clientWidth);
      if (!w || w === width) return;
      width = w;
      plot.replaceChildren();
      RENDER[figure.dataset.caseChart](plot, w);
    };
    new ResizeObserver(draw).observe(plot);
    draw();
    const reveal = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      figure.classList.add('is-revealed');
      reveal.disconnect();
    }, { threshold: 0.4 });
    reveal.observe(figure);
  });
})();
