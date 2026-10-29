"""Extract LV + ROI source workbooks into app data (data.js) and log every cleanup change."""
import json, re, sys
import openpyxl

S = sys.argv[1]  # scratchpad dir
lv = openpyxl.load_workbook(f'{S}/src/lv.xlsx')
roi = openpyxl.load_workbook(f'{S}/src/roi.xlsx')
changes = []  # (bereich, id, änderung)

def log(area, rid, what):
    changes.append({'bereich': area, 'id': rid, 'aenderung': what})

def clean(s):
    if s is None:
        return ''
    s = str(s).replace('\r', '').strip()
    s = re.sub(r'[ \t]+', ' ', s)
    return s

WEIGHT = {'MUSS': 10, 'SOLL': 5, 'KANN': 2}

def status_of(raw):
    raw = clean(raw)
    if not raw:
        return 'offen', ''
    low = raw.lower()
    if raw == 'Erfüllt':
        return 'erfuellt', ''
    if raw.startswith('->BITE:'):
        return 'teilweise', raw.replace('->BITE:', '').strip()
    if 'aufpreis' in low or 'kostenpflichtig' in low:
        note = re.sub(r'^Erfüllt\s*[\(–-]?\s*', '', raw).rstrip(')').strip()
        return 'aufpreis', note
    if raw.startswith('Erfüllt'):
        note = re.sub(r'^Erfüllt\s*[\(–-]?\s*', '', raw).rstrip(')').strip()
        return 'erfuellt', note
    if raw.startswith('KI-Unterstützung kann optional'):
        return 'erfuellt', raw
    return 'offen', raw

REC_IDS = {'NFA-02', 'NFA-15', 'TA-05', 'TA-07', 'TA-10', 'RA-01', 'RA-02', 'RA-03', 'RA-06', 'RA-07', 'RA-08', 'RA-09',
           'RA-11', 'RA-12', 'RA-13', 'RA-15', 'RA-17', 'SA-02', 'SA-05', 'SA-14', 'FA-02', 'FA-05', 'FA-14'} | \
          {f'SI-{n:02d}' for n in list(range(2, 11)) + list(range(12, 18))}
# note: Sicherheit rows still carry their original FA-xx ids at tagging time
REC = re.compile(r'Bewerb|Stellen|Jobbörs|Multiposting|Karriere|Talentpool|CV|Lebenslauf|Chatbot|WhatsApp|Whatsup|'
                 r'Sanktions|Agentur|bund\.de|Social Media|Recruiting|Kandidat|AGG|Scanner|Interamt|Indeed', re.I)

# --- text fixes: (sheet key, original id) -> {field: (old, new)} ---------------------------------
FIX = {
    ('rec', 'FA-66'): {'desc': 'Schnittstellen zur Überführung der Unterlagen in eine spätere Personalakte (sofern die Personalakte nicht im selben System geführt wird)'},
    ('rec', 'FA-73'): {'desc': 'Möglichkeit einer Volltextsuche in Dokumenten.'},
    ('rec', 'FA-74'): {'desc': 'Möglichkeit einer Volltextsuche über alle Dokumente innerhalb des Systems.'},
    ('per', 'FP-03'): {'desc': 'Individuelle zusätzliche Datenfelder müssen durch den Kunden selbst ergänzt werden können. Als Datenfeldtypen müssen alle gängigen Typen wie Freitext, Select, Multiselect, Kalender, E-Mail, URL, Telefon usw. auswählbar sein.'},
    ('per', 'FP-06'): {'desc': 'Aktive, ruhende und ausgeschiedene Mitarbeitende müssen unterscheidbar sein. Weitere Kategorien (z.B. Ehrenamt, FSJ, Azubis usw.) müssen frei definiert und ergänzt werden können.'},
    ('per', 'FP-17'): {'desc': 'Möglichkeit einer Volltextsuche in Dokumenten innerhalb einer Akte.'},
    ('per', 'FP-18'): {'desc': 'Möglichkeit einer Volltextsuche über Dokumente in vorgefilterten Mitarbeiterbereichen bzw. über alle Mitarbeitenden innerhalb des Systems.'},
    ('per', 'FP-29'): {'desc': 'Unterschiedliche Signaturniveaus sollen unterstützt werden können (Einfache, Fortgeschrittene und Qualifizierte Elektronische Signatur).'},
    ('per', 'FP-43'): {'desc': 'Aufgaben müssen vordefinierten Personen oder Bereichen zugewiesen werden können.'},
    ('per', 'FP-50'): {'desc': 'Aufgaben müssen in Blöcken/Kategorien erzeugt und ausscheidenden Mitarbeitenden bzw. internen Verantwortlichen für die Umsetzung zugewiesen werden können.'},
    ('per', 'FP-52'): {'desc': 'Aufgaben müssen vordefinierten Personen oder Bereichen zugewiesen werden können.'},
    ('per', 'FP-57'): {'desc': 'Unterschiedliche Offboardingprozesse (Kündigung, altersbedingtes Ausscheiden usw.) müssen hinterlegt werden können.'},
    ('nfa', 'NFA-16'): {'desc': 'Optional: kostenpflichtiges BI-Tool (z.B. Qlik) für erweiterte Auswertungen', 'prio': 'KANN'},
    ('nfa', 'NFA-19'): {'desc': 'Referenzkunden in vergleichbarer Unternehmensgröße und Branche'},
    ('ta', 'TA-24'): {'cat': 'Individualisierung', 'desc': 'Durch den Kunden selbst ergänzbare Felder: Multiselect, Singleselect, Datum, Zahl'},
    ('ta', 'TA-25'): {'desc': 'Alle Dateiformate ohne Größenbeschränkung'},
    ('si', 'SI-16'): {'desc': 'Schnittstelle zur Übergabe von Bewerbungsunterlagen in die spätere Personalakte (sofern die Personalakte nicht im selben System geführt wird)'},
    ('sec', 'FA-14'): {'cat': 'WhatsApp', 'desc': 'Kommunikation über WhatsApp auf anbietereigenen Business-Servern'},
}
DROP = {('per', 'FP-120'): 'Gestrichen: doppelt zu FP-07 („Ruhende Arbeitsverhältnisse“), dort mit Priorität MUSS statt SOLL'}

def apply_fix(key, oid, row, area):
    f = FIX.get((key, oid))
    if not f:
        return
    for k, v in f.items():
        if row.get(k) != v:
            label = {'desc': 'Beschreibung', 'cat': 'Kategorie', 'prio': 'Priorität'}[k]
            log(area, oid, f'{label} korrigiert: „{row.get(k)}“ → „{v}“')
            row[k] = v

def finish(row, area, oid, raw_weight):
    if row['prio'] not in WEIGHT:
        row['prio'] = 'MUSS'
    w = WEIGHT[row['prio']]
    row['weight'] = w
    if not raw_weight:
        log(area, oid, f'Fehlende Gewichtung ergänzt ({w})')
    return row

sheets = []

def req_sheet(key, title, ws, module, idcol=0, catcol=1, desccol=2, priocol=3, statcol=5, weightcol=4,
              prefix=None, id_map=None, extra_desc=None):
    reqs = []
    last_id = None
    sub = 0
    for r in ws.iter_rows(min_row=2, values_only=True):
        r = list(r) + [None] * 10
        desc = clean(r[desccol])
        if not desc:
            continue
        oid = clean(r[idcol])
        if extra_desc is not None:
            fn = clean(r[extra_desc])
            desc = f'{fn}: {desc}' if fn else desc
        row = {'cat': clean(r[catcol]), 'desc': desc, 'prio': clean(r[priocol]).upper()}
        if (key, oid) in DROP:
            log(title, oid, DROP[(key, oid)])
            continue
        apply_fix(key, oid, row, title)
        raw_w = r[weightcol] if weightcol is not None else 'n/a'
        st, note = status_of(r[statcol] if statcol is not None else None)
        if not oid:
            if key == 'rec' and last_id:
                sub += 1
                nid = f'{last_id}{"abc"[sub - 1]}'
                row['cat'] = row['cat'] or prev_cat
                row['prio'] = row['prio'] or prev_prio
                log(title, nid, f'Unterpunkt ohne ID zu „{last_id}“ erhielt eigene ID {nid}, Kategorie und Priorität übernommen')
                oid_new = nid
            else:
                oid_new = None  # assigned later
        else:
            sub = 0
            last_id = oid
            oid_new = oid
        prev_cat, prev_prio = row['cat'], row['prio']
        row['id'] = oid_new
        row['_oid'] = oid
        row['status'] = st
        row['note'] = note
        if module == 'auto':
            row['module'] = 'R' if oid in REC_IDS else 'A'
        else:
            row['module'] = module
        finish(row, title, oid_new or '(neu)', raw_w)
        reqs.append(row)
    # ID normalisation
    if prefix:
        n = 0
        for row in reqs:
            n += 1
            nid = f'{prefix}-{n:02d}'
            if row['id'] != nid:
                log(title, nid, f'ID vereinheitlicht: „{row["id"] or "ohne ID"}“ → {nid}')
                row['id'] = nid
    for row in reqs:
        row.pop('_oid', None)
    sheets.append({'key': key, 'title': title, 'reqs': reqs})

ws = lv.worksheets
req_sheet('rec', 'Funktionale Anforderungen Recruiting', ws[3], 'R')
req_sheet('per', 'Funktionale Anforderungen Personalmanagement', ws[4], 'P')
req_sheet('nfa', 'Nicht-funktionale Anforderungen', ws[5], 'auto', statcol=4, weightcol=None)
req_sheet('ta', 'Technische Anforderungen', ws[6], 'auto', statcol=4, weightcol=None, prefix='TA')
req_sheet('ra', 'Rechtliche Anforderungen & Compliance', ws[7], 'auto', statcol=4, weightcol=None)
req_sheet('si', 'Schnittstellen & Integrationen', ws[9], 'auto', statcol=4, weightcol=None)
req_sheet('ki', 'KI-Anforderungen', ws[10], 'R', catcol=2, desccol=3, priocol=4, weightcol=5, statcol=6)
req_sheet('sec', 'Sicherheit', ws[11], 'auto', priocol=3, weightcol=4, statcol=5, prefix='SA')
req_sheet('se', 'Service & Implementierung', ws[12], 'A', priocol=3, weightcol=None, statcol=4, prefix='SE')

# fix category typos everywhere
for sh in sheets:
    for r in sh['reqs']:
        if r['cat'] == 'Allgmein':
            r['cat'] = 'Allgemein'
            log(sh['title'], r['id'], 'Kategorie „Allgmein“ → „Allgemein“')
        if r['note'] == 'Public APII':
            r['note'] = 'Public API'
            log(sh['title'], r['id'], 'BITE-Anmerkung „Public APII“ → „Public API“')
        if r['cat'] == 'Whatsup':
            r['cat'] = 'WhatsApp'

# KI: category is the function name already in desc -> use "KI – Recruiting" style category
for r in next(s for s in sheets if s['key'] == 'ki')['reqs']:
    fn, _, d = r['desc'].partition(': ')
    r['cat'], r['desc'] = fn, d
log('KI-Anforderungen', 'alle', 'Spalten „Herkunft“ und „KI-Funktion“ zu einheitlicher Spalte „Kategorie“ zusammengeführt')
log('Sicherheit', 'alle', 'Vertauschte Spalten „Typ“ (MUSS) und „Priorität“ (10) korrigiert: jetzt Priorität = MUSS, Gewichtung = 10')
log('Service & Implementierung', 'alle', 'Spalte „Typ“ in „Priorität“ umbenannt, 22 Zeilen ohne ID erhielten IDs SE-08 bis SE-29')
log('Alle Anforderungsblätter', 'alle', 'Einheitliche Spalten: ID, Kategorie, Beschreibung, Priorität, Gewichtung, BITE-Status, BITE-Anmerkung')
log('Alle Anforderungsblätter', 'alle', 'Gewichtung systematisiert: MUSS = 10, SOLL = 5, KANN = 2 (vorher überall 10, damit wirkungslos). In der App je Zeile änderbar')
log('Alle Anforderungsblätter', 'alle', 'BITE-Status normalisiert auf Erfüllt / Gegen Aufpreis / Teilweise / Nicht erfüllt / Offen, Erläuterungen in eigene Spalte „BITE-Anmerkung“')

# --- Stakeholder -----------------------------------------------------------------------------
stake = []
for r in ws[2].iter_rows(min_row=2, values_only=True):
    if not clean(r[0]):
        continue
    s = {'id': clean(r[0]), 'role': clean(r[1]), 'type': clean(r[2]), 'desc': clean(r[3]), 'perm': clean(r[4])}
    if s['id'] == 'S-04':
        s['perm'] = s['perm'].replace('Mitarbeiterinformarmationen', 'Mitarbeiterinformationen')
        log('Stakeholder & Rollen', 'S-04', 'Tippfehler „Mitarbeiterinformarmationen“ korrigiert')
    if s['id'] == 'S-06':
        s['desc'] = 'Einsicht und Verwaltung eigener Daten, meldet Datenänderungen, startet Anträge, Einsicht in die eigene Akte'
        s['perm'] = 'Zugriff auf eigenen Stammsatz (eingeschränkt)'
        log('Stakeholder & Rollen', 'S-06', 'Mehrere Tippfehler korrigiert („Eisnicht“, „DAtenänderungen“, „Zugriiff“)')
    s['module'] = {'S-05': 'R', 'S-06': 'P', 'S-12': 'R'}.get(s['id'], 'A')
    stake.append(s)

# --- Einleitung ------------------------------------------------------------------------------
intro = []
for r in ws[1].iter_rows(min_row=2, values_only=True):
    if clean(r[0]):
        intro.append({'title': re.sub(r'^\d+\.\s*', '', clean(r[0])), 'text': str(r[1] or '').strip()})
for it in intro:
    if 'XXX' in it['text']:
        it['text'] = it['text'].replace('XXX', '{{kunde}}')
        log('Einleitung & Projektziel', 'Ausgangssituation', 'Platzhalter „XXX“ wird automatisch durch den Kundennamen ersetzt')
    if 'Mailsystems XX' in it['text']:
        it['text'] = it['text'].replace('Mailsystems XX', 'Mailsystems {{mailsystem}}')
        log('Einleitung & Projektziel', 'Projektumfang', 'Platzhalter „XX“ (Mailsystem) wird durch Eingabefeld ersetzt')
    it['text'] = re.sub(r'[ \t]+\n', '\n', it['text'])
log('Deckblatt', '-', 'Interne Notiz „Vorschlag HUbert“ entfernt, Datum wird automatisch gesetzt, Inhaltsverzeichnis passt sich den gewählten Modulen an')

# --- Prozesse ---------------------------------------------------------------------------------
procs = []
for r in ws[8].iter_rows(min_row=2, values_only=True):
    if clean(r[0]):
        st, note = status_of(r[5]) if str(r[5] or '').startswith('->BITE') else ('', '')
        procs.append({'proc': clean(r[0]), 'step': clean(r[1]), 'nr': int(r[2]) if r[2] else None,
                      'desc': clean(r[3]), 'roles': clean(r[4]),
                      'support': 'Notizen / Beteiligungsrolle' if note else clean(r[5]), 'bite': note})
log('Prozesse & Workflows', 'Betriebsratsanhörung', 'Interne BITE-Notiz aus „Systemunterstützung“ in BITE-Anmerkung verschoben (erscheint nur im Export mit BITE-Erfüllung)')

# --- ROI ----------------------------------------------------------------------------------------
DRV = {'C7': 'stellen', 'C10': 'neueinst', 'C11': 'abgaenge', 'C2': 'ma', 'C12': 'abteilungen'}
def parse_qty(v):
    if isinstance(v, (int, float)):
        return 'const', float(v)
    v = str(v).replace("'Eingabe der Daten'!", '').lstrip('=')
    m = re.fullmatch(r'C8\*C7(?:\*([\d.]+))?', v)
    if m:
        return 'bewerbungen', float(m.group(1) or 1)
    m = re.fullmatch(r'(C\d+)(?:\*([\d.]+))?', v)
    if m:
        return DRV[m.group(1)], float(m.group(2) or 1)
    raise ValueError(v)

roi_mod = {}
for name, key in (('Bewerbermanagement', 'bm'), ('Personalakte', 'pa')):
    groups = []
    for r in roi[name].iter_rows(min_row=2, values_only=True):
        a = clean(r[0])
        if not a or a.startswith('Gesamt'):
            continue
        if r[2] is None:
            groups.append({'name': a, 'items': []})
            continue
        drv, fac = parse_qty(r[4])
        groups[-1]['items'].append({'name': a, 'desc': clean(r[1]), 'cur': float(r[2]), 'dig': float(r[3]),
                                    'driver': drv, 'factor': fac, 'def': clean(r[5]).replace('\n', ' ')})
    roi_mod[key] = groups
for it in [i for g in roi_mod['pa'] for i in g['items']]:
    if it['name'].startswith('Wilkommensmail'):
        it['name'] = 'Willkommensmail und Willkommenstasche'
        log('ROI-Rechner', 'Personalakte', 'Tippfehler „Wilkommensmail und Wilkommenbag“ korrigiert')
log('ROI-Rechner', 'Nachforderung fehlender Unterlagen', 'Formelfehler behoben: Zeile hatte keine Ersparnis-Formel und floss nicht in die Summe ein (+650 € p.a. im Beispiel)')
log('ROI-Rechner', 'alle', 'Spalte H „Zeitersparnis manuell“ gestrichen (floss in keine Berechnung ein)')

ein = roi['Eingabe der Daten']
roi_inputs = {'ma': ein['C2'].value, 'admins': ein['C3'].value, 'lizenz': ein['C4'].value, 'setup': ein['C5'].value,
              'lohn': ein['C6'].value, 'stellen': ein['C7'].value, 'bewProVerf': ein['C8'].value,
              'neueinst': ein['C10'].value, 'abgaenge': ein['C11'].value, 'abteilungen': ein['C12'].value,
              'bm': bool(ein['G4'].value), 'pa': bool(ein['G5'].value)}
lohn_hint = clean(ein['B14'].value)

data = {'sheets': sheets, 'stakeholders': stake, 'intro': intro, 'processes': procs,
        'roi': {'modules': roi_mod, 'inputs': roi_inputs, 'lohnHint': lohn_hint}}
with open(f'{S}/build/data.json', 'w') as f:
    json.dump(data, f, ensure_ascii=False, indent=1)
with open(f'{S}/build/changes.json', 'w') as f:
    json.dump(changes, f, ensure_ascii=False, indent=1)

from collections import Counter
for sh in sheets:
    print(sh['key'], len(sh['reqs']), Counter(r['status'] for r in sh['reqs']), Counter(r['module'] for r in sh['reqs']), Counter(r['prio'] for r in sh['reqs']))
print('changes', len(changes), 'stake', len(stake), 'procs', len(procs), 'roi', {k: sum(len(g['items']) for g in v) for k, v in roi_mod.items()})
