<?php
// Initialize a new installation only; never reset an existing database or configuration.
$options = getopt('', ['origin:', 'admin:']);
$root = dirname(__DIR__);
if (is_file($root . '/private/config.php')) {
  fwrite(STDERR, "Configuration exists; setup stopped.\n");
  exit(1);
}
$origin = rtrim($options['origin'] ?? '', '/');
$admin = $options['admin'] ?? '';
if (!filter_var($origin, FILTER_VALIDATE_URL) || !filter_var($admin, FILTER_VALIDATE_EMAIL)) {
  fwrite(
    STDERR,
    "Usage: php scripts/setup.php --origin=https://example.org --admin=admin@example.org\n",
  );
  exit(1);
}
if (!is_dir($root . '/var')) {
  mkdir($root . '/var', 0700, true);
}
$file = $root . '/var/octenarius.sqlite';
if (is_file($file)) {
  fwrite(STDERR, "Database exists; setup stopped.\n");
  exit(1);
}
$db = new PDO('sqlite:' . $file);
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->exec(file_get_contents($root . '/migrations/sqlite.sql'));
chmod($file, 0600);
$config = require $root . '/private/config.example.php';
$config['origin'] = $origin;
$config['card_admin_emails'] = [$admin];
$config['app_key'] = bin2hex(random_bytes(32));
file_put_contents(
  $root . '/private/config.php',
  "<?php\nreturn " . var_export($config, true) . ";\n",
  LOCK_EX,
);
chmod($root . '/private/config.php', 0600);
echo "Empty installation initialized. Configure SMTP before using sign-in links.\n";
