# Mercado Pago em homologação local

O fluxo externo usa Assinaturas do Mercado Pago, com `POST /preapproval` em estado pendente e redirecionamento ao `init_point` retornado. O retorno do navegador não confirma pagamento. O backend consulta assinatura autorizada, referência da tentativa, proprietário, fatura, valor e moeda. Em teste, comprova também `live_mode=false` pelo recurso do pagamento. Registros aprovados nessa sessão recebem a origem `mercadopago_teste`. O simulador mantém origens próprias e seus controles não modificam tentativas externas. [Criar assinatura](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/create-preapproval/post) · [Credenciais para assinaturas](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/your-integrations/credentials)

## Configuração local

- `NODE_ENV=development` e `PAYMENT_MODE=mp_test`.
- `DATABASE_URL` aponta para `127.0.0.1:3307/academia_kripton_checkout_test` no MySQL descartável, sem parâmetros.
- `MP_BACK_URL` aponta para `/checkout/success` da instância local. Se o provedor exigir HTTPS, use exclusivamente um retorno de homologação aprovado, sem apontar para os serviços acadêmicos.
- `MP_TEST_ACCESS_TOKEN` vem da aplicação correta de Assinaturas em **Teste** no painel do Mercado Pago. A Vitória deve confirmar o ambiente e a conta relacionados ao token em canal seguro antes de instalar o segredo.
- `MP_TEST_PAGADOR_EMAIL` contém o e-mail exato do comprador de teste autorizado e deve corresponder ao aluno fictício local.
- Defina `MP_TEST_CREDENCIAL_CONFIRMADA=ASSINATURAS_TESTE` somente depois da verificação no painel. Prefixo e formato do token, isoladamente, não comprovam a origem.
- Deixe ausentes `mercado_pago_access_token`, `RENDER`, `RENDER_EXTERNAL_HOSTNAME` e `DEMO_DEPLOYMENT` na sessão local.

Os serviços acadêmicos permanecem em `PAYMENT_MODE=demo`. O modo externo de teste rejeita banco remoto e execução no Render. Quando a configuração de teste está completa, o checkout mostra Mercado Pago API de teste como opção principal e PIX Krypton abaixo. Em modo demo, o Mercado Pago mostrado na interface é o simulador local.

## Validação externa pendente

Com autorização da Vitória, confirme o token da aplicação, um comprador de teste compatível e um meio de pagamento de teste fornecido pelo Mercado Pago. Inicie uma assinatura no banco descartável, confira o redirecionamento e acompanhe a confirmação pelo painel do aluno. Pode haver atraso entre autorização da assinatura e aprovação da primeira fatura. Mantenha tentativas ambíguas reservadas para reconciliação, sem iniciar uma segunda cobrança. A validação da API externa e da compatibilidade da conta do comprador exige essa sessão autorizada. Os testes automatizados usam apenas mocks.
