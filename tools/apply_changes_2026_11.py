"""Änderungsrunde 2026-11 (Feedback BITE-Testrunde) auf data.js anwenden.

Einmalig ausführen:  python3 tools/apply_changes_2026_11.py
Schreibt data.js neu und ergänzt eine idMap (alte ID -> neue ID) für die Migration
gespeicherter Entwürfe.
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / 'data.js'
src = DATA.read_text(encoding='utf-8')
d = json.loads(src[src.index('{'):src.rindex('}') + 1])
assert 'idMap' not in d, 'Änderungen wurden bereits angewendet'

W = {'MUSS': 10, 'SOLL': 5, 'KANN': 2}
sheets = {sh['key']: sh for sh in d['sheets']}
id_map = {}


def req(rid, cat, desc, module, prio='MUSS', status='erfuellt', note=''):
    return {'cat': cat, 'desc': desc, 'prio': prio, 'id': rid, 'status': status, 'note': note, 'module': module, 'weight': W[prio]}


def find(key, rid):
    return next(r for r in sheets[key]['reqs'] if r['id'] == rid)


def insert_after_cat(key, cat, rows):
    reqs = sheets[key]['reqs']
    last = max(i for i, r in enumerate(reqs) if r['cat'] == cat)
    reqs[last + 1:last + 1] = rows


def insert_after_id(key, rid, rows):
    reqs = sheets[key]['reqs']
    i = next(i for i, r in enumerate(reqs) if r['id'] == rid)
    reqs[i + 1:i + 1] = rows


# ------------------------------------------------------------ Einleitung
nutzen = next(i for i in d['intro'] if i['title'] == 'Erwarteter Nutzen')
nutzen['text'] += ('\n• Transparenz über alle Bewerber- und Mitarbeitendendaten: alle Daten zentral an einem Ort'
                   '\n• Einhaltung von Compliance-Vorgaben durch standardisierte Prozesse quer durch das Unternehmen'
                   '\n• Einbindung von Führungskräften und Mitarbeitenden in die Personalprozesse, mit Sicht auf stets aktuelle Daten')
for i in d['intro']:
    i['text'] = i['text'].replace('HR, Fachabteilungen, Betriebsrat, Geschäftsleitung', 'HR, Fachabteilungen, Betriebsrat / Personalvertretung, Geschäftsleitung')
    if i['title'] == 'Beteiligte Abteilungen':
        i['text'] = 'HR-Abteilung, Fachabteilungen, Geschäftsleitung, Betriebsrat / Personalvertretung, Schwerbehindertenvertretung, Ausbildung, IT-Abteilung, Datenschutz, Einkauf'

# ------------------------------------------------------------ Stakeholder
st = {s['id']: s for s in d['stakeholders']}
st['S-02'].update(role='Fachabteilung / Fachabteilungsleitung',
                  desc='Stellt Stellenanträge, sichtet und bewertet Bewerbungen, trifft Auswahlentscheidungen und betreut und entwickelt die Mitarbeitenden; gibt Rückmeldung workflowgestützt an HR',
                  perm='Lese- und Bewertungszugriff für zugewiesene Stellen, Bewerbungen und Mitarbeitende')
st['S-04']['role'] = 'Betriebsrat / Personalvertretung'
st['S-10'].update(role='Schwerbehindertenvertretung',
                  desc='Nimmt die Beteiligungsrechte nach § 178 SGB IX wahr: Einsicht in Bewerbungen schwerbehinderter und gleichgestellter Menschen, Teilnahme an Vorstellungsgesprächen, Beteiligung bei personellen Maßnahmen schwerbehinderter Beschäftigter (z. B. BEM)',
                  perm='Lesezugriff auf Bewerbungen schwerbehinderter bzw. gleichgestellter Bewerbender und auf die relevanten Mitarbeiterinformationen; Kommentierungsfunktion (konfigurierbar)')
new_st = {
    'AUS': {'role': 'Ausbilder / Ausbildungsleitung', 'type': 'Anwendergruppe',
            'desc': 'Verantwortlich für die Auswahl von Auszubildenden und dual Studierenden sowie für Betreuung, Ausbildungsplanung und Beurteilungen während der Ausbildung',
            'perm': 'Lese- und Bewertungszugriff für Ausbildungsstellen und deren Bewerbungen; Zugriff auf Daten und Dokumente der zugeordneten Auszubildenden', 'module': 'A'},
    'IT': {'role': 'IT', 'type': 'Systemrolle',
           'desc': 'Technische Ansprechpartner für Einführung und Betrieb: Single Sign-On, Schnittstellen, E-Mail- und Kalenderanbindung sowie IT-Sicherheit; unterstützt die Administratoren',
           'perm': 'Zugriff auf technische Konfiguration und Schnittstellen; kein Zugriff auf Bewerber- und Personaldaten (konfigurierbar)', 'module': 'A'},
    'FUH': {'role': 'Fuhrparkmanager/-in', 'type': 'Anwendergruppe',
            'desc': 'Verantwortlich für Dienstfahrzeuge und deren Überlassung sowie für die regelmäßige Führerscheinkontrolle der Mitarbeitenden',
            'perm': 'Zugriff auf Fuhrpark- und Führerscheindaten der berechtigten Mitarbeitenden (eingeschränkt)', 'module': 'P'},
    'DS': {'role': 'Datenschutzbeauftragte/-r', 'type': 'Systemrolle',
           'desc': 'Überwacht die Einhaltung der DSGVO: Löschfristen, Einwilligungen, Auskunftsersuchen, Rollen- und Rechtekonzept sowie Protokollierung',
           'perm': 'Lesezugriff auf Datenschutzeinstellungen, Löschprotokolle und Auswertungen; kein Zugriff auf Inhalte von Bewerbungen und Personalakten (konfigurierbar)', 'module': 'A'},
}
order = ['S-01', 'S-02', 'S-03', 'S-04', 'S-05', 'S-06', 'AUS', 'FUH', 'S-07', 'IT', 'S-08', 'S-10', 'S-11', 'DS', 'S-12']
stake = []
for n, k in enumerate(order, 1):
    s = dict(st[k]) if k in st else dict(new_st[k])
    s['id'] = f'S-{n:02d}'
    stake.append({'id': s['id'], 'role': s['role'], 'type': s['type'], 'desc': s['desc'], 'perm': s['perm'], 'module': s['module']})
d['stakeholders'] = stake
for p in d['processes']:
    p['roles'] = p['roles'].replace('Fachabteilungsleiter', 'Fachabteilungsleitung').replace('Betriebsrat', 'Betriebsrat / Personalvertretung')

# ------------------------------------------------------------ Allgemeine funktionale Anforderungen
GEN = [  # (Kategorie im Personalmanagement, neue Kategorie)
    ('Aufgabenmanagement', 'Aufgabenmanagement'),
    ('Reporting & Auswertungen', 'Reporting, Berichte und Auswertungen'),
    ('Digitale Personalakte & Dokumentenmanagement', 'Dokumentenmanagement'),
    ('Dokumentenerstellung', 'Dokumentenerstellung (Verträge)'),
    ('Elektronische Signatur', 'Elektronische Signatur'),
    ('Onlineformulare', 'Onlineformulare / Ergänzungsanfragen'),
    ('Kommunikation', 'Kommunikation'),
    ('Administration & Konfiguration', 'Administration & Konfiguration'),
]
WORDING = {  # Formulierungen für Bewerber- und Personalbereich verallgemeinern
    'FP-08': 'Dokumente müssen direkt der jeweiligen Bewerber- bzw. Mitarbeiterakte zugeordnet werden können.',
    'FP-09': 'Dokumentkategorien bzw. Aktenregister müssen individuell definiert werden können.',
    'FP-16': 'Vorlagen sollen mit vorhandenen Bewerber- bzw. Mitarbeiterdaten automatisiert befüllt werden können.',
    'FP-18': 'Möglichkeit einer Volltextsuche über Dokumente in vorgefilterten Bereichen bzw. über alle Bewerbenden und Mitarbeitenden innerhalb des Systems.',
    'FP-20': 'Bewerber- und Personaldaten müssen automatisiert in Vorlagen (z. B. Verträge) übernommen werden können.',
    'FP-23': 'Serienbriefe bzw. Dokumente für mehrere Personen sollen erzeugt werden können (Massenbearbeitung).',
    'FP-129': 'E-Mails bzw. Nachrichten sollen aus Bewerber- und Personalprozessen heraus erzeugt werden können.',
    'FP-131': 'Bewerber- bzw. Mitarbeiterdaten sollen automatisiert in Kommunikationsvorlagen übernommen werden können.',
}
per = sheets['per']
gen_reqs = []
for old_cat, new_cat in GEN:
    for r in [r for r in per['reqs'] if r['cat'] == old_cat]:
        n = dict(r, cat=new_cat, module='A', id=f'AF-{len(gen_reqs) + 1:02d}')
        if r['id'] in WORDING:
            n['desc'] = WORDING[r['id']]
        id_map[r['id']] = n['id']
        gen_reqs.append(n)
moved = {c for c, _ in GEN}
per['reqs'] = [r for r in per['reqs'] if r['cat'] not in moved]
gen = {'key': 'gen', 'title': 'Allgemeine funktionale Anforderungen', 'reqs': gen_reqs}
d['sheets'].insert(0, gen)
sheets['gen'] = gen

# ------------------------------------------------------------ Personalmanagement
insert_after_cat('per', 'Einstellungsprozess', [
    req('FP-153', 'Einstellungsprozess', 'Bewerberdokumente müssen bei der Einstellung automatisch in die digitale Personalakte übernommen werden können.', 'P'),
    req('FP-154', 'Einstellungsprozess', 'Online-Formulare, z. B. für Daten-Ergänzungsanfragen vor dem Eintritt, müssen an neue Mitarbeitende versendet werden können.', 'P'),
])
insert_after_cat('per', 'Onboarding', [
    req('FP-152', 'Onboarding', 'On- und Offboarding-Vorlagen müssen je Berufsgruppe hinterlegt werden können.', 'P'),
])

# ------------------------------------------------------------ Recruiting
rec = sheets['rec']
find('rec', 'FA-47')['desc'] = 'Beurteilungsmöglichkeit und interne Kommunikation: Kommentierungsmöglichkeit und workflow-gestützte Kommunikation zwischen HR und Fachabteilungen'
find('rec', 'FA-56')['desc'] = 'Kalenderintegration: Planung von Vorstellungsgesprächen mit Ansicht freier Terminslots; Einladungen an Bewerbende und Beteiligte (u. a. per iCal)'
insert_after_id('rec', 'FA-01', [
    req('FA-95', 'Stellenausschreibung', 'Stellenantrag: Fachabteilungen beantragen Stellen digital; workflowgestützte Freigabe vor Erstellung der Ausschreibung', 'R'),
])
insert_after_id('rec', 'FA-09', [
    req('FA-96', 'Stellenausschreibung', 'Rechte pro Stellenausschreibung: Zugriffs- und Bearbeitungsrechte können je Stellenausschreibung individuell vergeben werden', 'R'),
])
insert_after_id('rec', 'FA-15', [
    req('FA-97', 'Stellenausschreibung', 'Anbieterbereinigte Karriereseite: Karriereseite und Stellenanzeigen erscheinen ohne Hinweise auf den Softwareanbieter', 'R'),
])
insert_after_id('rec', 'FA-22', [
    req('FA-98', 'Bewerbungsformular', 'Bewerbungsmöglichkeiten je Stellenanzeige festlegbar: per WhatsApp, Online-Formular und/oder E-Mail', 'R'),
])
insert_after_cat('rec', 'Bewerbungsverwaltung', [
    req('FA-99', 'Bewerbungsverwaltung', 'Ansichten können ohne IT-Kenntnisse individuell auf die eigenen Workflows angepasst werden', 'R'),
])
insert_after_id('rec', 'FA-48', [
    req('FA-100', 'Kommunikation', 'Alle ein- und ausgehenden E-Mails laufen über einen integrierten, zentralen E-Mail-Client', 'R'),
])
insert_after_id('rec', 'FA-75', [
    req('FA-101', 'Talentpool', 'Beliebig viele, voneinander getrennte Talentpools (z. B. je Berufsgruppe oder Standort)', 'R'),
])
for r in rec['reqs']:
    if r['cat'] == 'Bewerbermanagement & Übergang zum Mitarbeiter':
        r['cat'] = 'Onboarding'
# Spiegel des Onboarding-Bereichs aus dem Personalmanagement; nur sichtbar, wenn nur Recruiting gewählt ist
mirror = []
for r in [r for r in per['reqs'] if r['cat'] == 'Onboarding']:
    mirror.append(dict(r, id=f'FA-{102 + len(mirror)}', cat='Onboarding', module='RO'))
insert_after_cat('rec', 'Onboarding', mirror)

# ------------------------------------------------------------ Technik
sheets['ta']['reqs'] = [r for r in sheets['ta']['reqs'] if r['id'] != 'TA-08']
find('ta', 'TA-12')['desc'] = 'Kalenderintegration (iCal) inkl. Ansicht freier Terminslots'
insert_after_id('ta', 'TA-17', [
    req('TA-24', 'Single Sign-On', 'Single Sign-On (SSO) über den zentralen Identitätsanbieter der Organisation (z. B. Microsoft Entra ID via SAML 2.0 oder OpenID Connect)', 'A'),
])

# ------------------------------------------------------------ Schnittstellen
find('si', 'SI-04')['desc'] = 'stepstone.de, indeed.com (kostenfreie Anbindung), xing.de, interamt.de, bund.de u.a.'
find('si', 'SI-09')['desc'] = 'Kalendereinladungen an Bewerbende und Kolleginnen/Kollegen via iCal; Ansicht freier Terminslots'

# ------------------------------------------------------------ KI (Beschreibung steht hier in der Kategorie-Spalte)
sheets['ki']['reqs'].append(req('KI-11', 'Jobposting Optimizer: KI-gestützte Optimierung des Designs von Stellenausschreibungen', '', 'R'))

# ------------------------------------------------------------ Sicherheit
find('sec', 'SA-02')['desc'] = find('sec', 'SA-02')['desc'].replace('Betriebsrat ', 'Betriebsrat bzw. Personalvertretung ', 1)
insert_after_id('sec', 'SA-12', [
    req('SA-25', 'Mehrmandantenfähigkeit', 'Mehrere Gesellschaften bzw. Mandanten können in einem System getrennt verwaltet werden (getrennte Daten, Rollen und Rechte)', 'A'),
])

# ------------------------------------------------------------ Service & Implementierung
find('se', 'SE-20')['desc'] = 'Ein persönlicher Ansprechpartner soll im Projekt fest benannt werden und den Kunden durchgängig begleiten.'
find('se', 'SE-24')['desc'] = 'Dokumentationen, Anleitungen und umfangreiche Schulungsvideos sollen bereitgestellt werden.'

d['idMap'] = id_map
d['dataVersion'] = 2
DATA.write_text('window.LV_DATA = ' + json.dumps(d, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
print('ok', {sh['key']: len(sh['reqs']) for sh in d['sheets']}, len(d['stakeholders']), 'Rollen')
