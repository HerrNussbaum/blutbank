<?php
declare(strict_types=1);
function cardTypes(string $line): array
{
  return array_values(
    array_filter(
      [
        'Advisor',
        'Artifact',
        'Character',
        'Miracle',
        'Reference',
        'Resource',
        'Ritual',
        'Rune',
        'Sovereign',
        'Spell',
        'Token',
        'Training',
      ],
      fn($type) => preg_match('/\b' . $type . '\b/i', $line) &&
        !($type === 'Sovereign' && preg_match('/\bTraining\b/i', $line)),
    ),
  );
}
function consolidatedTypeLine(array $text): string
{
  $line = trim($text['typeLine'] ?? '');
  foreach (
    array_merge($text['traits'] ?? [], $text['types'] ?? [], $text['subtypes'] ?? [])
    as $part
  ) {
    if ($part !== '' && !preg_match('/(?<!\w)' . preg_quote($part, '/') . '(?!\w)/iu', $line)) {
      $line .= ($line ? ', ' : '') . $part;
    }
  }
  return $line;
}
function printingFields(): array
{
  return ['artist', 'language', 'rawText', 'source', 'method'];
}
function storedCard(array $card): array
{
  unset($card['text']['types'], $card['text']['subtypes'], $card['text']['traits']);
  return $card;
}
function catalogVersion(array $version): array
{
  $version['code'] = $version['code'] ?? ($version['text']['collectorNumber'] ?? '');
  if (!$version['code']) {
    $version['code'] = $version['text']['collectorNumber'] ?? '';
  }
  $version['image'] = $version['original'] ?? ($version['image'] ?? '');
  unset($version['original'], $version['text']['rarity'], $version['text']['collectorNumber']);
  return $version;
}
function printingThumbnail(string $image): string
{
  if (parse_url($image, PHP_URL_HOST) === 'bluthelden.com') {
    return preg_replace('/([?&])width=\d+/', '$1width=750', $image);
  }
  return $image;
}
function expandCatalog(array $catalog): array
{
  $out = [];
  foreach ($catalog as $card) {
    if (!isset($card['versions'])) {
      $card['text']['typeLine'] = consolidatedTypeLine($card['text']);
      $card['text']['types'] = cardTypes($card['text']['typeLine'] ?? '');
      $out[] = $card;
      continue;
    }
    $versions = $card['versions'];
    $source = $card['sourceId'];
    unset($card['versions'], $card['sourceId']);
    foreach ($versions as $version) {
      $version = catalogVersion($version);
      $c = array_replace($card, $version);
      $c['original'] = $version['image'];
      $c['image'] = printingThumbnail($version['image']);
      $c['gameplayId'] = $card['id'];
      $c['gameplaySourceId'] = $source;
      $c['text'] = array_replace($card['text'], $version['text'] ?? []);
      $c['text']['collectorNumber'] = $version['code'];
      $c['text']['gameplayId'] = $card['id'];
      $c['text']['types'] = cardTypes($c['text']['typeLine'] ?? '');
      $out[] = $c;
    }
  }
  return $out;
}
function compactCatalog(array $cards): array
{
  $groups = [];
  foreach ($cards as $c) {
    $groups[$c['gameplayId'] ?? $c['id']][] = $c;
  }
  $out = [];
  foreach ($groups as $id => $versions) {
    $base = $versions[0];
    foreach ($versions as $c) {
      if ($c['id'] === ($c['gameplaySourceId'] ?? '')) {
        $base = $c;
        break;
      }
    }
    $text = $base['text'];
    $text['typeLine'] = consolidatedTypeLine($text);
    foreach (array_merge(printingFields(), ['types', 'subtypes', 'traits', 'gameplayId']) as $key) {
      unset($text[$key]);
    }
    $card = [
      'id' => $id,
      'sourceId' => $base['id'],
      'name' => $base['name'],
      'notes' => $base['notes'] ?? '',
      'text' => $text,
      'versions' => [],
    ];
    foreach ($versions as $v) {
      $version = [];
      foreach (['id', 'code', 'set', 'group', 'variant', 'image', 'original', 'source'] as $key) {
        $version[$key] = $v[$key] ?? '';
      }
      $version['code'] = $v['code'] ?: $v['text']['collectorNumber'] ?? '';
      $version['text'] = array_intersect_key($v['text'], array_flip(printingFields()));
      $version = catalogVersion($version);
      if (array_key_exists('archived', $v)) {
        $version['archived'] = $v['archived'];
      }
      $card['versions'][] = $version;
    }
    $out[] = $card;
  }
  return $out;
}
function validatedVersions(array $versions, array $existing): array
{
  if (!array_is_list($versions) || !count($versions) || count($versions) > 200) {
    throw new InvalidArgumentException('Invalid versions');
  }
  $seen = [];
  foreach ($versions as &$v) {
    if (
      !is_array($v) ||
      !preg_match('/^[a-f0-9]{12}$/D', $v['id'] ?? '') ||
      isset($seen[$v['id']])
    ) {
      throw new InvalidArgumentException('Invalid printing id');
    }
    $seen[$v['id']] = true;
    if (array_key_exists('archived', $v) && !is_bool($v['archived'])) {
      throw new InvalidArgumentException('Invalid archive flag');
    }
    foreach (['code', 'set', 'group', 'variant', 'image', 'source'] as $key) {
      if (!is_string($v[$key] ?? null) || strlen($v[$key]) > 2000) {
        throw new InvalidArgumentException('Invalid printing field');
      }
      if (
        in_array($key, ['image', 'source']) &&
        $v[$key] !== '' &&
        (!filter_var($v[$key], FILTER_VALIDATE_URL) ||
          parse_url($v[$key], PHP_URL_SCHEME) !== 'https')
      ) {
        throw new InvalidArgumentException('HTTPS image/source required');
      }
    }
    if (!trim($v['set']) || !$v['image']) {
      throw new InvalidArgumentException('Image required');
    }
    if (
      array_diff(array_keys($v), [
        'id',
        'code',
        'set',
        'group',
        'variant',
        'image',
        'source',
        'text',
        'archived',
      ])
    ) {
      throw new InvalidArgumentException('Unknown printing field');
    }
    if (!is_array($v['text'] ?? null) || array_diff(array_keys($v['text']), printingFields())) {
      throw new InvalidArgumentException('Invalid printing text');
    }
    foreach ($v['text'] as $value) {
      if (!is_string($value) || strlen($value) > 20000) {
        throw new InvalidArgumentException('Invalid printing text');
      }
    }
  }
  unset($v);
  foreach ($existing as $v) {
    if (!isset($seen[$v['id']])) {
      throw new InvalidArgumentException('Existing printings must be retained');
    }
  }
  return $versions;
}

function cardTextCatalog(array $catalog): array
{
  return array_map(
    fn($c) => array_merge(
      ['id' => $c['id'], 'name' => $c['name'], 'notes' => $c['notes']],
      $c['text'],
    ),
    $catalog,
  );
}
