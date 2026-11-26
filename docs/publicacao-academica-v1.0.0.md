# Publicação acadêmica com Dashboards V2

O oficial usa o banco original. A demonstração usa seu próprio banco e dados fictícios. Cada perfil vincula o hostname público do serviço Render ao host, à porta e ao schema autorizados. O checkout acadêmico continua em `PAYMENT_MODE=demo` nos dois serviços, com QR Code e adaptador local do Mercado Pago. A homologação da API original de Assinaturas fica em ambiente separado com contas de teste autorizadas. [Procedimento com a Vitória](checkout-e-confirmacao.md#homologação-futura-com-a-vitória)

## Bloqueio TLS do oficial

O handshake MySQL sem login em `b7ah1lmgd5imdjqu51eq-mysql.services.clever-cloud.com:3306` apresentou um certificado de servidor MySQL autogerado, sem SAN e com CN `MySQL_Server_8.0.22-13_Auto_Generated_Server_Certificate`. A cadeia enviada tem uma raiz autossinada. Em um teste diagnóstico isolado, confiar nessa raiz fez a cadeia passar, mas a verificação de hostname continuou falhando com OpenSSL 62. O nome da versão no CN não confirma a versão atual do servidor.

**Interrompa a publicação oficial aqui enquanto o suporte não corrigir o certificado.** Solicite ao Clever Cloud para o add-on original: certificado de servidor no endpoint MySQL da porta 3306 com SAN DNS exatamente igual ao hostname autorizado, cadeia completa e CA PEM obtida por canal autenticado, e política de renovação. Peça a troca do certificado no mesmo banco, com preservação do schema e dos dados. Se o provedor oferecer apenas outro hostname, confirme por escrito que é o mesmo add-on e revise o destino autorizado em código antes de usá-lo. [Documentação do MySQL no Clever Cloud](https://www.clever.cloud/developers/doc/deploy/databases/mysql/)

Após a correção, valide com a CA oficial do provedor quando privada. Com cadeia pública confiável, use o trust store do sistema e omita `-CAfile`.

```bash
host=b7ah1lmgd5imdjqu51eq-mysql.services.clever-cloud.com
openssl s_client -starttls mysql -connect "$host:3306" -servername "$host" \
  -verify_hostname "$host" -verify_return_error -CAfile /caminho/ca-oficial.pem -brief </dev/null
```

## Configuração do Render oficial

| Configuração | Valor |
| --- | --- |
| Serviço e branch | `https://projetoacademiakrypton.onrender.com`, `main` após revisão e integração da correção |
| Build / start | `npm ci --include=dev && npx prisma generate` / `npm start` |
| Pre-deploy / auto-deploy / health | Vazio / desligado / `/api/health` |
| `NODE_ENV` / `PAYMENT_MODE` | `production` / `demo` |
| `DEMO_DEPLOYMENT` | `academico_oficial` |
| `DEMO_DATABASE_HOST` | `b7ah1lmgd5imdjqu51eq-mysql.services.clever-cloud.com` |
| `DEMO_DATABASE_NAME` | `b7ah1lmgd5imdjqu51eq` |
| `DATABASE_URL` | `mysql://USUARIO:SENHA@b7ah1lmgd5imdjqu51eq-mysql.services.clever-cloud.com:3306/b7ah1lmgd5imdjqu51eq?sslaccept=strict`. Se necessário, acrescente `&sslcert=%2Fetc%2Fsecrets%2Fmysql-oficial-ca.pem` e cadastre esse PEM nos arquivos secretos. |
| `DEMO_ALLOW_UNVERIFIED_TLS` | Ausente |
| `DEMO_PRISMA_POOL` | `serial` |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Segredo exclusivo / opcional, padrão `7d` |
| `CONTA_ORIGEM_PUBLICA` | `https://projetoacademiakrypton.onrender.com` |
| `CONTA_SMTP_HOST` / `CONTA_SMTP_PORTA` | Para homologação, `sandbox.smtp.mailtrap.io` / `2525`. Para entrega efetiva, serviço SMTP aprovado em porta suportada, com TLS. |
| `CONTA_SMTP_USUARIO` / `CONTA_SMTP_SENHA` / `CONTA_EMAIL_REMETENTE` | Credenciais e remetente aprovados, exclusivos do oficial |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Ausentes até homologação manual e triagem de contas legadas; depois, cliente exclusivo |
| `GOOGLE_CALLBACK_URL` | Quando habilitado, `https://projetoacademiakrypton.onrender.com/api/auth/google/callback`; cadastrar exatamente no Google |
| `mercado_pago_access_token` / `MP_BACK_URL` / `MP_WEBHOOK_SECRET` / `MP_PLAN_*` | Ausentes |

## Configuração do Render demonstrativo

| Configuração | Valor |
| --- | --- |
| Serviço e branch | `https://projetoacademiakrypton-1.onrender.com`, branch de desenvolvimento aprovada |
| Build / start | `npm ci --include=dev && npx prisma generate` / `npm start` |
| Pre-deploy / auto-deploy / health | Vazio / desligado durante homologação / `/api/health` |
| `NODE_ENV` / `PAYMENT_MODE` | `production` / `demo` |
| `DEMO_DEPLOYMENT` | `academico_isolado` |
| `DEMO_DATABASE_HOST` | `booqcxfmlvclpjzw2uce-mysql.services.clever-cloud.com` |
| `DEMO_DATABASE_NAME` | `booqcxfmlvclpjzw2uce` |
| `DATABASE_URL` | `mysql://USUARIO:SENHA@booqcxfmlvclpjzw2uce-mysql.services.clever-cloud.com:3306/booqcxfmlvclpjzw2uce?sslaccept=accept_invalid_certs` enquanto a exceção vigente for necessária. Se houver certificado compatível, use `sslaccept=strict` e, se necessário, `sslcert` com a CA autorizada. |
| `DEMO_ALLOW_UNVERIFIED_TLS` | `I_UNDERSTAND_TEST_ONLY` somente durante a exceção, com dados fictícios |
| `DEMO_PRISMA_POOL` | `serial` |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Segredo exclusivo / opcional, padrão `7d` |
| `CONTA_ORIGEM_PUBLICA` | `https://projetoacademiakrypton-1.onrender.com` |
| `CONTA_SMTP_HOST` / `CONTA_SMTP_PORTA` | `sandbox.smtp.mailtrap.io` / `2525` |
| `CONTA_SMTP_USUARIO` / `CONTA_SMTP_SENHA` / `CONTA_EMAIL_REMETENTE` | Sandbox separado, credenciais próprias e remetente de teste |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Ausentes por padrão ou cliente separado de homologação, com contas fictícias após TLS estrito |
| `GOOGLE_CALLBACK_URL` | Quando habilitado, `https://projetoacademiakrypton-1.onrender.com/api/auth/google/callback`; cadastrar exatamente no Google |
| `mercado_pago_access_token` / `MP_BACK_URL` / `MP_WEBHOOK_SECRET` / `MP_PLAN_*` | Ausentes |

Render injeta `PORT`, `RENDER` e `RENDER_EXTERNAL_HOSTNAME`. Deixe o hostname automático. Codifique caracteres reservados de usuário e senha na URL, mantenha credenciais e grupos de variáveis separados e rotacione quaisquer credenciais expostas. O pool serial acrescenta uma conexão e timeout de 30 segundos somente ao datasource interno. As variáveis antigas `DB_HOST`, `DB_HOSTNAME`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` e `DB_PORT` não são lidas pelo código ou scripts versionados. Confira integrações externas antes de removê-las do painel. O sandbox Mailtrap intercepta e-mails para teste. Valide entrega de recuperação no provedor aprovado antes de habilitar o fluxo para destinatários reais. [Variáveis padrão do Render](https://render.com/docs/environment-variables) · [Limites do Render gratuito](https://render.com/docs/free) · [Mailtrap Sandbox](https://docs.mailtrap.io/email-sandbox/setup)

## Onze migrations versionadas

| Migration | Efeito |
| --- | --- |
| `0_init` | Cria o schema inicial e seus relacionamentos |
| `20261109_sync_schema_atual` | Sincroniza unidades e plano e permite contas sem senha local |
| `20261116_checkout_tentativas` | Adiciona a referência de assinatura em planos e cria tentativas |
| `20261124_transacoes_pagamento` | Cria o histórico de transações |
| `20261125_demo_transacoes` | Adiciona origem e permite transação pendente sem plano ou assinatura associados |
| `20261126_checkout_qr` | Adiciona hash e validade do QR à tentativa |
| `20261126_seguranca_contas` | Adiciona versionamento de sessão, recuperação, limites e auditoria |
| `20261127_google_oauth_identidade` | Adiciona identificador Google único e estados OAuth e torna o nascimento opcional |
| `20261128_checkout_metodos` | Registra método e resposta simulada e classifica os QR anteriores |
| `20261130_foto_perfil` | Armazena a foto de perfil por aluno |
| `20261201_treinos_concluidos` | Registra treinos concluídos, uma vez por aluno e dia |

## Banco oficial após desbloqueio TLS

1. Registre o SHA em execução, as configurações atuais e a janela de manutenção. A partir de uma estação autorizada com MySQL 8 e o código revisado, injete os segredos do oficial por mecanismo seguro. No plano gratuito, use essa estação para as operações manuais, pois o Render não oferece shell. [Limites do Render gratuito](https://render.com/docs/free)
2. Rode `node scripts/migrate-demo-hospedado.js --verificar` e depois `node scripts/migrate-demo-hospedado.js --status`. O primeiro confirma schema, versão e cifra negociada na sessão. A identidade é verificada pelo conector com `sslaccept=strict`. Compare o status com as 11 migrations e com o histórico de `_prisma_migrations`. A lista efetivamente pendente depende desse ledger. O status pode retornar código 1 ao listar pendências. Leia a saída e diferencie pendências esperadas de histórico divergente ou migration com falha. Se o ledger estiver ausente em um schema legado não vazio, houver falha ou divergência, interrompa. Revise o schema em uma restauração e documente um baseline correspondente antes de qualquer alteração do ledger. [Baseline Prisma](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining)
3. Inventarie localmente, sem exportar identificadores em relatórios, as contagens de usuários por papel, planos por tipo e situação, agendamentos, logins, transações por origem e estado e unidades, conforme as tabelas disponíveis. Verifique chaves e vínculos entre usuários, planos e transações. Confirme quantos administradores existem e se há uma conta recuperável. Revise contas sem senha local nem `google_sub` quando as colunas existirem. Mantenha OAuth desativado até comprovar a titularidade e decidir a recuperação de cada conta legada. Preserve IDs, papéis e histórico; vínculo por e-mail sozinho é insuficiente. Exemplos de leitura no cliente MySQL, após confirmar quais colunas e tabelas existem:

   ```sql
   SELECT role, COUNT(*) AS total FROM usuarios GROUP BY role;
   SELECT tipo, ativo, COUNT(*) AS total FROM planos GROUP BY tipo, ativo;
   SELECT COUNT(*) AS contas_sem_senha_e_sem_vinculo
     FROM usuarios WHERE senha_hash IS NULL AND google_sub IS NULL;
   SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at;
   ```
4. Gere snapshot pelo provedor e um dump cifrado em armazenamento restrito. Para o dump lógico, use um arquivo de cliente com permissão 0600 e opções `host`, `port`, `user`, `password`, `ssl-mode=VERIFY_IDENTITY` e `ssl-ca` com a CA aprovada. Com origem InnoDB e sem DDL concorrente, execute em diretório protegido e cifrado. [Documentação do mysqldump](https://dev.mysql.com/doc/refman/8.0/en/mysqldump.html)

   ```bash
   umask 077
   mysqldump --defaults-file=/caminho/protegido/oficial.cnf \
     --single-transaction --quick --no-tablespaces --set-gtid-purged=OFF \
     b7ah1lmgd5imdjqu51eq > oficial-pre-publicacao.sql
   sha256sum oficial-pre-publicacao.sql > oficial-pre-publicacao.sql.sha256
   ```

5. Verifique o checksum e restaure o dump em **MySQL 8 privado e descartável**, fora dos dois serviços Render e sem usar nenhum dos dois bancos Clever Cloud. Revise o destino local antes de executar `mysql --defaults-file=/caminho/restore-local.cnf krypton_restore < oficial-pre-publicacao.sql`. Compare inventário, ledger e vínculos com a origem. Nessa cópia, ensaie as migrations pendentes com o Prisma 5.22 apontado exclusivamente ao banco de ensaio. Compare novamente os dados e confirme que a restauração é operável. Restrinja acesso à cópia e elimine-a conforme o prazo aprovado.
6. Após aprovação e backup restaurado com sucesso, execute `node scripts/migrate-demo-hospedado.js --aplicar` com as variáveis oficiais e uma conta autorizada à manutenção naquele banco. O script repete a validação e o Prisma aplica as pendências. Rode `--status` novamente e confira o inventário pós-migration. Mantenha migrations fora de Build, Start e Pre-deploy.

## Publicação e rollback

Após o bloqueio TLS ser resolvido e a etapa de banco aprovada, confirme a revisão integrada à `main`. No Render oficial, ajuste a branch, o build, o start e o health check conforme a tabela. Mantenha Auto-Deploy desligado. Em Environment, use **Save only** e inicie manualmente o deploy do SHA aprovado em **Manual Deploy**. Confirme o SHA publicado e faça smoke tests de login, acesso separado aos dashboards V2, indicadores, histórico, checkout simulado e recuperação de conta. Homologue o callback Google com contas autorizadas antes de liberar o provedor. Se precisar provisionar um primeiro administrador, use apenas `npm run conta:admin-inicial` em operação separada e autorizada. [Configuração de segredos no Render](https://render.com/docs/configure-environment-variables) · [Publicação manual](https://render.com/docs/deploys) · [Segurança de contas](seguranca-contas.md) · [Homologação Google OAuth](homologacao-autenticacao.md)

Em rollback, suspenda escritas se houver risco aos dados. Republique apenas um SHA compatível com o schema atual, com pagamentos simulados e TLS estrito. Se houver incompatibilidade, use manutenção até aprovar a recuperação. O rollback do código não reverte migrations. Caso seja preciso restaurar o banco oficial, use o backup já validado em janela com escritas suspensas e reconcilie registros posteriores à cópia antes de reabrir o serviço.
