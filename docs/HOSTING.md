# blutbank auf united-domains

Ziel: https://blutbank.nussbaum.page · PHP 8.5 · eigene MySQL-Datenbank.

## Upload vorbereiten

1. `npm run build` und `npm test` ausführen.
2. `composer install --working-dir=server --no-dev --prefer-dist` installiert PHPMailer gemäß eingecheckter composer.lock.
3. `npm run build:hosting` erstellt `release/blutbank/`. Es enthält ausschließlich eine Konfigurationsvorlage, niemals die echte config.php.

## Verzeichnis und Datenbank

Das vorhandene Zielverzeichnis der Subdomain muss auf den **public**-Unterordner zeigen:

```
blutbank/
  public/       <- Dokumentenstamm der Subdomain
  private/      <- außerhalb des öffentlich erreichbaren Verzeichnisses
  vendor/       <- außerhalb des öffentlich erreichbaren Verzeichnisses
```

Den Inhalt dieser drei Ordner hochladen. Die bestehende Website in ihrem eigenen Verzeichnis belassen. `schema.sql` in die neue, leere MySQL-Datenbank über die Datenbankverwaltung importieren; die SQL-Datei nicht öffentlich hochladen. Tabellen verwenden InnoDB. PHP benötigt PDO MySQL, OpenSSL und sessions.

HTTPS-Zertifikat für blutbank.nussbaum.page aktivieren. Die API akzeptiert in Produktion nur HTTPS. PHP 8.5 für diese Subdomain wählen.

## Konfiguration

Auf dem Server `private/config.example.php` nach `private/config.php` kopieren. Datenbankhost, Datenbankname, Benutzer und Passwort aus der Hostingverwaltung einsetzen. Einen zufälligen Schlüssel erzeugen (`php -r 'echo bin2hex(random_bytes(32));'`) und als app_key eintragen. Zugangsdaten weder ins Repository noch in den öffentlichen Ordner legen. `registration_enabled` zunächst false lassen.

`public/deck-config.json` enthält im Upload-Paket bereits `{"api":"api.php"}`. Die GitHub-Pages-Fassung bleibt absichtlich ohne Online-Anbindung. Die statische Website und die API müssen unter derselben Domain erreichbar sein.

## E-Mail und Freigabe

Ein echtes Postfach (z. B. blutbank@nussbaum.page) erstellen und seine SMTP-Zugangsdaten in config.php eintragen. Vorgabe: smtps.udag.de, Port 587, STARTTLS. Port 465 verwendet TLS. TLS-Zertifikate werden regulär geprüft.

Nach Einrichtung registration_enabled auf true setzen und zunächst mit der eigenen Adresse testen: Link anfordern, Eingang und Spam-Ordner prüfen, einmal anmelden, denselben Link erneut versuchen (muss abgewiesen werden). Ein Link gilt 15 Minuten. Bei SMTP-Fehlern zeigt die Oberfläche einen Fehler; Serverlogs enthalten keine Zugangsdaten. Die lokalen Tests verwenden ausschließlich einen simulierten Mailausgang. Tatsächliche Zustellung und die MySQL-Anbindung müssen auf dem Hoster geprüft werden.

Danach zwei Testkonten verwenden: Deck speichern, in anderem Browser öffnen, prüfen, dass das zweite Konto das private Deck nicht sieht. Freigabelink erstellen, ohne Anmeldung öffnen, Freigabe widerrufen und erneut prüfen. Änderungen mit veraltetem Versionsstand müssen einen Konflikt melden. Eine vorhandene lokale Kartenliste wird beim Laden einer abweichenden Online-Liste als Sicherungskopie erhalten.

## Betrieb und Grenzen dieser ersten Version

- Gastdeckbau funktioniert vollständig lokal; Browserdaten sind nicht automatisch zwischen GitHub Pages und der neuen Domain übertragbar. Vor Umzug JSON exportieren und danach importieren.
- Online-Speichern erfolgt ausdrücklich per Knopf. Lokale Änderungen werden automatisch für Name und Beschreibung während der Eingabe, für Mengen nach Bestätigung des Felds gespeichert.
- Private Online-Decks sind Standard. Wer einen Freigabelink kennt, kann das freigegebene Deck lesen. Erneutes Freigeben erzeugt einen neuen Link; Widerruf macht den alten unbrauchbar.
- Höchstens 200 Online-Decks pro Konto, 600 Karten inklusive Merkliste pro Deck, 300 Karten pro Proxy-Auftrag.
- Papierkorb statt endgültigem Löschen. Online-Papierkorb wird beim nächsten Online-Speichern aktualisiert; keine automatische Kontolöschung in dieser Version.
- Es gibt Hinweise zu Kopienlimits anhand der erfassten Seltenheit, noch keine vollständige Prüfung von Formaten, Herrschereinschränkungen oder Kartenzulässigkeit. Ungeprüfte Kartendaten bleiben eine Einschränkung.
- Anmeldelinks sind auf drei Anfragen pro Adresse in 15 Minuten und 15 pro IP in einer Stunde begrenzt. Der Hosting-Mailtarif kann zusätzliche Versandlimits haben.
- Datenbank und Konfiguration regelmäßig über die Hostingverwaltung sichern. Die Anwendung legt keine eigenen periodischen Backups an.

## Entwicklung und Tests

`npm test`: Regeln, Suche, Proxy-PDF und Deckmodell.
`python3 scripts/test-server.py`: isolierter lokaler HTTP-Test mit PHP 8.5, SQLite und simuliertem E-Mail-Ausgang. Prüft Einmalverwendung, Sessions, CSRF, Origin, Besitzerprüfung, Versionskonflikte und Freigabewiderruf. MySQL-Produktionskonfiguration wird dadurch nicht ersetzt.

Stabile Kartenidentitäten stehen in dist/data/card-identities.json. `npm run build` ergänzt neue Druckversionen. Bereits vergebene IDs nicht neu erzeugen. Konflikte beim Zusammenführen bislang getrennter Namen müssen ausdrücklich migriert werden.
