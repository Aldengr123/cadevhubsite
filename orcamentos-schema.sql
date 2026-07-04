-- ============================================================
--  CADev Hub — Banco de Orçamentos
--  Cole TUDO isto no phpMyAdmin (aba SQL) com o SEU banco selecionado.
-- ============================================================

CREATE TABLE IF NOT EXISTS orcamentos (
  id             VARCHAR(40)   NOT NULL PRIMARY KEY,
  titulo         VARCHAR(255)  NOT NULL DEFAULT '',
  cliente        VARCHAR(255)  NOT NULL DEFAULT '',
  total_inicial  DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_mensal   DECIMAL(12,2) NOT NULL DEFAULT 0,
  dados          LONGTEXT      NOT NULL,
  criado_em      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
