# Publicação acadêmica com Dashboards V2

O oficial usa o MySQL 8 da Oracle Cloud, no schema `krypton_oficial`. A demonstração usa seu próprio banco e dados fictícios. Cada perfil vincula o hostname público do serviço Render ao host, à porta e ao schema autorizados. O checkout acadêmico continua em `PAYMENT_MODE=demo` nos dois serviços, com QR Code e adaptador local do Mercado Pago. A homologação da API original de Assinaturas fica em ambiente separado com contas de teste autorizadas. [Procedimento com a Vitória](checkout-e-confirmacao.md#homologação-futura-com-a-vitória)

## TLS do oficial

O destino autorizado é `147.224.191.149:3306/krypton_oficial`. A aplicação exige `sslaccept=strict` e um único `sslcert` apontando para um arquivo legível. No Render oficial, use o Secret File `krypton-ca.pem`, disponível em `/etc/secrets/krypton-ca.pem`. O Prisma valida a cadeia e a identidade do servidor usando o IP público. A CA deve corresponder à cadeia do MySQL e o certificado do servidor deve ser válido para esse IP. [TLS no conector MySQL do Prisma](https://docs.prisma.io/docs/orm/v6/overview/databases/mysql) · [Secret Files no Render](https://render.com/docs/configure-environment-variables#secret-files)

## Configuração do Render oficial

| Configuração | Valor |
| --- | --- |
| Serviço e branch | `https://projetoacademiakrypton.onrender.com`, `main` após revisão e integração da correção |
| Build / start | `npm ci --include=dev && npx prisma generate` / `npm start` |
| Pre-deploy / auto-deploy / health | Vazio / desligado / `/api/health` |
| `NODE_ENV` / `PAYMENT_MODE` | `production` / `demo` |
| `DEMO_DEPLOYMENT` | `academico_oficial` |
| `DEMO_DATABASE_HOST` | `147.224.191.149` |
| `DEMO_DATABASE_NAME` | `krypton_oficial` |
| `DATABASE_URL` | `mysql://krypton_app:SENHA@147.224.191.149:3306/krypton_oficial?sslcert=/etc/secrets/krypton-ca.pem&sslaccept=strict` (`SENHA` é um marcador) |
| `DEMO_ALLOW_UNVERIFIED_TLS` | Ausente |
| `DEMO_PRISMA_POOL` | Opcional. Preserve `serial` se já estiver em uso. |
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

## Preparação do banco oficial

A infraestrutura informada já tem 14 tabelas, 11 migrations aplicadas, três unidades e um administrador inicial. O runtime usa `krypton_app` com permissões de leitura e escrita de dados apenas no schema oficial. A conta de migrations fica no localhost da instância. O script hospedado bloqueia `--aplicar` para o oficial. Qualquer manutenção futura de schema exige uma operação separada na instância. Mantenha Build, Start e Pre-deploy livres de migrations e seeds.

O backup já foi copiado e teve o SHA-256 conferido. Antes da publicação, valide a restauração em MySQL 8 privado e descartável, separado dos ambientes hospedados. Compare o inventário de tabelas, as 11 migrations em `_prisma_migrations`, as contagens dos dados críticos e os vínculos entre registros. Planeje a reconciliação de escritas posteriores ao backup se uma recuperação de dados se tornar necessária.

## Publicação coordenada no Render oficial

1. Após revisão e integração autorizada à `main`, registre o SHA aprovado, o último deploy funcional e o conjunto correspondente de variáveis e arquivos secretos em armazenamento restrito. Confirme a janela de manutenção e um destino de rollback que cumpra TLS estrito. Se o banco anterior continuar com certificado incompatível, mantenha um plano de manutenção para esse cenário.
2. No serviço `projetoacademiakrypton.onrender.com`, mantenha Auto-Deploy desligado. Confirme Build, Start e health check conforme a tabela. Suspenda escritas no serviço antigo durante a janela em que os bancos divergem e confira se os dados que precisam constar na Oracle já estão presentes.
3. Em **Environment**, substitua juntos `DEMO_DATABASE_HOST`, `DEMO_DATABASE_NAME` e `DATABASE_URL` do Clever Cloud pelos valores Oracle da tabela. Confira o Secret File existente e o caminho exato. Remova `DEMO_ALLOW_UNVERIFIED_TLS` do oficial, se presente. Remova as variáveis legadas `DB_*` listadas acima após verificar consumidores externos. Mantenha `PAYMENT_MODE=demo`, deixe ausentes as variáveis do Mercado Pago e confira se nenhum grupo vinculado fornece valores antigos. Use **Save only**. [Variáveis e segredos no Render](https://render.com/docs/configure-environment-variables)
4. Inicie **Manual Deploy → Deploy a specific commit** com o SHA aprovado. Confira o SHA ativo, a inicialização do Prisma, `/api/health` e a listagem de unidades. Valide login e leitura nos painéis com contas autorizadas. Confirme o modo simulado e o retorno 404 do webhook antes de liberar escritas. Registre o resultado sem copiar URLs com credenciais ou dados pessoais. [Deploy manual no Render](https://render.com/docs/deploys#manual-deploys)

## Rollback

1. Suspenda escritas e confira qual deploy ainda recebe tráfego. Se o novo deploy falhar antes da troca e o anterior estiver saudável, preserve a instância ativa e alinhe as variáveis salvas ao SHA que será usado na próxima tentativa.
2. Se for necessário reverter, selecione um deploy saudável com configuração compatível com seu SHA, banco, CA e TLS estrito. O rollback do Render reaproveita o build e as variáveis daquele deploy, enquanto a configuração salva do serviço precisa ser alinhada separadamente para o próximo deploy manual. Confira também os grupos vinculados e os arquivos secretos. Se recriar o deploy anterior, salve primeiro o conjunto compatível com **Save only** e então publique o SHA correspondente. [Rollback no Render](https://render.com/docs/rollbacks)
3. Se o build anterior só aceitar Clever Cloud e o banco não cumprir TLS estrito, mantenha o serviço em manutenção até aprovar um SHA compatível com Oracle ou recuperar um destino anterior que cumpra TLS estrito. Valide saúde, unidades, login e modo simulado antes de reabrir. Se já houver novas escritas na Oracle, reconcilie-as antes de trocar de banco ou restaurar um backup validado. O rollback de aplicação não restaura dados.
