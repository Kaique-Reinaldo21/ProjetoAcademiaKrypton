# Checkout e confirmação de pagamento — testes de desenvolvimento

> Integração em avaliação. **Não utilizar dinheiro real nem implantar em produção sem testes de ponta a ponta.**

## Objetivo

O botão de contratação utiliza a rota POST /api/checkout com autenticação JWT e não ativa planos. A API identifica o aluno pelo token, registra uma tentativa no MySQL e devolve o link do Mercado Pago. A confirmação exige assinatura com status authorized e uma fatura vinculada com payment.status = approved e valor/moeda esperados, consultados no provedor.

A confirmação pode ocorrer no retorno do navegador (GET /checkout/success) ou pelo webhook assinado (POST /api/webhooks/mercadopago). Nenhum deles confia em uma indicação de aprovação enviada pelo navegador.

## Preparação

1. Execute npm ci, npx prisma migrate deploy, npx prisma generate e npm run dev.
2. Configure DATABASE_URL, JWT_SECRET, SESSION_SECRET, mercado_pago_access_token, MP_BACK_URL e MP_WEBHOOK_SECRET em seu .env.
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
