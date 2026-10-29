/* Excel export (ExcelJS): Lastenheft sheets, evaluation with live formulas, optional ROI calculator. */
(function () {
  const BRAND = 'FF0F2F57', BRAND_LIGHT = 'FFE8F1FC', LINE = 'FFD9D8D2', GREY = 'FF8A8984';
  const SHORT = {
    rec: 'Funktional Recruiting', per: 'Funktional Personal', nfa: 'Nicht-funktional', ta: 'Technik', ra: 'Recht & Compliance',
    si: 'Schnittstellen', ki: 'KI', sec: 'Sicherheit', se: 'Service & Implementierung',
  };
  const STATUS_LABEL = { erfuellt: 'Erfüllt', aufpreis: 'Gegen Aufpreis', teilweise: 'Teilweise', nicht: 'Nicht erfüllt', offen: 'Offen' };
  const STATUS_FILL = { 'Erfüllt': 'FFD7F0D7', 'Gegen Aufpreis': 'FFFDEFC8', 'Teilweise': 'FFFBE0D3', 'Nicht erfüllt': 'FFF6D3D3' };
  const q = name => `'${name.replace(/'/g, "''")}'`;
  const border = { top: { style: 'thin', color: { argb: LINE } }, bottom: { style: 'thin', color: { argb: LINE } }, left: { style: 'thin', color: { argb: LINE } }, right: { style: 'thin', color: { argb: LINE } } };

  function header(ws, cols) {
    ws.columns = cols.map(c => ({ header: c.h, key: c.k, width: c.w }));
    const row = ws.getRow(1);
    row.height = 30;
    row.eachCell(c => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
      c.alignment = { vertical: 'middle', wrapText: true };
      c.border = border;
    });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }
  function styleBody(ws, from, to, ncol) {
    for (let r = from; r <= to; r++) {
      const row = ws.getRow(r);
      for (let c = 1; c <= ncol; c++) {
        const cell = row.getCell(c);
        cell.border = border;
        cell.alignment = { vertical: 'top', wrapText: true, ...(cell.alignment || {}) };
      }
    }
  }
  function sectionRow(ws, r, text, ncol) {
    const row = ws.getRow(r);
    row.getCell(1).value = text;
    for (let c = 1; c <= ncol; c++) {
      row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_LIGHT } };
      row.getCell(c).font = { bold: true, color: { argb: BRAND } };
      row.getCell(c).border = border;
    }
  }

  async function exportXlsx() {
    const L = window.LV, S = L.state;
    const msg = document.getElementById('exportMsg');
    if (!window.ExcelJS) { msg.textContent = 'Die Excel-Bibliothek lädt noch, bitte gleich erneut versuchen.'; return; }
    const bite = (document.querySelector('input[name=variant]:checked') || {}).value === 'bite';
    const withRoi = document.getElementById('optRoi').checked;
    const withOff = document.getElementById('optOff').checked;
    msg.textContent = 'Excel-Datei wird erstellt …';

    const wb = new ExcelJS.Workbook();
    wb.creator = 'BITE GmbH';
    wb.created = new Date();
    const mods = [S.modules.R && 'Bewerbermanagement', S.modules.P && 'Personalmanagement'].filter(Boolean);
    const softwareLabel = S.modules.R && S.modules.P ? 'Bewerbermanagement- und Personalmanagementsoftware' : S.modules.R ? 'Bewerbermanagementsoftware' : 'Personalmanagementsoftware';
    const sheets = S.sheets.filter(L.sheetVisible);
    const chapters = ['Einleitung & Projektziel', 'Stakeholder & Rollen', ...sheets.map(s => s.title)];
    if (S.modules.R) chapters.push('Prozesse & Workflows');
    chapters.push('Auswertung');
    const roiOn = withRoi && (S.roi.inputs.bm || S.roi.inputs.pa);
    if (roiOn) chapters.push('ROI-Rechner (Eingabe, Prozesse, ROI-Rechnung)');

    // ---- Deckblatt
    const cover = wb.addWorksheet('Deckblatt', { properties: { tabColor: { argb: BRAND } } });
    cover.columns = [{ width: 30 }, { width: 90 }];
    cover.mergeCells('A1:B1');
    cover.getCell('A1').value = 'Lastenheft ' + softwareLabel;
    cover.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
    cover.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
    cover.getCell('A1').alignment = { vertical: 'middle', indent: 1 };
    cover.getRow(1).height = 42;
    const datum = S.meta.datum ? new Date(S.meta.datum) : new Date();
    const coverRows = [
      ['Dokument-Typ', 'Lastenheft (Anforderungsspezifikation)'],
      ['Projekt', softwareLabel.replace('software', 'software') + ' – Auswahl'],
      ['Auftraggeber', S.meta.kunde],
      ['Ansprechpartner', S.meta.ansprechpartner],
      ['Version', S.meta.version],
      ['Datum', datum.toLocaleDateString('de-DE')],
      ['Status', S.meta.status],
      ['Erstellt durch', 'BITE GmbH' + (S.meta.bearbeiter ? ' – ' + S.meta.bearbeiter : '')],
      ['Auftragnehmer (Consultant)', 'BITE GmbH (Business IT Engineers)'],
      ['Module', mods.join(', ')],
      ['Zusammenfassung', `Dieses Lastenheft fasst alle Anforderungen an eine neue ${softwareLabel} zusammen. Es kombiniert die Anforderungen an Sicherheit, Recht, Technik und Service des Anbieters mit den funktionalen Merkmalen der Software.`],
      ['Dokumentkonventionen', 'MUSS = Pflichtanforderung (nicht verhandelbar) · SOLL = Wunschanforderung (hohe Priorität) · KANN = optionale Anforderung. Gewichtung: MUSS 10, SOLL 5, KANN 2 (sofern nicht abweichend festgelegt).'],
    ];
    if (!bite) coverRows.push(['Hinweis für Anbieter', 'Bitte füllen Sie je Anforderung die Spalten „Erfüllung Anbieter“ (Auswahlliste) und „Anmerkung Anbieter“ aus. Das Blatt „Auswertung“ berechnet den Erfüllungsgrad automatisch.']);
    let r = 3;
    coverRows.forEach(([k, v]) => {
      cover.getCell(`A${r}`).value = k; cover.getCell(`A${r}`).font = { bold: true, color: { argb: BRAND } };
      cover.getCell(`B${r}`).value = v || ''; cover.getCell(`B${r}`).alignment = { wrapText: true, vertical: 'top' };
      cover.getCell(`A${r}`).alignment = { vertical: 'top' };
      r++;
    });
    r++;
    cover.getCell(`A${r}`).value = 'Struktur des Dokuments'; cover.getCell(`A${r}`).font = { bold: true, color: { argb: BRAND } };
    chapters.forEach((c, i) => { cover.getCell(`B${r + i}`).value = `${i + 1}. ${c}`; });

    // ---- Einleitung
    const intro = wb.addWorksheet('1 Einleitung');
    header(intro, [{ h: 'Abschnitt', w: 28 }, { h: 'Inhalt', w: 110 }]);
    S.intro.forEach((it, i) => {
      let text = L.fillText(it.text);
      if (/Zeitplan/.test(it.title)) {
        const z = S.meta.zeitplan;
        text = `• Ausschreibung / Marktanalyse: ${z.markt}\n• Anbieterbewertung / Demo: ${z.demo}\n• Vertragsabschluss: ${z.vertrag}\n• Go-Live: ${z.golive}`;
      }
      intro.addRow([`${i + 1}. ${it.title}`, text]);
    });
    styleBody(intro, 2, intro.rowCount, 2);
    intro.getColumn(1).font = { bold: true };

    // ---- Stakeholder
    const sk = wb.addWorksheet('2 Stakeholder');
    header(sk, [{ h: 'ID', w: 8 }, { h: 'Rolle / Stakeholder', w: 30 }, { h: 'Typ', w: 16 }, { h: 'Beschreibung / Verantwortlichkeit', w: 60 }, { h: 'System-Berechtigungen', w: 45 }]);
    S.stake.filter(s => s.on && L.visibleModule(s.module)).forEach(s => sk.addRow([s.id, s.role, s.type, s.desc, s.perm]));
    styleBody(sk, 2, sk.rowCount, 5);

    // ---- Anforderungen
    const evalRows = [];
    sheets.forEach((sh, si) => {
      const name = `${si + 3} ${SHORT[sh.key] || sh.title}`.slice(0, 31);
      const ws = wb.addWorksheet(name);
      header(ws, [
        { h: 'ID', w: 9 }, { h: 'Kategorie', w: 24 }, { h: 'Beschreibung', w: 70 }, { h: 'Priorität', w: 10 }, { h: 'Gewichtung', w: 11 },
        { h: bite ? 'BITE-Status' : 'Erfüllung Anbieter', w: 16 }, { h: bite ? 'BITE-Anmerkung' : 'Anmerkung Anbieter', w: 40 }, { h: 'Punkte', w: 9 },
      ]);
      const rows = sh.reqs.filter(x => L.visibleModule(x.module) && (x.on || withOff));
      rows.forEach((x, i) => {
        const rr = i + 2;
        const st = bite ? STATUS_LABEL[x.status] : '';
        const w = x.on ? x.weight : 0;
        const sc = { 'Erfüllt': 1, 'Gegen Aufpreis': 1, 'Teilweise': 0.5 }[st] || 0;
        const row = ws.addRow([x.id, x.cat, x.desc, x.on ? x.prio : 'entfällt', w, st, bite ? x.note : '',
          { formula: `IF(OR(F${rr}="Erfüllt",F${rr}="Gegen Aufpreis"),E${rr},IF(F${rr}="Teilweise",E${rr}/2,0))`, result: w * sc }]);
        if (!x.on) row.font = { color: { argb: GREY }, italic: true };
        if (x.on && x.prio === 'MUSS') row.getCell(4).font = { bold: true };
      });
      const last = Math.max(2, rows.length + 1);
      styleBody(ws, 2, last, 8);
      ws.getColumn(5).alignment = { horizontal: 'center', vertical: 'top' };
      ws.getColumn(8).alignment = { horizontal: 'center', vertical: 'top' };
      ws.autoFilter = { from: 'A1', to: `H${last}` };
      ws.dataValidations.add(`D2:D${last + 50}`, { type: 'list', allowBlank: true, formulae: ['"MUSS,SOLL,KANN,entfällt"'] });
      ws.dataValidations.add(`F2:F${last + 50}`, { type: 'list', allowBlank: true, formulae: ['"Erfüllt,Gegen Aufpreis,Teilweise,Nicht erfüllt,Offen"'] });
      ws.addConditionalFormatting({
        ref: `F2:F${last + 50}`,
        rules: Object.entries(STATUS_FILL).map(([t, color], i) => ({ type: 'expression', priority: i + 1, formulae: [`$F2="${t}"`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: color } } } })),
      });
      const act = rows.filter(x => x.on);
      const res = { n: act.length, muss: act.filter(x => x.prio === 'MUSS').length, max: act.reduce((a, x) => a + x.weight, 0) };
      res.mussOk = bite ? act.filter(x => x.prio === 'MUSS' && (x.status === 'erfuellt' || x.status === 'aufpreis')).length : 0;
      res.got = bite ? act.reduce((a, x) => a + x.weight * ({ erfuellt: 1, aufpreis: 1, teilweise: 0.5 }[x.status] || 0), 0) : 0;
      evalRows.push({ name, title: sh.title, end: last + 50, res });
    });

    // ---- Prozesse
    if (S.modules.R) {
      const pw = wb.addWorksheet(`${sheets.length + 3} Prozesse`);
      const cols = [{ h: 'Prozess', w: 24 }, { h: 'Schritt', w: 26 }, { h: 'Nr.', w: 6 }, { h: 'Beschreibung', w: 60 }, { h: 'Beteiligte Rollen', w: 30 }, { h: 'Systemunterstützung', w: 36 }];
      if (bite) cols.push({ h: 'BITE-Anmerkung', w: 34 });
      header(pw, cols);
      window.LV_DATA.processes.forEach(p => pw.addRow([p.proc, p.step, p.nr, p.desc, p.roles, p.support, ...(bite ? [p.bite] : [])]));
      styleBody(pw, 2, pw.rowCount, cols.length);
    }

    // ---- Auswertung
    const ev = wb.addWorksheet('Auswertung', { properties: { tabColor: { argb: 'FF2A78D6' } } });
    header(ev, [{ h: 'Kapitel', w: 44 }, { h: 'Anforderungen', w: 15 }, { h: 'davon MUSS', w: 12 }, { h: 'MUSS erfüllt', w: 13 }, { h: 'Max. Punkte', w: 13 }, { h: 'Erreichte Punkte', w: 16 }, { h: 'Erfüllungsgrad', w: 15 }]);
    evalRows.forEach((e, i) => {
      const rr = i + 2, n = q(e.name), E = e.end;
      ev.addRow([
        e.title,
        { formula: `COUNTIFS(${n}!A2:A${E},"<>",${n}!D2:D${E},"<>entfällt")`, result: e.res.n },
        { formula: `COUNTIF(${n}!D2:D${E},"MUSS")`, result: e.res.muss },
        { formula: `COUNTIFS(${n}!D2:D${E},"MUSS",${n}!F2:F${E},"Erfüllt")+COUNTIFS(${n}!D2:D${E},"MUSS",${n}!F2:F${E},"Gegen Aufpreis")`, result: e.res.mussOk },
        { formula: `SUM(${n}!E2:E${E})`, result: e.res.max },
        { formula: `SUM(${n}!H2:H${E})`, result: e.res.got },
        { formula: `IF(E${rr}=0,0,F${rr}/E${rr})`, result: e.res.max ? e.res.got / e.res.max : 0 },
      ]);
    });
    const tr = evalRows.length + 2, sum = (col, key) => ({ formula: `SUM(${col}2:${col}${tr - 1})`, result: evalRows.reduce((a, e) => a + e.res[key], 0) });
    const totGot = evalRows.reduce((a, e) => a + e.res.got, 0), totMax = evalRows.reduce((a, e) => a + e.res.max, 0);
    ev.addRow(['Gesamt', sum('B', 'n'), sum('C', 'muss'), sum('D', 'mussOk'), sum('E', 'max'), sum('F', 'got'), { formula: `IF(E${tr}=0,0,F${tr}/E${tr})`, result: totMax ? totGot / totMax : 0 }]);
    styleBody(ev, 2, tr, 7);
    ev.getRow(tr).font = { bold: true };
    ev.getColumn(7).numFmt = '0%';
    ev.addRow([]);
    ev.addRow(['Punkte: Erfüllt und Gegen Aufpreis = volle Gewichtung, Teilweise = halbe Gewichtung, Nicht erfüllt / Offen = 0. MUSS-Kriterien sind unabhängig vom Erfüllungsgrad K.-o.-Kriterien.']);
    ev.mergeCells(`A${tr + 2}:G${tr + 2}`);
    ev.getCell(`A${tr + 2}`).alignment = { wrapText: true };
    ev.getRow(tr + 2).height = 32;
    ev.getCell(`A${tr + 2}`).font = { italic: true, color: { argb: GREY } };

    if (roiOn) addRoi(wb, S, L);

    const buf = await wb.xlsx.writeBuffer();
    const file = `Lastenheft_${L.slug(S.meta.kunde)}_${bite ? 'mit-BITE-Erfuellung' : 'neutral'}_${(S.meta.datum || '').replace(/-/g, '')}.xlsx`;
    L.download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), file);
    msg.textContent = `„${file}“ wurde heruntergeladen.`;
  }

  function addRoi(wb, S, L) {
    const inp = S.roi.inputs;
    const calc = L.roiCalc();
    const eurFmt = '#,##0.00 "€"', eurFmt0 = '#,##0 "€"';
    const IN = q('ROI Eingabe');
    const ein = wb.addWorksheet('ROI Eingabe', { properties: { tabColor: { argb: 'FFEB6834' } } });
    header(ein, [{ h: 'Kennzahl', w: 46 }, { h: 'Wert', w: 16 }, { h: 'Hinweis', w: 60 }]);
    const rows = [
      ['Mitarbeitende', +inp.ma], ['Admin-Zugänge', +inp.admins], ['Jährliche Lizenzkosten', +inp.lizenz, '', eurFmt],
      ['Einmalige Projekt- und Einrichtungskosten', +inp.setup, '', eurFmt], ['Stundenmittellohn HR', +inp.lohn, window.LV_DATA.roi.lohnHint, eurFmt],
      ['Stellenausschreibungen p.a.', +inp.stellen], ['Bewerbungen pro Verfahren', +inp.bewProVerf],
      ['Bewerbungseingänge p.a.', { formula: 'B7*B8', result: inp.stellen * inp.bewProVerf }, 'berechnet'],
      ['Neueinstellungen p.a.', +inp.neueinst], ['Abgänge p.a.', +inp.abgaenge], ['Anzahl Abteilungen', +inp.abteilungen],
      ['Bewerbermanagement einrechnen', !!inp.bm, 'WAHR / FALSCH'], ['Digitale Personalakte einrechnen', !!inp.pa, 'WAHR / FALSCH'],
      ['Einsparung im 1. Jahr (% vom Folgejahr)', +inp.year1pct || 0, 'Erfahrungsgemäß zehren Lernkurve und Ersteinrichtung im 1. Jahr die Zeitersparnis auf (Standard 0 %).'],
    ];
    rows.forEach(([k, v, h, fmt]) => { const row = ein.addRow([k, v, h || '']); if (fmt) row.getCell(2).numFmt = fmt; });
    styleBody(ein, 2, ein.rowCount, 3);
    ein.getColumn(2).font = { bold: true, color: { argb: 'FF1C5CAB' } };
    const CELL = { ma: 'B2', stellen: 'B7', bewerbungen: 'B9', neueinst: 'B10', abgaenge: 'B11', abteilungen: 'B12' };

    const totals = {};
    [['bm', 'ROI Bewerbermanagement'], ['pa', 'ROI Personalakte']].forEach(([mod, name]) => {
      if (!inp[mod]) return;
      const ws = wb.addWorksheet(name);
      header(ws, [{ h: 'Prozess', w: 46 }, { h: 'Beschreibung', w: 60 }, { h: 'Min. heute', w: 11 }, { h: 'Min. digital', w: 11 }, { h: 'Vorgänge p.a.', w: 13 }, { h: 'Bezugsgröße', w: 34 }, { h: 'Einbezogen', w: 11 }, { h: 'Zeitersparnis min p.a.', w: 14 }, { h: 'Kostenersparnis € p.a.', w: 16 }]);
      let rr = 2;
      const dataRows = [];
      S.roi.items[mod].forEach(g => {
        sectionRow(ws, rr, g.name, 9); rr++;
        g.items.forEach(it => {
          const qty = it.driver === 'const' ? it.factor : { formula: `${IN}!${CELL[it.driver]}${it.factor !== 1 ? '*' + it.factor : ''}`, result: it._qty };
          const min = it.on ? it._min : 0;
          ws.getRow(rr).values = [it.name, it.desc, it.cur, it.dig, qty, it.def, it.on ? 'Ja' : 'Nein',
            { formula: `IF(G${rr}="Ja",(C${rr}-D${rr})*E${rr},0)`, result: min },
            { formula: `H${rr}/60*${IN}!$B$6`, result: min / 60 * calc.lohn }];
          ws.getRow(rr).getCell(9).numFmt = eurFmt;
          ws.getRow(rr).getCell(5).numFmt = '#,##0';
          dataRows.push(rr); rr++;
        });
      });
      const totMin = calc.groups.filter(g => g.mod === mod).reduce((a, g) => a + g.min, 0);
      ws.getRow(rr).values = ['Gesamt', 'wird in „ROI-Rechnung“ übertragen', '', '', '', '', '', { formula: `SUM(H2:H${rr - 1})`, result: totMin }, { formula: `SUM(I2:I${rr - 1})`, result: totMin / 60 * calc.lohn }];
      ws.getRow(rr).font = { bold: true };
      ws.getRow(rr).getCell(9).numFmt = eurFmt;
      styleBody(ws, 2, rr, 9);
      ws.dataValidations.add(`G2:G${rr - 1}`, { type: 'list', allowBlank: false, formulae: ['"Ja,Nein"'] });
      totals[mod] = { ref: `${q(name)}!I${rr}`, flag: mod === 'bm' ? `${IN}!B13` : `${IN}!B14`, val: totMin / 60 * calc.lohn };
    });

    const ws = wb.addWorksheet('ROI-Rechnung', { properties: { tabColor: { argb: 'FFEB6834' } } });
    ws.columns = [{ width: 30 }, ...Array(6).fill({ width: 15 })];
    ws.getRow(1).values = ['', '1. Jahr', '2. Jahr', '3. Jahr', '4. Jahr', '5. Jahr', '6. Jahr'];
    ws.getRow(1).eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }; c.border = border; });
    ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
    const savExpr = Object.values(totals).map(t => `IF(${t.flag},${t.ref},0)`).join('+') || '0';
    const cols = ['B', 'C', 'D', 'E', 'F', 'G'];
    const labels = ['Kosten p.a.', 'Kosten kumuliert', 'Einsparung p.a.', 'Einsparung kumuliert', 'Saldo kumuliert'];
    labels.forEach((l, i) => { ws.getCell(`A${i + 2}`).value = l; ws.getCell(`A${i + 2}`).font = { bold: true }; });
    calc.years.forEach((y, i) => {
      const c = cols[i], p = cols[i - 1];
      ws.getCell(`${c}2`).value = { formula: i === 0 ? `${IN}!B4+${IN}!B5` : `${IN}!B4`, result: y.cost };
      ws.getCell(`${c}3`).value = { formula: i === 0 ? `${c}2` : `${p}3+${c}2`, result: y.cumCost };
      ws.getCell(`${c}4`).value = { formula: i === 0 ? `(${savExpr})*${IN}!B15/100` : `${savExpr}`, result: y.save };
      ws.getCell(`${c}5`).value = { formula: i === 0 ? `${c}4` : `${p}5+${c}4`, result: y.cumSave };
      ws.getCell(`${c}6`).value = { formula: `${c}5-${c}3`, result: y.delta };
    });
    for (let rr = 2; rr <= 6; rr++) for (const c of cols) { ws.getCell(`${c}${rr}`).numFmt = eurFmt0; }
    styleBody(ws, 2, 6, 7);
    ws.getRow(6).font = { bold: true };
    ws.addConditionalFormatting({ ref: 'B6:G6', rules: [
      { type: 'cellIs', operator: 'lessThan', formulae: [0], priority: 1, style: { font: { color: { argb: 'FFD03B3B' } } } },
      { type: 'cellIs', operator: 'greaterThanOrEqual', formulae: [0], priority: 2, style: { font: { color: { argb: 'FF006300' } } } },
    ] });
    ws.getCell('A8').value = 'Kennzahlen';
    ws.getCell('A8').font = { bold: true, color: { argb: BRAND } };
    const kp = [
      ['Einsparung pro Jahr (ab 2. Jahr)', { formula: 'C4', result: calc.savePa }, eurFmt0],
      ['Gewonnene Arbeitszeit p.a. (Stunden)', { formula: `C4/${IN}!B6`, result: calc.hours }, '#,##0'],
      ['ROI nach 6 Jahren', { formula: 'IF(G3=0,0,G6/G3)', result: calc.roi6 }, '0%'],
    ];
    kp.forEach(([k, v, f], i) => { ws.getCell(`A${9 + i}`).value = k; ws.getCell(`B${9 + i}`).value = v; ws.getCell(`B${9 + i}`).numFmt = f; });
    ws.getCell('A13').value = 'Werte in „ROI Eingabe“ (blau) und die Zeitansätze in den Prozessblättern können angepasst werden. Alle Ergebnisse rechnen automatisch neu.';
    ws.mergeCells('A13:G13');
    ws.getCell('A13').font = { italic: true, color: { argb: GREY } };
  }

  document.getElementById('btnXlsx').addEventListener('click', () => {
    exportXlsx().catch(err => { console.error(err); document.getElementById('exportMsg').textContent = 'Export fehlgeschlagen: ' + err.message; });
  });
  window.LVExport = { exportXlsx };
})();
