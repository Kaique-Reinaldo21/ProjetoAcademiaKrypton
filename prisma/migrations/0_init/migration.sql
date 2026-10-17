-- CreateTable
CREATE TABLE `agendamentos` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER UNSIGNED NOT NULL,
    `tipo` ENUM('nutricionista', 'personal') NOT NULL,
    `data_hora` DATETIME(0) NOT NULL,
    `observacao` TEXT NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_usuario_ag`(`usuario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `historico_logins` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER UNSIGNED NOT NULL,
    `data_login` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `ip` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,

    INDEX `usuario_id`(`usuario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `planos` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER UNSIGNED NOT NULL,
    `tipo` ENUM('basico', 'pro', 'elite') NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `unidade_id` INTEGER UNSIGNED NULL,
    `inicio` DATE NOT NULL DEFAULT (curdate()),
    `vencimento` DATE NULL,
    `updated_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_usuario`(`usuario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `unidades` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(120) NOT NULL,
    `endereco` VARCHAR(255) NOT NULL,
    `cidade` VARCHAR(80) NOT NULL,
    `telefone` VARCHAR(20) NULL,
    `horario` VARCHAR(80) NULL DEFAULT 'Seg–Sex 06h–22h | Sáb 08h–18h',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuarios` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(120) NOT NULL,
    `email` VARCHAR(180) NOT NULL,
    `senha_hash` VARCHAR(255) NOT NULL,
    `data_nascimento` DATE NOT NULL,
    `role` ENUM('aluno', 'admin', 'personal', 'nutricionista') NOT NULL DEFAULT 'aluno',
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `email`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `agendamentos` ADD CONSTRAINT `agendamentos_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `historico_logins` ADD CONSTRAINT `historico_logins_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `planos` ADD CONSTRAINT `planos_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

