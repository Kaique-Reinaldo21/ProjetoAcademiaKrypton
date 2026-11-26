# Checkout e confirmação de pagamento — testes de desenvolvimento

> Integração em avaliação. **Não utilizar dinheiro real nem implantar em produção sem testes de ponta a ponta.**

## Objetivo

O botão de contratação utiliza a rota POST /api/checkout com autenticação JWT e não ativa planos. A API identifica o aluno pelo token, registra uma tentativa no MySQL e devolve o link do Mercado Pago. A confirmação exige assinatura com status authorized e uma fatura vinculada com payment.status = approved e valor/moeda esperados, consultados no provedor.

A confirmação pode ocorrer no retorno do navegador (GET /checkout/success) ou pelo webhook assinado (POST /api/webhooks/mercadopago). Nenhum deles confia em uma indicação de aprovação enviada pelo navegador.

## Preparação

1. Execute npm ci, npx prisma migrate deploy, npx prisma generate e npm run dev.
2. Configure DATABASE_URL, JWT_SECRET, mercado_pago_access_token, MP_BACK_URL e MP_WEBHOOK_SECRET em seu .env.
3. Configure um webhook público HTTPS apontando para /api/webhooks/mercadopago e habilite os eventos de assinatura e fatura autorizada no painel Mercado Pago.
4. A URL de retorno local pode ser http://localhost:3000/checkout/success se aceita pelo provedor. O webhook exige domínio ou túnel HTTPS publicamente acessível.
5. Use contas e credenciais de teste. Nunca compartilhe o .env ou execute pagamentos reais durante os testes.

## Cenários de aceitação

| Cenário | Resultado esperado |
| --- | --- |
| Checkout sem JWT | HTTP 401 |
| Selecionar um plano | Redirecionamento ao Mercado Pago, sem ativar plano |
| Assinatura ou fatura pendente | Plano inalterado |
| Assinatura autorizada com fatura paga | Tentativa confirmada e plano ativo |
| Webhook/retorno repetido | Não cria plano duplicado |
| Rota antiga assinar-plano | HTTP 410; sem ativação direta |
| Plano legado ativo | Mantém-se ativo até novo pagamento aprovado |
| Assinatura recorrente ativa | Bloqueia segundo checkout para evitar dupla cobrança |
| Checkout pendente | Dashboard permite consultar status |
| Consulta à tentativa de outro usuário | HTTP 404 |

## Restrições atuais

- O botão Alterar plano leva à seleção de planos. Para uma assinatura recorrente Mercado Pago já ativa, o backend não inicia nova assinatura: é necessário desenvolver a política de alteração/cancelamento da cobrança antiga, prorrateamento e conciliação.
- Não existe recuperação automática de checkouts abandonados nem processo completo de reembolso.
- A sincronização de renovações dos próximos meses, inadimplência e estornos ainda precisa de implementação.
- Testes de integração de ponta a ponta com a conta Mercado Pago do projeto são necessários antes da liberação para clientes reais.
- A validade do retorno não substitui a checagem do pagamento junto ao Mercado Pago.

## Endpoints

| Método | Endpoint | Acesso |
| --- | --- | --- |
| POST | /api/checkout | JWT de aluno |
| GET | /api/checkout/status/:tentativaId | JWT do titular |
| POST | /api/webhooks/mercadopago | Assinatura válida do provedor |
| GET | /checkout/success | Retorno público com verificação no provedor |
| POST | /api/usuario/assinar-plano | Desativado: HTTP 410 |

## Reconciliação de tentativas

Um operador autorizado, no ambiente correto e com acesso ao banco e à conta Mercado Pago correspondentes, pode listar as 100 tentativas pendentes ou aguardando mais antigas com `node scripts/reconciliar-checkout.js listar`. A lista contém identificadores, situação e datas; monitore-a regularmente, pois ela é limitada a 100 registros. Para consultar e reconciliar uma tentativa específica, execute `node scripts/reconciliar-checkout.js verificar <id-da-tentativa>`.

A verificação consulta o provedor e pode associar a assinatura e confirmar o plano somente após a verificação financeira existente. Ela não cria assinatura nem aceita aprovação informada pelo operador. `revisao_manual` com `assinatura_nao_encontrada`, `multiplas_assinaturas`, `dados_incompativeis`, `dados_locais_invalidos` ou `alteracao_concorrente` exige investigação no provedor e no histórico da tentativa; erros de rede ou de paginação também exigem nova análise. A tentativa não é liberada automaticamente. Não crie outra assinatura nem altere status para confirmado manualmente; encaminhe divergências à equipe responsável pela cobrança.

A busca usa o e-mail atual do aluno e pagina os resultados. Alterações de e-mail, dados omitidos pelo provedor, indexação atrasada ou resultados mutáveis podem impedir a reconciliação automática; ausência na busca não prova que nenhuma cobrança foi criada. Os detalhes e o formato de resposta do provedor devem ser validados em ambiente de testes antes do uso operacional.

### Diagnóstico e confirmação efetiva

O comando exige `DATABASE_URL` explicitamente no ambiente, apontando para MySQL em `localhost` ou `127.0.0.1`, sem parâmetros de URL; ele recusa endereços remotos antes de carregar o serviço. Esse bloqueio não distingue um banco de produção hospedado localmente nem um túnel ou proxy local para um servidor remoto: confirme o destino e use credenciais de menor privilégio. O comando não possui autenticação de aplicação; restrinja sua execução no sistema operacional a operadores autorizados.

- `listar` lê até 100 tentativas no banco; não grava e não consulta o Mercado Pago.
- `verificar <id> --dry-run` lê a tentativa e o aluno e consulta a API real do Mercado Pago, inclusive pagamentos quando a assinatura estiver autorizada. Não grava, não associa assinatura e não ativa plano. O resultado `diagnostico` é uma observação naquele instante, não uma confirmação persistida; o pagamento pode mudar antes de uma execução efetiva.
- `verificar <id>` lê o banco e consulta a API real do Mercado Pago. Se encontrar uma assinatura compatível, pode associá-la à tentativa e alterar seu status para aguardando. Se houver assinatura autorizada e pagamento aprovado, pode confirmar a tentativa, desativar planos anteriores e criar um plano em transação. Não cria assinaturas nem envia cobranças. Casos incertos continuam bloqueados para revisão.

Os dois modos de verificação usam o token configurado no ambiente e podem produzir tráfego de rede ao provedor. Não execute nenhum deles em uma conta real para testar. A confirmação existente pode usar um registro já confirmado sem repetir a consulta de pagamento; a garantia financeira depende também da integridade dos registros anteriores e das permissões de escrita no banco.

## Roteiro para teste completo de assinatura

**Não execute enquanto não estiverem confirmados o ambiente e as contas de teste.** O prefixo do token não prova seu ambiente: o painel atual pode apresentar `APP_USR` também para credenciais de teste. Confira na aplicação correta do Mercado Pago, sem compartilhar o token, e use apenas uma configuração explicitamente identificada pelo provedor para testes de Assinaturas. A documentação histórica para assinaturas menciona credenciais de produção de uma conta de vendedor *de teste*, enquanto a documentação atual apresenta credenciais de teste da aplicação; confirme com o painel e o suporte qual fluxo de teste se aplica à integração antes de prosseguir. Nunca use credenciais de uma conta vendedora real para experimentar.

1. Use ambiente local isolado, banco dedicado de testes e aluno de teste autenticado cujo e-mail corresponda ao comprador de teste do Mercado Pago. Use vendedor e comprador de teste distintos e do mesmo país. Não use o banco principal ou dados reais.
2. Configure a aplicação temporária de teste com `MP_BACK_URL` apontando para `/checkout/success` da instância de teste; para retorno e webhook externos, utilize domínio HTTPS de teste controlado que encaminhe à instância isolada. Confirme que não aponta para Render ou domínio de produção. Configure o segredo do webhook somente no ambiente de teste, sem registrá-lo em logs.
3. Confira que não há tentativa pendente nem assinatura recorrente ativa para o aluno de teste. Caso exista tentativa ambígua, investigue e reconcilie; não a libere automaticamente para criar outra cobrança.
4. Autentique como aluno de teste, selecione plano e unidade quando exigida e inicie o checkout. Verifique a tentativa `aguardando`, a referência externa e o identificador da assinatura; não registre tokens nem dados de cartão. Faça o pagamento apenas com os dados de teste indicados pelo Mercado Pago para esse fluxo.
5. Confira no provedor de teste assinatura autorizada e fatura aprovada, vinculada à assinatura e com valor e moeda esperados. Exercite o retorno `/checkout/success` e o webhook assinado em HTTPS. Confira nos registros locais que a tentativa ficou `confirmado` e foi criado um único plano ativo. Repita a notificação e o retorno para verificar idempotência; antes da aprovação, o plano não deve ativar.
6. Se ocorrer falha de rede ou resposta incompleta, consulte a tentativa e faça diagnóstico da reconciliação antes de qualquer nova tentativa. O erro de mistura de comprador e vendedor reais/de teste exige corrigir as contas de teste; não há conversão automática do aluno real.

## Proposta de histórico financeiro (não aplicada)

O schema atual registra tentativas e planos, mas não possui um registro individual de cada pagamento ou renovação. Para revisão futura, criar uma migration separada para `pagamentos_assinatura` com chave primária, chave estrangeira para usuário e assinatura/tentativa, identificador único do pagamento no provedor, identificador da assinatura, valor em centavos, moeda, status, data de aprovação e timestamps. Uma tabela de eventos com identificador único do evento e histórico de mudanças permitiria auditoria de reembolsos, estornos e notificações repetidas. A gravação deveria ser transacional, idempotente pelo ID do pagamento e alimentada por consulta autenticada ao provedor; definir retenção e tratar pagamento recorrente, reversões e divergências antes da implementação. Nenhuma migration foi criada ou aplicada nesta etapa.

A opção **Alterar plano** abre a seleção; o backend bloqueia intencionalmente outro checkout quando há assinatura recorrente ativa, até existir política de alteração ou cancelamento da cobrança anterior.

Exemplo de migration proposta para discussão, **não executar sem revisão do esquema e da política financeira**:

```sql
CREATE TABLE pagamentos_assinatura (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NOT NULL,
  tentativa_id VARCHAR(36) NOT NULL,
  mp_preapproval_id VARCHAR(100) NOT NULL,
  mp_payment_id VARCHAR(100) NOT NULL,
  valor_centavos BIGINT UNSIGNED NOT NULL,
  moeda CHAR(3) NOT NULL,
  status VARCHAR(32) NOT NULL,
  aprovado_em DATETIME(3) NULL,
  criado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY pagamentos_mp_payment_id_key (mp_payment_id),
  KEY pagamentos_tentativa_idx (tentativa_id),
  KEY pagamentos_assinatura_idx (mp_preapproval_id),
  CONSTRAINT pagamentos_usuario_fk FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT pagamentos_tentativa_fk FOREIGN KEY (tentativa_id) REFERENCES checkout_tentativas(id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

A proposta exige definir a política de exclusão, correspondência entre usuário e tentativa, identificação de fatura versus pagamento no provedor, eventos e migração de dados existentes antes de ser implementada.

## Migration de transações de pagamento

A migration versionada `20261124_transacoes_pagamento` substitui a proposta ilustrativa anterior; ainda não foi aplicada. Ela cria registro com ID único de pagamento, assinatura, tentativa, aluno, plano, valor em centavos, moeda, estado e data da fatura. Na confirmação inicial, a criação do plano e do registro financeiro ocorre na mesma transação; falha de unicidade ou gravação desfaz ambos. O ID usado é `payment.id` da fatura, distinto do ID da fatura. Pagamentos sem ID identificável, pendentes, recusados ou parcialmente reembolsados não ativam o plano.

Para aplicar futuramente **somente no banco local dedicado** `academia_kripton_checkout_test`, após configurar no ambiente uma `DATABASE_URL` MySQL com host `localhost` ou `127.0.0.1` e esse nome exato, execute `npm run test:integration:migrate`. A proteção do script exige conexão prévia ao banco existente e MySQL 8; revise o destino para excluir túneis locais antes da execução. Depois, `npm run test:integration` executa os testes do banco dedicado. Nenhum desses comandos foi executado nesta etapa.

A implementação atual registra a transação que ativa inicialmente o plano. A tentativa já confirmada retorna antes de consultar novas faturas: renovações, pagamentos posteriores, estornos e reembolsos ocorridos depois da confirmação **ainda não são sincronizados** nem alteram a validade do plano. Não se deve inferir pagamento de futuras mensalidades a partir do status da assinatura. Pagamentos históricos anteriores à migration não são preenchidos automaticamente; uma reconciliação posterior e uma política de acesso após estorno exigem implementação e validação próprias.

## Demonstração acadêmica isolada

O modo `demo` registra transações fictícias e ativa planos apenas com `NODE_ENV=development`, `PAYMENT_MODE=demo` e `DATABASE_URL` apontando exatamente para `127.0.0.1:3307/academia_kripton_checkout_test`, sem parâmetros. O banco e as contas são descartáveis; a verificação de endereço não detecta um túnel local para outro servidor. Não exponha o servidor de demonstração à internet e nunca aponte a porta 3307 para banco real. A integração Mercado Pago permanece desativada nesse modo.

Para uma instância Docker nova e dedicada (não execute se a porta ou o nome do contêiner já estiverem em uso):

```bash
docker run --name krypton-checkout-demo -d -p 127.0.0.1:3307:3306 -e MYSQL_ROOT_PASSWORD=senha-demo-descartavel -e MYSQL_DATABASE=academia_kripton_checkout_test -e MYSQL_USER=demo -e MYSQL_PASSWORD=senha-demo-descartavel mysql:8.0
```

Aguarde o MySQL ficar pronto com `docker logs krypton-checkout-demo`. No shell local, configure apenas variáveis temporárias, sem editar `.env`:

```bash
export DATABASE_URL='mysql://demo:senha-demo-descartavel@127.0.0.1:3307/academia_kripton_checkout_test'
export NODE_ENV=development PAYMENT_MODE=demo
export JWT_SECRET='jwt-demo-descartavel-nao-usar-em-producao'
export GOOGLE_CLIENT_ID='' GOOGLE_CLIENT_SECRET='' mercado_pago_access_token=''
npm run test:integration:migrate
npx prisma generate
npm start
```

O comando de migration acima modifica exclusivamente o banco apontado pela URL validada; confira que o contêiner dedicado é o destino antes de executá-lo. Acesse `http://localhost:3000/login.html`, cadastre um aluno fictício e escolha Pro ou Elite. Para Básico, é necessário cadastrar previamente uma unidade fictícia no banco isolado pelo procedimento administrativo apropriado; não é fornecida seed automática. A página de checkout identifica a simulação e permite aprovar, manter pendente ou recusar. O dashboard mostra as transações e o plano; uma tentativa recusada permite iniciar outra. Desligue o contêiner com `docker stop krypton-checkout-demo` quando terminar.

Para incluir uma unidade fictícia no banco do contêiner dedicado para testar o Básico, após as migrations, execute:

```bash
docker exec -i krypton-checkout-demo mysql -udemo -psenha-demo-descartavel academia_kripton_checkout_test -e "INSERT INTO unidades (nome, endereco, cidade) VALUES ('Unidade Demonstração', 'Rua Fictícia, 1', 'Cidade Teste');"
```

## Preparação de demonstração hospedada no Render

A demonstração hospedada requer um serviço Render separado e o MySQL 8 exclusivo do add-on acadêmico `krypton-demo-faculdade` (`mysql_6fb6e7f4-a51c-4e30-8623-3d4698453556`). A validação exige o host, a porta e o schema aprovados em `src/config/demo-hosts.js`. Confira o recurso no painel do Clever Cloud e use uma conta restrita ao schema demonstrativo.

`sslaccept=strict` continua sendo a configuração padrão da demonstração hospedada. Quando houver uma CA específica e compatível com o hostname, informe opcionalmente `sslcert` com o caminho de um arquivo legível. O Prisma resolve caminhos relativos a partir de `prisma/`.

O certificado atual do add-on é autoassinado e não cobre o hostname. Para usar temporariamente TLS sem validação de identidade, configure **somente no Render demonstrativo**:

```dotenv
NODE_ENV=production
PAYMENT_MODE=demo
DEMO_DEPLOYMENT=academico_isolado
DEMO_DATABASE_HOST=booqcxfmlvclpjzw2uce-mysql.services.clever-cloud.com
DEMO_DATABASE_NAME=booqcxfmlvclpjzw2uce
DEMO_ALLOW_UNVERIFIED_TLS=I_UNDERSTAND_TEST_ONLY
DATABASE_URL=mysql://USUARIO:SENHA@booqcxfmlvclpjzw2uce-mysql.services.clever-cloud.com:3306/booqcxfmlvclpjzw2uce?sslaccept=accept_invalid_certs
```

Use as credenciais do add-on demo, com caracteres reservados do usuário e da senha codificados para URL. Guarde a URL como segredo. Configure um `JWT_SECRET` próprio do serviço e deixe as credenciais reais de Mercado Pago e Google fora desse ambiente. Quando o banco oferecer um certificado confiável e compatível com o hostname, volte para `sslaccept=strict` e remova `DEMO_ALLOW_UNVERIFIED_TLS`.

1. Aponte o segundo Web Service no Render para a branch de integração e mantenha deploy automático desativado durante a validação. Use `npm ci --include=dev && npx prisma generate` no build e `npm start` para iniciar o app.
2. No shell do serviço demo, com o código publicado e as variáveis acima, execute `node scripts/migrate-demo-hospedado.js --verificar`. Esse modo faz consultas de leitura na mesma sessão para conferir schema, versão MySQL 8 e `Ssl_cipher`, e encerra antes do Prisma Migrate. Aguarde a confirmação de êxito e código de saída 0. A cifra confirma criptografia na sessão. Com a exceção ativa, a identidade do servidor fica sem validação.
3. Após a verificação bem-sucedida, revise o SQL e faça backup conforme a política do banco. A aplicação das migrations é uma etapa manual separada, com uma conta restrita ao banco demo. O comando `node scripts/migrate-demo-hospedado.js` repete a verificação antes de executar o Prisma Migrate. Mantenha esse comando fora do build, start e pre-deploy.
4. No domínio HTTPS do serviço demo, use login tradicional e contas fictícias. Confira o bloqueio sem login, aprovação, pendência, recusa, repetição, troca de plano, isolamento entre alunos e os rótulos SIMULADA. Para Básico, use uma unidade fictícia cadastrada no banco demonstrativo. Reinicie o serviço e confira novamente histórico e plano.

O app usa cookies `secure` em produção e confia no primeiro proxy para sessões HTTPS no Render. Autenticação, cadastro e checkout devem ser validados no segundo serviço com dados fictícios. A persistência depende da disponibilidade e retenção do MySQL dedicado, e não do disco efêmero do Render.

A verificação de saúde do serviço Render deve usar `/api/health`; o endpoint informa que o processo responde, mas não prova que o banco ou o checkout funcionam. O login tradicional usa JWT com cookie seguro em HTTPS e token no navegador; o token continua válido após reinício enquanto a chave e a validade permanecerem as mesmas. O login Google emite o mesmo JWT revogável do login tradicional. A aplicação confere a versão da sessão no banco a cada requisição autenticada. Para apresentação, use login tradicional e contas fictícias.

## Checkout Krypton por QR Code

Emita o código no checkout do aluno autenticado. Um novo código revoga o anterior. A tentativa guarda somente SHA-256 do token e a expiração de cinco minutos. Escanear o código autoriza somente a aprovação dessa tentativa fictícia. O celular pode ser usado sem sessão. Trate o link como uma autorização delegada pelo aluno e compartilhe-o apenas com a pessoa que deve executar a simulação.

A página do celular recebe o token no fragmento da URL, remove o fragmento da barra de endereços e envia o token em um POST JSON da mesma origem, sem credenciais de sessão. GET, HEAD, imagens e a geração do PNG não aprovam. O GET descarta prévias identificadas pelos cabeçalhos de prefetch e o script espera visibilidade e saída do modo de pré-renderização. Um navegador automatizado capaz de executar JavaScript em uma aba visível e obter o fragmento pode agir como quem escaneou o código. Essas medidas reduzem aprovações por prévias passivas. A política `no-referrer` protege a navegação ao YouTube, cujo URL é fixo.

Para homologar no Render demo, use a nova branch, mantenha o modo acadêmico isolado, gere o cliente Prisma e execute primeiro a verificação somente de leitura já descrita. Após revisão, aplique a migration aditiva do QR manualmente apenas no banco demo. Na URL HTTPS do serviço, entre com aluno de teste, inicie um plano, escaneie com celular sem sessão, confira a aprovação e o redirecionamento e confirme no desktop a atualização do plano e do histórico. Repita com código expirado, renovado e reutilizado e com as ferramentas de apresentação.

## Estrutura prevista dos dashboards

| Perfil | Áreas do painel |
| --- | --- |
| Aluno | Plano ativo, histórico, treinos e agendamentos próprios |
| Administrador | Gestão de usuários, unidades, planos, permissões e auditoria |
| Recepcionista | Atendimento, check-in e agenda da unidade |
| Personal trainer | Treinos, agenda e acompanhamento de alunos atribuídos |
| Nutricionista | Consultas e acompanhamento dos alunos atribuídos |

Compartilhe cabeçalho, navegação, cartões e indicadores de estado entre os painéis. Os dados e as ações de cada perfil devem ser autorizados no backend, com escopo de aluno ou unidade conforme a função. Recepção, personal e nutrição ficam para as próximas sprints.
