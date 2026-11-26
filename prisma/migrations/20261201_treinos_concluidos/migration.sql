CREATE TABLE `treinos_concluidos` (
  `usuario_id` INTEGER UNSIGNED NOT NULL,
  `dia` DATE NOT NULL,
  `registrado_em` DATETIME(3) NOT NULL,
  PRIMARY KEY (`usuario_id`, `dia`),
  CONSTRAINT `treinos_concluidos_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
