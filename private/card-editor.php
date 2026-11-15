<?php
declare(strict_types=1);
require_once __DIR__ . '/card-reminders.php';
function cardRole(PDO $db, ?array $user, array $config): string
{
  if (!$user || !($config['card_editor_enabled'] ?? false)) {
    return 'reader';
  }
  if (
    in_array(
      strtolower($user['email']),
      array_map('strtolower', $config['card_admin_emails'] ?? []),
      true,
    )
  ) {
    return 'admin';
  }
  $role = query($db, 'SELECT role FROM card_roles WHERE user_id=?', [$user['id']])->fetchColumn();
  return in_array($role, ['editor', 'approver', 'admin'], true) ? $role : 'reader';
}
function cardPermissions(string $role): array
{
  return [
    'edit' => in_array($role, ['editor', 'admin'], true),
    'approve' => in_array($role, ['approver', 'admin'], true),
    'manage' => $role === 'admin',
    'access' => $role !== 'reader',
  ];
}
function gameplayFields(): array
{
  return [
    'typeLine',
    'types',
    'subtypes',
    'traits',
    'colors',
    'stats',
    'mechanics',
    'keywords',
    'rulesText',
    'additionalCostsText',
    'surcharges',
  ];
}
function cardRecords(PDO $db, array $config): array
{
  $cards = json_decode(
    file_get_contents(__DIR__ . '/../public/data/cards.json'),
    true,
    512,
    JSON_THROW_ON_ERROR,
  );
  $map = array_column($cards, null, 'id');
  $published = [];
  $shared = [];
  if ($config['card_editor_enabled'] ?? false) {
    foreach (
      query(
        $db,
        'SELECT card_id,body,updated_at FROM card_published ORDER BY updated_at ASC,card_id ASC',
      )->fetchAll()
      as $row
    ) {
      if (!isset($map[$row['card_id']])) {
        continue;
      }
      $body = json_decode($row['body'], true);
      $published[$row['card_id']] = $body;
      $key = $map[$row['card_id']]['gameplayId'] ?? $row['card_id'];
      $shared[$key] = $body['text'];
    }
  }
  foreach ($cards as &$card) {
    $id = $card['id'];
    $key = $card['gameplayId'] ?? $id;
    $source = $card['gameplaySourceId'] ?? $id;
    if (isset($published[$id])) {
      $card = array_replace($card, $published[$id]);
      $card['gameplayId'] = $key;
      $card['gameplaySourceId'] = $source;
    }
    if (isset($shared[$key])) {
      foreach (gameplayFields() as $field) {
        if (array_key_exists($field, $shared[$key])) {
          $card['text'][$field] = $shared[$key][$field];
        }
      }
      $review = array_values(array_diff($card['text']['reviewedFields'] ?? [], ['review.text']));
      if (in_array('review.text', $shared[$key]['reviewedFields'] ?? [], true)) {
        $review[] = 'review.text';
      }
      $card['text']['reviewedFields'] = $review;
      $card['text']['status'] =
        in_array('review.text', $review, true) && in_array('review.info', $review, true)
          ? 'reviewed'
          : 'machine';
    }
  }
  unset($card);
  foreach ($cards as &$card) {
    if (in_array($card['id'], ['19532e874bac', '549c4a48ddec'], true)) {
      $card['text']['gameplayId'] = $card['gameplayId'];
    }
  }
  unset($card);
  return array_map('normalizeCardReminders', $cards);
}
function cardAudit(
  PDO $db,
  string $id,
  string $action,
  string $actor,
  array $before,
  array $after,
  string $note,
): void {
  query(
    $db,
    'INSERT INTO card_audit(id,card_id,action,actor_id,before_body,after_body,note,created_at) VALUES(?,?,?,?,?,?,?,?)',
    [
      bin2hex(random_bytes(16)),
      $id,
      $action,
      $actor,
      json_encode($before, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
      json_encode($after, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
      $note,
      time(),
    ],
  );
}
function cardPatch(array $card, array $patch): array
{
  if (array_diff(array_keys($patch), ['card', 'text', 'textReviewed', 'infoReviewed'])) {
    throw new InvalidArgumentException('Unknown fields');
  }
  foreach (['card', 'text'] as $part) {
    if (
      isset($patch[$part]) &&
      (!is_array($patch[$part]) || (array_is_list($patch[$part]) && count($patch[$part])))
    ) {
      throw new InvalidArgumentException('Invalid fields');
    }
  }
  foreach ($patch['card'] ?? [] as $key => $value) {
    if (
      !in_array($key, ['name', 'code', 'notes'], true) ||
      !is_string($value) ||
      strlen($value) > ($key === 'notes' ? 30000 : 300) ||
      ($key === 'name' && trim($value) === '')
    ) {
      throw new InvalidArgumentException('Invalid card field');
    }
    if ($key === 'name' && $card[$key] !== $value) {
      $card['nameFromFilename'] = false;
    }
    $card[$key] = $value;
  }
  $lists = ['types', 'subtypes', 'traits', 'colors'];
  $strings = [
    'typeLine',
    'rulesText',
    'additionalCostsText',
    'flavorText',
    'rarity',
    'collectorNumber',
    'artist',
    'language',
  ];
  foreach ($patch['text'] ?? [] as $key => $value) {
    if (in_array($key, $strings, true)) {
      if (!is_string($value) || strlen($value) > 20000) {
        throw new InvalidArgumentException('Invalid text');
      }
      $card['text'][$key] = $value;
    } elseif (in_array($key, $lists, true)) {
      if (!is_array($value) || !array_is_list($value) || count($value) > 40) {
        throw new InvalidArgumentException('Invalid list');
      }
      foreach ($value as $v) {
        if (!is_string($v) || strlen($v) > 150) {
          throw new InvalidArgumentException('Invalid list item');
        }
      }
      $card['text'][$key] = $value;
    } elseif ($key === 'surcharges') {
      if (
        !in_array('Sovereign', $card['text']['types'], true) ||
        !is_array($value) ||
        array_is_list($value)
      ) {
        throw new InvalidArgumentException('Sovereign costs required');
      }
      $expected = array_values(
        array_diff(
          ['white', 'blue', 'green', 'brown', 'purple', 'red', 'orange', 'black'],
          $card['text']['colors'],
        ),
      );
      if (array_diff($expected, array_keys($value)) || array_diff(array_keys($value), $expected)) {
        throw new InvalidArgumentException('All foreign colors required');
      }
      foreach ($value as $v) {
        if ($v !== null && (!is_int($v) || $v < 0 || $v > 9)) {
          throw new InvalidArgumentException('Invalid surcharge');
        }
      }
      $card['text']['surcharges'] = $value;
      $card['text']['additionalCostsText'] = '';
    } elseif (in_array($key, ['stats', 'mechanics'], true)) {
      if (!is_array($value)) {
        throw new InvalidArgumentException('Invalid values');
      }
      foreach ($value as $k => $v) {
        $valid =
          $key === 'stats'
            ? in_array($k, ['asp', 'level', 'res', 'ini', 'pow', 'hp', 'magic', 'lp'], true) &&
              ($v === null || ($k === 'asp' && $v === 'X') || (is_int($v) && $v >= 0 && $v <= 1000))
            : in_array($k, ['pool', 'binding', 'rise'], true) && ($v === null || is_bool($v));
        if (!$valid) {
          throw new InvalidArgumentException('Invalid value');
        }
        $card['text'][$key][$k] = $v;
      }
    } else {
      throw new InvalidArgumentException('Unknown text field');
    }
  }
  if (!in_array('Sovereign', $card['text']['types'] ?? [], true)) {
    unset($card['text']['surcharges']);
    $card['text']['additionalCostsText'] = '';
  }
  // Preserve existing review markers when the editor does not submit review actions.
  $fields = $card['text']['reviewedFields'] ?? [];
  foreach (['textReviewed' => 'review.text', 'infoReviewed' => 'review.info'] as $flag => $marker) {
    if (!array_key_exists($flag, $patch)) {
      continue;
    }
    if (isset($patch[$flag]) && !is_bool($patch[$flag])) {
      throw new InvalidArgumentException('Invalid review marker');
    }
    $fields = array_values(array_diff($fields, [$marker]));
    if ($patch[$flag] ?? false) {
      $fields[] = $marker;
    }
  }
  $glossary = __DIR__ . '/../public/data/glossary.json';
  if (is_file($glossary)) {
    $keywords = [];
    foreach (json_decode(file_get_contents($glossary), true) as $term) {
      if (
        ($term['kind'] ?? '') === 'Keyword' &&
        preg_match(
          '/(?<!\\w)' . preg_quote($term['en'], '/') . '(?!\\w)/iu',
          $card['text']['rulesText'],
        )
      ) {
        $keywords[] = $term['en'];
      }
    }
    $card['text']['keywords'] = $keywords;
  }
  $card['text']['reviewedFields'] = $fields;
  $card['text']['status'] =
    in_array('review.text', $fields, true) && in_array('review.info', $fields, true)
      ? 'reviewed'
      : 'machine';
  return normalizeCardReminders($card);
}
function cardEditorAction(PDO $db, array $config, ?array $user, string $action, array $data): void
{
  if (in_array($action, ['cards', 'cards-download', 'texts-download', 'cards-csv'], true)) {
    $cards = cardRecords($db, $config);
    if ($action === 'cards') {
      respond(['cards' => $cards]);
    }
    if ($action === 'cards-csv') {
      header('Content-Type: text/csv; charset=utf-8');
      header('Content-Disposition: attachment; filename="card-texts.csv"');
      $out = fopen('php://output', 'w');
      fwrite($out, "\xEF\xBB\xBF");
      $cols = [
        'id',
        'name',
        'set',
        'typeLine',
        'colors',
        'rarity',
        'asp',
        'level',
        'res',
        'ini',
        'pow',
        'hp',
        'magic',
        'lp',
        'rulesText',
        'additionalCostsText',
        'flavorText',
      ];
      fputcsv($out, $cols, ',', '"', '');
      foreach ($cards as $c) {
        $d = $c['text'];
        $row = array_merge($d, $d['stats'], [
          'id' => $c['id'],
          'name' => $c['name'],
          'set' => $c['set'],
          'colors' => implode(', ', $d['colors']),
        ]);
        $values = [];
        foreach ($cols as $k) {
          $v = $row[$k] ?? '';
          if (is_string($v) && preg_match('/^[=+@-]/', $v)) {
            $v = "'" . $v;
          }
          $values[] = $v;
        }
        fputcsv($out, $values, ',', '"', '');
      }
      fclose($out);
      exit();
    }
    header(
      'Content-Disposition: attachment; filename="' .
        ($action === 'texts-download' ? 'card-texts' : 'cards') .
        '.json"',
    );
    echo json_encode(
      $action === 'texts-download'
        ? array_map(
          fn($c) => array_merge(
            ['id' => $c['id'], 'name' => $c['name'], 'set' => $c['set']],
            $c['text'],
          ),
          $cards,
        )
        : $cards,
      JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE,
    );
    exit();
  }
  if (!str_starts_with($action, 'card-')) {
    return;
  }
  if (!$user) {
    fail('Bitte zuerst anmelden.', 401);
  }
  $role = cardRole($db, $user, $config);
  $permissions = cardPermissions($role);
  if (!$permissions['access']) {
    fail('Keine Redaktionsberechtigung.', 403);
  }
  if ($action === 'card-users') {
    if (!$permissions['manage']) {
      fail('Keine Berechtigung zur Rechteverwaltung.', 403);
    }
    respond([
      'users' => query(
        $db,
        "SELECT u.email,COALESCE(r.role,'reader') AS role FROM users u LEFT JOIN card_roles r ON u.id=r.user_id ORDER BY u.email",
      )->fetchAll(),
      'owners' => $config['card_admin_emails'] ?? [],
    ]);
  }
  if ($action === 'card-role') {
    if (!$permissions['manage']) {
      fail('Keine Berechtigung zur Rechteverwaltung.', 403);
    }
    $inputEmail = $data['email'] ?? '';
    if (!is_string($inputEmail)) {
      fail('Ungültige E-Mail.');
    }
    $email = strtolower(trim($inputEmail));
    $new = $data['role'] ?? '';
    if (!in_array($new, ['reader', 'editor', 'approver', 'admin'], true)) {
      fail('Ungültige Rolle.');
    }
    $target = query($db, 'SELECT id,email FROM users WHERE email=?', [$email])->fetch();
    if (!$target) {
      fail('Dieses Konto muss sich zuerst einmal anmelden.', 404);
    }
    if ($target['id'] === $user['id']) {
      fail('Die eigene Rolle kann hier nicht geändert werden.', 409);
    }
    if (in_array($email, array_map('strtolower', $config['card_admin_emails'] ?? []), true)) {
      fail('Das Startkonto wird in der Serverkonfiguration verwaltet.', 409);
    }
    $db->beginTransaction();
    $old = cardRole($db, $target, $config);
    query($db, 'DELETE FROM card_roles WHERE user_id=?', [$target['id']]);
    if ($new !== 'reader') {
      query($db, 'INSERT INTO card_roles(user_id,role) VALUES(?,?)', [$target['id'], $new]);
    }
    cardAudit(
      $db,
      '',
      'role',
      $user['id'],
      ['email' => $email, 'role' => $old],
      ['email' => $email, 'role' => $new],
      'Rollenänderung',
    );
    $db->commit();
    respond(['ok' => true]);
  }
  if ($action === 'card-queue') {
    respond([
      'drafts' => query(
        $db,
        'SELECT d.card_id,d.revision,d.base_revision,d.state,d.source_note,d.updated_at,u.email AS author FROM card_drafts d JOIN users u ON u.id=d.author_id ORDER BY d.updated_at DESC',
      )->fetchAll(),
      'permissions' => $permissions,
    ]);
  }
  $id = $data['id'] ?? ($_GET['id'] ?? '');
  if (!is_string($id) || !preg_match('/^[a-f0-9]{12}$/D', $id)) {
    fail('Ungültige Karten-ID.');
  }
  if ($id === '688dcbaa3d2b') {
    $id = 'cca2d2102a69';
  }
  $cards = array_column(cardRecords($db, $config), null, 'id');
  if (!isset($cards[$id])) {
    fail('Karte nicht gefunden.', 404);
  }
  $id = $cards[$id]['gameplaySourceId'] ?? $id;
  $published = $cards[$id];
  $pubRevision =
    (int) (query($db, 'SELECT revision FROM card_published WHERE card_id=?', [
      $id,
    ])->fetchColumn() ?:
    0);
  $draft = query($db, 'SELECT * FROM card_drafts WHERE card_id=?', [$id])->fetch() ?: null;
  if ($action === 'card-load') {
    respond([
      'card' => $published,
      'publishedRevision' => $pubRevision,
      'draft' => $draft ? array_merge($draft, ['body' => json_decode($draft['body'], true)]) : null,
      'permissions' => $permissions,
    ]);
  }
  if ($action === 'card-history') {
    $rows = query(
      $db,
      'SELECT a.id,a.action,a.before_body,a.after_body,a.note,a.created_at,u.email AS actor FROM card_audit a JOIN users u ON u.id=a.actor_id WHERE a.card_id=? ORDER BY a.created_at DESC,a.id DESC LIMIT 100',
      [$id],
    )->fetchAll();
    foreach ($rows as &$r) {
      $r['before'] = json_decode($r['before_body'], true);
      $r['after'] = json_decode($r['after_body'], true);
      unset($r['before_body'], $r['after_body']);
    }
    respond(['history' => $rows]);
  }
  if (!is_int($data['revision'] ?? null)) {
    fail('Versionsnummer fehlt.');
  }
  if ($action === 'card-discard') {
    if (!$permissions['edit']) {
      fail('Keine Bearbeitungsberechtigung.', 403);
    }
    $db->beginTransaction();
    $n = query($db, 'DELETE FROM card_drafts WHERE card_id=? AND revision=? AND state=?', [
      $id,
      $data['revision'],
      'draft',
    ])->rowCount();
    if (!$n) {
      $db->rollBack();
      fail('Entwurf inzwischen geändert oder eingereicht.', 409);
    }
    cardAudit(
      $db,
      $id,
      'discard',
      $user['id'],
      $draft ? json_decode($draft['body'], true) : [],
      [],
      'Entwurf verworfen',
    );
    $db->commit();
    respond(['ok' => true]);
  }
  if ($action === 'card-save') {
    if (!$permissions['edit']) {
      fail('Keine Bearbeitungsberechtigung.', 403);
    }
    if ($draft && $draft['state'] === 'submitted') {
      fail('Der Entwurf wartet auf Freigabe. Zuerst zurückziehen oder zurückgeben.', 409);
    }
    $sourceNote = $data['sourceNote'] ?? '';
    if (!is_string($sourceNote)) {
      fail('Ungültige Quellenangabe.');
    }
    $note = trim($sourceNote);
    if ($note === '' || strlen($note) > 2000) {
      fail('Bitte Quelle und Änderungsgrund angeben.');
    }
    try {
      $body = cardPatch(
        $draft ? json_decode($draft['body'], true) : $published,
        $data['patch'] ?? [],
      );
    } catch (Throwable) {
      fail('Ungültige Kartenfelder.');
    }
    $expected = $data['revision'];
    $json = json_encode($body, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    $db->beginTransaction();
    if ($draft) {
      $changed = query(
        $db,
        'UPDATE card_drafts SET body=?,revision=revision+1,author_id=?,source_note=?,updated_at=? WHERE card_id=? AND revision=? AND state=?',
        [$json, $user['id'], $note, time(), $id, $expected, 'draft'],
      )->rowCount();
      if (!$changed) {
        $db->rollBack();
        fail('Der Entwurf wurde inzwischen geändert. Bitte neu laden.', 409);
      }
    } else {
      if ($expected !== 0) {
        $db->rollBack();
        fail('Versionskonflikt.', 409);
      }
      try {
        query(
          $db,
          'INSERT INTO card_drafts(card_id,body,revision,base_revision,state,author_id,source_note,updated_at) VALUES(?,?,1,?,?,?,?,?)',
          [$id, $json, $pubRevision, 'draft', $user['id'], $note, time()],
        );
      } catch (PDOException) {
        $db->rollBack();
        fail('Der Entwurf wurde inzwischen angelegt. Bitte neu laden.', 409);
      }
    }
    cardAudit(
      $db,
      $id,
      'save',
      $user['id'],
      $draft ? json_decode($draft['body'], true) : $published,
      $body,
      $note,
    );
    $db->commit();
    respond(['revision' => $expected + 1]);
  }
  if (in_array($action, ['card-submit', 'card-withdraw', 'card-reject'], true)) {
    if ($action === 'card-reject' ? !$permissions['approve'] : !$permissions['edit']) {
      fail('Keine Berechtigung.', 403);
    }
    $from = $action === 'card-submit' ? 'draft' : 'submitted';
    $to = $action === 'card-submit' ? 'submitted' : 'draft';
    $note = trim($data['note'] ?? '');
    if ($action === 'card-reject' && $note === '') {
      fail('Bitte einen Rückgabegrund angeben.');
    }
    if (strlen($note) > 2000) {
      fail('Notiz zu lang.');
    }
    $db->beginTransaction();
    $n = query(
      $db,
      'UPDATE card_drafts SET state=?,revision=revision+1,updated_at=? WHERE card_id=? AND revision=? AND state=?',
      [$to, time(), $id, $data['revision'], $from],
    )->rowCount();
    if (!$n) {
      $db->rollBack();
      fail('Entwurf oder Version inzwischen geändert.', 409);
    }
    cardAudit($db, $id, substr($action, 5), $user['id'], [], [], $note);
    $db->commit();
    respond(['revision' => $data['revision'] + 1]);
  }
  if (in_array($action, ['card-publish', 'card-restore'], true)) {
    if (!$permissions['approve']) {
      fail('Keine Freigabeberechtigung.', 403);
    }
    if (
      !is_int($data['publishedRevision'] ?? null) ||
      $data['publishedRevision'] !== $pubRevision
    ) {
      fail('Die veröffentlichte Version wurde geändert.', 409);
    }
    if ($action === 'card-publish') {
      if (
        !$draft ||
        $draft['state'] !== 'submitted' ||
        (int) $draft['revision'] !== $data['revision'] ||
        (int) $draft['base_revision'] !== $pubRevision
      ) {
        fail('Entwurf ist nicht freigabefähig oder veraltet.', 409);
      }
      $next = json_decode($draft['body'], true);
      $note = $draft['source_note'];
    } else {
      $event = query(
        $db,
        'SELECT before_body FROM card_audit WHERE id=? AND card_id=? AND action IN (?,?)',
        [$data['eventId'] ?? '', $id, 'publish', 'restore'],
      )->fetchColumn();
      if (!$event) {
        fail('Version nicht gefunden.', 404);
      }
      $next = json_decode($event, true);
      $note = trim($data['note'] ?? '');
      if ($note === '' || strlen($note) > 2000) {
        fail('Bitte Wiederherstellung begründen.');
      }
    }
    $db->beginTransaction();
    // Lock the draft revision by a conditional update; a simultaneous withdrawal cannot publish.
    if (
      $action === 'card-publish' &&
      !query(
        $db,
        'UPDATE card_drafts SET state=?,revision=revision+1 WHERE card_id=? AND state=? AND revision=?',
        ['publishing', $id, 'submitted', $data['revision']],
      )->rowCount()
    ) {
      $db->rollBack();
      fail('Entwurf inzwischen geändert.', 409);
    }
    $json = json_encode($next, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    if ($pubRevision) {
      if (
        !query(
          $db,
          'UPDATE card_published SET body=?,revision=revision+1,updated_at=? WHERE card_id=? AND revision=?',
          [$json, time(), $id, $pubRevision],
        )->rowCount()
      ) {
        $db->rollBack();
        fail('Veröffentlichungskonflikt.', 409);
      }
    } else {
      try {
        query($db, 'INSERT INTO card_published(card_id,body,revision,updated_at) VALUES(?,?,1,?)', [
          $id,
          $json,
          time(),
        ]);
      } catch (PDOException) {
        $db->rollBack();
        fail('Veröffentlichungskonflikt.', 409);
      }
    }
    if ($action === 'card-publish') {
      query($db, 'DELETE FROM card_drafts WHERE card_id=?', [$id]);
    }
    cardAudit($db, $id, substr($action, 5), $user['id'], $published, $next, $note);
    $db->commit();
    respond(['revision' => $pubRevision + 1, 'card' => $next]);
  }
  fail('Unknown card action', 404);
}
