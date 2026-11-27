-- AlterTable
ALTER TABLE `agendamentos` ADD COLUMN `profissional_id` INTEGER UNSIGNED NULL,
    ADD COLUMN `situacao` VARCHAR(20) NOT NULL DEFAULT 'agendado',
    ADD COLUMN `unidade_id` INTEGER UNSIGNED NULL,
    ADD COLUMN `vaga` VARCHAR(48) NULL;

-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN `profissional_ativo` BOOLEAN NOT NULL DEFAULT true,
    MODIFY `role` ENUM('aluno', 'admin', 'personal', 'nutricionista', 'recepcao') NOT NULL DEFAULT 'aluno';

-- CreateTable
CREATE TABLE `vinculos_profissionais` (
    `aluno_id` INTEGER UNSIGNED NOT NULL,
    `profissional_id` INTEGER UNSIGNED NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `vinculos_profissionais_profissional_id_idx`(`profissional_id`),
    PRIMARY KEY (`aluno_id`, `profissional_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fichas_profissionais` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `aluno_id` INTEGER UNSIGNED NOT NULL,
    `profissional_id` INTEGER UNSIGNED NOT NULL,
    `tipo` ENUM('nutricionista', 'personal') NOT NULL,
    `titulo` VARCHAR(120) NOT NULL,
    `itens` JSON NOT NULL,
    `orientacoes` TEXT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `fichas_profissionais_aluno_id_tipo_idx`(`aluno_id`, `tipo`),
    INDEX `fichas_profissionais_profissional_id_tipo_idx`(`profissional_id`, `tipo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `atendimentos_recepcao` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `aluno_id` INTEGER UNSIGNED NOT NULL,
    `autor_id` INTEGER UNSIGNED NOT NULL,
    `unidade_id` INTEGER UNSIGNED NULL,
    `motivo` VARCHAR(160) NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `atendimentos_recepcao_criado_em_idx`(`criado_em`),
    INDEX `atendimentos_recepcao_aluno_id_idx`(`aluno_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `agendamentos_vaga_key` ON `agendamentos`(`vaga`);

-- CreateIndex
CREATE INDEX `agendamentos_profissional_id_data_hora_idx` ON `agendamentos`(`profissional_id`, `data_hora`);

-- AddForeignKey
ALTER TABLE `agendamentos` ADD CONSTRAINT `agendamentos_profissional_id_fkey` FOREIGN KEY (`profissional_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agendamentos` ADD CONSTRAINT `agendamentos_unidade_id_fkey` FOREIGN KEY (`unidade_id`) REFERENCES `unidades`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vinculos_profissionais` ADD CONSTRAINT `vinculos_profissionais_aluno_id_fkey` FOREIGN KEY (`aluno_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vinculos_profissionais` ADD CONSTRAINT `vinculos_profissionais_profissional_id_fkey` FOREIGN KEY (`profissional_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fichas_profissionais` ADD CONSTRAINT `fichas_profissionais_aluno_id_fkey` FOREIGN KEY (`aluno_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fichas_profissionais` ADD CONSTRAINT `fichas_profissionais_profissional_id_fkey` FOREIGN KEY (`profissional_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `atendimentos_recepcao` ADD CONSTRAINT `atendimentos_recepcao_aluno_id_fkey` FOREIGN KEY (`aluno_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `atendimentos_recepcao` ADD CONSTRAINT `atendimentos_recepcao_autor_id_fkey` FOREIGN KEY (`autor_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `atendimentos_recepcao` ADD CONSTRAINT `atendimentos_recepcao_unidade_id_fkey` FOREIGN KEY (`unidade_id`) REFERENCES `unidades`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
