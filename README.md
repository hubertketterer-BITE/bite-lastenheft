# BITE Lastenheft & ROI

Internes Web-Tool für BITE-Mitarbeitende: Lastenheft für Bewerber- und Personalmanagementsoftware vorausfüllen, ROI berechnen und als .xlsx herunterladen.

- Statische Seite (kein Build), gehostet auf Vercel.
- `middleware.js` schützt die Seite per Passwort (Umgebungsvariable `SITE_PASSWORD` im Vercel-Projekt).
- `data.js` enthält die bereinigten Inhalte aus den Google Sheets; erzeugt mit `tools/extract.py`.
