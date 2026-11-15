# Prüfung und Veröffentlichung

1. `npm ci`, `npm test` und `npm run format:check` ausführen; PHP-Dateien mit `php -l` prüfen.
2. Auf einer isolierten Datenbank Desktop- und Mobilansichten testen: Kartensuche, Sprachwechsel, Regeln/Glossar, Decks, Editor, Export, Proxy-Übergabe, Anmelden und Kartenredaktion.
3. Serverfehler und Browserkonsole prüfen; Bildschirmgrößen mehrfach ändern und zurück navigieren. Menüs müssen nach einem Seitenwechsel ihre Listener freigeben.
4. Speichern, Veröffentlichen und endgültiges Löschen nur mit eigens dafür angelegten Testdaten testen. Kein Test darf produktive Entwürfe freigeben oder private Decks löschen.
5. Release-Dateiliste prüfen: keine `config.php`, Sessions, SQLite-Dateien, SMTP-Zugangsdaten, Mailausgaben, privaten Decks, Entwürfe oder Sicherungen.
6. Vor der Übernahme betroffene Live-Dateien zurücklesen und sichern. Neue Live-Änderungen mit dem getesteten Ausgangsstand vergleichen; bei Abweichungen abbrechen und abgleichen.
7. Quellcode bereitstellen, gemeinsam verwendete Module zusammen ausrollen und den HTML-Einstieg zuletzt umschalten. Konfiguration, Datenbank und CMS-Veröffentlichungen erhalten.
8. Live anschließend erneut prüfen und Upload-Dateien mit ihren lokalen Prüfsummen vergleichen. Im Fehlerfall die gesicherten Quellcode-Dateien zurückspielen, keine fremden Datenbanken ersetzen.

Eine neue Installation braucht keine historischen Arbeitskopien. Die ursprüngliche lokale Designkopie und private Backups gehören nicht in den GitHub-Quellcode.
