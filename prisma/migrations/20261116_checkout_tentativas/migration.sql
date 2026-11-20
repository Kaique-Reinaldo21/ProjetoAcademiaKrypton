-- Checkout: vinculo seguro e idempotente entre usuario e assinatura no Mercado Pago.
ALTER TABLE `planos`
  ADD COLUMN `mp_preapproval_id` VARCHAR(100) NULL,
  ADD UNIQUE INDEX `planos_mp_preapproval_id_key`(`mp_preapproval_id`);

CREATE TABLE `checkout_tentativas` (
  `id` VARCHAR(36) NOT NULL,
  `usuario_id` INTEGER UNSIGNED NOT NULL,
  `tipo` ENUM('basico','pro','elite') NOT NULL,
  `unidade_id` INTEGER UNSIGNED NULL,
  `mp_preapproval_id` VARCHAR(100) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pendente',
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `checkout_tentativas_mp_preapproval_id_key`(`mp_preapproval_id`),
  INDEX `checkout_tentativas_usuario_id_status_idx`(`usuario_id`, `status`),
  CONSTRAINT `checkout_tentativas_usuario_id_fkey`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
