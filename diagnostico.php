<?php
/* ============================================================
   CADev Hub — Diagnóstico de e-mail (driver Resend / HTTPS)
   Abra no navegador:  https://cadevhub.com/diagnostico.php?key=cadev2026
   Testa o envio por Resend e mostra onde falha.
   APAGUE este arquivo (ou troque a key) depois de resolver.
   ============================================================ */
$KEY = 'cadev2026';
if (($_GET['key'] ?? '') !== $KEY) { http_response_code(403); exit('Acesso negado. Use ?key=...'); }

header('Content-Type: text/plain; charset=utf-8');
define('CADEV_APP', true);
$CFG = require __DIR__ . '/config-email.php';

function line($s = '') { echo $s . "\n"; }
function check($label, $ok, $extra = '') {
  line(($ok ? '✅' : '❌') . '  ' . $label . ($extra ? '  →  ' . $extra : ''));
}

line('===== DIAGNÓSTICO CADev Hub — ' . date('d/m/Y H:i:s') . ' =====');
line();
line('— Ambiente PHP —');
check('PHP ' . PHP_VERSION, version_compare(PHP_VERSION, '7.2', '>='));
check('Extensão cURL', function_exists('curl_init'), function_exists('curl_init') ? 'ok' : 'ausente — usará fallback file_get_contents');
check('Extensão openssl (HTTPS)', extension_loaded('openssl'));
line('   allow_url_fopen = ' . (ini_get('allow_url_fopen') ? 'on' : 'off') . '  (necessário só se não houver cURL)');
line();

$driver = $CFG['driver'] ?? 'resend';
line('— Configuração (config-email.php) —');
check('Driver', $driver === 'resend', 'driver=' . $driver);
$keyOk = !(empty($CFG['api_key']) || strpos($CFG['api_key'], 'COLE_AQUI') !== false);
check('API key do Resend preenchida', $keyOk, $keyOk ? '(' . substr($CFG['api_key'], 0, 5) . '… ' . strlen($CFG['api_key']) . ' chars)' : 'AINDA É O PLACEHOLDER — cole a chave re_... em config-email.php');
line('   from=' . $CFG['from']);
line('   to=' . $CFG['to']);
line();

line('— Conectividade HTTPS (porta 443, nunca bloqueada) —');
$t0 = microtime(true);
$fp = @stream_socket_client('ssl://api.resend.com:443', $errno, $errstr, 8);
$ms = round((microtime(true) - $t0) * 1000);
if ($fp) { check('Conexão a api.resend.com:443', true, $ms . 'ms'); fclose($fp); }
else     { check('Conexão a api.resend.com:443', false, "errno $errno: $errstr"); }
line();

line('— Teste real de envio (chama a API do Resend) —');
if (!$keyOk) { line('   pulado: cole a API key primeiro.'); line(); }
else {
  $payload = json_encode([
    'from'    => $CFG['from'],
    'to'      => [ $CFG['to'] ],
    'subject' => 'Teste de diagnóstico — CADev Hub',
    'html'    => '<p>Este é um e-mail de teste enviado pelo <b>diagnostico.php</b> em ' . date('d/m/Y H:i:s') . '.</p>',
  ]);
  $code = 0; $resp = '';
  if (function_exists('curl_init')) {
    $ch = curl_init('https://api.resend.com/emails');
    curl_setopt_array($ch, [
      CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20,
      CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $CFG['api_key'], 'Content-Type: application/json'],
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $cerr = curl_error($ch);
    curl_close($ch);
    if ($resp === false) { check('Chamada à API', false, 'cURL: ' . $cerr); $resp = ''; }
  } else {
    $ctx = stream_context_create(['http' => [
      'method' => 'POST',
      'header' => "Authorization: Bearer {$CFG['api_key']}\r\nContent-Type: application/json\r\n",
      'content' => $payload, 'timeout' => 20, 'ignore_errors' => true,
    ]]);
    $resp = @file_get_contents('https://api.resend.com/emails', false, $ctx);
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) $code = (int)$m[1];
  }

  check('Resposta HTTP 200/201', ($code >= 200 && $code < 300), 'HTTP ' . $code);
  $j = json_decode((string)$resp, true);
  if ($code >= 200 && $code < 300) {
    line('   ✉️  Enviado! id=' . ($j['id'] ?? '?') . ' — confira a caixa ' . $CFG['to'] . ' (e o spam).');
  } else {
    $msg = is_array($j) && !empty($j['message']) ? $j['message'] : substr((string)$resp, 0, 300);
    line('   Detalhe do erro: ' . $msg);
    line('   Dicas:');
    line('   • 401/403 → API key inválida ou revogada. Gere outra no painel do Resend.');
    line('   • 403 "domain is not verified" → enquanto não verificar cadevhub.com no Resend,');
    line('     use from = "CADev Hub <onboarding@resend.dev>" no config-email.php.');
    line('   • 422 → o campo "from" está num formato inválido (use "Nome <email>").');
  }
  line();
}

line('— Log do endpoint —');
$log = __DIR__ . '/debug-orcamento.log';
if (is_file($log)) {
  line('Arquivo: ' . $log . ' (' . round(filesize($log)/1024, 1) . ' KB) · pasta gravável: ' . (is_writable(__DIR__) ? 'sim' : 'NÃO'));
  line('--- últimas 30 linhas ---');
  foreach (array_slice(file($log, FILE_IGNORE_NEW_LINES), -30) as $l) line($l);
} else {
  line('Nenhum log ainda. Pasta gravável: ' . (is_writable(__DIR__) ? 'sim' : 'NÃO — o endpoint não conseguirá gravar o log'));
}
line();
line('===== FIM =====');
line('Tudo ✅ e o e-mail de teste chegou? Então o formulário já está funcionando.');
line('Depois de validar: APAGUE diagnostico.php e debug-orcamento.log, e ponha $DEBUG=false no enviar-orcamento.php.');
