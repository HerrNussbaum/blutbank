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

## Kartentexte und Eigenschaftensuche

Alle 729 erfassten Abbildungen und Varianten besitzen eine strukturierte Textfassung in `content/card-texts.json`. Dies sind maschinelle Transkriptionen, keine vollständig geprüften offiziellen Kartendaten. Insbesondere kleine Zahlen, Kosten und Symbole können fehlen oder fehlerhaft sein. Das Kartenbild und offizielle Errata bleiben maßgeblich. Kartentexte bleiben in ihrer gedruckten Sprache; die Bedienung ist deutsch und englisch.

Die Suche kombiniert Wörter, `"genaue Wortfolgen"` und Zahlenvergleiche wie `asp<=4 pow>=3`. Filter gibt es für Edition, Farbe, Kartentyp, Untertyp, Seltenheit, Begriffe im Kartentext, Traits, Pool/Binding/Rise sowie Bereiche für ASP, LVL, RES, INI, POW, HP, MAG und LP. Alle Bedingungen werden mit UND verbunden. Filter bleiben beim Sprachwechsel erhalten und lassen sich über die Adresse teilen. Fehlende Werte (`null`) bedeuten unbekannt oder nicht aufgedruckt und werden niemals als 0 behandelt. Erwähnte Schlüsselwörter bedeuten nicht zwingend, dass die Karte die Fähigkeit selbst hat.

### Korrekturen ohne Texterkennung

1. Die stabile Karten-ID im JSON-Download oder Direktlink nachsehen.
2. In `content/card-overrides.json` einen Eintrag unter dieser ID ergänzen. Nur korrigierte Felder angeben, zum Beispiel:

```json
{"cca2d2102a69": {"stats": {"asp": 4}, "reviewedFields": ["stats.asp"]}}
```

3. `npm run build` und `npm test` ausführen. Der Build wendet Korrekturen auf die Textdaten an und erzeugt die Website sowie JSON-/CSV-Downloads. Dafür werden nur Python 3 und Node.js benötigt, keine Texterkennung oder Bilddateien. Arrays werden ersetzt, Unterobjekte wie `stats` zusammengeführt. `status: "reviewed"` erst setzen, wenn der gesamte Datensatz anhand des Originals geprüft wurde.

Neue Karten benötigen zusätzlich zu `content/cards.json` einen Textdatensatz unter derselben ID. Der Build prüft die vollständige Zuordnung. `rawText` bewahrt die ursprüngliche Erkennung; `rulesText` enthält den bearbeitbaren Regeltext, `source` verweist auf das Originalbild. Die Tests prüfen Suchverhalten, unbekannte Werte, Datenzuordnung und Regelverweise.

### Maschinelle Erfassung wiederholen (optional, macOS)

Die bereits eingecheckten Textdaten reichen für Pflege und Veröffentlichung aus. Für eine neue Erfassung werden macOS/Apple Vision, Swift, Tesseract sowie Python mit Pillow und NumPy benötigt. Die folgenden Schritte laden die offiziellen Bilder, erkennen Texte und Zahlen und übernehmen anschließend die manuellen Korrekturen:

```sh
python3 scripts/download_card_images.py
python3 scripts/run_card_ocr.py
python3 scripts/extract_card_values.py
python3 scripts/refine_card_levels.py
python3 scripts/build_card_texts.py
npm run build
npm test
```

Zwischenergebnisse liegen ausschließlich unter `.cache/` und werden nicht veröffentlicht. Nach jedem Import müssen neue oder geänderte Karten visuell geprüft werden. Layoutbasierte Erkennung ist bei neuen Kartengestaltungen anzupassen.

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

### Bildprüfung vom 08.10.2026

Die 151 priorisierten Einträge mit Erkennungslücken wurden gezielt geprüft: sechs gemeinsam mit dem Nutzer und 145 durch direkten Bildvergleich. Das Prüfprotokoll unter `review/visual-review-2026-10-08.json` enthält Quelle, geprüfte Felder und Änderungen. `review/karten-pruefliste.md` hält den Stand fest. Diese Prüfung deckt die markierten Lücken und weitere lesbare Eigenschaften ab; sie ist keine vollständige Prüfung aller Kartentexte. Die betreffenden Korrekturen stehen in `content/card-overrides.json`, bestätigte Namen in `content/cards.json`.

### Karten nach Namen gruppieren

Katalog und Archivsuche zeigen pro Kartenname einen Treffer. Groß-/Kleinschreibung, Leerzeichen und typografische Satzzeichen werden beim Vergleich vereinheitlicht; ähnlich klingende Namen werden nicht automatisch zusammengelegt. Eine passende reguläre Ausgabe wird bevorzugt. Bei aktiven Filtern muss eine einzelne Ausgabe alle Bedingungen erfüllen; Bedingungen verschiedener Ausgaben werden nicht vermischt. Beim Öffnen sind alle Ausgaben über Bildminiaturen auswählbar. Jede Ausgabe behält ihre eigenen Texte, Eigenschaften, Quellen und Direktlinks. Leere Eigenschaften und Textabschnitte werden ausgeblendet; gedruckte Nullwerte bleiben sichtbar.

### Proxy-Drucker

Unter `#/de/proxy` bzw. `#/en/proxy` eine Karte pro Zeile eingeben: `4 Zayas Ritual`, `2x Amazon Rider` oder einen Namen ohne Anzahl für eine Kopie. Nach dem Übernehmen lassen sich Namen korrigieren und Druckvarianten auswählen. Maximal 300 Karten je Auftrag. Unbekannte Namen, ungültige Mengen und Bildfehler blockieren den Druck.

Die Vorschau verwendet A4 mit höchstens neun Karten in einem 3×3-Raster. Standardformat 63 × 88 mm, bei Bedarf verkleinerbar; Bilder bleiben vollständig sichtbar. Über „Drucken / als PDF speichern“ öffnet sich der Druckdialog des Browsers. A4, Hochformat, 100 %/tatsächliche Größe, keine Ränder und keine Kopf-/Fußzeilen einstellen. Die Liste bleibt während Navigation und Sprachwechsel im aktuellen Tab erhalten, wird aber nicht an einen Server übertragen oder dauerhaft gespeichert. Kartenbilder werden vom offiziellen CDN geladen.
