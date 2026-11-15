<?php
declare(strict_types=1);
// Called only after the existing administrator check. No user input becomes a filesystem path.
function octPrepareEbook(string $cms, string $lang): string
{
  if (!in_array($lang, ['de', 'en'], true)) {
    throw new RuntimeException('Unbekannte Sprache.');
  }
  $folder = $lang === 'de' ? '01-regeln' : '02-rules';
  $base = $cms . '/content/' . $folder;
  if (!is_dir($base)) {
    throw new RuntimeException('Regelordner nicht verfügbar.');
  }
  $walk = function (string $dir) use (&$walk, $cms): array {
    $rows = [];
    $children = array_values(
      array_filter(
        glob($dir . '/*'),
        fn($p) => !is_link($p) &&
          (is_dir($p) || (str_ends_with($p, '.md') && basename($p) !== 'index.md')),
      ),
    );
    sort($children, SORT_NATURAL);
    foreach ($children as $path) {
      $isDir = is_dir($path);
      $file = $isDir ? $path . '/index.md' : $path;
      if (!is_file($file) || is_link($file)) {
        continue;
      } // Published .md only; never drafts (.txt).
      $relative = substr($path, strlen($cms . '/content'));
      $without = $isDir ? $relative . '/index' : substr($relative, 0, -3);
      $metaFile = $cms . '/content' . $without . '.yaml';
      $meta = is_file($metaFile) ? Symfony\Component\Yaml\Yaml::parseFile($metaFile) : [];
      if (($meta['meta']['referencetype'] ?? '') === 'copy') {
        throw new RuntimeException(
          'Eine Regel verwendet eine Inhaltsreferenz. Bitte diese vor dem Buch-Export prüfen.',
        );
      }
      $url = preg_replace('~/\d+-~', '/', $isDir ? $relative : substr($relative, 0, -3));
      $row = [
        'elementType' => $isDir ? 'folder' : 'file',
        'status' => 'published',
        'include' => true,
        'path' => $relative,
        'pathWithoutType' => $without,
        'urlRelWoF' => $url,
        'name' => basename($path),
      ];
      if ($isDir) {
        $row['folderContent'] = $walk($path);
      }
      $rows[] = $row;
    }
    return $rows;
  };
  $nav = $walk($base);
  if (!$nav) {
    throw new RuntimeException('Keine veröffentlichten Regeln vorhanden.');
  }
  $count = function (array $rows) use (&$count): int {
    $n = count($rows);
    foreach ($rows as $r) {
      $n += $count($r['folderContent'] ?? []);
    }
    return $n;
  };
  $data = [
    'layout' => 'octenarius',
    'title' =>
      $lang === 'de' ? 'Bluthelden – Turnierregelwerk' : 'Bluthelden – Tournament Rulebook',
    'language' => $lang,
    'edition' =>
      (new DateTimeImmutable('now', new DateTimeZone('Europe/Berlin')))->format('d.m.Y, H:i') .
      ' Uhr',
    'exportcount' => $count($nav),
    'downgradeheadlines' => 1,
    'toc' => true,
    'toclevel' => 2,
    'toccounter' => false,
    'shortcodes' => false,
    'originalimages' => false,
  ];
  $dir = $cms . '/data/ebooks';
  if (!is_dir($dir) && !mkdir($dir, 0700, true)) {
    throw new RuntimeException('Exportverzeichnis nicht verfügbar.');
  }
  $name = 'octenarius-' . $lang;
  $lock = fopen($dir . '/export-' . $lang . '.lock', 'c');
  if (!$lock || !flock($lock, LOCK_EX)) {
    throw new RuntimeException('Export ist beschäftigt.');
  }
  try {
    foreach (
      [
        'ebookdata-' . $name . '.yaml' => Symfony\Component\Yaml\Yaml::dump($data, 4, 2),
        'navigation-' . $name . '.txt' => serialize($nav),
      ]
      as $nameFile => $content
    ) {
      $tmp = $dir . '/' . $nameFile . '.' . bin2hex(random_bytes(6));
      if (file_put_contents($tmp, $content, LOCK_EX) === false) {
        throw new RuntimeException('Export konnte nicht vorbereitet werden.');
      }
      chmod($tmp, 0600);
      if (!rename($tmp, $dir . '/' . $nameFile)) {
        unlink($tmp);
        throw new RuntimeException('Export konnte nicht vorbereitet werden.');
      }
    }
  } finally {
    flock($lock, LOCK_UN);
    fclose($lock);
  }
  return '/handbuch/tm/ebooks/preview?projectname=ebookdata-' . $name . '.yaml';
}
