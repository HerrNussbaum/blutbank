# blutbank · Bluthelden-Regelarchiv

Ein zweisprachiges, statisches Nachschlagewerk nach dem Dokumentationsprinzip der CAS-Seite: Kapitel links, Regeltext in der Mitte, Inhaltsverzeichnis rechts. Auf kleinen Bildschirmen wird die Kapitelnavigation eingeklappt. Es gibt keine Datenbank und keine Laufzeit-Abhängigkeiten.

## Inhalte pflegen

| Datei | Inhalt |
| --- | --- |
| `content/rules-de.md` | Deutsche Regeln, aus der bereitgestellten PDF übernommen; Tabellen für die Website formatiert |
| `content/rules-en.md` | Nicht autorisierte englische Übersetzung aller nummerierten Abschnitte, teilweise sprachlich gestrafft |
| `content/glossary.tsv` | Zweisprachige, redaktionelle Erläuterungen der Anhänge und weitere zentrale Begriffe |
| `content/cards.json` | Kartenabbildungen, Namen, Gruppen, Quellen und vorhandene Hinweise |
| `dist/app.js` | Navigation, Suche, automatische Verknüpfungen und Kartenansicht |
| `dist/style.css` | Farben, Schrift und responsive Darstellung |

Nach einer Änderung an Inhalten im Projektordner ausführen:

```sh
python3 scripts/build_content.py
node scripts/validate.mjs
```

### Regeln ergänzen

Jeder Abschnitt beginnt mit genau `# NUMMER Titel`, beispielsweise `# 4.4 Astralpunkte`. Nachfolgender Text gehört bis zur nächsten solchen Überschrift zum Abschnitt. Deutsche und englische Dateien müssen dieselben Nummern in derselben Reihenfolge enthalten. Absätze und Listen werden dargestellt; einfache Markdown-Tabellen werden unterstützt. Andere Markdown-Auszeichnungen sind derzeit nicht vorgesehen.

Regelnummern bleiben stabil. Links wie `#/de/rules/4.4` und `#/en/rules/4.4` öffnen denselben Abschnitt in der jeweiligen Sprache. Beim Sprachwechsel bleibt das gewählte Ziel erhalten. Die Suche findet Nummern, Regeltexte, Begriffe und Kartennamen. Regeln müssen nicht manuell verlinkt werden: vorhandene Abschnittsnummern werden automatisch erkannt. Nicht existierende Nummern aus der Quelle werden nicht als defekte Links ausgegeben.

### Begriff ergänzen

Eine Zeile in `content/glossary.tsv` enthält sieben durch Tabulatoren getrennte Felder:

1. Stabile eindeutige ID (z. B. `priority`).
2. Deutscher Anzeigename.
3. Englischer Anzeigename.
4. Zugehörige vorhandene Regelnummer, optional leer.
5. Zusätzliche Schreibweisen, durch `|` getrennt.
6. Deutsche Erläuterung, einzeilig.
7. Englische Erläuterung, einzeilig.

Die Namen und Aliase werden automatisch in Regeltexten, Definitionen und Kartenhinweisen verlinkt. Vollständige Wörter werden bevorzugt, längere Begriffe zuerst. Das englische „dies“ wird in deutschen Texten wegen der gleichlautenden deutschen Wortform ausgenommen. Das Register enthält bewusst redaktionelle Erklärungen und verlinkt für verbindliche Auslegung die Originalregeln.

### Karten ergänzen oder korrigieren

Ein Eintrag in `content/cards.json` hat eine stabile `id`, `name`, `code`, `set`, `group`, `variant`, `image`, `original`, `notes`, `source` und `nameFromFilename`. IDs nicht nachträglich ändern, damit Direktlinks gültig bleiben. `image` ist die kleinere Darstellung, `original` das größere Kartenbild. Nur HTTPS-URLs verwenden.

Kartenbilder werden direkt vom offiziellen Bluthelden-CDN geladen; die Website benötigt dafür Internetzugriff. Kartennamen und Bilder bleiben in ihrer Originalsprache. Vorhandene offizielle Hinweise/Errata erscheinen ebenfalls in ihrer Originalsprache. Namen aus Bilddateien sind im Detail ausdrücklich gekennzeichnet und können redaktionell korrigiert werden. Einträge zählen Abbildungen und Varianten, nicht einzigartige spielmechanische Karten.

## Karten neu importieren

Die gespeicherten Quellseiten liegen unter `sources/`. Zum Aktualisieren diese vier Seiten in die entsprechenden Dateien herunterladen:

- `origin.html`: https://bluthelden.com/pages/kartenspoiler
- `alliances.html`: https://bluthelden.com/pages/2nd-edition-alliances (Einstiegsseite)
- `alliances-spoiler.html`: https://bluthelden.com/pages/alliances-spoiler
- `alliances-starters.html`: https://bluthelden.com/pages/alliances-spoiler-starter-decks

Danach:

```sh
python3 scripts/import_sources.py
python3 scripts/build_content.py
node scripts/validate.mjs
```

Der Import ersetzt den Karten-Snapshot einschließlich manueller Kartenänderungen. Daher Änderungen vorher sichern und den Unterschied anschließend prüfen. Die Regeln werden bei einem normalen Kartenimport nicht überschrieben. Der Parser verwendet die derzeitige Shopify-Struktur; bei Änderungen der Quellseiten muss er geprüft werden. Der gespeicherte Stand ist vom 03.10.2026, nicht automatisch live aktualisiert.

## Neues Regelwerk übernehmen

1. Neue Original-PDF prüfen und `dist/TournamentRulebook_de.pdf` ersetzen.
2. Mit `pdftotext -layout` nach `sources/rules-de.txt` extrahieren.
3. `python3 scripts/import_sources.py --rules` ausführen. Dies ersetzt bewusst die deutsche Textdatei; manuelle Tabellenformatierung danach erneut prüfen.
4. Englische Übersetzung und Glossar inhaltlich abgleichen, insbesondere geänderte Zahlen, Voraussetzungen und Ausnahmen.
5. `python3 scripts/build_content.py` und `node scripts/validate.mjs` ausführen; PDF-Seitenverweise und Tabellen visuell prüfen.

Die Quelle trägt Revision 00. Sie enthält eigene redaktionelle Unstimmigkeiten, beispielsweise einen Verweis auf 12.1.4 statt 12.4 und zwei Bezeichnungen für REL 3. Diese Website ist kein offiziell freigegebenes Regelwerk. Die englische Übersetzung und die Glossarerklärungen sind nicht von Bluthelden autorisiert. Das Original-PDF und aktuelle offizielle Kartentexte bleiben maßgeblich; vor Einsatz als offizielles Turniermedium sollte eine fachliche Freigabe erfolgen.

## Lokal ansehen

Im Projektordner:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Anschließend http://127.0.0.1:4173/ öffnen. Direktes Öffnen der HTML-Datei ohne HTTP-Server funktioniert wegen des Datenladens nicht zuverlässig.

## Hosting

`dist/` ist die vollständige auslieferbare Website. Sie kann auf einem beliebigen statischen Webhost betrieben werden; Hash-Links brauchen keine serverseitigen Weiterleitungsregeln. Alle lokalen Ressourcen verwenden relative Pfade, sodass auch GitHub-Projektseiten unter einem Repository-Unterpfad funktionieren. Quelldateien und Rohimporte werden nicht als Webdateien ausgeliefert.

### GitHub Pages

Unter **Settings → Pages → Build and deployment → Source** die Option **GitHub Actions** auswählen. Der Workflow `.github/workflows/pages.yml` erzeugt bei jedem Push auf `main` die Inhaltsdateien, prüft Regeln und Querverweise und veröffentlicht ausschließlich `dist/`. Pull Requests führen dieselben Inhaltsprüfungen ohne Veröffentlichung aus. Ein manueller Start ist unter **Actions → Validate and publish website → Run workflow** möglich.

Für spätere Änderungen die entsprechenden Dateien unter `content/` bearbeiten und auf `main` übertragen. Die Website wird nach erfolgreicher Prüfung automatisch aktualisiert. Es werden keine zusätzlichen Zugangsschlüssel als Repository-Secrets benötigt. Die Einrichtung folgt der [GitHub-Pages-Dokumentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Die frühere private Sites-Zuordnung bleibt in `.openai/hosting.json` dokumentiert; GitHub Pages verwendet diese Datei nicht.

## Quellen und Rechte

Regelgrundlage: `TournamentRulebook_de.pdf`, bereitgestellt im Projekt; Autoren laut Impressum Dr. Tobias Wels, Marcel Schottkowski und Jounes Erojo. Illustration: Anna Lesnikova. Regeln, Kartenbilder, Kartentexte und Marke: © Bluthelden. Die CAS-Seite dient als strukturelle Vorlage; ihre Unterrichtsinhalte wurden nicht übernommen. Fira Code wird unter der SIL Open Font License mitgeliefert; siehe `dist/fonts/OFL.txt`.
