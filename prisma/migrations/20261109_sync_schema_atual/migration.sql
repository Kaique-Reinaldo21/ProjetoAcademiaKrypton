-- Sincroniza a tabela de unidades com o schema atual
ALTER TABLE `unidades`
    ADD COLUMN `latitude` DOUBLE NULL,
    ADD COLUMN `longitude` DOUBLE NULL,
    MODIFY COLUMN `horario` VARCHAR(80) NULL;

-- Adiciona o identificador do plano no Mercado Pago
ALTER TABLE `planos`
    ADD COLUMN `mp_plan_id` VARCHAR(100) NULL;

-- Permite usuários sem senha local, por exemplo via OAuth
ALTER TABLE `usuarios`
    MODIFY COLUMN `senha_hash` VARCHAR(255) NULL;