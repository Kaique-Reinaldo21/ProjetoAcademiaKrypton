-- CreateTable
CREATE TABLE `jobs` (
    `id` CHAR(36) NOT NULL,
    `tipo` VARCHAR(40) NOT NULL,
    `payload` JSON NOT NULL,
    `situacao` ENUM('pendente', 'processando', 'concluido', 'falhou') NOT NULL DEFAULT 'pendente',
    `tentativas` INTEGER NOT NULL DEFAULT 0,
    `limite` INTEGER NOT NULL DEFAULT 5,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `programado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processado_em` DATETIME(3) NULL,
    `concluido_em` DATETIME(3) NULL,
    `bloqueado_ate` DATETIME(3) NULL,
    `bloqueio` CHAR(36) NULL,
    `idempotencia` VARCHAR(120) NOT NULL,
    `erro` VARCHAR(40) NULL,

    UNIQUE INDEX `jobs_idempotencia_key`(`idempotencia`),
    INDEX `jobs_situacao_programado_em_idx`(`situacao`, `programado_em`),
    INDEX `jobs_situacao_bloqueado_ate_idx`(`situacao`, `bloqueado_ate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notificacoes` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `destinatario_id` INTEGER UNSIGNED NOT NULL,
    `job_id` CHAR(36) NOT NULL,
    `categoria` VARCHAR(40) NOT NULL,
    `titulo` VARCHAR(120) NOT NULL,
    `mensagem` VARCHAR(255) NOT NULL,
    `destino` VARCHAR(120) NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lida_em` DATETIME(3) NULL,

    INDEX `notificacoes_destinatario_id_lida_em_criado_em_idx`(`destinatario_id`, `lida_em`, `criado_em`),
    UNIQUE INDEX `notificacoes_job_id_destinatario_id_key`(`job_id`, `destinatario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `notificacoes` ADD CONSTRAINT `notificacoes_destinatario_id_fkey` FOREIGN KEY (`destinatario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notificacoes` ADD CONSTRAINT `notificacoes_job_id_fkey` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
