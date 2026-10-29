/* Small SVG chart helpers: stacked horizontal bars, cumulative line chart, ranked bar list. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const tip = () => document.getElementById('tooltip');

  function el(name, attrs, parent) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) {
      const v = attrs[k];
      // CSS variables are not reliable in SVG presentation attributes; route them through style
      if (typeof v === 'string' && v.startsWith('var(')) n.style.setProperty(k, v);
      else n.setAttribute(k, v);
    }
    if (parent) parent.appendChild(n);
    return n;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function showTip(evt, html) {
    const t = tip();
    t.innerHTML = html;
    t.hidden = false;
    const pad = 14, w = t.offsetWidth, h = t.offsetHeight;
    let x = evt.clientX + pad, y = evt.clientY + pad;
    if (x + w > window.innerWidth - 8) x = evt.clientX - w - pad;
    if (y + h > window.innerHeight - 8) y = evt.clientY - h - pad;
    t.style.left = x + 'px';
    t.style.top = y + 'px';
  }
  function hideTip() { tip().hidden = true; }
  function ttRow(color, label, value) {
    return `<div class="tt-row"><span><i style="background:${color}"></i>${esc(label)}</span><b>${esc(value)}</b></div>`;
  }

  // rounded-end bar path: square at baseline (left), 4px radius at the data end (right)
  function hbarPath(x, y, w, h, roundEnd) {
    const r = roundEnd ? Math.min(4, w / 2, h / 2) : 0;
    if (w <= 0) return '';
    return `M${x},${y}h${w - r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 -${r},${r}h-${w - r}z`;
  }

  // draw at the container's real pixel width so text stays 12px instead of scaling with the viewBox
  function width(c) { return Math.max(300, Math.round(c.getBoundingClientRect().width) || 640); }

  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    return steps.find(x => n <= x) * p;
  }

  /** rows: [{label, segments:[{key, value}]}], keys: [{key, label, color}] */
  function stackedBars(container, rows, keys, opts = {}) {
    container.innerHTML = '';
    const legend = document.createElement('div');
    legend.className = 'legend';
    legend.innerHTML = keys.map(k => `<span><i style="background:${k.color}"></i>${esc(k.label)}</span>`).join('');
    container.appendChild(legend);
    const W = width(container), labelW = Math.min(opts.labelW || 210, W * 0.42), barH = 18, gap = 12, valueW = 40;
    const H = rows.length * (barH + gap);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opts.aria || 'Balkendiagramm' }, container);
    const plotW = W - labelW - valueW;
    rows.forEach((row, i) => {
      const total = row.segments.reduce((a, s) => a + s.value, 0);
      const y = i * (barH + gap);
      el('text', { x: labelW - 10, y: y + barH / 2 + 4, 'text-anchor': 'end' }, svg).textContent = row.label;
      let x = labelW;
      const segs = row.segments.filter(s => s.value > 0);
      segs.forEach((s, j) => {
        const k = keys.find(k => k.key === s.key);
        const w = total ? (s.value / total) * plotW : 0;
        const wDraw = Math.max(0, w - (j < segs.length - 1 ? 2 : 0)); // 2px surface gap between segments
        const p = el('path', { d: hbarPath(x, y, wDraw, barH, j === segs.length - 1), fill: k.color }, svg);
        const hit = el('rect', { x, y: y - gap / 2, width: Math.max(w, 1), height: barH + gap, fill: 'transparent' }, svg);
        const html = `<div class="tt-title">${esc(row.label)}</div>` +
          ttRow(k.color, k.label, `${s.value} (${Math.round(s.value / total * 100)} %)`);
        hit.addEventListener('mousemove', e => { showTip(e, html); p.style.opacity = .85; });
        hit.addEventListener('mouseleave', () => { hideTip(); p.style.opacity = 1; });
        x += w;
      });
      el('text', { x: W - 4, y: y + barH / 2 + 4, 'text-anchor': 'end', class: 'axis-label' }, svg).textContent = total;
    });
  }

  /** labels: ['Jahr 1'…], series: [{name, color, values, fmt}], marker: {index, label} */
  function lineChart(container, labels, series, opts = {}) {
    container.innerHTML = '';
    const legend = document.createElement('div');
    legend.className = 'legend';
    legend.innerHTML = series.map(s => `<span><i class="line" style="background:${s.color}"></i>${esc(s.name)}</span>`).join('');
    container.appendChild(legend);
    const W = width(container), H = opts.height || 260, m = { l: 64, r: 16, t: 12, b: 28 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const all = series.flatMap(s => s.values);
    const max = niceMax(Math.max(...all, 1));
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opts.aria || 'Liniendiagramm' }, container);
    const xs = i => m.l + (labels.length === 1 ? pw / 2 : (i / (labels.length - 1)) * pw);
    const ys = v => m.t + ph - (v / max) * ph;
    for (let k = 0; k <= 4; k++) {
      const v = (max / 4) * k, y = ys(v);
      el('line', { x1: m.l, x2: W - m.r, y1: y, y2: y, class: k === 0 ? 'baseline' : 'grid' }, svg);
      el('text', { x: m.l - 8, y: y + 4, 'text-anchor': 'end', class: 'axis-label' }, svg).textContent = opts.fmtAxis ? opts.fmtAxis(v) : v;
    }
    labels.forEach((l, i) => {
      el('text', { x: xs(i), y: H - 8, 'text-anchor': 'middle', class: 'axis-label' }, svg).textContent = l;
    });
    if (opts.marker && opts.marker.x != null) {
      const x = m.l + opts.marker.x * pw;
      el('line', { x1: x, x2: x, y1: m.t, y2: m.t + ph, stroke: 'var(--muted)', 'stroke-dasharray': '3 3' }, svg);
      el('text', { x: x + 6, y: m.t + 12, class: 'axis-label' }, svg).textContent = opts.marker.label;
    }
    series.forEach(s => {
      const d = s.values.map((v, i) => `${i ? 'L' : 'M'}${xs(i)},${ys(v)}`).join('');
      el('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      s.values.forEach((v, i) => el('circle', { cx: xs(i), cy: ys(v), r: 4, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2 }, svg));
      const last = s.values.length - 1;
      el('text', { x: xs(last) - 6, y: ys(s.values[last]) - 10, 'text-anchor': 'end', style: 'font-weight:600' }, svg).textContent = s.fmt(s.values[last]);
    });
    // crosshair + tooltip
    const cross = el('line', { y1: m.t, y2: m.t + ph, stroke: 'var(--line-strong)', visibility: 'hidden' }, svg);
    const hit = el('rect', { x: m.l, y: m.t, width: pw, height: ph, fill: 'transparent' }, svg);
    hit.addEventListener('mousemove', e => {
      const r = svg.getBoundingClientRect();
      const px = (e.clientX - r.left) * (W / r.width);
      const i = Math.max(0, Math.min(labels.length - 1, Math.round(((px - m.l) / pw) * (labels.length - 1))));
      cross.setAttribute('x1', xs(i)); cross.setAttribute('x2', xs(i)); cross.setAttribute('visibility', 'visible');
      let html = `<div class="tt-title">${esc(labels[i])}</div>` + series.map(s => ttRow(s.color, s.name, s.fmt(s.values[i]))).join('');
      if (opts.extraTip) html += opts.extraTip(i);
      showTip(e, html);
    });
    hit.addEventListener('mouseleave', () => { cross.setAttribute('visibility', 'hidden'); hideTip(); });
  }

  /** items: [{label, value, sub}] sorted desc; single series */
  function barList(container, items, opts = {}) {
    container.innerHTML = '';
    if (!items.length) { container.innerHTML = '<p class="empty">Keine Daten</p>'; return; }
    const W = width(container), labelW = Math.min(opts.labelW || 230, W * 0.42), barH = 16, gap = 10, valueW = 86;
    const H = items.length * (barH + gap);
    const max = Math.max(...items.map(i => i.value), 1);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opts.aria || 'Balkendiagramm' }, container);
    const plotW = W - labelW - valueW;
    const color = opts.color || 'var(--series-1)';
    items.forEach((it, i) => {
      const y = i * (barH + gap);
      el('text', { x: labelW - 10, y: y + barH / 2 + 4, 'text-anchor': 'end' }, svg).textContent = it.label;
      const w = Math.max(0, (it.value / max) * plotW);
      const p = el('path', { d: hbarPath(labelW, y, w, barH, true), fill: color }, svg);
      el('text', { x: labelW + w + 8, y: y + barH / 2 + 4, class: 'axis-label' }, svg).textContent = opts.fmt(it.value);
      const hit = el('rect', { x: 0, y: y - gap / 2, width: W, height: barH + gap, fill: 'transparent' }, svg);
      const html = `<div class="tt-title">${esc(it.label)}</div>` + ttRow(color, opts.seriesName || 'Wert', opts.fmt(it.value)) + (it.sub ? `<div class="hint">${esc(it.sub)}</div>` : '');
      hit.addEventListener('mousemove', e => { showTip(e, html); p.style.opacity = .85; });
      hit.addEventListener('mouseleave', () => { hideTip(); p.style.opacity = 1; });
    });
  }

  window.Charts = { stackedBars, lineChart, barList };
})();
