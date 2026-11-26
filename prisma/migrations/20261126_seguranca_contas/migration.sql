ALTER TABLE `usuarios`
  ADD COLUMN `versao_sessao` INTEGER UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN `senha_redefinicao_obrigatoria` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `recuperacoes_senha` (
  `usuario_id` INTEGER UNSIGNED NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `expira_em` DATETIME(3) NOT NULL,
  PRIMARY KEY (`usuario_id`),
  UNIQUE KEY `recuperacoes_senha_token_hash_key` (`token_hash`),
  CONSTRAINT `recuperacoes_senha_usuario_id_fkey`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `limites_conta` (
  `chave` CHAR(64) NOT NULL,
  `contador` INTEGER UNSIGNED NOT NULL,
  `expira_em` DATETIME(3) NOT NULL,
  PRIMARY KEY (`chave`),
  KEY `limites_conta_expira_em_idx` (`expira_em`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `auditoria_contas` (
  `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  `autor_id` INTEGER UNSIGNED NULL,
  `usuario_id` INTEGER UNSIGNED NOT NULL,
  `evento` VARCHAR(40) NOT NULL,
  `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `auditoria_contas_usuario_id_criado_em_idx` (`usuario_id`, `criado_em`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
