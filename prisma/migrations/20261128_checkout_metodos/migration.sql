ALTER TABLE `checkout_tentativas`
  ADD COLUMN `metodo` ENUM('mercadopago', 'qr_krypton', 'mercadopago_simulado') NOT NULL DEFAULT 'mercadopago',
  ADD COLUMN `resposta_mp_demo` ENUM('pendente', 'aprovada', 'recusada') NULL;

UPDATE `checkout_tentativas` AS `tentativa`
JOIN `transacoes_pagamento` AS `transacao` ON `transacao`.`tentativa_id` = `tentativa`.`id`
SET `tentativa`.`metodo` = 'qr_krypton'
WHERE `transacao`.`origem` = 'demo';
