<?php
/* ============================================================
   CADev Hub — API de Orçamentos (MySQL/PDO)
   Ações:
     GET  ?action=get&id=oc_xxx      → público (cliente abre a proposta)
     POST ?action=list              → admin (lista)
     POST ?action=save              → admin (cria/atualiza)
     POST ?action=delete            → admin (remove)
   Auth admin: header  X-Admin-Token: <admin_token do config-db.php>
   ============================================================ */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { exit; }

$cfg = @include __DIR__ . '/config-db.php';
if (!is_array($cfg)) {
  http_response_code(500);
  echo json_encode(['ok'=>false,'error'=>'config-db.php ausente ou inválido']); exit;
}

function reqBody(){ static $b=null; if($b===null){ $j=json_decode(file_get_contents('php://input'),true); $b=is_array($j)?$j:[]; } return $b; }
function isAdmin($cfg){
  $t = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
  if(!$t){ $b=reqBody(); $t=$b['token'] ?? ''; }
  return $t !== '' && hash_equals((string)$cfg['admin_token'], (string)$t);
}

try {
  $pdo = new PDO(
    "mysql:host={$cfg['host']};dbname={$cfg['db']};charset=utf8mb4",
    $cfg['user'], $cfg['pass'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
  );
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok'=>false,'error'=>'Falha na conexão: '.$e->getMessage()]); exit;
}

$action = $_GET['action'] ?? (reqBody()['action'] ?? '');

try {
  /* ---- público: abrir proposta ---- */
  if ($action === 'get') {
    $id = $_GET['id'] ?? '';
    $st = $pdo->prepare('SELECT dados FROM orcamentos WHERE id = ?');
    $st->execute([$id]);
    $row = $st->fetch();
    if (!$row) { echo json_encode(['ok'=>false,'error'=>'Proposta não encontrada']); exit; }
    echo json_encode(['ok'=>true,'dados'=>json_decode($row['dados'], true)]); exit;
  }

  /* ---- daqui pra baixo: só admin ---- */
  if (!isAdmin($cfg)) { http_response_code(401); echo json_encode(['ok'=>false,'error'=>'Não autorizado']); exit; }

  if ($action === 'list') {
    $rows = $pdo->query('SELECT id,titulo,cliente,total_inicial,total_mensal,atualizado_em FROM orcamentos ORDER BY atualizado_em DESC')->fetchAll();
    echo json_encode(['ok'=>true,'itens'=>$rows]); exit;
  }

  if ($action === 'save') {
    $b = reqBody();
    if (empty($b['id'])) { echo json_encode(['ok'=>false,'error'=>'id ausente']); exit; }
    $st = $pdo->prepare(
      'INSERT INTO orcamentos (id,titulo,cliente,total_inicial,total_mensal,dados)
       VALUES (:id,:titulo,:cliente,:ti,:tm,:dados)
       ON DUPLICATE KEY UPDATE titulo=VALUES(titulo),cliente=VALUES(cliente),
         total_inicial=VALUES(total_inicial),total_mensal=VALUES(total_mensal),dados=VALUES(dados)'
    );
    $st->execute([
      ':id'=>$b['id'], ':titulo'=>$b['titulo']??'', ':cliente'=>$b['cliente']??'',
      ':ti'=>(float)($b['total_inicial']??0), ':tm'=>(float)($b['total_mensal']??0),
      ':dados'=>json_encode($b['dados']??[], JSON_UNESCAPED_UNICODE)
    ]);
    echo json_encode(['ok'=>true,'id'=>$b['id']]); exit;
  }

  if ($action === 'delete') {
    $b = reqBody();
    $st = $pdo->prepare('DELETE FROM orcamentos WHERE id = ?');
    $st->execute([$b['id'] ?? '']);
    echo json_encode(['ok'=>true]); exit;
  }

  echo json_encode(['ok'=>false,'error'=>'Ação inválida']);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok'=>false,'error'=>$e->getMessage()]);
}
