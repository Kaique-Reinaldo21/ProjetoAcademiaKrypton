-- Armazenamento privado de PDFs profissionais no MySQL.
-- Conteúdo só é servido por rotas autenticadas após validação de proprietário.
CREATE TABLE `documentos_profissionais` (
  `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  `aluno_id` INTEGER UNSIGNED NOT NULL,
  `profissional_id` INTEGER UNSIGNED NOT NULL,
  `ficha_id` INTEGER UNSIGNED NULL,
  `tipo` ENUM('nutricionista', 'personal') NOT NULL,
  `titulo` VARCHAR(120) NOT NULL,
  `nome_arquivo` VARCHAR(180) NOT NULL,
  `origem` VARCHAR(20) NOT NULL DEFAULT 'upload',
  `situacao` VARCHAR(20) NOT NULL DEFAULT 'disponivel',
  `conteudo` MEDIUMBLOB NULL,
  `sha256` CHAR(64) NULL,
  `chave_origem` VARCHAR(120) NULL,
  `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `disponibilizado_em` DATETIME(3) NULL,
  UNIQUE INDEX `documentos_profissionais_chave_origem_key` (`chave_origem`),
  INDEX `documentos_profissionais_aluno_id_situacao_criado_em_idx` (`aluno_id`, `situacao`, `criado_em`),
  INDEX `documentos_profissionais_profissional_id_tipo_criado_em_idx` (`profissional_id`, `tipo`, `criado_em`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `documentos_profissionais`
  ADD CONSTRAINT `documentos_profissionais_aluno_id_fkey`
    FOREIGN KEY (`aluno_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `documentos_profissionais_profissional_id_fkey`
    FOREIGN KEY (`profissional_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `documentos_profissionais_ficha_id_fkey`
    FOREIGN KEY (`ficha_id`) REFERENCES `fichas_profissionais` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
