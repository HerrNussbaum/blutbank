<?php
// Use the existing publishing CMS when installed; otherwise serve bundled public rules.
if (is_dir(dirname(__DIR__) . '/typemill/content')) {
  require dirname(__DIR__) . '/private/typemill-reader.php';
  exit();
}
header('Content-Type: application/json; charset=utf-8');
$book = [];
foreach (['de' => 'rules-de', 'en' => 'rules-en', 'glossary' => 'glossary'] as $key => $file) {
  $book[$key] = json_decode(
    file_get_contents(__DIR__ . '/data/' . $file . '.json'),
    true,
    512,
    JSON_THROW_ON_ERROR,
  );
}
echo json_encode($book, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
