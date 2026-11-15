<?php
declare(strict_types=1);
function stripCardReminders(string $text): string
{
  static $definitions = null;
  if ($definitions === null) {
    $path = __DIR__ . '/../public/data/ability-reminders.json';
    if (!is_file($path)) {
      $path = __DIR__ . '/../../dist/data/ability-reminders.json';
    }
    $definitions = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
  }
  $normalize = static fn(string $s): string => strtolower(trim(preg_replace('/\s+/u', ' ', $s)));
  $stack = [];
  $ranges = [];
  $length = strlen($text);
  for ($i = 0; $i < $length; $i++) {
    if ($text[$i] === '(') {
      $stack[] = $i;
    } elseif ($text[$i] === ')' && count($stack)) {
      $start = array_pop($stack);
      if (count($stack)) {
        continue;
      }
      $before = rtrim(substr($text, 0, $start));
      $body = $normalize(substr($text, $start + 1, $i - $start - 1));
      foreach ($definitions as $d) {
        if (!in_array($body, array_map($normalize, $d['legacy']), true)) {
          continue;
        }
        foreach (array_merge([$d['name']], $d['aliases'] ?? []) as $name) {
          if (preg_match('/(?<![\p{L}\p{N}_])' . preg_quote($name, '/') . '$/iu', $before)) {
            $ranges[] = [$start, $i + 1];
            break 2;
          }
        }
      }
    }
  }
  foreach (array_reverse($ranges) as [$a, $b]) {
    $text = substr($text, 0, $a) . substr($text, $b);
  }
  return trim(preg_replace('/[ \t]{2,}/', ' ', preg_replace('/[ \t]+\n/', "\n", $text)));
}
function normalizeCardReminders(array $card): array
{
  foreach (['rulesText', 'additionalCostsText'] as $field) {
    $card['text'][$field] = preg_replace(
      '/\b(gains?\s+\{(?:X|\d+)\})(?!\s*ASP\b)/iu',
      '$1 ASP',
      stripCardReminders($card['text'][$field] ?? ''),
    );
  }
  return $card;
}
