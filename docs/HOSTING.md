# Hosting

## Verzeichnisse und Voraussetzungen

PHP >= 8.3, PDO SQLite oder PDO MySQL und Composer 2. Node.js/npm werden nur zur Formatierung und Prüfung benötigt, nicht zur Anzeige der Website. SMTP ist für Anmeldelinks erforderlich. Eine reine GitHub-Pages-Installation unterstützt keine PHP-Konten oder Deckspeicherung.

Das Web-Stammverzeichnis zeigt auf `/pfad/zu/octenarius/public`. Alle übrigen Verzeichnisse liegen außerhalb des öffentlichen Bereichs. `private/config.php`, SQLite-Dateien, Sessions, SMTP-Daten, Token und Sicherungen niemals veröffentlichen. Bei Apache `AllowOverride` für die vorhandene `.htaccess` aktivieren. HTTPS im Webserver konfigurieren; die Anwendung prüft HTTPS und die konfigurierte Origin bei schreibenden Anfragen.

## Neue Installation

1. Repository klonen und `composer install --no-dev` im Projektverzeichnis ausführen.
2. `php scripts/setup.php --origin=https://example.org --admin=admin@example.org` erzeugt eine leere SQLite-Datenbank sowie eine neue Konfiguration mit zufälligem Schlüssel. Eine vorhandene Konfiguration wird niemals überschrieben.
3. Eigene SMTP-Zugangsdaten in `private/config.php` eintragen; Beispiel: `private/config.example.php`.
4. Origin, Canonical- und Vorschaubild-URLs mit `python3 scripts/set-origin.py https://example.org` an die eigene Domain anpassen.
5. `var/` und das private Sitzungsverzeichnis für den PHP-Prozess schreibbar machen. Konfigurationsdatei nur für den Betreiber/PHP-Prozess lesbar halten.
6. Über Konto einen Anmeldelink für die konfigurierte Administratoradresse anfordern und Funktionen testen.

Für MySQL zuerst `migrations/mysql-base.sql` und `migrations/mysql-card-editor.sql` in eine neue Datenbank einspielen und DSN/Benutzer/Passwort anpassen. Bestehende Installationen nicht erneut initialisieren. Die Regelredaktion legt ihre zusätzlichen Tabellen bedarfsgesteuert an.

## Nginx

```nginx
root /srv/octenarius/public;
location = /cms-rules { rewrite ^ /cms-rules.php last; }
location ~ \.php$ {
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    fastcgi_param HTTPS on;
    fastcgi_pass unix:/run/php/php-fpm.sock;
}
location ~ \.(?:sqlite|sqlite3|db|sql|log|bak)$ { deny all; }
location ~ \.mjs$ {
    types { text/javascript mjs; }
    add_header Cache-Control "no-cache";
}
location ~ \.(?:js|css|html)$ { add_header Cache-Control "no-cache"; }
```

Socket und TLS-Konfiguration an den Server anpassen. `/handbuch` ist nur bei zusätzlicher Typemill-Installation erforderlich. Auf allen Servern muss `/cms-rules` zum PHP-Endpunkt führen.

## Sicherung und Aktualisierung

Datenbank konsistent sichern, außerdem `private/config.php`, CMS-Inhalte und redaktionelle Einstellungen. Backups außerhalb des Webroots mit eingeschränkten Rechten aufbewahren. Bei SQLite die Backup-API oder ein geeignetes Datenbankwerkzeug verwenden; eine Kopie während laufender Schreibvorgänge ist keine verlässliche Sicherung.

Quellcodeaktualisierungen überschreiben weder Konfiguration noch Datenbank, CMS-Inhalte oder Entwürfe. Ein isoliertes Testsystem mit einer privaten Datenkopie benutzen. Statische `public/data/`-Snapshots nicht als aktuelle produktive Datenbank zurückspielen.
