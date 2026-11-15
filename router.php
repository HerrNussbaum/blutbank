<?php
// Development router: no automatic login and no production-domain redirect.
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($path === '/cms-rules') {
  require __DIR__ . '/public/cms-rules.php';
  return true;
}
if (str_starts_with($path, '/handbuch')) {
  require __DIR__ . '/private/typemill-gateway.php';
  return true;
}
return false;
