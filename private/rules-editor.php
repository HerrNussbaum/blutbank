<?php
declare(strict_types=1);
// Whole-rulebook snapshots. The CAS counter protects shared work; it is not section history.
function initialRules(): array
{
  $book = ['name' => 'Revision 01', 'languages' => []];
  foreach (['de', 'en'] as $lang) {
    $rows = json_decode(
      file_get_contents(__DIR__ . '/../public/data/rules-' . $lang . '.json'),
      true,
      512,
      JSON_THROW_ON_ERROR,
    );
    $ids = array_column($rows, 'id');
    foreach ($rows as &$r) {
      $parent = $r['id'];
      do {
        $parent = str_contains($parent, '.') ? substr($parent, 0, strrpos($parent, '.')) : '';
      } while ($parent !== '' && !in_array($parent, $ids, true));
      $r['parent'] = $parent;
    }
    unset($r);
    $book['languages'][$lang] = $rows;
  }
  return $book;
}
function ruleMediaUrl(mixed $value, bool $video = false): bool
{
  if (!is_string($value) || strlen($value) > 2048) {
    return false;
  }
  $url = parse_url($value);
  if (
    !$url ||
    ($url['scheme'] ?? '') !== 'https' ||
    empty($url['host']) ||
    isset($url['user']) ||
    isset($url['pass'])
  ) {
    return false;
  }
  return !$video ||
    (in_array(
      strtolower($url['host']),
      ['www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'],
      true,
    ) &&
      preg_match('~^/(embed/[a-zA-Z0-9_-]+|video/[0-9]+)$~', $url['path'] ?? ''));
}
function ruleColor(mixed $value): bool
{
  return is_string($value) &&
    preg_match(
      '/^(#[0-9a-f]{3,4}|#[0-9a-f]{6}|#[0-9a-f]{8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0(?:\.\d+)?|1(?:\.0+)?|\.\d+))?\s*\)|[a-z]{1,30})$/iD',
      $value,
    );
}
function ruleLink(mixed $value): bool
{
  return is_string($value) &&
    strlen($value) < 2048 &&
    !preg_match('/[\x00-\x20]/', $value) &&
    !str_starts_with($value, '//') &&
    (preg_match('~^(https?://|mailto:|tel:|sms:|\#|/(?!/)|\./|\.\./)~i', $value) ||
      !preg_match('~[:\\\\]~', $value));
}

function validateRuleDelta(mixed $delta): array
{
  if (
    !is_array($delta) ||
    !is_array($delta['ops'] ?? null) ||
    !array_is_list($delta['ops']) ||
    count($delta['ops']) > 10000
  ) {
    fail('Ungültiger Editorinhalt.');
  }
  $ops = [];
  $plain = '';
  $last = '';
  foreach ($delta['ops'] as $op) {
    if (!is_array($op) || !isset($op['insert'])) {
      fail('Ungültiger Editorinhalt.');
    }
    $insert = $op['insert'];
    if (is_string($insert)) {
      $plain .= $insert;
      $last = $insert;
    } elseif (is_array($insert) && count($insert) === 1) {
      $kind = array_key_first($insert);
      $value = $insert[$kind];
      if ($kind === 'image' && ruleMediaUrl($value)) {
        $plain .= ' [Bild] ';
      } elseif ($kind === 'video' && ruleMediaUrl($value, true)) {
        $plain .= ' [Video] ';
      } elseif ($kind === 'formula' && is_string($value) && strlen($value) <= 2048) {
        $plain .= ' ' . $value . ' ';
      } else {
        fail(
          'Ungültiges Medium. Bilder benötigen HTTPS; Videos einen YouTube-/Vimeo-Einbettungslink.',
        );
      }
      $last = '';
    } else {
      fail('Ungültiger Editorinhalt.');
    }
    $attrs = $op['attributes'] ?? [];
    if (!is_array($attrs)) {
      fail('Ungültige Formatierung.');
    }
    $safe = [];
    foreach ($attrs as $k => $v) {
      if ($v === null || $v === false) {
        continue;
      }
      if (in_array($k, ['header', 'indent'], true) && is_string($v) && ctype_digit($v)) {
        $v = (int) $v;
      }
      if (($k === 'direction' && $v === 'ltr') || ($k === 'size' && $v === 'normal')) {
        continue;
      }
      if (
        in_array($k, ['bold', 'italic', 'underline', 'strike', 'code', 'blockquote'], true) &&
        is_bool($v)
      ) {
        $safe[$k] = $v;
      } elseif (
        $k === 'list' &&
        in_array($v, ['ordered', 'bullet', 'checked', 'unchecked'], true)
      ) {
        $safe[$k] = $v;
      } elseif ($k === 'table' && is_string($v) && preg_match('/^[a-zA-Z0-9_-]{1,80}$/D', $v)) {
        $safe[$k] = $v;
      } elseif ($k === 'header' && is_int($v) && $v >= 1 && $v <= 6) {
        $safe[$k] = $v;
      } elseif ($k === 'indent' && is_int($v) && $v >= 0 && $v <= 8) {
        $safe[$k] = $v;
      } elseif ($k === 'align' && in_array($v, ['left', 'center', 'right', 'justify'], true)) {
        $safe[$k] = $v;
      } elseif ($k === 'direction' && $v === 'rtl') {
        $safe[$k] = $v;
      } elseif ($k === 'font' && in_array($v, ['serif', 'monospace', 'sans-serif'], true)) {
        $safe[$k] = $v;
      } elseif ($k === 'size' && in_array($v, ['small', 'large', 'huge'], true)) {
        $safe[$k] = $v;
      } elseif ($k === 'script' && in_array($v, ['sub', 'super'], true)) {
        $safe[$k] = $v;
      } elseif (in_array($k, ['color', 'background'], true) && ruleColor($v)) {
        $safe[$k] = $v;
      } elseif (
        $k === 'code-block' &&
        ($v === true || (is_string($v) && preg_match('/^[a-z0-9_-]{1,40}$/iD', $v)))
      ) {
        $safe[$k] = $v;
      } elseif ($k === 'link' && ruleLink($v)) {
        $safe[$k] = $v;
      } elseif (
        in_array($k, ['width', 'height'], true) &&
        (is_string($v) || is_int($v)) &&
        preg_match('/^(?:[0-9]{1,4}(?:px|%)?|auto)$/D', (string) $v)
      ) {
        $safe[$k] = $v;
      } elseif ($k === 'alt' && is_string($v) && strlen($v) < 500) {
        $safe[$k] = $v;
      } else {
        fail(
          'Nicht erlaubte Formatierung: ' .
            substr(preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $k), 0, 40) .
            ' (' .
            (is_scalar($v) ? substr((string) $v, 0, 80) : get_debug_type($v)) .
            ').',
        );
      }
    }
    $ops[] = ['insert' => $insert, 'attributes' => $safe ?: new stdClass()];
  }
  if (strlen($plain) > 150000 || !str_ends_with($last, "\n")) {
    fail('Ungültiger Editorinhalt.');
  }
  return ['delta' => ['ops' => $ops], 'body' => $plain];
}
function glossaryDefaults(): array
{
  return json_decode(
    file_get_contents(__DIR__ . '/../public/data/glossary.json'),
    true,
    512,
    JSON_THROW_ON_ERROR,
  );
}
function completeRulebook(array $book): array
{
  if (!array_key_exists('glossary', $book)) {
    $book['glossary'] = glossaryDefaults();
  }
  return $book;
}
function validateRuleGlossary(mixed $terms): array
{
  if (!is_array($terms) || !array_is_list($terms) || count($terms) > 2000) {
    fail('Ungültiges Begriffsverzeichnis.');
  }
  $out = [];
  $seen = [];
  foreach ($terms as $term) {
    if (
      !is_array($term) ||
      !is_string($term['id'] ?? null) ||
      !preg_match('/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/D', $term['id']) ||
      isset($seen[$term['id']])
    ) {
      fail('Ungültiger Begriff.');
    }
    $t = ['id' => $term['id']];
    $seen[$t['id']] = true;
    foreach (['de', 'en'] as $lang) {
      if (
        !is_string($term[$lang] ?? null) ||
        trim($term[$lang]) === '' ||
        strlen($term[$lang]) > 500 ||
        !is_string($term[$lang . 'Text'] ?? null) ||
        strlen($term[$lang . 'Text']) > 150000
      ) {
        fail('Ungültiger Begriffstext.');
      }
      $t[$lang] = trim($term[$lang]);
      $t[$lang . 'Text'] = $term[$lang . 'Text'];
      if (isset($term[$lang . 'Delta'])) {
        $valid = validateRuleDelta($term[$lang . 'Delta']);
        $t[$lang . 'Delta'] = $valid['delta'];
        $t[$lang . 'Text'] = $valid['body'];
      }
    }
    foreach (['kind', 'rule'] as $key) {
      $v = $term[$key] ?? '';
      if (
        !is_string($v) ||
        strlen($v) > 80 ||
        ($key === 'rule' && $v !== '' && !preg_match('/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/D', $v))
      ) {
        fail('Ungültige Begriffseigenschaft.');
      }
      $t[$key] = $v;
    }
    $aliases = $term['aliases'] ?? [];
    if (!is_array($aliases) || !array_is_list($aliases) || count($aliases) > 100) {
      fail('Ungültige alternative Bezeichnungen.');
    }
    foreach ($aliases as $alias) {
      if (!is_string($alias) || strlen($alias) > 500) {
        fail('Ungültige alternative Bezeichnung.');
      }
    }
    $t['aliases'] = array_values(array_unique(array_filter(array_map('trim', $aliases))));
    $out[] = $t;
  }
  return $out;
}
function validateRulebook(mixed $book): array
{
  if (
    !is_array($book) ||
    !is_string($book['name'] ?? null) ||
    trim($book['name']) === '' ||
    strlen($book['name']) > 160
  ) {
    fail('Bitte eine Revisionsbezeichnung angeben.');
  }
  $out = [
    'name' => trim($book['name']),
    'languages' => [],
    'glossary' => validateRuleGlossary($book['glossary'] ?? glossaryDefaults()),
  ];
  foreach (['de', 'en'] as $lang) {
    $rows = $book['languages'][$lang] ?? null;
    if (!is_array($rows) || !array_is_list($rows) || count($rows) < 1 || count($rows) > 1000) {
      fail('Ungültiges Regelverzeichnis.');
    }
    $seen = [];
    $clean = [];
    foreach ($rows as $r) {
      if (
        !is_array($r) ||
        !is_string($r['id'] ?? null) ||
        !preg_match('/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/D', $r['id']) ||
        isset($seen[$r['id']]) ||
        !is_string($r['parent'] ?? null) ||
        ($r['parent'] !== '' && !isset($seen[$r['parent']])) ||
        !is_string($r['title'] ?? null) ||
        trim($r['title']) === '' ||
        strlen($r['title']) > 500 ||
        !is_string($r['body'] ?? null) ||
        strlen($r['body']) > 150000
      ) {
        fail('Ungültiger Abschnitt oder Reihenfolge.');
      }
      $row = [
        'id' => $r['id'],
        'parent' => $r['parent'],
        'title' => trim($r['title']),
        'body' => $r['body'],
        'page' => max(0, min(10000, (int) ($r['page'] ?? 0))),
      ];
      if (isset($r['number']) && $r['number'] !== '') {
        if (
          !is_string($r['number']) ||
          !preg_match('/^[0-9]+(?:\.[0-9]+)*$/D', $r['number']) ||
          strlen($r['number']) > 80
        ) {
          fail('Ungültige Abschnittsnummer.');
        }
        $row['number'] = $r['number'];
      }
      if (isset($r['delta'])) {
        $row = array_replace($row, validateRuleDelta($r['delta']));
      }
      $seen[$r['id']] = true;
      $clean[] = $row;
    }
    // A subtree must be contiguous, so moving/deleting never affects unrelated sections.
    $closed = [];
    $stack = [];
    foreach ($clean as $r) {
      while ($stack && end($stack) !== $r['parent']) {
        $closed[array_pop($stack)] = true;
      }
      if (isset($closed[$r['parent']])) {
        fail('Abschnitte müssen innerhalb ihres Kapitels stehen.');
      }
      $stack[] = $r['id'];
    }
    $out['languages'][$lang] = $clean;
  }
  return $out;
}
function rulesEditorAction(PDO $db, array $config, ?array $user, string $action, array $data): void
{
  if (!str_starts_with($action, 'rules-')) {
    return;
  }
  $admin = cardRole($db, $user, $config) === 'admin';
  if ($action !== 'rules-live' && !$admin) {
    fail('Nur Administratoren dürfen Arbeitsfassungen einsehen und bearbeiten.', 403);
  }
  query(
    $db,
    'CREATE TABLE IF NOT EXISTS rulebooks (id INTEGER PRIMARY KEY, generation INTEGER NOT NULL, body LONGTEXT NOT NULL)',
  );
  $row = query($db, 'SELECT generation,body FROM rulebooks WHERE id=1')->fetch();
  $state = $row
    ? json_decode($row['body'], true, 512, JSON_THROW_ON_ERROR)
    : ['live' => initialRules(), 'draft' => null, 'archives' => []];
  $generation = $row ? (int) $row['generation'] : 0;
  $state['live'] = completeRulebook($state['live']);
  if ($state['draft']) {
    $state['draft'] = completeRulebook($state['draft']);
  }
  foreach ($state['archives'] as &$archived) {
    $archived = completeRulebook($archived);
  }
  unset($archived);
  if ($action === 'rules-live') {
    respond(['book' => $state['live']]);
  }
  if ($action === 'rules-admin') {
    respond(['generation' => $generation] + $state);
  }
  if (!is_int($data['generation'] ?? null) || $data['generation'] !== $generation) {
    fail('Inzwischen geändert. Bitte neu laden; deine Eingaben wurden nicht überschrieben.', 409);
  }
  if ($action === 'rules-start') {
    if ($state['draft']) {
      fail('Es gibt bereits eine Arbeitsfassung.', 409);
    }
    $state['draft'] = $state['live'];
    $state['draft']['name'] = trim((string) ($data['name'] ?? ''));
    $state['draft'] = validateRulebook($state['draft']);
  } elseif ($action === 'rules-save') {
    if (!$state['draft']) {
      fail('Keine Arbeitsfassung.', 409);
    }
    // Hosting limits the number of JSON arguments before PHP runs. Transfer the
    // complete book as one JSON string, then apply the same structural validation.
    $book = $data['book'] ?? null;
    if (array_key_exists('bookJson', $data)) {
      if (!is_string($data['bookJson']) || strlen($data['bookJson']) > 3500000) {
        fail('Ungültiges oder zu großes Regelwerk.');
      }
      try {
        $book = json_decode($data['bookJson'], true, 32, JSON_THROW_ON_ERROR);
      } catch (JsonException) {
        fail('Ungültiges Regelwerk-JSON.');
      }
    }
    if (is_array($book) && !array_key_exists('glossary', $book)) {
      $book['glossary'] = $state['draft']['glossary'];
    }
    $state['draft'] = validateRulebook($book);
  } elseif ($action === 'rules-publish') {
    if (!$state['draft']) {
      fail('Keine Arbeitsfassung.', 409);
    }
    $state['archives'][] = $state['live'];
    $state['live'] = $state['draft'];
    $state['live']['publishedAt'] = gmdate('c');
    $state['draft'] = null;
  } elseif ($action === 'rules-discard') {
    $state['draft'] = null;
  } elseif ($action === 'rules-restore') {
    if ($state['draft']) {
      fail('Bitte die aktuelle Arbeitsfassung erst veröffentlichen oder verwerfen.', 409);
    }
    $i = $data['index'] ?? null;
    if (!is_int($i) || !isset($state['archives'][$i])) {
      fail('Revision nicht gefunden.', 404);
    }
    $state['draft'] = $state['archives'][$i];
    $state['draft']['name'] .= ' (Wiederherstellung)';
  } else {
    fail('Unbekannte Regelaktion.', 404);
  }
  $body = json_encode($state, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
  if ($row) {
    if (
      !query(
        $db,
        'UPDATE rulebooks SET body=?,generation=generation+1 WHERE id=1 AND generation=?',
        [$body, $generation],
      )->rowCount()
    ) {
      fail('Inzwischen geändert. Bitte neu laden.', 409);
    }
  } else {
    try {
      query($db, 'INSERT INTO rulebooks(id,generation,body) VALUES(1,1,?)', [$body]);
    } catch (PDOException) {
      fail('Inzwischen geändert. Bitte neu laden.', 409);
    }
  }
  respond(['generation' => $generation + 1] + $state);
}
