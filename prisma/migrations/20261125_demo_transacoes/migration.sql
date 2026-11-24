ALTER TABLE `transacoes_pagamento` DROP FOREIGN KEY `transacoes_pagamento_plano_id_fkey`;
ALTER TABLE `transacoes_pagamento`
  MODIFY `mp_preapproval_id` VARCHAR(100) NULL,
  MODIFY `plano_id` INTEGER UNSIGNED NULL,
  ADD COLUMN `origem` VARCHAR(16) NOT NULL DEFAULT 'mercadopago',
  ADD CONSTRAINT `transacoes_pagamento_plano_id_fkey` FOREIGN KEY (`plano_id`) REFERENCES `planos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
