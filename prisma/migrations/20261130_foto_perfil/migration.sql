CREATE TABLE `fotos_perfil` (
  `usuario_id` INTEGER UNSIGNED NOT NULL,
  `imagem` MEDIUMBLOB NOT NULL,
  PRIMARY KEY (`usuario_id`),
  CONSTRAINT `fotos_perfil_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
