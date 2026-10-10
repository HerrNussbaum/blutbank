<?php
return [
 'origin' => 'https://blutbank.nussbaum.page',
 'dsn' => 'mysql:host=DATENBANKSERVER;dbname=DATENBANKNAME;charset=utf8mb4',
 'user' => 'DATENBANKBENUTZER', 'password' => 'DATENBANKPASSWORT',
 'app_key' => 'HIER_64_ZUFAELLIGE_HEXZEICHEN_EINTRAGEN',
 'registration_enabled' => false,
 'smtp' => ['host'=>'smtps.udag.de','port'=>587,'username'=>'POSTFACHBENUTZER','password'=>'POSTFACHPASSWORT','from'=>'blutbank@nussbaum.page'],
];
