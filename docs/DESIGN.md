# Gestaltung und Lesbarkeit

## Befund der Überprüfung

Die vorherige Gestaltung wirkte vor allem durch die Häufung kleiner Gestaltungselemente unruhig: Linien unter der Navigation, zwischen Regelabschnitten und Kartenwerten sowie Rahmen und rote Flächen innerhalb derselben Kartenseite. Diese Elemente konkurrierten mit den bereits auffälligen Kartenbildern und den farbigen Querverweisen.

Regeltexte liefen am Desktop über zu lange Zeilen. Gleichzeitig waren einige Metadaten und Auswahlfelder im Deckbuilder nur 11–13 Pixel groß. Die komprimierte Kartenseite machte lange Errata durch eine schmale Spalte und kleine Schrift schwerer lesbar. Die einzelnen Bereiche verwendeten unterschiedliche Seitenbreiten und Abstände.

## Gemeinsame Gestaltung

- Fließtext verwendet Garamond, die vorhandene Farbpalette bleibt erhalten. Der Schriftzug BLUTBANK und die vier Reiter verwenden Regensburg Grunged Regular in Großbuchstaben. Die unveränderte Schriftdatei liegt lokal unter `dist/fonts/regensburg/`; `SOURCE.txt` dokumentiert Herkunft und Nutzungshinweise.
- Maximal 1200 Pixel Seitenbreite mit flexiblen Außenrändern; auf schmalen Geräten mindestens 24 Pixel pro Seite. Bei 1280 Pixel Bildschirmbreite beträgt der Rand 64 Pixel.
- Längere Lesetexte sind auf 66 `ch` begrenzt. Fließtext liegt bei 19–20 Pixeln, übliche Beschriftungen bei 16–18 Pixeln.
- Zusammengehörige Inhalte werden durch Nähe, Abstände und Überschriften gegliedert. Dekorative Trennlinien, Schatten und zusätzliche Inhaltsrahmen entfallen.
- Rahmen bleiben bei Eingabefeldern und Schaltflächen erhalten. Tastaturfokus und Fehlermarkierungen bleiben sichtbar.
- Rot kennzeichnet Links, aktive Navigation und ausgewählte Hauptaktionen. Nebenaktionen sind zurückhaltender gestaltet.
- Die Styles stehen nach Komponenten geordnet in `dist/style.css`; ältere, inzwischen unbenutzte Dialog- und Katalogregeln wurden entfernt.

## Anwendung auf die einzelnen Seiten

| Bereich | Anpassung |
| --- | --- |
| Turnierregeln | Kürzere Textzeilen; Abschnitte durch Abstände getrennt; die linke Kapitelnavigation ohne Rahmen und rote Balken. |
| Begriffsregister und Archivsuche | Gleiche Lesebreite, größere Auszüge und ruhigere Gliederung ohne Ergebnis-Trennlinien. |
| Kartenarchiv | Vier größere Karten je Desktop-Zeile, freie Ränder, optionale Filter ohne umgebenden Rahmen. Quellen und Datenexporte liegen in einem aufklappbaren Bereich. |
| Einzelkarte | Freie Anordnung ohne Textkasten oder roten Editionsblock; größere Texte und Werte. Ausführliche Hinweise stehen unter den Hauptinformationen in einer breiteren Lesespalte. |
| Proxy-Drucker | Zentrierter Arbeitsbereich ohne Kapitelnavigation, gut lesbare Kartenliste und zurückhaltende Nebenaktionen. Die funktionalen Schnittmarken im Druck bleiben erhalten. |
| Deckbuilder | Größere Namen und Auswahlfelder, offene Spalten ohne zusätzliche Rahmen; bei wenig Platz wechseln die Bereiche untereinander. |
| Konto und geteilte Decks | Begrenzte Inhaltsbreite und gut lesbare Formulare, statt die gesamte Bildschirmbreite auszunutzen. |

Lange Inhalte dürfen die Seite verlängern. Lesbarkeit und freie Ränder haben Vorrang vor dem Ziel, jede Information ohne Scrollen unterzubringen. Die mobile Ansicht schneidet keine Texte ab.

## Prüfung

Regeln, Begriffsregister, Kartenarchiv, Kartenseite, erweiterte Suche, Proxy-Drucker und Deckeditor wurden im Browser geprüft. Bei 390 Pixel Breite zeigen die geprüften Ansichten keine seitlichen Überläufe und behalten beidseitig 24 Pixel Rand. Die vorhandenen automatischen Inhalts-, Such-, Proxy- und Deckprüfungen bestehen weiterhin.

## Suche als Startseite

Die Startseite enthält als einziges zentrales Element eine große Suchleiste. Sie steht bereits im initialen HTML und wartet nicht auf die Kartendaten. Die Kopfzeile blendet nach 360 Millisekunden innerhalb von 240 Millisekunden ein; ihr Platz ist reserviert, sodass nichts springt. Bei reduzierter Bewegung entfällt die Animation. Die Kopfzeile hebt sich mit einem Verlauf von dunklem Blutrot über ein gedämpftes Rotbraun zu Schwarz ab.

Suchergebnisse erscheinen nach 120 Millisekunden Eingabepause, mit einer begrenzten Vorschau aus Karten, Regeln und Begriffen sowie Links zu allen Ergebnissen. Suche und Sprache bleiben in der URL erhalten; das Schließen einer Karte führt zur Suche zurück. Fließtexte verwenden durchgehend Blocksatz und automatische Silbentrennung; Navigation, Beschriftungen und tabellarische Werte behalten ihre natürliche Ausrichtung.

## Deckansichten und einheitliche Suche

Die Navigation lautet Regeln, Karten, Meine Decks und Proxies. Begriffe bleiben als Suchtreffer und über Querverweise erreichbar. Suchfelder tragen ein Lupensymbol links. Die leere Startsuche hat keinen Platzhalter und erhält den Tastaturfokus. Gemischte Suchtreffer stehen in zwei Spalten: Karten links, Begriffe vor Regeln rechts; auf schmalen Bildschirmen untereinander.

Fließtext bleibt im Blocksatz, automatische Silbentrennung entfällt. Regelabsätze und verschachtelte nummerierte bzw. unnummerierte Listen werden semantisch gerendert; Listen bleiben linksbündig.

Bestehende Decks öffnen in der Präsentation. Neue Decks starten im Editor. Die Präsentation und geteilte Decks verwenden dieselbe Komponente (`deck-presentation.mjs`) mit Text-/Bildansicht, Gruppierung, Sortierung und Statistiken. Die ASP-Kurve bezieht sich auf das Spell-Deck, andere Statistiken auf das Deck ohne Merkliste. Mehrfarbige Karten können mehrfach in der Farbverteilung zählen.

Der Editor zeigt links die Suche mit Filtern und Namenslisten, rechts Deckbereiche, Mengen und Seltenheiten. Kartenvorschauen sind per Hover, Fokus und Antippen erreichbar. Kopienlimits zählen Varianten und Deckbereiche zusammen, ohne Merkliste. Die Prüfung ersetzt keine vollständige Format-/Herrscher- und Bannlistenprüfung. Änderungen speichern lokal automatisch; Online-Speichern und Freigabe bleiben bewusste Aktionen. Entfernen ist rückgängig machbar.

Beschreibung und Titelkarte werden separat bearbeitet. Die optionalen Felder `summary` (300 Zeichen) und `coverPrintingId` ergänzen das bisherige Deckformat rückwärtskompatibel. Die Titelkarte muss im Deck enthalten sein. Lokaler Speicher, JSON-Export, Online-Speichern und geteilte Decks erhalten diese Felder. Beschreibungstext unterstützt sichere Überschriften und Listen, kein HTML.

## Struktur der Kartendetailseiten

Auf Wunsch sind Kartendetails wieder durch feine Linien gegliedert: Blutrot trennt den Regeltext vom Kartenkopf und markiert die aktuelle Edition; dunkle graubraune Linien teilen Zusatzkosten, Werte, Eigenschaften, Druckversionen und Errata. Am Desktop trennt eine senkrechte Linie die Editionsspalte, auf kleineren Geräten eine waagerechte Linie. Freie Ränder und gut lesbare Schriftgrößen bleiben bestehen.

## Organischer Hintergrund

Der Hintergrund besteht aus einer sehr dunklen, weinroten Pigmenttextur mit feiner Körnung und ineinander verlaufenden Schlieren. `dist/blood-background.mjs` erzeugt sie lokal mit WebGL, ohne Bilddownloads oder zusätzliche Bibliotheken. Suchleiste, Kartenbild sowie das aktuell berührte oder fokussierte Bedienelement verdichten die Textur an ihren Konturen. Der Mauszeiger verdrängt die Maserung leicht und hinterlässt eine kurz ausklingende Strömung.

Auch sichtbare Karten, Überschriften und Textabsätze verdrängen die Maserung unabhängig vom Mauszeiger. Wenn Inhalte neu gerendert, Bilder geladen oder Absätze ins Sichtfeld gescrollt werden, läuft eine einzelne weiche Welle von ihren Konturen nach außen und klingt innerhalb von rund zwei Sekunden ab. Hinter Text wird die Textur leicht abgedunkelt. Verschwindende Inhalte geben ihre Verdrängung sanft frei. Bis zu 16 sichtbare Inhaltsflächen wirken gleichzeitig; die Anzahl passt sich an die WebGL-Grenzen des Geräts an. Die Lage der Elemente wird nur nach Änderungen am Layout neu gemessen.

Die Textur liegt hinter allen Inhalten und nimmt keine Eingaben entgegen. Nach dem Abklingen endet die Animationsschleife; während einer Interaktion werden höchstens 30 Bilder pro Sekunde und rund 650.000 Pixel berechnet. In inaktiven Tabs pausiert die Darstellung. Touch-Eingaben lösen keine Cursoranimation aus, und bei `prefers-reduced-motion` bleibt die Textur still. Ohne WebGL oder JavaScript bleibt eine statische CSS-Textur sichtbar. Druck und erzwungene Systemfarben blenden die dekorativen Ebenen aus.

Startsuche und Suchergebnisse wurden bei 390 Pixel Breite, Regeltexte bei 1280 Pixel Breite geprüft: kein seitlicher Überlauf, Text und Bedienelemente bleiben lesbar. Die bestehenden Inhalts-, Such-, Proxy- und Deckprüfungen bestehen.

## Deck workspace refinement (2026-10-18)

The deck overview uses compact, transparent bordered rows with the Sovereign and Rune on the left. New deck, Trash and Account share the upper-right action area; JSON import is nested under New deck. The redundant Cards / My decks / Proxy printer page headings remain accessible to assistive technology but are visually hidden.

Deck presentation defaults to images. Sovereign and Rune sit side by side; type groups share available horizontal space. A right action rail contains the deck actions and presentation controls. Editing places the compact deck list on the left and card search on the right. Printing/zone changes are in an accessible modal opened by each row's ellipsis; quantities, remove and undo remain directly available. Existing deck JSON and backend storage require no migration.

Rows and presentation cards have a 360 ms reveal, staggered by 45 ms (capped after ten items). The procedural background measures deck rows as content fields and delays their pigment response to match. Reduced-motion settings disable reveals. No continuous background animation was added.

### Sovereign ASP costs

`dist/deck-costs.mjs` owns pure, testable cost calculations, independent of display. Profiles are explicitly restricted to reviewed Sovereign names (case-insensitive, so reprints share their profile). New/unreviewed Sovereigns and ambiguous/missing colors return unknown, never a guessed zero. The known OCR false-positive Sovereign type on Dark Infiltration is not admitted by the reviewed name list.

The following printed color bars were visually checked against the official card images on 2026-10-18. Same-color and Equilibra cards have no color surcharge. A forbidden color is a separate state, not a numeric cost.

| Sovereign color | +0 | +1 | +2 | Forbidden |
|---|---|---|---|---|
| White | Green, Blue | Brown, Purple | Red, Orange | Black |
| Green | White, Blue | Brown, Purple | Red, Black | Orange |
| Black | Red, Orange | Brown, Purple | Green, Blue | White |
| Orange | Red, Black | Brown, Purple | White, Blue | Green |
| Blue | Green, White | Brown, Purple | Orange, Black | Red |
| Brown | Red, Green | Black, White | Orange, Blue | Purple |
| Red | Black, Orange | Brown, Purple | Green, White | Blue |
| Purple | Orange, Blue | Black, White | Red, Green | Brown |

Reviewed cards: Sirunian, Valdar, KingLomeling, Elaria, Barabas, Vorathis, Kaela, Noctara, Airell, Rha'Velkor, Krador, Thordrin, Pyrana, Grak'Nar, Lysera and Miralyn. Source image URLs are retained in `dist/data/cards.json`; representative printings: d0859d36e880, 1e9ff377912d, 67996634c395, c91eb97c6ad2, 0a443f510b68, fe9281027597, bed8b1e3fa7a, d1bc65b0894a, ff32861ae7cd, 72001b9155f6, 11d860a357e4, 15835eb31d9b, 0e5d95642b43, f009cfe75b2b, 6ba73460db36, 64621f0c3cc4. Rules 2.2.3, 2.4 and 4.5 explain the color bar, deck restrictions and additional costs.

The optional surcharge toggle affects sorting, displayed costs, the Spell-deck histogram and weighted average/range. It does not simulate other card effects or claim full legality validation. Unknown and forbidden costs sort after known costs and are counted separately; neither is included in the mean. Considering cards are excluded from statistics. Tests cover every reviewed identity, zero and missing costs, forbidden colors, ambiguous Sovereigns, quantity weighting and considering exclusion.

### Compact deck follow-up (2026-10-18)

The editor omits its redundant Deck list heading and success-only validation notice, combines Sovereign and Rune under one heading, and hides every search filter in the same disclosure. Search results have no count. Actual copy-limit violations still highlight the affected quantities, and the presentation retains the full deck checks. Actions are directly visible; text/JSON export share a format selector and export button. Saving privately and sharing remain separate actions.

Image tiles now use identical 148 × 310 px frames, including the caption area. Text presentation renders only quantity and name, with no frame, cost or rarity. Names stay on one line; unusually long names remain readable by scrolling within the group. Columns flow independently to avoid blank rows below shorter categories.

### Presentation cleanup and hover repair (2026-10-18)

Image tiles now show only card name and quantity, in uniform 148 × 254 px frames. View/group/sort controls precede actions. The action rail uses ordinary document flow with no sticky positioning, height limit or internal scrollbar. Description/summary/cover editing and rendering have been removed; a small rename dialog preserves deck naming. Legacy metadata remains import-compatible and is not destructively removed from saved decks.

Text-card previews are rendered once under `document.body`, outside the horizontal overflow containers and multi-column layout. Their fixed bounds are clamped to the viewport. Pointer hover and keyboard focus use the same preview; Escape, scrolling, resizing, view changes and navigation dismiss it. Listener cleanup prevents stale previews between decks. The original inline preview is hidden in text presentation.

## Kompakte Arbeitsflächen (2026-10-19)

Die leere Startsuche bleibt großzügig. Beim ersten Tippen gleitet sie in 480 ms kompakt unter die Navigation und bleibt für die laufende Sitzung auch nach dem Leeren oben; die Treffer beginnen bei 1280 × 720 Pixeln etwa bei y=216 statt y=453. Karten behalten ihr Bildraster. Die Sortierung steht direkt über dem Raster. Die Filter öffnen sich in drei Gruppen (Grundfilter, Werte, Druckversion & Weitere). Angewandte Bedingungen sind einzeln entfernbar; das Entfernen aller Filter erhält Suchbegriff und Sortierung. Sprachwechsel und Kartenrückkehr erhalten weiterhin die Filter in der URL.

Decksteuerung und Aktionen bleiben am Desktop in der rechten Seitenleiste, mit Ansicht, Gruppierung und Sortierung vor den Aktionen. Die Leiste scrollt im normalen Seitenfluss. Auf schmalen Bildschirmen steht sie kompakt über dem Deck. Bearbeiten/Präsentation, Rückgängig, Online speichern und Teilen bleiben direkt erreichbar. Umbenennen, Kopieren, Exportieren, Proxies, Papierkorb und Konto stehen im Menü Weitere Aktionen. Die Übersicht zeigt Neues Deck als direkte Hauptaktion, Import, Papierkorb und Konto im Kontextmenü. Die bisherigen Mengen- und Hinzufügen-Bedienelemente bleiben direkt verfügbar.

Vier Kennzahlen stehen am Decknamen: Karten ohne Merkliste, verschiedene Karten, durchschnittliche bekannte ASP im Spell-Deck und Anzahl der Kopienlimit-Hinweise. Die Präsentation aktualisiert den Mittelwert beim Zuschalten geprüfter Herrscher-Aufschläge. Der Editor nutzt aufgedruckte Kosten. Unbekannte oder ausgeschlossene Kosten bleiben von Mittelwerten ausgenommen. Bestehende Grenzverletzungen bleiben an den Mengen markiert und sind im Editor aufklappbar erläutert. Herrscher und Rune stehen nebeneinander; das Pool-Deck nutzt den freien Platz daneben. Gruppen bleiben strukturiert, zeigen aber keine zusätzlichen Überschriften. Die reine Textpräsentation nutzt insgesamt höchstens zwei Spalten, auf schmalen Bildschirmen eine Spalte.

Kartendetails behalten die drei Informationsspalten und feinen Trennlinien, mit engeren Metadaten- und Versionsabständen. Kopieraktionen stehen in einem gemeinsamen Menü. Regelabschnitte haben ein Kontextmenü am Kopf für Direktlink und Original-PDF. Die Lesebreite bleibt erhalten. Menüs funktionieren mit Maus, Touch und Tastatur; Escape schließt ein offenes Menü und stellt den Fokus wieder her.

Proxies bieten die Liste und die A4-Vorschau am Desktop nebeneinander. Liste prüfen startet automatisch die Vorschau. Karten/Versionen und Druckformat sind aufklappbar; Fehler öffnen die betroffene Kartenliste. PDF herunterladen ist die Hauptaktion, Browserdruck die Nebenaktion. Listenänderungen sperren alte Ausgaben, Format- und Versionsänderungen erneuern die Vorschau automatisch. Ungültige Zeilen, unbekannte Karten, zu viele Karten und ungültige Maße blockieren die Ausgabe. Veraltete Vorschau- und PDF-Aufträge geben keine Ausgabe für inzwischen geänderte Daten frei.

### Kartensymbole (2026-10-19)
- Websymbole liegen in `dist/assets/symbols/`; Quelle ist das vom Nutzer bereitgestellte Paket `bluthelden-icons-v3`. Die KI-aufbereiteten Varianten sind keine unveränderten Originalausschnitte. WebP-Dateien sind verlustfrei komprimierte 128-Pixel-Ableitungen für scharfe kleine Darstellungen.
- `card-symbols.mjs` trennt Textnotation und sichere HTML-Darstellung: ASP-Rahmen für Kartenkosten und Kostenkurve, weiße Fähigkeitkosten und Turn-Symbol im Fließtext, Statussymbole neben ausgeschriebenen Bezeichnungen sowie Pool/Binding/Rise bei Mechaniken.
- Kopieren, Suche und Export behalten `{N}` / `{T}`. Nicht verfügbare Kostenwerte bleiben lesbarer Text; Levelsymbole werden nur für die tatsächlich vorhandenen Werte 1 und 2 eingesetzt. Deckkarten bleiben auf Name und Anzahl beschränkt.
