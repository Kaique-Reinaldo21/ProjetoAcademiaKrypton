# Publicação acadêmica v1.0.0

A versão acadêmica reúne o QR Code Krypton com Rickroll, o adaptador local de Mercado Pago, autenticação e segurança de contas. A integração original de Assinaturas, o webhook e a reconciliação ficam disponíveis no código para homologação posterior em ambiente separado.

## Nove migrations revisadas

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

O ledger do banco oficial precisa ser consultado no ambiente autorizado. Do código, é possível comprovar que as últimas quatro migrations são novas em relação à `main`. Se apenas as cinco primeiras já estiverem aplicadas no destino, essas quatro serão as pendentes. Essa hipótese não substitui `npm run prisma:status` no banco oficial.

A migration de Google preserva os dados e não vincula contas antigas por e-mail. Separe as contas legadas sem identificador Google e revise como comprovar o vínculo antes de liberar o login. A migration de métodos atualiza a classificação das tentativas antigas. Revise o tempo de execução e a janela de manutenção em uma restauração representativa.

## Pré-publicação

- [ ] Revisar o PR e registrar o SHA aprovado. Manter deploy automático desativado. Revisão do PR, merge, aplicação de migrations e publicação são ações manuais distintas.
- [ ] Confirmar que o serviço oficial usará um banco acadêmico isolado e aprovado pelo código em `src/config/demo-hosts.js`. Confirmar MySQL 8 e cadeia do certificado compatível com o hostname, com `sslaccept=strict`. A exceção TLS existente se limita ao banco de demonstração aprovado e a dados fictícios. Se o destino oficial exigir a exceção, ou se estiver fora da lista autorizada, interromper a publicação e tratar a infraestrutura em revisão separada.
- [ ] Configurar `NODE_ENV=production`, `PAYMENT_MODE=demo`, `DEMO_DEPLOYMENT=academico_isolado`, `DEMO_DATABASE_HOST`, `DEMO_DATABASE_NAME` e a `DATABASE_URL` do destino. Manter ausentes `mercado_pago_access_token` e `MP_WEBHOOK_SECRET` no serviço acadêmico. Confirmar que o webhook financeiro responde 404 e que os dois métodos do checkout permanecem simulados.
- [ ] Configurar `JWT_SECRET` exclusivo, `CONTA_ORIGEM_PUBLICA` com a origem canônica HTTPS e as variáveis `CONTA_SMTP_*` e `CONTA_EMAIL_REMETENTE`. Usar caixa de testes e contas fictícias na homologação. Conferir falha de entrega, expiração, resposta genérica e revogação de sessão. [Guia SMTP e contas](seguranca-contas.md)
- [ ] Se Google estiver habilitado, confirmar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_CALLBACK_URL` com o callback exato do domínio servido, por exemplo `https://academiakripton.com.br/api/auth/google/callback` no domínio oficial configurado. Validar o provedor em homologação antes de habilitar no oficial. Confirmar colisões, vínculo explícito, perfis e triagem de usuários legados. Rotacionar credenciais expostas. Na transição do OAuth legado, rotacionar `JWT_SECRET` em todas as instâncias e exigir novo login. [Guia de autenticação](homologacao-autenticacao.md)
- [ ] Confirmar que alunos, administradores e unidades de apresentação foram provisionados por procedimentos autorizados. O administrador inicial recebe senha via entrada protegida. Verificar no painel as permissões de aluno e administrador.

## Banco, deploy e verificação

1. Em um ambiente operacional autorizado que carregue **as variáveis do serviço oficial**, rode `node scripts/migrate-demo-hospedado.js --verificar` para conferir schema, versão e cifra TLS. Com `sslaccept=strict`, a conexão também precisa passar pela verificação de identidade. Em seguida, rode `npm run prisma:status` e compare com a tabela de migrations. Interrompa em caso de histórico divergente, migration com falha ou destino inesperado.
2. Prepare backup do banco, teste a restauração e registre o SHA atualmente publicado. Quando houver aprovação explícita para a janela de manutenção, aplique apenas as migrations pendentes manualmente com a conta dedicada ao banco acadêmico. Repita `npm run prisma:status` e confira que o schema está atualizado.
3. Configure o build `npm ci --include=dev && npx prisma generate`, o start `npm start` e o health check `/api/health`. Deixe o pre-deploy sem migrations. Publique manualmente a revisão aprovada após validar o banco.
4. Em HTTPS, faça smoke test com contas fictícias. Confira cadastro e login, métodos QR e Mercado Pago simulado, tentativa concorrente bloqueada, aprovação e recusa com histórico e plano corretos. Teste a recuperação, a revogação de sessão e a separação entre alunos e administradores. Teste o callback Google e a entrega SMTP do ambiente somente se configurados. A página de saúde confirma o processo. Os fluxos autenticados confirmam a integração com o banco.
5. Registre o SHA, o estado das migrations e o resultado da homologação. A API oficial de Assinaturas fica fora desta publicação. [Procedimento de testes futuros com a Vitória](checkout-e-confirmacao.md#homologação-futura-com-a-vitória)

## Rollback

Suspenda o tráfego se houver risco aos dados. Publique novamente o SHA anterior somente se ele for compatível com o schema atualizado e com a configuração acadêmica. Mantenha OAuth desativado se o rollback reintroduzir vínculo por e-mail. Se a recuperação exigir o backup, coordene a restauração e reconcilie as transações e contas criadas após a cópia antes de reabrir o serviço.
