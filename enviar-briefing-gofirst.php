<?php
/* ============================================================
   GoFirst — Recebimento de BRIEFING (com modo DEBUG)
   Envia o briefing por e-mail via Resend (HTTPS). Reusa
   config-email.php (mesma chave do orçamento).
   ============================================================ */

$DEBUG = true;   // DESLIGUE (false) depois de validar em produção.

define('CADEV_APP', true);
$CFG = require __DIR__ . '/config-email.php';
$LOG = __DIR__ . '/debug-briefing-gofirst.log';

function dbg($msg){ global $DEBUG, $LOG; if(!$DEBUG) return;
  @file_put_contents($LOG, '['.date('Y-m-d H:i:s').'] '.$msg."\n", FILE_APPEND | LOCK_EX); }
function fail($code, $pub, $detail=''){ global $DEBUG;
  dbg('ERRO: '.$pub.($detail?' :: '.$detail:''));
  http_response_code($code);
  $o = ['ok'=>false,'error'=>$pub]; if($DEBUG && $detail) $o['debug']=$detail;
  echo json_encode($o); exit; }

header('Content-Type: application/json; charset=utf-8');
dbg('============ NOVO BRIEFING ============');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405,'Método não permitido');

$driver = $CFG['driver'] ?? 'resend';
if ($driver === 'resend' && (empty($CFG['api_key']) || strpos($CFG['api_key'],'COLE_AQUI') !== false))
  fail(500,'Configuração de e-mail incompleta.','api_key do Resend ainda é o placeholder.');

$raw = file_get_contents('php://input');
$d = json_decode($raw, true);
if (!is_array($d)) $d = $_POST;
if (!empty($d['hp'])) { dbg('Honeypot — ignorado'); echo json_encode(['ok'=>true]); exit; }

$nome  = trim($d['nome'] ?? '');
$zap   = trim($d['zap'] ?? '');
if ($nome === '' || strlen(preg_replace('/\D/','',$zap)) < 10)
  fail(422,'Dados obrigatórios ausentes.','nome ou WhatsApp inválido.');

/* rótulos amigáveis na ordem do briefing */
$labels = [
  'nome'               => 'Nome',
  'zap'                => 'WhatsApp',
  'email'              => 'E-mail',
  'sistema_nome'       => 'Nome do sistema',
  'sua_agencia'        => 'Agência',
  'modulos_v1'         => '[Módulos] Módulos da v1',
  'modulo_prioridade'  => '[Módulos] Módulo prioritário',
  'modulo_prioridade_outro' => '[Módulos] Prioridade (outra)',
  'modulos_v1_outro'   => '[Módulos] Outro módulo',
  'modulos_fora'       => '[Módulos] Ficam de fora (futuro)',
  'crm_detalhe'        => '[Funcionamento] CRM comercial',
  'tarefas_detalhe'    => '[Funcionamento] Gestão de tarefas',
  'relatorio_detalhe'  => '[Funcionamento] Relatórios',
  'posts_detalhe'      => '[Funcionamento] Agendamento de posts',
  'portal_detalhe'     => '[Funcionamento] Portal do cliente',
  'inbox_detalhe'      => '[Funcionamento] Inbox unificado',
  'automacoes_detalhe' => '[Funcionamento] Automações',
  'ia_detalhe'         => '[Funcionamento] IA',
  'integracoes'        => '[Funcionamento] Integrações',
  'integracoes_outro'  => '[Funcionamento] Integrações (outra)',
  'publico_alvo'       => '[Comercial] Público-alvo',
  'modelo_venda'       => '[Comercial] Modelo de venda',
  'modelo_venda_outro' => '[Comercial] Modelo de venda (outro)',
  'publico_alvo_outro' => '[Comercial] Público-alvo (outro)',
  'white_label'        => '[Comercial] White-label',
  'white_label_outro'  => '[Comercial] White-label (detalhe)',
  'branding'           => '[Comercial] Personalização (branding)',
  'rebilling'          => '[Comercial] Revenda / cobrança',
  'faixa_preco'        => '[Comercial] Faixa de preço pretendida',
  'preco_setup'        => '[Precificação] Setup / entrada',
  'preco_basico'       => '[Precificação] Plano básico (mensal)',
  'preco_completo'     => '[Precificação] Plano completo (mensal)',
  'preco_modulo'       => '[Precificação] Módulo adicional',
  'equipe_vendas'       => '[Comercial] Equipe de vendas',
  'prazo'              => '[Fecho] Prazo',
  'referencias'        => '[Fecho] Referências',
  'materiais'          => '[Fecho] Materiais',
  'observacoes'        => '[Fecho] Observações',
];

function e($v){ return htmlspecialchars(is_array($v)?implode(', ',$v):(string)$v, ENT_QUOTES,'UTF-8'); }
function row($label,$val){
  $val = is_array($val) ? implode(', ',$val) : trim((string)$val);
  if ($val==='') $val='—';
  return '<tr><td style="padding:10px 14px;border-bottom:1px solid #eee;color:#666;font:600 13px Arial;white-space:nowrap;vertical-align:top">'
       . e($label) . '</td><td style="padding:10px 14px;border-bottom:1px solid #eee;color:#111;font:400 14px Arial">'
       . nl2br(e($val)) . '</td></tr>';
}

$rows = '';
foreach ($labels as $key => $label) if (isset($d[$key])) $rows .= row($label, $d[$key]);

$zapDigits = preg_replace('/\D/','',$zap);
$waLink = 'https://wa.me/55'.$zapDigits;

$html = '<!doctype html><html><body style="margin:0;background:#0C0E0E;padding:24px">'
  . '<table role="presentation" width="100%" style="max-width:640px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e5e5e5">'
  . '<tr><td style="background:#0C0E0E;padding:22px 24px">'
  . '<div style="font:700 18px Arial;color:#41E248">CADev Hub</div>'
  . '<div style="font:400 13px Arial;color:#ACB9B9;margin-top:4px">Novo briefing · GoFirst — SaaS/CRM para agências</div></td></tr>'
  . '<tr><td style="padding:8px 10px 0"><table role="presentation" width="100%" style="border-collapse:collapse">'
  . $rows
  . '</table></td></tr>'
  . '<tr><td style="padding:18px 24px 26px">'
  . '<a href="'.e($waLink).'" style="display:inline-block;background:#179E1D;color:#fff;font:700 14px Arial;text-decoration:none;padding:12px 22px;border-radius:6px">Responder no WhatsApp →</a>'
  . '<div style="font:400 12px Arial;color:#999;margin-top:14px">Recebido em '.date('d/m/Y \à\s H:i').'</div>'
  . '</td></tr></table></body></html>';

$subject = 'Novo briefing GoFirst — '.$nome.' ('.($d['sua_agencia'] ?? '—').')';

/* ---- Envio via Resend (HTTPS, porta 443) ---- */
function resend_send($cfg, $subject, $html, $attachments=[]){
  $payload = ['from'=>$cfg['from'], 'to'=>[$cfg['to']], 'subject'=>$subject, 'html'=>$html];
  if (!empty($cfg['reply_to'])) $payload['reply_to'] = $cfg['reply_to'];
  if (!empty($attachments)) $payload['attachments'] = $attachments;
  $json = json_encode($payload);
  dbg('Resend POST (from='.$cfg['from'].' to='.$cfg['to'].')');

  if (function_exists('curl_init')){
    $ch = curl_init('https://api.resend.com/emails');
    curl_setopt_array($ch, [
      CURLOPT_POST=>true, CURLOPT_POSTFIELDS=>$json, CURLOPT_RETURNTRANSFER=>true, CURLOPT_TIMEOUT=>20,
      CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$cfg['api_key'],'Content-Type: application/json'],
    ]);
    $resp = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch); curl_close($ch);
    if ($resp === false) throw new Exception('cURL falhou: '.$err);
  } else {
    $ctx = stream_context_create(['http'=>[
      'method'=>'POST',
      'header'=>"Authorization: Bearer {$cfg['api_key']}\r\nContent-Type: application/json\r\n",
      'content'=>$json, 'timeout'=>20, 'ignore_errors'=>true,
    ]]);
    $resp = @file_get_contents('https://api.resend.com/emails', false, $ctx);
    if ($resp === false) throw new Exception('file_get_contents falhou (allow_url_fopen off?).');
    $code = 0;
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) $code=(int)$m[1];
  }
  dbg('Resend HTTP '.$code.': '.substr((string)$resp,0,400));
  if ($code < 200 || $code >= 300){
    $detail = $resp; $j = json_decode((string)$resp,true);
    if (is_array($j) && !empty($j['message'])) $detail = $j['message'];
    throw new Exception('Resend HTTP '.$code.': '.$detail);
  }
  return true;
}

/* ---- anexos (base64, vindos do formulário) ---- */
$attachments = [];
if (!empty($d['_anexos']) && is_array($d['_anexos'])){
  $MAX_TOTAL = 18 * 1024 * 1024; $total = 0;
  foreach ($d['_anexos'] as $a){
    if (empty($a['content']) || empty($a['name'])) continue;
    $size = strlen((string)$a['content']) * 0.75;
    if ($total + $size > $MAX_TOTAL) { dbg('Anexo ignorado (limite total): '.$a['name']); continue; }
    $total += $size;
    $attachments[] = ['filename'=>basename($a['name']), 'content'=>$a['content']];
  }
  dbg(count($attachments).' anexo(s) preparado(s).');
}

try {
  resend_send($CFG, $subject, $html, $attachments);
  dbg('SUCESSO: briefing enviado.');
  echo json_encode(['ok'=>true]);
} catch (Exception $ex) {
  error_log('[GoFirst briefing] '.$ex->getMessage());
  fail(502,'Falha ao enviar. Tente novamente.', $ex->getMessage());
}
