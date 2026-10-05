<?php
/* ============================================================
   CADev Hub — Credenciais do banco
   Os valores ficam no arquivo .env, FORA do public_html:
     servidor: /home/cadevhub.com/.env  (pasta acima do public_html)
     local:    .env nesta mesma pasta (fallback para desenvolvimento)
   Nunca suba o .env para o public_html: o OpenLiteSpeed ignora o
   bloqueio do .htaccess e serviria o arquivo como texto.
   Edite o .env, não este arquivo.
   ============================================================ */
$env = [];
$envFile = dirname(__DIR__) . '/.env';
if (!is_readable($envFile)) $envFile = __DIR__ . '/.env';
if (is_readable($envFile)) {
  foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    $line = trim($line);
    if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) continue;
    [$k, $v] = explode('=', $line, 2);
    $env[trim($k)] = trim(trim($v), "\"'");
  }
}

return [
  'host'               => $env['DB_HOST'] ?? 'localhost',
  'db'                 => $env['DB_NAME'] ?? '',
  'user'               => $env['DB_USER'] ?? '',
  'pass'               => $env['DB_PASS'] ?? '',
  'admin_token'        => $env['ADMIN_TOKEN'] ?? '',
  'openrouter_api_key' => $env['OPENROUTER_API_KEY'] ?? '',
];
