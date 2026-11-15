<?php
// Copy to config.php, supply your own values, and keep it outside the document root.
return [
  'origin' => 'https://example.org',
  'site_name' => 'Octenarius',
  'dsn' => 'sqlite:' . dirname(__DIR__) . '/var/octenarius.sqlite',
  'user' => '',
  'password' => '',
  'app_key' => 'REPLACE_WITH_RANDOM_64_HEX_CHARACTERS',
  'registration_enabled' => false,
  'card_editor_enabled' => true,
  'card_admin_emails' => ['admin@example.org'],
  'smtp' => [
    'host' => 'smtp.example.org',
    'port' => 587,
    'username' => 'SMTP_USERNAME',
    'password' => 'SMTP_PASSWORD',
    'from' => 'octenarius@example.org',
  ],
];
