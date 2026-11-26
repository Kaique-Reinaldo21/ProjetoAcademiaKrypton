ALTER TABLE `checkout_tentativas`
  ADD COLUMN `qr_token_hash` CHAR(64) NULL,
  ADD COLUMN `qr_expira_em` DATETIME(3) NULL;
