# Runbook da entrega acadêmica oficial

Alvo: Render Oficial `projetoacademiakrypton.onrender.com` e Oracle MySQL `krypton_oficial`. Registre o SHA candidato, o SHA ativo, o horário UTC e o operador. Mantenha a publicação automática desligada e o demonstrativo separado. A sessão de desenvolvimento usa somente bancos descartáveis.

## Antes da janela

1. Reserve uma janela com escritas suspensas no oficial. Produza um backup consistente do schema e dos dados com uma conta autorizada e TLS verificado. Proteja o arquivo com modo 0600, confira `sha256sum` e `gzip -t` e restaure em um MySQL 8 descartável. Compare tabelas, contagens, histórico de migrations e ausência de órfãos. Registre horário e posição do binlog para reconciliação. Uma restauração validada de backup antigo não substitui a validação da cópia desta janela.
2. Confira as 11 migrations esperadas em `_prisma_migrations`. Compare nomes e checksums com a revisão em produção. Exija `finished_at` preenchido, `rolled_back_at` nulo e ausência de execuções incompletas. Confira as 14 tabelas esperadas. Se o histórico divergir, interrompa.
3. Revise o SQL de `20261202_perfis_profissionais` e `20261203_notificacoes_jobs`. A primeira acrescenta colunas e chaves à agenda, expande o enum de papéis e cria estruturas profissionais. A segunda cria a fila e as notificações. Avalie tempo e bloqueios de DDL. MySQL pode confirmar instruções DDL separadamente, por isso a falha precisa de diagnóstico antes de qualquer nova tentativa.
4. Em uma cópia descartável atualizada, rode o código anterior com registros anteriores à migração. Confirme startup, sessão, unidades, painel e checkout demo. Contas com papel `recepcao` só devem ser provisionadas depois de trocar para o SHA novo. O Prisma Client anterior desconhece esse valor do enum. Considere isso também ao planejar rollback.

## Aplicação e troca do serviço

1. Na própria instância Oracle, use uma cópia revisada do código candidato e o Prisma do lockfile. Carregue o `DATABASE_URL` de manutenção por canal protegido, com `krypton_migrate` no loopback. Preserve TLS estrito e a verificação de identidade. Confirme que o nome no SAN do certificado resolve para o loopback no contexto do cliente e que o MySQL identifica a conta como `krypton_migrate@127.0.0.1`. Se DNS local, SAN, autenticação ou rota não permitirem essa combinação, interrompa para corrigir a identidade da conexão. A conta de aplicação não executa migrations.
2. Com o destino já verificado, rode `npx prisma migrate status`. O status anterior pode retornar código 1 por haver duas migrations pendentes. Confirme que apenas as duas revisadas estão pendentes, então rode `npx prisma migrate deploy` e novamente `npx prisma migrate status`. Confira 13 entradas concluídas e as novas colunas, chaves e tabelas. Em caso de falha, preserve logs e ledger e avalie quais DDLs foram confirmados. Execute uma nova tentativa somente após revisão.
3. Confira, em leitura, os dois grants `krypton_app`. Exija `SELECT, INSERT, UPDATE, DELETE` sobre `krypton\_oficial`.* para ambos os CIDRs, `REQUIRE SSL` e ausência de DDL ou grants administrativos. O grant no escopo literal do schema cobre as novas tabelas. Use `SHOW GRANTS` e `HEX(mysql.db.Db)` para confirmar o escape antes de testar as APIs.
4. No Render Oficial, preserve `NODE_ENV=production`, `PAYMENT_MODE=demo`, `DEMO_DEPLOYMENT=academico_oficial`, `DEMO_DATABASE_HOST=147.224.191.149`, `DEMO_DATABASE_NAME=krypton_oficial` e a `DATABASE_URL` protegida com `sslaccept=strict` e `sslcert=/etc/secrets/krypton-ca.pem`. Preserve `DEMO_PRISMA_POOL=serial` se já usado e os segredos de sessão do serviço. Mantenha o worker desativado inicialmente. Nenhum segredo Mercado Pago de teste é necessário. Use o deploy manual do SHA aprovado, sem migrations em Build, Start ou Pre-deploy.
5. Verifique Prisma, `/api/health`, `/api/unidades`, sessão TLS na Oracle e os cinco papéis. Com contas autorizadas, confira vínculo, agenda, ficha, plano alimentar, isolamento entre alunos, PIX, Mercado Pago simulado e revogação de sessão. O logout invalida as sessões anteriores da mesma conta por versão. Em seguida, habilite `KRYPTON_WORKER_NOTIFICACOES=1` no oficial e valide que um evento autorizado gera uma única notificação por destinatário. `KRYPTON_WORKER_INTERVALO_MS` é opcional. Reabra escritas após assinar a conferência.

## Recuperação

Suspenda escritas e desligue o worker se houver falha. Prefira correção adiante compatível com o schema e o ledger. O rollback do Render muda o código e a configuração do deploy correspondente. As migrations permanecem aplicadas no MySQL. O SHA antigo só pode receber tráfego depois de confirmar compatibilidade com os dados gravados pelo novo código, especialmente o papel `recepcao`. Caso seja necessário restaurar, preserve uma cópia do estado atual e reconcilie os registros posteriores ao backup a partir do binlog antes de reabrir. Registre qualquer perda autorizada explicitamente e mantenha o serviço em manutenção se a reconciliação estiver pendente.

## Demonstração autorizada

O provisionador exige consentimento por execução e usa contas reservadas `krypton.demo.*@example.invalid`. Ele requer uma unidade existente, cria os cinco papéis fictícios e preserva contas já provisionadas e o administrador principal. O Elite do aluno é uma fixture acadêmica sem transação financeira. Repetir a execução conserva as senhas originais e reaproveita vínculos, materiais e consultas. Colisão com identidade que não tenha a marca do provisionador interrompe a transação.

Gere o JSON de senhas em um arquivo novo, fora do repositório e com modo 0600, sem copiá-lo para relatórios:

```bash
node --input-type=module -e 'import {randomBytes} from "node:crypto"; import {writeFileSync} from "node:fs"; const papeis=["admin","recepcao","personal","nutricionista","aluno"]; writeFileSync(process.argv[1], JSON.stringify(Object.fromEntries(papeis.map(p=>[p,randomBytes(32).toString("base64url")]))),{mode:0o600,flag:"wx"});' /caminho/privado/krypton-demo.json
KRYPTON_PROVISIONAR_DEMO=CONFIRMO_DADOS_FICTICIOS npm run demo:provisionar -- /caminho/privado/krypton-demo.json
```

O comando local exige `NODE_ENV=development` e o banco descartável de checkout. No oficial, além da confirmação local, a execução precisa de autorização operacional específica e de `KRYPTON_PROVISIONAR_HOSPEDADO=CONFIRMO_RENDER_OFICIAL`, `NODE_ENV=production` e `RENDER_EXTERNAL_HOSTNAME=projetoacademiakrypton.onrender.com` junto das variáveis oficiais e TLS válido. Forneça essas confirmações apenas ao processo administrativo. O ambiente demonstrativo hospedado é recusado. Guarde o arquivo protegido para acesso às fixtures e não o compartilhe no Git. Caso o plano Render não ofereça shell, planeje uma execução separada a partir de uma origem autorizada, com as mesmas verificações.

Google OAuth continua dependente da revisão do Léo e da homologação dos callbacks com a aplicação correta. O checkout `mp_test` permanece exclusivo de desenvolvimento local e depende de credenciais e comprador de teste confirmados pela Vitória.
