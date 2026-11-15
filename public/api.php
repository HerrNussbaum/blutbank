<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
require dirname(__DIR__) . '/private/bootstrap.php';
require dirname(__DIR__) . '/private/card-editor.php';
require dirname(__DIR__) . '/private/rules-editor.php';
set_exception_handler(function (Throwable $e) {
  error_log('Octenarius API: ' . get_class($e));
  fail('Server nicht verfügbar. / Server unavailable.', 503);
});
$configPath = dirname(__DIR__) . '/private/config.php';
if (!is_file($configPath)) {
  fail('Online-Konten noch nicht eingerichtet. / Online accounts not configured.', 503);
}
$config = require $configPath;
$editorSettings = dirname(__DIR__) . '/private/card-editor-settings.php';
if (is_file($editorSettings)) {
  $config = array_replace($config, require $editorSettings);
}
$test = getenv('BLUTBANK_TEST_MODE') === '1';
if (!$test && ($_SERVER['HTTPS'] ?? '') !== 'on') {
  fail('HTTPS required', 400);
}
if (strlen($config['app_key'] ?? '') < 32) {
  fail('Server configuration incomplete', 503);
}
require_once dirname(__DIR__) . '/private/browser-session.php';
octStartBrowserSession(!$test);
$action = $_GET['action'] ?? 'session';
$post = $_SERVER['REQUEST_METHOD'] === 'POST';
$data = [];
if ($post) {
  if (($_SERVER['HTTP_ORIGIN'] ?? '') !== $config['origin']) {
    fail('Invalid origin', 403);
  }
  if (!hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) {
    fail('Invalid session token', 403);
  }
  if (!str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) {
    fail('JSON required', 415);
  }
  $limit = str_starts_with($action, 'rules-') ? 4000000 : 300000;
  $raw = file_get_contents('php://input', false, null, 0, $limit + 1);
  if (strlen($raw) > $limit) {
    fail('Request too large', 413);
  }
  try {
    $data = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
  } catch (Throwable) {
    fail('Invalid JSON');
  }
  if (!is_array($data)) {
    fail('Invalid request');
  }
}
if (
  !in_array(
    $action,
    [
      'rules-live',
      'rules-admin',
      'session',
      'list',
      'read-deck',
      'meta',
      'cards',
      'cards-download',
      'texts-download',
      'cards-csv',
      'card-queue',
      'card-load',
      'card-history',
      'card-users',
    ],
    true,
  ) &&
  !$post
) {
  fail('POST required', 405);
}
$db = new PDO($config['dsn'], $config['user'], $config['password'], [
  PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$user = null;
if (isset($_SESSION['uid'])) {
  $user = query($db, 'SELECT id,email FROM users WHERE id=?', [$_SESSION['uid']])->fetch() ?: null;
}
if ($action === 'session') {
  respond([
    'user' => $user,
    'csrf' => $_SESSION['csrf'],
    'cardRole' => cardRole($db, $user, $config),
    'cardPermissions' => cardPermissions(cardRole($db, $user, $config)),
  ]);
}
rulesEditorAction($db, $config, $user, $action, $data);
cardEditorAction($db, $config, $user, $action, $data);
if ($action === 'request-login') {
  if (!$config['registration_enabled']) {
    fail('Anmeldung wird noch eingerichtet. / Sign-in is not enabled yet.', 503);
  }
  $email = strtolower(trim((string) ($data['email'] ?? '')));
  if (strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fail('Invalid email');
  }
  $ip = $_SERVER['REMOTE_ADDR'] ?? '';
  rateLimit($db, hash_hmac('sha256', 'ip:' . $ip, $config['app_key']), 15, 3600);
  rateLimit($db, hash_hmac('sha256', 'email:' . $email, $config['app_key']), 3, 900);
  query($db, 'DELETE FROM login_tokens WHERE expires_at < ?', [time()]);
  $token = bin2hex(random_bytes(32));
  $hash = hash('sha256', $token);
  query($db, 'INSERT INTO login_tokens(token_hash,email,expires_at) VALUES(?,?,?)', [
    $hash,
    $email,
    time() + 900,
  ]);
  try {
    sendLogin($config, $email, $token, ($data['lang'] ?? 'de') === 'en' ? 'en' : 'de');
  } catch (Throwable $e) {
    query($db, 'DELETE FROM login_tokens WHERE token_hash=?', [$hash]);
    error_log('Octenarius SMTP delivery failed');
    fail(
      'E-Mail konnte nicht versendet werden. Bitte später versuchen. / Email delivery failed.',
      503,
    );
  }
  respond(['ok' => true]);
}
if ($action === 'login') {
  rateLimit(
    $db,
    hash_hmac('sha256', 'token:' . ($_SERVER['REMOTE_ADDR'] ?? ''), $config['app_key']),
    30,
    900,
  );
  $token = $data['token'] ?? '';
  if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/D', $token)) {
    fail('Invalid or expired link', 401);
  }
  $hash = hash('sha256', $token);
  $db->beginTransaction();
  $row = query($db, 'SELECT email FROM login_tokens WHERE token_hash=? AND expires_at>?', [
    $hash,
    time(),
  ])->fetch();
  if (!$row) {
    $db->rollBack();
    fail('Link ungültig oder abgelaufen. / Link invalid or expired.', 401);
  }
  if (query($db, 'DELETE FROM login_tokens WHERE token_hash=?', [$hash])->rowCount() !== 1) {
    $db->rollBack();
    fail('Link already used', 401);
  }
  $u = query($db, 'SELECT id,email FROM users WHERE email=?', [$row['email']])->fetch();
  if (!$u) {
    $u = ['id' => bin2hex(random_bytes(16)), 'email' => $row['email']];
    query($db, 'INSERT INTO users(id,email,created_at) VALUES(?,?,?)', [
      $u['id'],
      $u['email'],
      time(),
    ]);
  }
  $db->commit();
  session_regenerate_id(true);
  $_SESSION['uid'] = $u['id'];
  $_SESSION['auth_started'] = time();
  $_SESSION['csrf'] = bin2hex(random_bytes(32));
  respond([
    'user' => $u,
    'csrf' => $_SESSION['csrf'],
    'cardRole' => cardRole($db, $u, $config),
    'cardPermissions' => cardPermissions(cardRole($db, $u, $config)),
  ]);
}
// One canonical deck ID; visibility is server-owned metadata in the stored body.
function deckVisibility(array $deck): string
{
  return in_array($deck['visibility'] ?? '', ['public', 'shared'], true)
    ? $deck['visibility']
    : 'private';
}
function readableDeck(array $row, ?array $user): array
{
  $deck = normalizeDeckCardIdentities(json_decode($row['body'], true, 512, JSON_THROW_ON_ERROR));
  $owned = $user && $row['user_id'] === $user['id'];
  if (!$owned && (($deck['trashed'] ?? false) || deckVisibility($deck) === 'private')) {
    fail('Deck ist privat oder nicht verfügbar. / Deck is private or unavailable.', 404);
  }
  $deck['visibility'] = deckVisibility($deck);
  return ['deck' => $deck, 'owned' => (bool) $owned] +
    ($owned ? ['revision' => (int) $row['revision']] : []);
}
if ($action === 'meta') {
  $rows = query($db, 'SELECT body FROM decks ORDER BY updated_at DESC')->fetchAll();
  $decks = [];
  foreach ($rows as $row) {
    $d = json_decode($row['body'], true);
    if (!($d['trashed'] ?? false) && deckVisibility($d) === 'public') {
      $decks[] = $d;
    }
  }
  respond(['decks' => $decks]);
}
if ($action === 'read-deck') {
  $id = $_GET['id'] ?? '';
  if (!is_string($id) || !preg_match('/^[\w-]{1,80}$/D', $id)) {
    fail('Deck unavailable', 404);
  }
  $row = query($db, 'SELECT body,user_id,revision FROM decks WHERE id=?', [$id])->fetch();
  if (!$row) {
    fail('Deck ist privat oder nicht verfügbar. / Deck is private or unavailable.', 404);
  }
  respond(readableDeck($row, $user));
}
// Old share addresses are read-only aliases and immediately resolve to the same deck ID.
if ($action === 'read-shared') {
  $token = $data['token'] ?? '';
  if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/D', $token)) {
    fail('Not found', 404);
  }
  $row = query($db, 'SELECT body,user_id,revision FROM decks WHERE share_token=?', [
    $token,
  ])->fetch();
  if (!$row) {
    fail('Deck unavailable', 404);
  }
  respond(readableDeck($row, $user));
}
if (!$user) {
  fail('Bitte zuerst anmelden. / Please sign in first.', 401);
}
if ($action === 'logout') {
  $_SESSION = [];
  session_regenerate_id(true);
  respond(['ok' => true]);
}
if ($action === 'list') {
  $rows = query($db, 'SELECT body,revision FROM decks WHERE user_id=? ORDER BY updated_at DESC', [
    $user['id'],
  ])->fetchAll();
  respond([
    'decks' => array_map(
      fn($r) => [
        'deck' => normalizeDeckCardIdentities(json_decode($r['body'], true)),
        'revision' => (int) $r['revision'],
      ],
      $rows,
    ),
  ]);
}
if ($action === 'save') {
  if (isset($data['expectedUser']) && $data['expectedUser'] !== $user['id']) {
    fail('Das angemeldete Konto hat sich geändert. / Account changed.', 409);
  }
  $cards = cardRecords($db, $config);
  $ids = json_decode(
    file_get_contents(__DIR__ . '/data/card-identities.json'),
    true,
    512,
    JSON_THROW_ON_ERROR,
  );
  try {
    $deck = validateDeckData($data['deck'] ?? [], $ids, array_column($cards, null, 'id'));
  } catch (Throwable) {
    fail('Ungültige Deckdaten. / Invalid deck data');
  }
  $id = $deck['id'];
  $existing = query($db, 'SELECT revision,user_id,body FROM decks WHERE id=?', [$id])->fetch();
  if ($existing) {
    if ($existing['user_id'] !== $user['id']) {
      fail('Deck ID unavailable', 409);
    }
    $previous = json_decode($existing['body'], true);
    $deck['visibility'] = $deck['trashed'] ? 'private' : deckVisibility($previous);
    $body = json_encode($deck, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    $rev = $data['revision'] ?? null;
    if (!is_int($rev)) {
      fail(
        'Online-Version geändert. Als neues Deck kopieren oder erneut laden. / Online version conflict.',
        409,
      );
    }
    $s = query(
      $db,
      'UPDATE decks SET body=?,revision=revision+1,updated_at=?,share_token=CASE WHEN ? THEN NULL ELSE share_token END WHERE id=? AND user_id=? AND revision=?',
      [$body, time(), $deck['trashed'] ? 1 : 0, $id, $user['id'], $rev],
    );
    if (!$s->rowCount()) {
      fail(
        'Online-Version geändert. Lokale Daten bleiben erhalten. / Online version conflict; local data retained.',
        409,
      );
    }
    respond(['revision' => $rev + 1, 'visibility' => $deck['visibility']]);
  }
  if (
    (int) query($db, 'SELECT COUNT(*) FROM decks WHERE user_id=?', [$user['id']])->fetchColumn() >=
    200
  ) {
    fail('Maximum 200 online decks', 409);
  }
  $deck['visibility'] = 'private';
  $body = json_encode($deck, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
  query($db, 'INSERT INTO decks(id,user_id,body,updated_at) VALUES(?,?,?,?)', [
    $id,
    $user['id'],
    $body,
    time(),
  ]);
  respond(['revision' => 1, 'visibility' => 'private']);
}
if ($action === 'delete') {
  if (($data['expectedUser'] ?? null) !== $user['id']) {
    fail('Account changed', 409);
  }
  $items = $data['decks'] ?? null;
  if (!is_array($items) || !$items || count($items) > 1000) {
    fail('Invalid deletion request');
  }
  $db->beginTransaction();
  foreach ($items as $item) {
    if (!is_string($item['id'] ?? null) || !is_int($item['revision'] ?? null)) {
      fail('Invalid deck');
    }
    $row = query($db, 'SELECT body,revision FROM decks WHERE id=? AND user_id=?', [
      $item['id'],
      $user['id'],
    ])->fetch();
    if (!$row || (int) $row['revision'] !== $item['revision']) {
      fail('Deck changed. Please reload.', 409);
    }
    $deck = json_decode($row['body'], true);
    if (!($deck['trashed'] ?? false)) {
      fail('Only trashed decks can be deleted', 409);
    }
  }
  foreach ($items as $item) {
    query($db, 'DELETE FROM decks WHERE id=? AND user_id=? AND revision=?', [
      $item['id'],
      $user['id'],
      $item['revision'],
    ]);
  }
  $db->commit();
  respond(['ok' => true]);
}
if ($action === 'visibility') {
  if (isset($data['expectedUser']) && $data['expectedUser'] !== $user['id']) {
    fail('Account changed', 409);
  }
  $id = $data['id'] ?? null;
  $visibility = $data['visibility'] ?? null;
  $revision = $data['revision'] ?? null;
  if (
    !is_string($id) ||
    !in_array($visibility, ['private', 'shared', 'public'], true) ||
    !is_int($revision)
  ) {
    fail('Invalid visibility request');
  }
  $row = query($db, 'SELECT body,revision FROM decks WHERE id=? AND user_id=?', [
    $id,
    $user['id'],
  ])->fetch();
  if (!$row) {
    fail('Not found', 404);
  }
  $deck = json_decode($row['body'], true);
  if ($deck['trashed']) {
    fail('Restore deck first', 409);
  }
  if ((int) $row['revision'] !== $revision) {
    fail('Deck wurde geändert. Bitte neu laden. / Deck changed; please reload.', 409);
  }
  $deck['visibility'] = $visibility;
  $deck['updatedAt'] = gmdate('c');
  $body = json_encode($deck, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
  $result = query(
    $db,
    'UPDATE decks SET body=?,revision=revision+1,updated_at=?,share_token=CASE WHEN ? THEN NULL ELSE share_token END WHERE id=? AND user_id=? AND revision=?',
    [$body, time(), $visibility === 'private' ? 1 : 0, $id, $user['id'], $revision],
  );
  if (!$result->rowCount()) {
    fail('Deck changed; please reload', 409);
  }
  respond(['revision' => $revision + 1, 'visibility' => $visibility]);
}
if (in_array($action, ['share', 'unshare'], true)) {
  fail(
    'Bitte Seite neu laden und Privat/Öffentlich in der Deckübersicht verwenden. / Reload and use Private/Public in your deck overview.',
    410,
  );
}

fail('Unknown action', 404);
