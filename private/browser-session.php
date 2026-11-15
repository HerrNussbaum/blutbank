<?php
declare(strict_types=1);
const OCT_SESSION_IDLE_SECONDS = 30 * 86400;
const OCT_SESSION_ABSOLUTE_SECONDS = 90 * 86400;
function octBrowserSessionExpired(array $session, int $now): bool
{
  return isset($session['uid']) &&
    ($now - (int) ($session['active'] ?? 0) >= OCT_SESSION_IDLE_SECONDS ||
      $now - (int) ($session['auth_started'] ?? $now) >= OCT_SESSION_ABSOLUTE_SECONDS);
}
function octStartBrowserSession(bool $secure): void
{
  if (session_status() === PHP_SESSION_ACTIVE) {
    throw new RuntimeException('Session already active');
  }
  $now = time();
  $oldPath = session_save_path();
  $directory = __DIR__ . '/browser-sessions';
  if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
    throw new RuntimeException('Session storage unavailable');
  }
  ini_set('session.use_strict_mode', '1');
  ini_set('session.use_only_cookies', '1');
  ini_set('session.gc_maxlifetime', (string) OCT_SESSION_IDLE_SECONDS);
  ini_set('session.gc_probability', '1');
  ini_set('session.gc_divisor', '100');
  session_name('blutbank_session');
  session_id('');
  $cookie = [
    'lifetime' => OCT_SESSION_IDLE_SECONDS,
    'path' => '/',
    'secure' => $secure,
    'httponly' => true,
    'samesite' => 'Lax',
  ];
  session_set_cookie_params($cookie);
  if (random_int(1, 100) === 1) {
    foreach (glob($directory . '/migration-*') ?: [] as $oldMarker) {
      if (is_file($oldMarker) && filemtime($oldMarker) < $now - 600) {
        @unlink($oldMarker);
      }
    }
  }
  $sid = $_COOKIE['blutbank_session'] ?? '';
  $migrated = [];
  $migrationLock = null;
  $migrationRedirect = null;
  $preferredSid = null;
  // Serialize first migration so simultaneous API requests keep the same login.
  if (
    is_string($sid) &&
    preg_match('/^[A-Za-z0-9,-]{22,128}$/D', $sid) &&
    !is_file($directory . '/sess_' . $sid) &&
    $oldPath !== $directory
  ) {
    $migrationLock = fopen($directory . '/migration-' . hash('sha256', $sid), 'c+');
    if (!$migrationLock || !flock($migrationLock, LOCK_EX)) {
      throw new RuntimeException('Session migration unavailable');
    }
    $migrationRedirect = json_decode(stream_get_contents($migrationLock), true);
    if (
      $migrationRedirect &&
      $now - (int) $migrationRedirect['at'] < 300 &&
      preg_match('/^[A-Za-z0-9,-]{22,128}$/D', $migrationRedirect['sid']) &&
      is_file($directory . '/sess_' . $migrationRedirect['sid'])
    ) {
      $preferredSid = $migrationRedirect['sid'];
    } elseif (!$migrationRedirect) {
      session_id($sid);
      session_start();
      if (isset($_SESSION['uid']) && $now - (int) ($_SESSION['active'] ?? 0) <= 43200) {
        $migrated = $_SESSION;
      }
      session_destroy();
      $_SESSION = [];
    }
    session_id('');
  }
  session_save_path($directory);
  if ($preferredSid) {
    session_id($preferredSid);
  } elseif (
    is_string($sid) &&
    preg_match('/^[A-Za-z0-9,-]{22,128}$/D', $sid) &&
    is_file($directory . '/sess_' . $sid)
  ) {
    session_id($sid);
  }
  session_start();
  if ($migrated) {
    $_SESSION = $migrated;
  }
  if ($migrationLock) {
    if (!$migrationRedirect) {
      rewind($migrationLock);
      ftruncate($migrationLock, 0);
      fwrite(
        $migrationLock,
        json_encode(['sid' => session_id(), 'at' => $now], JSON_THROW_ON_ERROR),
      );
      fflush($migrationLock);
    }
    flock($migrationLock, LOCK_UN);
    fclose($migrationLock);
  }
  if (octBrowserSessionExpired($_SESSION, $now)) {
    $_SESSION = [];
    session_regenerate_id(true);
  }
  if (isset($_SESSION['uid'])) {
    $_SESSION['auth_started'] ??= $now;
  }
  $_SESSION['active'] = $now;
  $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
  setcookie(session_name(), session_id(), [
    'expires' => $now + OCT_SESSION_IDLE_SECONDS,
    'path' => '/',
    'secure' => $secure,
    'httponly' => true,
    'samesite' => 'Lax',
  ]);
}
