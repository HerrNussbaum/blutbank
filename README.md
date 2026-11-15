# Octenarius

Die offizielle Bluthelden-Kartendatenbank mit integriertem Regelwerk, Deckverwaltung und Proxy-Druck. Die Oberfläche verwendet native JavaScript-Module; Konten, Decks und Redaktion werden von einer PHP-API bereitgestellt.

## Starten und selbst hosten

Voraussetzungen: PHP 8.3 oder neuer mit PDO/SQLite (oder PDO/MySQL), Composer 2; für Entwicklung und Tests zusätzlich Node.js 22 oder neuer und npm. Kartenbilder werden vom offiziellen CDN geladen; dafür ist Internetzugriff erforderlich.

```sh
git clone --branch octenarius https://github.com/HerrNussbaum/blutbank.git octenarius
cd octenarius
composer install --no-dev
npm ci
php scripts/setup.php --origin=https://example.org --admin=admin@example.org
```

Anschließend `private/config.php` um die eigenen SMTP-Daten ergänzen. **Nur `public/` ist das Web-Stammverzeichnis.** `private/`, `var/`, `vendor/` und Konfigurationen dürfen nie öffentlich ausgeliefert werden. Für den Produktivbetrieb HTTPS einrichten. Ausführlich: [Hosting](docs/HOSTING.md).

Lokaler Entwicklungsserver, ohne automatische Anmeldung:

```sh
BLUTBANK_TEST_MODE=1 php -S 127.0.0.1:4187 -t public router.php
```

Dafür die Origin in der lokalen Konfiguration auf `http://127.0.0.1:4187` setzen. Der historisch benannte Testschalter deaktiviert die HTTPS-Pflicht ausschließlich für Entwicklung; er erzeugt keine Testsitzung. In Produktion darf er nicht gesetzt sein.

## Entwickeln

```sh
npm test
npm run format:check
npm run format
```

- [Aufbau und Wartung](docs/ARCHITECTURE.md)
- [Hosting und Datensicherung](docs/HOSTING.md)
- [Prüfung und Veröffentlichung](docs/RELEASE.md)
- [Rechte und Drittkomponenten](THIRD_PARTY.md)

Die ausgelieferten Dateien sind zugleich die lesbaren Quellen. Es gibt keinen verpflichtenden Bundler. `public/app.mjs` ist der feste Einstieg; es liegen keine alten App-Versionen oder fortlaufenden Änderungsprotokolle im Quellverzeichnis. Änderungen gehören in Git-Commits und Pull Requests.

## Daten und Rechte

Öffentliche Karten-/Regeldaten liegen in `public/data/`. Das Repository enthält keine Konten, privaten Decks, Entwürfe, Zugangsdaten oder produktiven Datenbanken. Lokale Daten sind ein öffentlicher Ausgangsstand, keine Sicherung einer produktiven Redaktion. Vor einer Veröffentlichung auf einer bestehenden Installation Daten und Entwürfe erhalten und nur gezielt Quellcode übernehmen.

Der Anwendungscode steht unter der MIT-Lizenz; Karten, Regeltexte, Marken, Illustrationen, Spielzeichen, Schriftarten und Drittbibliotheken sind davon ausgenommen. Die Bereitstellung des Codes erteilt keine Rechte an diesen Inhalten. Siehe `THIRD_PARTY.md`.
