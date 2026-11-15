# Aufbau und Wartung

## Zuständigkeiten

| Aufgabe                                           | Datei                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| Seitenwechsel, Startseite, Karten-/Regelansichten | `public/app.mjs`                                                         |
| Gestaltung und responsive Regeln                  | `public/styles.css`                                                      |
| Gemeinsame SVG-Funktionsicons                     | `public/ui-icons.mjs`                                                    |
| Deckübersicht und Editor                          | `public/deck-builder.mjs`                                                |
| Deckansicht und Statistiken                       | `public/deck-presentation.mjs`                                           |
| Deckvalidierung und Kartenidentitäten             | `public/deck-model.mjs`                                                  |
| Anmeldung und API-Client                          | `public/deck-online.mjs`                                                 |
| Serialisierte Speichervorgänge                    | `public/deck-sync.mjs`                                                   |
| Öffentliche Deckübersicht                         | `public/deck-meta.mjs`                                                   |
| Exportdateinamen                                  | `public/download-name.mjs`                                               |
| Proxydruck und PDF                                | `public/proxy-printer.mjs`, `public/proxy-pdf.mjs`                       |
| Kartenredaktion                                   | `public/card-editor.mjs`, `private/card-editor.php`                      |
| API, Sitzung und Datenbank                        | `public/api.php`, `private/bootstrap.php`, `private/browser-session.php` |
| Öffentliches Regelwerk                            | `public/cms-rules.php`, optional `private/typemill-reader.php`           |

## Regeln für Änderungen

Funktionsbeschreibungen erläutern Zweck und Grenzen des aktuellen Codes; sie erzählen nicht die Geschichte einzelner Änderungswünsche. Keine nummerierten Änderungskommentare oder datierten App-Kopien hinzufügen. Module erhalten stabile Dateinamen und relative Imports ohne historische Versionsbezeichnungen. Der Webserver fordert für JavaScript und CSS eine erneute Cachevalidierung an.

CSS wird in seiner wirksamen Reihenfolge gepflegt. Bestehende Regeln ändern, statt neue Gegenregeln ans Ende anzuhängen. Responsive Zustände und bewusst unterschiedliche Spezifitäten sind kein Grund, pauschal Selektoren zu sortieren. Die Bereinigung entfernt ausschließlich nachweislich überschriebene Deklarationen bei identischem Selektor und identischem Bedingungskontext; Layoutvergleiche sichern die Wirkung ab.

Lange HTML-Templates gehören zur jeweiligen Ansicht. Daten immer mit `escapeHTML` beziehungsweise dem lokalen Escape-Helfer ausgeben; Rich-Text wird getrennt validiert. Namen, sichtbare Texte und Downloadnamen sind keine Speicherkennungen.

## Kompatibilität

Historische `blutbank.*`-LocalStorage-Schlüssel, Sitzungsnamen und interne Ereignisse bleiben erhalten. Sie sind keine sichtbare Marke, sondern bestehende Datenverträge. Eine Umbenennung benötigt eine explizite Migration; ein globales Suchen/Ersetzen kann Decks oder Anmeldungen scheinbar verschwinden lassen.

Spielerische Kartenidentitäten und einzelne Druckversionen bleiben getrennt. Decks speichern Mengen, Bereiche und Druck-IDs. Kartentexte werden erst durch die ausdrückliche Freigabe veröffentlicht. Datenbankänderungen, Freigaben und Rechteänderungen sind keine Layoutaufgaben.

## Optionales Regel-CMS

Ist `typemill/content/` vorhanden, liest `cms-rules.php` den veröffentlichten CMS-Stand. Ohne CMS liefert der Endpunkt die mitgelieferten öffentlichen JSON-Daten. Die öffentliche Website funktioniert ohne Typemill; die integrierte CMS-Redaktion und deren PDF-Veröffentlichung erfordern die separat konfigurierte Typemill-Installation. CMS-Benutzerdateien, Entwürfe und Sessions gehören nicht ins Repository.
