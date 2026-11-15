<?php
declare(strict_types=1);
// Production entry: existing Octenarius admin session, no local test account or token login.
$root = dirname(__DIR__);
$cms = $root . '/typemill';
$config = require __DIR__ . '/config.php';
$rel =
  substr(
    rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? ''),
    strlen('/handbuch'),
  ) ?:
  '/';
if (str_contains($rel, '..') || str_contains($rel, "\0")) {
  http_response_code(403);
  exit();
}
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('X-Frame-Options: SAMEORIGIN');
// Only explicit static asset locations are readable; settings, sources and histories stay outside docroot.
if (
  preg_match(
    '~^/(system/typemill/author/(css|js|img)/|themes/[^/]+/(css|js|img|images|fonts)/|plugins/octhistory/|plugins/ebooks/(public/|booklayouts/))~',
    $rel,
  ) &&
  preg_match('~\.(css|js|png|jpg|jpeg|svg|webp|woff2?|ttf|ico)$~i', $rel)
) {
  $file = realpath($cms . $rel);
  if (!$file || !str_starts_with($file, $cms . '/') || !is_file($file)) {
    http_response_code(404);
    exit();
  }
  $types = [
    'css' => 'text/css',
    'js' => 'application/javascript',
    'svg' => 'image/svg+xml',
    'png' => 'image/png',
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'webp' => 'image/webp',
    'woff2' => 'font/woff2',
    'woff' => 'font/woff',
    'ttf' => 'font/ttf',
    'ico' => 'image/x-icon',
  ];
  header('Content-Type: ' . $types[strtolower(pathinfo($file, PATHINFO_EXTENSION))]);
  readfile($file);
  exit();
}
// Only generated eBook CSS is public; no general cache access.
if (preg_match('~^/cache/ebooklayout-[a-z0-9-]+-custom\.css$~D', $rel)) {
  $file = realpath($cms . $rel);
  if (!$file || !str_starts_with($file, $cms . '/cache/') || !is_file($file)) {
    http_response_code(404);
    exit();
  }
  header('Content-Type: text/css');
  readfile($file);
  exit();
}
if ($rel === '/') {
  header('Location: /#/de/rules');
  exit();
}
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/card-editor.php';
require_once __DIR__ . '/browser-session.php';
octStartBrowserSession(true);
$uid = $_SESSION['uid'] ?? null;
$active = $_SESSION['active'] ?? 0;
$db = new PDO($config['dsn'], $config['user'], $config['password'], [
  PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$user = $uid ? query($db, 'SELECT id,email FROM users WHERE id=?', [$uid])->fetch() : null;
$allowed = $user && cardRole($db, $user, $config) === 'admin';
session_write_close();
if (!$allowed) {
  if (
    str_starts_with($rel, '/api/') ||
    !in_array($_SERVER['REQUEST_METHOD'], ['GET', 'HEAD'], true)
  ) {
    header('Content-Type: application/json');
    http_response_code(403);
    echo '{"error":"Administratorrechte erforderlich."}';
    exit();
  }
  header('Location: /#/de/account');
  exit();
}
if (
  !in_array($_SERVER['REQUEST_METHOD'], ['GET', 'HEAD'], true) &&
  ($_SERVER['HTTP_ORIGIN'] ?? '') !== $config['origin']
) {
  http_response_code(403);
  exit();
}
// Free-only deployment: never dispatch the paid remote-PDF endpoint.
if ($rel === '/api/v1/kixotepdf') {
  http_response_code(403);
  header('Content-Type: application/json');
  echo '{"message":"Nur kostenloser Browser-PDF-Export ist aktiviert."}';
  exit();
}
if (in_array($rel, ['/tm/account', '/tm/user', '/tm/users'], true)) {
  require __DIR__ . '/typemill-account.php';
  exit();
}
// Authentication and user/role configuration remain managed by Octenarius.
if (preg_match('~^/tm/(login|setup|logout|users|user|account|recover|reset)(/|$)~', $rel)) {
  header('Location: /#/de/account');
  exit();
}
if (preg_match('~^/api/v1/(user|users)~', $rel)) {
  http_response_code(403);
  exit();
}
if ($rel === '/' || $rel === '/tm' || $rel === '/tm/') {
  header('Location: /handbuch/tm/content/visual/regeln');
  exit();
}
if (
  !str_starts_with($rel, '/tm/') &&
  !str_starts_with($rel, '/api/') &&
  !str_starts_with($rel, '/media/')
) {
  header('Location: /#/de/rules');
  exit();
}
chdir($cms);
require $cms . '/system/vendor/autoload.php';
$name = 'oct-' . hash('sha256', $user['id']);
$file = $cms . '/settings/users/' . $name . '.yaml';
if (!is_file($file)) {
  $data = [
    'username' => $name,
    'email' => $user['email'],
    'userrole' => 'administrator',
    'password' => password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT),
    'language' => 'de',
  ];
  $temp = $file . '.' . bin2hex(random_bytes(4));
  file_put_contents($temp, Symfony\Component\Yaml\Yaml::dump($data), LOCK_EX);
  chmod($temp, 0600);
  rename($temp, $file);
}
$cmsSid = $_COOKIE['__Secure-typemill-session'] ?? '';
session_id(is_string($cmsSid) && preg_match('/^[A-Za-z0-9,-]{22,128}$/D', $cmsSid) ? $cmsSid : '');
\Typemill\Static\Session::startSessionForSegments(
  ['tm', 'api', 'media'],
  ltrim($rel, '/'),
  'https',
);
if (($_SESSION['username'] ?? null) !== $name) {
  $model = new \Typemill\Models\User();
  $model->setUser($name);
  $model->login();
}
if ($rel === '/tm/octenarius-ebook') {
  header('Cache-Control: no-store');
  header('X-Robots-Tag: noindex, nofollow');
  try {
    require __DIR__ . '/octenarius-ebooks.php';
    header('Location: ' . octPrepareEbook($cms, (string) ($_GET['lang'] ?? 'de')));
  } catch (Throwable $error) {
    http_response_code(422);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Die PDF-Vorschau konnte nicht vorbereitet werden. Bitte veröffentlichte Regelstruktur prüfen.';
  }
  exit();
}
if (str_starts_with($rel, '/tm/ebooks')) {
  header('Cache-Control: no-store');
  header('X-Robots-Tag: noindex, nofollow');
}
$_SERVER['SCRIPT_NAME'] = '/handbuch/index.php';
$_SERVER['SCRIPT_FILENAME'] = $cms . '/index.php';
require $cms . '/index.php';
