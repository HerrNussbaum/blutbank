# Gestaltung und Lesbarkeit

## Befund der Überprüfung

Die vorherige Gestaltung wirkte vor allem durch die Häufung kleiner Gestaltungselemente unruhig: Linien unter der Navigation, zwischen Regelabschnitten und Kartenwerten sowie Rahmen und rote Flächen innerhalb derselben Kartenseite. Diese Elemente konkurrierten mit den bereits auffälligen Kartenbildern und den farbigen Querverweisen.

Regeltexte liefen am Desktop über zu lange Zeilen. Gleichzeitig waren einige Metadaten und Auswahlfelder im Deckbuilder nur 11–13 Pixel groß. Die komprimierte Kartenseite machte lange Errata durch eine schmale Spalte und kleine Schrift schwerer lesbar. Die einzelnen Bereiche verwendeten unterschiedliche Seitenbreiten und Abstände.

## Gemeinsame Gestaltung

- Garamond und die vorhandene Farbpalette bleiben erhalten.
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
