<?php
/* ============================================================
   CADev Hub — Funil de advogados (com modo DEBUG)
   Envia os dados do formulário por e-mail via SMTP autenticado.
   Sem dependências externas (não precisa de composer/PHPMailer).
   ============================================================ */

/* ===================== DEBUG ================================
   true  = grava toda a conversa SMTP em debug-orcamento.log E
           devolve o detalhe do erro no JSON (veja no Network do navegador).
   false = modo produção (silencioso, sem log, sem detalhes ao cliente).
   DESLIGUE depois de resolver. */
$DEBUG = true;
/* ============================================================ */

define('CADEV_APP', true);
$CFG = require __DIR__ . '/config-email.php';
$LOG = __DIR__ . '/debug-funil-advogados.log';

/* ---- logger ---- */
function dbg($msg) {
  global $DEBUG, $LOG;
  if (!$DEBUG) return;
  // esconde a senha caso apareça em alguma linha
  $line = '[' . date('Y-m-d H:i:s') . '] ' . $msg . "\n";
  @file_put_contents($LOG, $line, FILE_APPEND | LOCK_EX);
}
function fail($httpCode, $publicMsg, $debugDetail = '') {
  global $DEBUG;
  dbg('ERRO: ' . $publicMsg . ($debugDetail ? ' :: ' . $debugDetail : ''));
  http_response_code($httpCode);
  $out = ['ok' => false, 'error' => $publicMsg];
  if ($DEBUG && $debugDetail) $out['debug'] = $debugDetail;
  echo json_encode($out);
  exit;
}

header('Content-Type: application/json; charset=utf-8');

dbg('================ NOVA REQUISIÇÃO ================');
dbg('Método: ' . ($_SERVER['REQUEST_METHOD'] ?? '?') . ' | Content-Type: ' . ($_SERVER['CONTENT_TYPE'] ?? '—'));

/* ---- diagnóstico de ambiente (uma vez por request) ---- */
dbg('PHP ' . PHP_VERSION
  . ' | openssl=' . (extension_loaded('openssl') ? 'sim' : 'NÃO')
  . ' | stream_socket_client=' . (function_exists('stream_socket_client') ? 'sim' : 'NÃO')
  . ' | allow_url_fopen=' . (ini_get('allow_url_fopen') ? 'on' : 'off'));

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  fail(405, 'Método não permitido', 'Esperado POST, recebido ' . ($_SERVER['REQUEST_METHOD'] ?? '?'));
}

$DRIVER = $CFG['driver'] ?? 'resend';
dbg('Driver: ' . $DRIVER);

/* ---- chave/senha ainda no placeholder? ---- */
if ($DRIVER === 'resend') {
  if (empty($CFG['api_key']) || strpos($CFG['api_key'], 'COLE_AQUI') !== false) {
    fail(500, 'Configuração de e-mail incompleta.', 'A api_key do Resend em config-email.php ainda é o placeholder. Cole sua chave (re_...).');
  }
} else {
  if (($CFG['auth'] ?? true) && (empty($CFG['pass']) || strpos($CFG['pass'], 'COLOQUE_AQUI') !== false)) {
    fail(500, 'Configuração de e-mail incompleta.', 'A senha em config-email.php ainda é o placeholder. Edite o campo "pass".');
  }
}

$raw = file_get_contents('php://input');
dbg('Corpo bruto recebido: ' . strlen($raw) . ' bytes');
$d = json_decode($raw, true);
if (!is_array($d)) { $d = $_POST; dbg('JSON inválido — usando $_POST (' . count($_POST) . ' campos)'); }
else { dbg('JSON ok — ' . count($d) . ' campos'); }

/* Anti-spam: honeypot */
if (!empty($d['hp'])) { dbg('Honeypot preenchido — ignorando (provável bot)'); echo json_encode(['ok' => true]); exit; }

/* Validação mínima */
$nome = trim($d['nome'] ?? '');
$zap  = trim($d['zap']  ?? '');
dbg('Campos: nome="' . $nome . '" zap="' . $zap . '"');
if ($nome === '' || strlen(preg_replace('/\D/', '', $zap)) < 10) {
  fail(422, 'Dados obrigatórios ausentes.', 'nome vazio ou WhatsApp com menos de 10 dígitos.');
}

/* ---- Monta o corpo do e-mail (HTML) ---- */
function e($v){ return htmlspecialchars(is_array($v) ? implode(', ', $v) : (string)$v, ENT_QUOTES, 'UTF-8'); }
function row($label, $val){
  $val = (is_array($val) ? implode(', ', $val) : trim((string)$val));
  if ($val === '') $val = '—';
  return '<tr><td style="padding:10px 14px;border-bottom:1px solid #eee;color:#666;font:600 13px Arial;white-space:nowrap;vertical-align:top">'
       . e($label) . '</td><td style="padding:10px 14px;border-bottom:1px solid #eee;color:#111;font:400 14px Arial">'
       . nl2br(e($val)) . '</td></tr>';
}

$rows  = row('Nome', $d['nome'] ?? '');
$rows .= row('WhatsApp', $d['zap'] ?? '');
$rows .= row('Área de atuação', $d['area'] ?? '');
$rows .= row('Estrutura', $d['estrutura'] ?? '');
$rows .= row('Como capta clientes', $d['captacao'] ?? '');
$rows .= row('Site / página', $d['site'] ?? '');
$rows .= row('Anúncios online', $d['anuncios'] ?? '');
$rows .= row('Frequência de conteúdo', $d['conteudo'] ?? '');
$rows .= row('Objetivo principal', $d['objetivo'] ?? '');
$rows .= row('Meta de clientes/mês', $d['meta'] ?? '');
$rows .= row('O que mais trava', $d['trava'] ?? '');
$rows .= row('Canal preferido', $d['canal'] ?? '');
$rows .= row('Melhor período', $d['periodo'] ?? '');

$zapDigits = preg_replace('/\D/', '', $zap);
$waLink = 'https://wa.me/55' . $zapDigits;

$html = '<!doctype html><html><body style="margin:0;background:#0C0E0E;padding:24px">'
  . '<table role="presentation" width="100%" style="max-width:620px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e5e5e5">'
  . '<tr><td style="background:#0C0E0E;padding:22px 24px">'
  . '<div style="font:700 18px Arial;color:#41E248">CADev Hub</div>'
  . '<div style="font:400 13px Arial;color:#ACB9B9;margin-top:4px">Novo lead — Advogados</div></td></tr>'
  . '<tr><td style="padding:8px 10px 0"><table role="presentation" width="100%" style="border-collapse:collapse">'
  . $rows
  . '</table></td></tr>'
  . '<tr><td style="padding:18px 24px 26px">'
  . '<a href="' . e($waLink) . '" style="display:inline-block;background:#179E1D;color:#fff;font:700 14px Arial;text-decoration:none;padding:12px 22px;border-radius:6px">Responder no WhatsApp →</a>'
  . '<div style="font:400 12px Arial;color:#999;margin-top:14px">Recebido em ' . date('d/m/Y \à\s H:i') . '</div>'
  . '</td></tr></table></body></html>';

$subject = 'Novo lead (Advogados) — ' . $nome;

/* ---- Envio via Resend (HTTPS, porta 443 — não sofre bloqueio de SMTP) ---- */
function resend_send($cfg, $subject, $html) {
  $payload = [
    'from'    => $cfg['from'],
    'to'      => [ $cfg['to'] ],
    'subject' => $subject,
    'html'    => $html,
  ];
  if (!empty($cfg['reply_to'])) $payload['reply_to'] = $cfg['reply_to'];
  $json = json_encode($payload);
  dbg('Resend: POST https://api.resend.com/emails (from=' . $cfg['from'] . ' to=' . $cfg['to'] . ')');

  if (function_exists('curl_init')) {
    $ch = curl_init('https://api.resend.com/emails');
    curl_setopt_array($ch, [
      CURLOPT_POST           => true,
      CURLOPT_POSTFIELDS     => $json,
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_TIMEOUT        => 20,
      CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . $cfg['api_key'],
        'Content-Type: application/json',
      ],
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    if ($resp === false) throw new Exception('cURL falhou: ' . $err);
  } else {
    // fallback sem cURL (precisa de allow_url_fopen)
    $ctx = stream_context_create(['http' => [
      'method'        => 'POST',
      'header'        => "Authorization: Bearer {$cfg['api_key']}\r\nContent-Type: application/json\r\n",
      'content'       => $json,
      'timeout'       => 20,
      'ignore_errors' => true,
    ]]);
    $resp = @file_get_contents('https://api.resend.com/emails', false, $ctx);
    if ($resp === false) throw new Exception('file_get_contents falhou (allow_url_fopen off?).');
    $code = 0;
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) $code = (int)$m[1];
  }

  dbg('Resend resposta HTTP ' . $code . ': ' . substr((string)$resp, 0, 400));
  if ($code < 200 || $code >= 300) {
    $detail = $resp;
    $j = json_decode((string)$resp, true);
    if (is_array($j) && !empty($j['message'])) $detail = $j['message'];
    throw new Exception('Resend HTTP ' . $code . ': ' . $detail);
  }
  return true;
}

/* ---- Cliente SMTP mínimo (AUTH LOGIN) com log de cada passo ---- */
function smtp_send($cfg, $subject, $html) {
  $errno = 0; $errstr = '';
  $secure = $cfg['secure'] ?? 'ssl';
  $doAuth = $cfg['auth'] ?? true;
  $proto = ($secure === 'ssl') ? 'ssl://' : 'tcp://';   // 'tls' e 'none' começam em tcp
  $target = $proto . $cfg['host'] . ':' . $cfg['port'];
  dbg('Conectando em ' . $target . ' (secure=' . $secure . ', auth=' . ($doAuth ? 'sim' : 'não') . ') ...');

  $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
  $fp = @stream_socket_client($target, $errno, $errstr, 30, STREAM_CLIENT_CONNECT, $ctx);
  if (!$fp) {
    throw new Exception("Conexão falhou ($errno): $errstr — verifique se a porta {$cfg['port']} está liberada (no modo local, confirme que o Postfix/servidor de e-mail do CyberPanel está rodando).");
  }
  dbg('Conexão TCP/SSL estabelecida.');
  stream_set_timeout($fp, 30);

  $read = function() use ($fp) {
    $data = '';
    while (($line = fgets($fp, 515)) !== false) {
      $data .= $line;
      $meta = stream_get_meta_data($fp);
      if (!empty($meta['timed_out'])) { dbg('<< TIMEOUT de leitura'); break; }
      if (isset($line[3]) && $line[3] === ' ') break;
    }
    dbg('<< ' . trim($data));
    return $data;
  };
  $expect = function($resp, $code) {
    if (strpos(ltrim($resp), (string)$code) !== 0) {
      throw new Exception("Resposta SMTP inesperada (esperava $code): " . trim($resp));
    }
  };
  $send = function($c, $hide = false) use ($fp) {
    dbg('>> ' . ($hide ? '[oculto]' : $c));
    fwrite($fp, $c . "\r\n");
  };
  $cmd = function($c, $hide = false) use ($fp, $read, $send) { $send($c, $hide); return $read(); };

  $expect($read(), 220);                                   // saudação
  $host = $_SERVER['SERVER_NAME'] ?? 'localhost';
  $cmd('EHLO ' . $host);

  if ($secure === 'tls') {
    dbg('Iniciando STARTTLS...');
    $expect($cmd('STARTTLS'), 220);
    $ok = stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT);
    if (!$ok) throw new Exception('Falha ao ativar TLS (STARTTLS).');
    dbg('TLS ativo.');
    $cmd('EHLO ' . $host);
  }

  if ($doAuth) {
    $cmd('AUTH LOGIN');
    $cmd(base64_encode($cfg['user']));                     // usuário (base64)
    $authResp = $cmd(base64_encode($cfg['pass']), true);   // senha (oculta no log)
    $expect($authResp, 235);                               // 235 = autenticado
    dbg('Autenticação OK.');
  } else {
    dbg('Sem autenticação (entrega local).');
  }

  $expect($cmd('MAIL FROM:<' . $cfg['from'] . '>'), 250);
  $expect($cmd('RCPT TO:<' . $cfg['to'] . '>'), 250);
  $expect($cmd('DATA'), 354);

  $headers  = 'From: =?UTF-8?B?' . base64_encode($cfg['from_name']) . "?= <" . $cfg['from'] . ">\r\n";
  $headers .= 'To: <' . $cfg['to'] . ">\r\n";
  $headers .= 'Subject: =?UTF-8?B?' . base64_encode($subject) . "?=\r\n";
  $headers .= "MIME-Version: 1.0\r\n";
  $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
  $headers .= "Content-Transfer-Encoding: 8bit\r\n";
  $headers .= 'Date: ' . date('r') . "\r\n";

  $body = preg_replace('/^\./m', '..', $html);             // dot-stuffing
  dbg('>> [enviando corpo do e-mail, ' . strlen($body) . ' bytes]');
  fwrite($fp, $headers . "\r\n" . $body . "\r\n.\r\n");
  $expect($read(), 250);                                   // aceito
  dbg('E-mail aceito pelo servidor (250).');

  fwrite($fp, "QUIT\r\n");
  fclose($fp);
  return true;
}

try {
  if ($DRIVER === 'resend') {
    resend_send($CFG, $subject, $html);
  } else {
    smtp_send($CFG, $subject, $html);
  }
  dbg('SUCESSO: e-mail enviado.');
  echo json_encode(['ok' => true]);
} catch (Exception $ex) {
  error_log('[CADev funil-advogados] ' . $ex->getMessage());
  fail(502, 'Falha ao enviar. Tente novamente.', $ex->getMessage());
}
