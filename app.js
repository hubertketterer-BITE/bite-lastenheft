/* BITE Lastenheft & ROI – state, wizard UI, ROI calculation and result dashboard. */
(function () {
  const D = window.LV_DATA;
  const STORE = 'bite-lv-tool.v1';
  const WEIGHT = { MUSS: 10, SOLL: 5, KANN: 2 };
  const STATUS = [
    { key: 'erfuellt', label: 'Erfüllt', color: 'var(--good)', score: 1 },
    { key: 'aufpreis', label: 'Gegen Aufpreis', color: 'var(--warning)', score: 1 },
    { key: 'teilweise', label: 'Teilweise', color: 'var(--serious)', score: 0.5 },
    { key: 'nicht', label: 'Nicht erfüllt', color: 'var(--critical)', score: 0 },
    { key: 'offen', label: 'Noch nicht bewertet', color: 'var(--neutral)', score: null },
  ];
  const ST = Object.fromEntries(STATUS.map(s => [s.key, s]));
  const SHORT_TITLE = { rec: 'Funktional Recruiting', per: 'Funktional Personal', nfa: 'Nicht-funktional', ta: 'Technik', ra: 'Recht & Compliance', si: 'Schnittstellen', ki: 'KI', sec: 'Sicherheit', se: 'Service & Implementierung' };
  const STEPS = ['Projekt & Kunde', 'Stakeholder', 'Anforderungen', 'ROI-Rechner', 'Ergebnis & Export'];
  const DRIVERS = {
    stellen: 'Stellenausschreibungen p.a.', bewerbungen: 'Bewerbungseingänge p.a.', neueinst: 'Neueinstellungen p.a.',
    abgaenge: 'Abgänge p.a.', ma: 'Mitarbeitende', abteilungen: 'Abteilungen', const: 'fester Wert',
  };
  const ROI_FIELDS = [
    { sep: 'Kosten der Software' },
    { k: 'lizenz', label: 'Jährliche Lizenzkosten (€)', step: 100 },
    { k: 'setup', label: 'Einmalige Projekt- und Einrichtungskosten (€)', step: 100 },
    { k: 'lohn', label: 'Stundenmittellohn HR (€)', step: 1 },
    { sep: 'Unternehmen' },
    { k: 'ma', label: 'Mitarbeitende', step: 1 },
    { k: 'admins', label: 'Admin-Zugänge', step: 1 },
    { k: 'abteilungen', label: 'Anzahl Abteilungen', step: 1 },
    { sep: 'Recruiting', mod: 'bm' },
    { k: 'stellen', label: 'Stellenausschreibungen p.a.', step: 1, mod: 'bm' },
    { k: 'bewProVerf', label: 'Bewerbungen pro Verfahren', step: 1, mod: 'bm' },
    { sep: 'Personalmanagement', mod: 'pa' },
    { k: 'neueinst', label: 'Neueinstellungen p.a.', step: 1, mod: 'pa' },
    { k: 'abgaenge', label: 'Abgänge p.a.', step: 1, mod: 'pa' },
    { sep: 'Annahme' },
    { k: 'year1pct', label: 'Einsparung im 1. Jahr (% vom Folgejahr)', step: 5, hint: 'Standard 0 %: Im ersten Jahr zehren Lernkurve und Ersteinrichtung die Zeitersparnis erfahrungsgemäß auf.' },
  ];
  const eur0 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const num0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
  const num1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------------------------------------------------------------- state
  function freshState() {
    return {
      v: 1,
      step: 1,
      meta: {
        kunde: '', ansprechpartner: 'HR-Abteilung / Geschäftsleitung', mailsystem: '', bearbeiter: '', version: '1.0',
        datum: new Date().toISOString().slice(0, 10), status: 'Entwurf zur Prüfung', zeitplan: { markt: '', demo: '', vertrag: '', golive: '' },
      },
      modules: { R: true, P: true },
      intro: D.intro.map(i => ({ ...i })),
      stake: D.stakeholders.map(s => ({ ...s, on: true })),
      sheets: D.sheets.map(sh => ({
        key: sh.key, title: sh.title,
        reqs: sh.reqs.map(r => ({ ...r, on: true, custom: false, wManual: false })),
      })),
      roi: {
        inputs: { ...D.roi.inputs, bm: true, pa: true, year1pct: 0 },
        items: Object.fromEntries(Object.entries(D.roi.modules).map(([k, groups]) =>
          [k, groups.map(g => ({ name: g.name, items: g.items.map(i => ({ ...i, on: true })) }))])),
      },
      sheetSel: D.sheets[0].key,
      variant: 'neutral',
    };
  }
  let S;
  try { S = JSON.parse(localStorage.getItem(STORE)); } catch (e) { S = null; }
  if (!S || S.v !== 1) S = freshState();

  let saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE, JSON.stringify(S)); $('#autosave').textContent = 'Zwischengespeichert ' + new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); } catch (e) { /* storage unavailable */ }
    }, 300);
    renderTopMeta();
  }

  const get = path => path.split('.').reduce((o, k) => o?.[k], S);
  const set = (path, v) => { const ks = path.split('.'); const last = ks.pop(); ks.reduce((o, k) => o[k], S)[last] = v; };

  // ---------------------------------------------------------------- helpers shared with export
  const visibleModule = m => m === 'A' || (m === 'R' && S.modules.R) || (m === 'P' && S.modules.P);
  const sheetVisible = sh => sh.reqs.some(r => visibleModule(r.module));
  const activeReqs = sh => sh.reqs.filter(r => visibleModule(r.module) && r.on);
  const fillText = t => t.replace(/\{\{kunde\}\}/g, S.meta.kunde || 'Der Auftraggeber').replace(/\{\{mailsystem\}\}/g, S.meta.mailsystem || '(Mailsystem)');

  function stats(reqs) {
    const st = Object.fromEntries(STATUS.map(s => [s.key, 0]));
    let wMax = 0, wGot = 0, muss = 0, mussOk = 0;
    reqs.forEach(r => {
      st[r.status]++;
      if (r.prio === 'MUSS') { muss++; if (r.status === 'erfuellt' || r.status === 'aufpreis') mussOk++; }
      const sc = ST[r.status].score;
      if (sc != null) { wMax += r.weight; wGot += r.weight * sc; }
    });
    return { n: reqs.length, st, muss, mussOk, wMax, wGot, rated: reqs.length - st.offen };
  }

  // ---------------------------------------------------------------- ROI
  function roiCalc() {
    const inp = S.roi.inputs;
    const drv = {
      stellen: +inp.stellen || 0, bewerbungen: (+inp.stellen || 0) * (+inp.bewProVerf || 0), neueinst: +inp.neueinst || 0,
      abgaenge: +inp.abgaenge || 0, ma: +inp.ma || 0, abteilungen: +inp.abteilungen || 0, const: 1,
    };
    const lohn = +inp.lohn || 0;
    const groups = [];
    let totalMin = 0;
    for (const mod of ['bm', 'pa']) {
      if (!inp[mod]) continue;
      for (const g of S.roi.items[mod]) {
        let gMin = 0;
        for (const it of g.items) {
          it._qty = drv[it.driver] * it.factor;
          it._min = (it.cur - it.dig) * it._qty;
          it._eur = it._min / 60 * lohn;
          if (it.on) gMin += it._min;
        }
        totalMin += gMin;
        groups.push({ mod, name: g.name, min: gMin, eur: gMin / 60 * lohn });
      }
    }
    const savePa = totalMin / 60 * lohn;
    const lic = +inp.lizenz || 0, setup = +inp.setup || 0, y1 = (+inp.year1pct || 0) / 100;
    const years = [1, 2, 3, 4, 5, 6].map(y => ({ y, cost: y === 1 ? lic + setup : lic, save: y === 1 ? savePa * y1 : savePa }));
    let cc = 0, cs = 0;
    years.forEach(r => { cc += r.cost; cs += r.save; r.cumCost = cc; r.cumSave = cs; r.delta = cs - cc; });
    // break-even month (monthly accrual, setup paid up front)
    let be = null;
    for (let m = 1; m <= 72; m++) {
      const cost = setup + lic * m / 12;
      const sav = m <= 12 ? savePa * y1 * m / 12 : savePa * y1 + savePa * (m - 12) / 12;
      if (sav >= cost && savePa > 0) { be = m; break; }
    }
    const hours = totalMin / 60;
    return { groups, totalMin, hours, fte: hours / 1600, savePa, years, be, roi6: cc ? (cs - cc) / cc : 0, lohn };
  }

  // ---------------------------------------------------------------- top + stepper
  function renderTopMeta() {
    $('#topMeta').textContent = [S.meta.kunde || 'Neuer Kunde', [S.modules.R && 'Bewerbermanagement', S.modules.P && 'Personalmanagement'].filter(Boolean).join(' + ')].join(' · ');
  }
  function renderStepper() {
    $('#stepper').innerHTML = STEPS.map((t, i) =>
      `<button data-go="${i + 1}" ${S.step === i + 1 ? 'aria-current="step"' : ''} class="${i + 1 < S.step ? 'done' : ''}"><span class="num">${i + 1}</span><span class="lbl">${t}</span></button>`).join('');
  }
  function go(n) {
    S.step = Math.max(1, Math.min(5, n));
    $$('.step').forEach(s => s.classList.toggle('active', +s.dataset.step === S.step));
    renderStepper();
    $('#btnPrev').disabled = S.step === 1;
    $('#btnNext').textContent = S.step === 5 ? 'Fertig' : 'Weiter';
    $('#btnNext').disabled = S.step === 5;
    if (S.step === 3) renderReqs();
    if (S.step === 4) renderRoi();
    if (S.step === 5) renderReport();
    window.scrollTo({ top: 0 });
    save();
  }

  // ---------------------------------------------------------------- step 1
  function renderStep1() {
    $$('[data-bind]').forEach(inp => { inp.value = get(inp.dataset.bind) ?? ''; });
    $$('#modulePick input').forEach(cb => { cb.checked = S.modules[cb.dataset.module]; });
    $('#introList').innerHTML = S.intro.map((it, i) =>
      `<div class="intro-item"><label for="intro${i}">${i + 1}. ${esc(it.title)}</label><textarea id="intro${i}" data-intro="${i}" rows="${Math.min(8, Math.max(2, it.text.split('\n').length + Math.ceil(it.text.length / 140)))}">${esc(it.text)}</textarea></div>`).join('');
  }
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.bind) { set(t.dataset.bind, t.value); save(); }
    if (t.dataset.intro) { S.intro[+t.dataset.intro].text = t.value; save(); }
  });
  $('#modulePick').addEventListener('change', e => {
    const m = e.target.dataset.module;
    S.modules[m] = e.target.checked;
    if (!S.modules.R && !S.modules.P) { S.modules[m] = true; e.target.checked = true; alert('Mindestens ein Modul muss gewählt sein.'); return; }
    S.roi.inputs.bm = S.modules.R;
    S.roi.inputs.pa = S.modules.P;
    renderStake();
    save();
  });

  // ---------------------------------------------------------------- step 2
  function renderStake() {
    $('#stakeList').innerHTML = S.stake.map((s, i) => visibleModule(s.module) ? `
      <div class="stake ${s.on ? '' : 'off'}">
        <div class="stake-top"><input type="checkbox" data-sk="${i}" ${s.on ? 'checked' : ''} aria-label="${esc(s.role)} einbeziehen"><strong>${esc(s.role)}</strong><span class="tag">${esc(s.type)}</span></div>
        <label class="field" style="margin:0"><span>Verantwortlichkeit</span><textarea rows="2" data-skf="${i}.desc">${esc(s.desc)}</textarea></label>
        <label class="field" style="margin:0"><span>System-Berechtigungen</span><input data-skf="${i}.perm" value="${esc(s.perm)}"></label>
      </div>` : '').join('');
  }
  $('#stakeList').addEventListener('change', e => {
    if (e.target.dataset.sk != null) { const s = S.stake[+e.target.dataset.sk]; s.on = e.target.checked; e.target.closest('.stake').classList.toggle('off', !s.on); save(); }
  });
  $('#stakeList').addEventListener('input', e => {
    const f = e.target.dataset.skf;
    if (f) { const [i, k] = f.split('.'); S.stake[+i][k] = e.target.value; save(); }
  });

  // ---------------------------------------------------------------- step 3
  const collapsed = new Set();
  function curSheet() {
    let sh = S.sheets.find(s => s.key === S.sheetSel);
    if (!sh || !sheetVisible(sh)) { sh = S.sheets.find(sheetVisible); S.sheetSel = sh.key; }
    return sh;
  }
  function miniBar(st, n) {
    return `<div class="mini-bar">${STATUS.map(s => st[s.key] ? `<span style="width:${st[s.key] / n * 100}%;background:${s.color}"></span>` : '').join('')}</div>`;
  }
  function renderTabs() {
    $('#sheetTabs').innerHTML = S.sheets.filter(sheetVisible).map(sh => {
      const act = activeReqs(sh), st = stats(act);
      const all = sh.reqs.filter(r => visibleModule(r.module)).length;
      return `<button class="sheet-tab" role="tab" data-sheet="${sh.key}" aria-selected="${sh.key === S.sheetSel}">
        <span class="t">${esc(sh.title)}</span><span class="c">${act.length} von ${all} aktiv · ${st.muss} MUSS</span>${miniBar(st.st, act.length || 1)}</button>`;
    }).join('');
  }
  function reqMatches(r, q, fp, fs, fo) {
    if (fp && r.prio !== fp) return false;
    if (fs && r.status !== fs) return false;
    if (fo === 'on' && !r.on) return false;
    if (fo === 'off' && r.on) return false;
    if (q && !(r.desc + ' ' + r.cat + ' ' + r.id + ' ' + r.note).toLowerCase().includes(q)) return false;
    return true;
  }
  function reqRow(r, idx) {
    return `<div class="req ${r.on ? '' : 'off'}" data-idx="${idx}">
      <div class="req-check"><input type="checkbox" data-act="on" ${r.on ? 'checked' : ''} aria-label="${esc(r.id)} einbeziehen"></div>
      <div class="req-id">${esc(r.id)}</div>
      <div class="req-desc"><span class="text" data-act="edit" title="Klicken zum Bearbeiten">${esc(r.desc)}</span>${r.custom ? '<span class="custom">EIGENE</span>' : ''}
        ${r.note || r._noteOpen ? `<input class="note-in" data-act="note" value="${esc(r.note)}" placeholder="BITE-Anmerkung">` : ''}</div>
      <div class="req-ctrl">
        <div class="seg" role="group" aria-label="Priorität">${['MUSS', 'SOLL', 'KANN'].map(p => `<button data-act="prio" data-v="${p}" aria-pressed="${r.prio === p}">${p}</button>`).join('')}</div>
        <input type="number" min="0" max="100" class="w-in ${r.wManual ? 'manual' : ''}" data-act="weight" value="${r.weight}" title="Gewichtung" aria-label="Gewichtung">
        <select class="st-sel st-${r.status}" data-act="status" aria-label="BITE-Status">${STATUS.map(s => `<option value="${s.key}" ${r.status === s.key ? 'selected' : ''}>${s.key === 'offen' ? 'Offen' : s.label}</option>`).join('')}</select>
        ${r.note || r._noteOpen ? '' : '<button class="btn small" data-act="addnote" title="BITE-Anmerkung ergänzen">+ Notiz</button>'}
        ${r.custom ? '<button class="del" data-act="del" title="Eigene Anforderung löschen" aria-label="Löschen">×</button>' : ''}
      </div></div>`;
  }
  function renderReqs() {
    const sh = curSheet();
    renderTabs();
    const q = $('#reqSearch').value.trim().toLowerCase(), fp = $('#fPrio').value, fs = $('#fStatus').value, fo = $('#fOn').value;
    const cats = new Map();
    sh.reqs.forEach((r, i) => {
      if (!visibleModule(r.module) || !reqMatches(r, q, fp, fs, fo)) return;
      if (!cats.has(r.cat)) cats.set(r.cat, []);
      cats.get(r.cat).push([r, i]);
    });
    const act = activeReqs(sh), st = stats(act);
    $('#sheetSummary').innerHTML = `<strong>${esc(sh.title)}</strong><span>${act.length} aktiv</span><span>${st.muss} MUSS</span><span>${st.st.erfuellt + st.st.aufpreis} von ${act.length} durch BITE erfüllt</span>${st.st.offen ? `<span>${st.st.offen} noch nicht bewertet</span>` : ''}
      <span class="actions"><button class="btn small" data-bulk="on">Alle an</button><button class="btn small" data-bulk="off">Alle aus</button></span>`;
    $('#reqList').innerHTML = cats.size ? [...cats].map(([cat, rows]) => {
      const key = sh.key + '|' + cat;
      const on = rows.filter(([r]) => r.on).length;
      return `<div class="cat ${collapsed.has(key) ? 'collapsed' : ''}" data-cat="${esc(cat)}">
        <div class="cat-head" data-act="toggle" data-key="${esc(key)}"><span class="chev">▾</span><h3>${esc(cat || 'Ohne Kategorie')}</h3><span class="count">${on}/${rows.length} aktiv</span>
          <button class="btn small" data-act="catall" data-v="${on === rows.length ? 'off' : 'on'}">${on === rows.length ? 'Kategorie aus' : 'Kategorie an'}</button></div>
        <div class="cat-body">${rows.map(([r, i]) => reqRow(r, i)).join('')}</div></div>`;
    }).join('') : '<div class="empty card">Keine Anforderungen passen zu den Filtern.</div>';
    $('#catList').innerHTML = [...new Set(sh.reqs.map(r => r.cat))].map(c => `<option value="${esc(c)}">`).join('');
  }
  function rerenderRow(rowEl, sh) {
    const i = +rowEl.dataset.idx;
    rowEl.outerHTML = reqRow(sh.reqs[i], i);
    renderTabs();
  }
  $('#reqList').addEventListener('click', e => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const sh = curSheet();
    const act = a.dataset.act;
    if (act === 'toggle' && !e.target.closest('button')) {
      const k = a.dataset.key;
      collapsed.has(k) ? collapsed.delete(k) : collapsed.add(k);
      a.parentElement.classList.toggle('collapsed');
      return;
    }
    if (act === 'catall') {
      e.stopPropagation();
      const cat = a.closest('.cat').dataset.cat;
      sh.reqs.forEach(r => { if (r.cat === cat && visibleModule(r.module)) r.on = a.dataset.v === 'on'; });
      renderReqs(); save(); return;
    }
    const rowEl = a.closest('.req');
    if (!rowEl) return;
    const r = sh.reqs[+rowEl.dataset.idx];
    if (act === 'prio') {
      r.prio = a.dataset.v;
      if (!r.wManual) r.weight = WEIGHT[r.prio];
      rerenderRow(rowEl, sh); save();
    } else if (act === 'edit') {
      const span = a;
      const ta = document.createElement('textarea');
      ta.value = r.desc; ta.rows = Math.max(2, Math.ceil(r.desc.length / 90));
      span.replaceWith(ta); ta.focus();
      ta.addEventListener('blur', () => { r.desc = ta.value.trim() || r.desc; rerenderRow(rowEl, sh); save(); });
    } else if (act === 'addnote') {
      r._noteOpen = true; rerenderRow(rowEl, sh);
      $(`.req[data-idx="${rowEl.dataset.idx}"] .note-in`)?.focus();
    } else if (act === 'del') {
      if (confirm('Eigene Anforderung löschen?')) { sh.reqs.splice(+rowEl.dataset.idx, 1); renderReqs(); save(); }
    }
  });
  $('#reqList').addEventListener('change', e => {
    const a = e.target.closest('[data-act]');
    const rowEl = e.target.closest('.req');
    if (!a || !rowEl) return;
    const sh = curSheet(), r = sh.reqs[+rowEl.dataset.idx];
    if (a.dataset.act === 'on') { r.on = a.checked; rerenderRow(rowEl, sh); }
    if (a.dataset.act === 'status') { r.status = a.value; rerenderRow(rowEl, sh); }
    if (a.dataset.act === 'weight') { r.weight = Math.max(0, +a.value || 0); r.wManual = r.weight !== WEIGHT[r.prio]; a.classList.toggle('manual', r.wManual); }
    if (a.dataset.act === 'note') { r.note = a.value.trim(); delete r._noteOpen; }
    save();
  });
  $('#sheetTabs').addEventListener('click', e => {
    const b = e.target.closest('[data-sheet]');
    if (b) { S.sheetSel = b.dataset.sheet; renderReqs(); save(); }
  });
  $('#sheetSummary').addEventListener('click', e => {
    const b = e.target.closest('[data-bulk]');
    if (!b) return;
    curSheet().reqs.forEach(r => { if (visibleModule(r.module)) r.on = b.dataset.bulk === 'on'; });
    renderReqs(); save();
  });
  ['#reqSearch', '#fPrio', '#fStatus', '#fOn'].forEach(s => $(s).addEventListener('input', renderReqs));
  $('#fStatus').innerHTML += STATUS.map(s => `<option value="${s.key}">${s.label}</option>`).join('');
  $('#btnAddReq').addEventListener('click', () => {
    const desc = $('#newDesc').value.trim();
    if (!desc) { $('#newDesc').focus(); return; }
    const sh = curSheet();
    const prefix = (sh.reqs.find(r => !r.custom)?.id || 'X').split('-')[0];
    const n = sh.reqs.filter(r => r.custom).length + 1;
    const prio = $('#newPrio').value;
    const cat = $('#newCat').value.trim() || 'Ergänzende Anforderungen';
    const module = S.modules.R && !S.modules.P ? 'R' : !S.modules.R && S.modules.P ? 'P' : 'A';
    sh.reqs.push({ id: `${prefix}-Z${String(n).padStart(2, '0')}`, cat, desc, prio, weight: WEIGHT[prio], status: 'offen', note: '', module, on: true, custom: true, wManual: false });
    $('#newDesc').value = '';
    renderReqs(); save();
    $('#reqList .req:last-of-type')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });

  // ---------------------------------------------------------------- step 4
  function renderRoiInputs() {
    const inp = S.roi.inputs;
    $('#roiModules').innerHTML = [['bm', 'Bewerbermanagement einrechnen'], ['pa', 'Digitale Personalakte einrechnen']].map(([k, l]) =>
      `<label class="check"><input type="checkbox" data-roimod="${k}" ${inp[k] ? 'checked' : ''}><span>${l}</span></label>`).join('');
    $('#roiInputs').innerHTML = ROI_FIELDS.map(f => {
      if (f.mod && !inp[f.mod]) return '';
      if (f.sep) return `<div class="sep">${f.sep}</div>`;
      return `<label class="field"><span>${f.label}</span><input type="number" min="0" step="${f.step}" data-roi="${f.k}" value="${inp[f.k] ?? 0}"></label>` + (f.hint ? `<p class="hint" style="margin:-4px 0 8px">${f.hint}</p>` : '');
    }).join('');
    $('#lohnHint').textContent = D.roi.lohnHint;
  }
  function renderRoiProcs() {
    const inp = S.roi.inputs;
    const calc = roiCalc();
    $('#roiProcs').innerHTML = ['bm', 'pa'].filter(m => inp[m]).map(mod => `
      <h3 class="mt">${mod === 'bm' ? 'Bewerbermanagement' : 'Digitale Personalakte'}</h3>
      ${S.roi.items[mod].map((g, gi) => `<div class="proc-group"><h3>${esc(g.name)}</h3><div class="table-scroll"><table>
        <thead><tr><th style="width:28px"></th><th>Prozess</th><th class="num">Min. heute</th><th class="num">Min. digital</th><th class="num">Vorgänge p.a.</th><th>Bezugsgröße</th><th class="num">Ersparnis p.a.</th></tr></thead>
        <tbody>${g.items.map((it, ii) => `<tr class="${it.on ? '' : 'off'}" data-p="${mod}.${gi}.${ii}" ${it.desc ? `title="${esc(it.desc)}"` : ''}>
          <td><input type="checkbox" data-pf="on" ${it.on ? 'checked' : ''} aria-label="${esc(it.name)} einrechnen"></td>
          <td>${esc(it.name)}</td>
          <td class="num"><input class="mini" type="number" min="0" step="1" data-pf="cur" value="${it.cur}"></td>
          <td class="num"><input class="mini" type="number" min="0" step="1" data-pf="dig" value="${it.dig}"></td>
          <td class="num">${num0.format(it._qty)}</td>
          <td class="hint" style="margin:0">${esc(it.def)}</td>
          <td class="num" data-eur>${eur0.format(it._eur)}</td></tr>`).join('')}</tbody></table></div></div>`).join('')}`).join('');
    return calc;
  }
  function renderRoiResults(calc) {
    const c = calc || roiCalc();
    const last = c.years[5];
    $('#roiKpis').innerHTML = `
      <div class="kpi hero"><div class="label">Einsparung pro Jahr</div><div class="value">${eur0.format(c.savePa)}</div><div class="sub">ab dem 2. Jahr</div></div>
      <div class="kpi"><div class="label">Gewonnene Arbeitszeit</div><div class="value">${num0.format(c.hours)} h</div><div class="sub">≈ ${num1.format(c.fte)} Vollzeitstellen (1.600 h/Jahr)</div></div>
      <div class="kpi"><div class="label">Break-even</div><div class="value">${c.be ? (c.be <= 12 ? c.be + ' Mon.' : num1.format(c.be / 12) + ' Jahre') : '–'}</div><div class="sub">${c.be ? 'nach Monat ' + c.be : 'innerhalb von 6 Jahren nicht erreicht'}</div></div>
      <div class="kpi"><div class="label">Nettonutzen nach 6 Jahren</div><div class="value ${last.delta < 0 ? 'neg' : ''}">${eur0.format(last.delta)}</div><div class="sub">ROI ${num0.format(c.roi6 * 100)} %</div></div>`;
    Charts.lineChart($('#roiLine'), c.years.map(r => r.y + '. Jahr'), [
      { name: 'Einsparungen kumuliert', color: 'var(--series-1)', values: c.years.map(r => r.cumSave), fmt: v => eur0.format(v) },
      { name: 'Kosten kumuliert', color: 'var(--series-2)', values: c.years.map(r => r.cumCost), fmt: v => eur0.format(v) },
    ], {
      fmtAxis: v => v >= 1000 ? num0.format(v / 1000) + ' T€' : num0.format(v) + ' €',
      marker: c.be && c.be <= 72 ? { x: Math.max(0, (c.be / 12 - 1) / 5), label: 'Break-even' } : null,
      extraTip: i => `<div class="tt-row"><span>Saldo</span><b class="${c.years[i].delta < 0 ? 'neg' : 'pos'}">${eur0.format(c.years[i].delta)}</b></div>`,
      aria: 'Kumulierte Kosten und Einsparungen über 6 Jahre',
    });
    $('#roiTable').innerHTML = `<div class="table-scroll"><table class="mt"><thead><tr><th></th>${c.years.map(r => `<th class="num">${r.y}. Jahr</th>`).join('')}</tr></thead><tbody>
      <tr><td>Kosten p.a.</td>${c.years.map(r => `<td class="num">${eur0.format(r.cost)}</td>`).join('')}</tr>
      <tr><td>Einsparung p.a.</td>${c.years.map(r => `<td class="num">${eur0.format(r.save)}</td>`).join('')}</tr>
      <tr><td><strong>Saldo kumuliert</strong></td>${c.years.map(r => `<td class="num ${r.delta < 0 ? 'neg' : 'pos'}"><strong>${eur0.format(r.delta)}</strong></td>`).join('')}</tr></tbody></table></div>`;
    Charts.barList($('#roiBars'), c.groups.filter(g => g.eur > 0).sort((a, b) => b.eur - a.eur)
      .map(g => ({ label: g.name, value: g.eur, sub: `${num0.format(g.min / 60)} Stunden p.a. · ${g.mod === 'bm' ? 'Bewerbermanagement' : 'Personalakte'}` })),
    { fmt: v => eur0.format(v), seriesName: 'Einsparung p.a.', aria: 'Einsparung pro Prozessbereich' });
    return c;
  }
  function renderRoi() { renderRoiInputs(); renderRoiResults(renderRoiProcs()); }
  $('#roiInputs').addEventListener('input', e => {
    const k = e.target.dataset.roi;
    if (!k) return;
    S.roi.inputs[k] = e.target.value === '' ? 0 : +e.target.value;
    const calc = renderRoiProcs();
    renderRoiResults(calc); save();
  });
  $('#roiModules').addEventListener('change', e => {
    const k = e.target.dataset.roimod;
    S.roi.inputs[k] = e.target.checked;
    renderRoi(); save();
  });
  $('#roiProcs').addEventListener('change', e => {
    const tr = e.target.closest('tr[data-p]'); const f = e.target.dataset.pf;
    if (!tr || !f) return;
    const [m, g, i] = tr.dataset.p.split('.');
    const it = S.roi.items[m][+g].items[+i];
    if (f === 'on') it.on = e.target.checked; else it[f] = Math.max(0, +e.target.value || 0);
    const calc = renderRoiProcs();
    renderRoiResults(calc); save();
  });

  // ---------------------------------------------------------------- step 5 report
  function renderReport() {
    const sheets = S.sheets.filter(sheetVisible);
    const all = sheets.flatMap(activeReqs);
    const st = stats(all);
    const c = roiCalc();
    const pct = (a, b) => b ? Math.round(a / b * 100) + ' %' : '–';
    const mods = [S.modules.R && 'Bewerbermanagement', S.modules.P && 'Personalmanagement'].filter(Boolean).join(' + ');
    $('#report').innerHTML = `
      <div class="card">
        <div class="report-head"><div><div class="kicker">Lastenheft · ${esc(mods)}</div><h2>${esc(S.meta.kunde || 'Kunde noch nicht angegeben')}</h2></div>
          <div class="meta">Version ${esc(S.meta.version)} · ${S.meta.datum ? new Date(S.meta.datum).toLocaleDateString('de-DE') : ''}<br>${esc(S.meta.status)}${S.meta.bearbeiter ? ' · ' + esc(S.meta.bearbeiter) : ''}</div></div>
        <div class="kpis">
          <div class="kpi"><div class="label">Anforderungen</div><div class="value">${st.n}</div><div class="sub">in ${sheets.length} Kapiteln</div></div>
          <div class="kpi"><div class="label">davon MUSS</div><div class="value">${st.muss}</div><div class="sub">${st.n - st.muss} SOLL / KANN</div></div>
          <div class="kpi hero"><div class="label">MUSS-Kriterien durch BITE erfüllt</div><div class="value">${pct(st.mussOk, st.muss)}</div><div class="sub">${st.mussOk} von ${st.muss}</div></div>
          <div class="kpi"><div class="label">Gewichteter Erfüllungsgrad</div><div class="value">${pct(st.wGot, st.wMax)}</div><div class="sub">${st.st.offen ? st.st.offen + ' Anforderungen noch nicht bewertet' : 'alle bewertet'}</div></div>
        </div>
        <h3 class="section">BITE-Erfüllung nach Kapitel</h3>
        <div id="repBars" class="chart"></div>
        ${S.roi.inputs.bm || S.roi.inputs.pa ? `
        <h3 class="section roi-sec">Wirtschaftlichkeit (ROI)</h3>
        <div class="kpis">
          <div class="kpi hero"><div class="label">Einsparung pro Jahr</div><div class="value">${eur0.format(c.savePa)}</div><div class="sub">ab dem 2. Jahr</div></div>
          <div class="kpi"><div class="label">Gewonnene Arbeitszeit</div><div class="value">${num0.format(c.hours)} h</div><div class="sub">≈ ${num1.format(c.fte)} Vollzeitstellen</div></div>
          <div class="kpi"><div class="label">Break-even</div><div class="value">${c.be ? (c.be <= 12 ? c.be + ' Mon.' : num1.format(c.be / 12) + ' Jahre') : '–'}</div><div class="sub">${c.be ? 'nach Monat ' + c.be : 'nicht innerhalb von 6 Jahren'}</div></div>
          <div class="kpi"><div class="label">Nettonutzen nach 6 Jahren</div><div class="value">${eur0.format(c.years[5].delta)}</div><div class="sub">ROI ${num0.format(c.roi6 * 100)} %</div></div>
        </div>
        <div class="report-grid"><div><div id="repLine" class="chart"></div></div><div><div id="repRoiBars" class="chart"></div></div></div>` : ''}
        <h3 class="section">Abgewählte Anforderungen</h3>
        <p class="hint">Abgewählt als nicht relevant: ${sheets.map(sh => sh.reqs.filter(r => visibleModule(r.module) && !r.on).length).reduce((a, b) => a + b, 0)} · Eigene Anforderungen ergänzt: ${sheets.flatMap(sh => sh.reqs.filter(r => r.custom && r.on)).length}</p>
      </div>`;
    Charts.stackedBars($('#repBars'), sheets.map(sh => {
      const s = stats(activeReqs(sh));
      return { label: SHORT_TITLE[sh.key] || sh.title, segments: STATUS.map(x => ({ key: x.key, value: s.st[x.key] })) };
    }), STATUS.map(s => ({ key: s.key, label: s.label, color: s.color })), { labelW: 190, aria: 'BITE-Erfüllung nach Kapitel' });
    if ($('#repLine')) {
      Charts.lineChart($('#repLine'), c.years.map(r => r.y + '. J.'), [
        { name: 'Einsparungen kumuliert', color: 'var(--series-1)', values: c.years.map(r => r.cumSave), fmt: v => eur0.format(v) },
        { name: 'Kosten kumuliert', color: 'var(--series-2)', values: c.years.map(r => r.cumCost), fmt: v => eur0.format(v) },
      ], { fmtAxis: v => v >= 1000 ? num0.format(v / 1000) + ' T€' : num0.format(v) + ' €', marker: c.be ? { x: Math.max(0, (c.be / 12 - 1) / 5), label: 'Break-even' } : null });
      Charts.barList($('#repRoiBars'), c.groups.filter(g => g.eur > 0).sort((a, b) => b.eur - a.eur).slice(0, 8)
        .map(g => ({ label: g.name, value: g.eur })), { fmt: v => eur0.format(v), seriesName: 'Einsparung p.a.', labelW: 250 });
    }
  }

  // ---------------------------------------------------------------- global actions
  $('#stepper').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) go(+b.dataset.go); });
  $('#btnPrev').addEventListener('click', () => go(S.step - 1));
  $('#btnNext').addEventListener('click', () => {
    if (S.step === 1 && !S.meta.kunde.trim()) { $('[data-bind="meta.kunde"]').focus(); $('[data-bind="meta.kunde"]').reportValidity?.(); alert('Bitte zuerst den Kunden angeben.'); return; }
    go(S.step + 1);
  });
  $('#btnReset').addEventListener('click', () => {
    if (!confirm('Alle Eingaben verwerfen und mit der Vorlage neu beginnen?')) return;
    S = freshState(); try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ }
    init();
  });
  $('#btnSave').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    download(blob, `Lastenheft-Entwurf_${slug(S.meta.kunde)}.json`);
  });
  $('#btnLoad').addEventListener('click', () => $('#fileLoad').click());
  $('#fileLoad').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const obj = JSON.parse(await f.text());
      if (obj.v !== 1 || !obj.sheets) throw new Error('format');
      S = obj; init();
    } catch (err) { alert('Die Datei ist kein gültiger Lastenheft-Entwurf.'); }
    e.target.value = '';
  });
  // charts are drawn at real pixel width, so lay the report out at A4 width before printing
  function preparePrint() { $('#report').style.width = '688px'; renderReport(); }
  function restorePrint() { $('#report').style.width = ''; if (S.step === 5) renderReport(); }
  window.addEventListener('beforeprint', preparePrint);
  window.addEventListener('afterprint', restorePrint);
  $('#btnPrint').addEventListener('click', () => window.print());
  document.addEventListener('change', e => { if (e.target.name === 'variant') { S.variant = e.target.value; save(); } });

  function slug(s) { return (s || 'Kunde').replace(/[^\wäöüÄÖÜß-]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'Kunde'; }
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function init() {
    renderStep1(); renderStake(); renderTopMeta();
    $$('input[name=variant]').forEach(r => { r.checked = r.value === (S.variant || 'neutral'); });
    go(S.step || 1);
  }

  let rz;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => { if (S.step === 4) renderRoiResults(); if (S.step === 5) renderReport(); }, 150);
  });

  window.LV = { get state() { return S; }, STATUS, ST, DRIVERS, visibleModule, sheetVisible, activeReqs, stats, roiCalc, fillText, slug, download };
  init();
})();
