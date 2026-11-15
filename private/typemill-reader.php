<?php
// The cache stays outside the document root and never reads Markdown drafts (.txt).
$cmsRoot = dirname(__DIR__) . '/typemill';
$files = [];
$iterator = new RecursiveIteratorIterator(
  new RecursiveDirectoryIterator($cmsRoot . '/content', FilesystemIterator::SKIP_DOTS),
);
foreach ($iterator as $entry) {
  if ($entry->isFile() && in_array($entry->getExtension(), ['md', 'yaml'], true)) {
    $files[] = $entry->getPathname();
  }
}
$files[] = dirname(__DIR__) . '/public/typemill-map.json';
$files[] = dirname(__DIR__) . '/public/typemill-identities.json';
sort($files, SORT_STRING);
$hash = hash_init('sha256');
hash_update($hash, hash_file('sha256', __FILE__));
foreach ($files as $file) {
  hash_update($hash, $file);
  hash_update($hash, hash_file('sha256', $file));
}
$signature = hash_final($hash);
$etag = '"' . $signature . '"';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=0, must-revalidate');
header('ETag: ' . $etag);
header('Vary: Accept-Encoding');
if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) {
  http_response_code(304);
  exit();
}
if (function_exists('ob_gzhandler') && !ini_get('zlib.output_compression')) {
  ob_start('ob_gzhandler');
}
$cacheFile = $cmsRoot . '/data/octenarius-public-reader.json';
$cached = is_file($cacheFile) ? json_decode(file_get_contents($cacheFile), true) : null;
if (($cached['signature'] ?? null) === $signature) {
  echo $cached['payload'];
  exit();
}
chdir($cmsRoot);
require 'system/vendor/autoload.php';
$map = json_decode(file_get_contents(dirname(__DIR__) . '/public/typemill-map.json'), true);
$reverse = array_flip($map);
$identities = json_decode(
  file_get_contents(dirname(__DIR__) . '/public/typemill-identities.json'),
  true,
);
$parser = new ParsedownExtra();
$parser->setSafeMode(true);
$book = [];
foreach (['de' => '01-regeln', 'en' => '02-rules'] as $lang => $folder) {
  $rows = [];
  $base = dirname(__DIR__) . '/typemill/content/' . $folder;
  $walk = function ($dir, $parent = '') use (
    &$walk,
    &$rows,
    $lang,
    $reverse,
    $parser,
    $identities,
  ) {
    $children = array_values(
      array_filter(
        glob($dir . '/*'),
        fn($p) => is_dir($p) || (str_ends_with($p, '.md') && basename($p) !== 'index.md'),
      ),
    );
    sort($children, SORT_NATURAL);
    foreach ($children as $child) {
      $isFolder = is_dir($child);
      $file = $isFolder ? $child . '/index.md' : $child;
      if (!is_file($file)) {
        continue;
      }
      $relative = substr(
        $isFolder ? $child : substr($child, 0, -3),
        strlen(dirname(__DIR__) . '/typemill/content'),
      );
      $path = preg_replace('~/\d+-~', '/', $relative);
      $text = file_get_contents($file);
      preg_match('/^#\s+(.+)\R?/', $text, $match);
      $title = $match[1] ?? basename($child);
      $body = preg_replace('/^#\s+[^\r\n]+\R*/', '', $text, 1);
      $metaFile = substr($file, 0, -3) . '.yaml';
      $meta = is_file($metaFile) ? Symfony\Component\Yaml\Yaml::parseFile($metaFile) : [];
      $pageid = $meta['meta']['pageid'] ?? null;
      $key = $reverse[$path] ?? null;
      $id =
        ($pageid ? $identities[$lang . ':' . $pageid] ?? null : null) ??
        ($key ? substr($key, 3) : 'page-' . substr(hash('sha256', $pageid ?? $path), 0, 12));
      $number = preg_match('/^([0-9]+(?:\.[0-9]+)*)\s+(.+)$/u', $title, $m) ? $m[1] : '';
      if ($number) {
        $title = $m[2];
      }
      $rows[] = [
        'id' => $id,
        'number' => $number,
        'title' => $title,
        'body' => $body,
        'html' => str_replace(['&lt;u&gt;', '&lt;/u&gt;'], ['<u>', '</u>'], $parser->text($body)),
        'parent' => $parent,
        'cmsPath' => $path,
      ];
      if ($isFolder) {
        $walk($child, $id);
      }
    }
  };
  $walk($base);
  $book[$lang] = $rows;
}
// Glossary text is read from published Typemill pages, with stable legacy identifiers.
$terms = [];
foreach (['de' => '03-glossar', 'en' => '04-glossary'] as $lang => $folder) {
  $base = dirname(__DIR__) . '/typemill/content/' . $folder;
  if (!is_dir($base)) {
    continue;
  }
  $iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS),
  );
  foreach ($iterator as $entry) {
    if (!$entry->isFile() || $entry->getExtension() !== 'md') {
      continue;
    }
    $file = $entry->getPathname();
    $metaFile = substr($file, 0, -3) . '.yaml';
    $meta = is_file($metaFile) ? Symfony\Component\Yaml\Yaml::parseFile($metaFile) : [];
    $meta = $meta['meta'] ?? [];
    $id = $meta['glossaryid'] ?? null;
    // New leaf pages are included too; root and category pages are not terms.
    if (!$id) {
      $relative = substr($file, strlen($base) + 1);
      if (substr_count($relative, '/') < (basename($file) === 'index.md' ? 2 : 1)) {
        continue;
      }
      if (basename($file) === 'index.md' && count(glob(dirname($file) . '/*', GLOB_ONLYDIR))) {
        continue;
      }
      $id = 'term-' . substr(hash('sha256', $meta['pageid'] ?? $relative), 0, 16);
    }
    $text = file_get_contents($file);
    preg_match('/^#\s+(.+)\R?/', $text, $match);
    $title = $match[1] ?? pathinfo($file, PATHINFO_FILENAME);
    $body = preg_replace('/^#\s+[^\r\n]+\R*/', '', $text, 1);
    $html = str_replace(['&lt;u&gt;', '&lt;/u&gt;'], ['<u>', '</u>'], $parser->text($body));
    if (!isset($terms[$id])) {
      $terms[$id] = [
        'id' => $id,
        'de' => '',
        'en' => '',
        'deText' => '',
        'enText' => '',
        'kind' => $meta['glossarykind'] ?? '',
        'rule' => $meta['glossaryrule'] ?? '',
        'aliases' => $meta['glossaryaliases'] ?? [],
      ];
    }
    $terms[$id][$lang] = $title;
    $terms[$id][$lang . 'Text'] = trim(
      html_entity_decode(
        strip_tags(str_replace(['</p>', '</li>', '<br />'], "\n", $html)),
        ENT_QUOTES | ENT_HTML5,
        'UTF-8',
      ),
    );
    $terms[$id][$lang . 'Html'] = $html;
    $relative = substr(
      basename($file) === 'index.md' ? dirname($file) : substr($file, 0, -3),
      strlen(dirname(__DIR__) . '/typemill/content'),
    );
    $terms[$id][$lang . 'CmsPath'] = preg_replace('~/\d+-~', '/', $relative);
  }
}
foreach ($terms as &$term) {
  foreach (['de', 'en'] as $lang) {
    $other = $lang === 'de' ? 'en' : 'de';
    if (!$term[$lang]) {
      foreach (['', 'Text', 'Html', 'CmsPath'] as $suffix) {
        $term[$lang . $suffix] = $term[$other . $suffix] ?? '';
      }
    }
  }
}
unset($term);
$book['glossary'] = array_values($terms);
$payload = json_encode($book, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
$temp = $cacheFile . '.' . bin2hex(random_bytes(6));
if (
  @file_put_contents(
    $temp,
    json_encode(['signature' => $signature, 'payload' => $payload], JSON_THROW_ON_ERROR),
    LOCK_EX,
  ) !== false
) {
  @chmod($temp, 0600);
  if (!@rename($temp, $cacheFile)) {
    @unlink($temp);
  }
}
echo $payload;
