ALTER TABLE `usuarios`
  ADD COLUMN `google_sub` VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD UNIQUE INDEX `usuarios_google_sub_key` (`google_sub`),
  MODIFY COLUMN `data_nascimento` DATE NULL;

CREATE TABLE `estados_oauth_google` (
  `state_hash` CHAR(64) NOT NULL,
  `navegador_hash` CHAR(64) NOT NULL,
  `expira_em` DATETIME(3) NOT NULL,
  `usuario_id` INTEGER UNSIGNED NULL,
  `versao_sessao` INTEGER UNSIGNED NULL,
  PRIMARY KEY (`state_hash`),
  INDEX `estados_oauth_google_expira_em_idx` (`expira_em`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
