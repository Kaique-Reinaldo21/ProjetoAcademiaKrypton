# Dashboard Administrativo V2

O painel usa o Krypton Design System e mantém menu e cabeçalho entre navegações. A seção é acessível pelo fragmento da URL e pelo histórico do navegador. Os gráficos usam Chart.js com uma versão textual acessível para consulta dos dados e para quando o CDN estiver indisponível.

## Indicadores

- **Total de alunos** conta contas com perfil de aluno. **Alunos ativos** conta alunos distintos com pelo menos um plano ativo cuja data de vencimento é hoje ou posterior, ou cujo plano não tem vencimento.
- **Novos cadastros** cobre sete datas, incluindo hoje. **Pagamentos pendentes** conta registros do extrato em estado pendente. **Planos a vencer** inclui hoje e os sete dias seguintes. **Agendamentos** cobre os próximos sete dias.
- **Valores transacionados** soma o histórico integral de transações aprovadas por origem e moeda. Simulados agrupam QR Code Krypton e Mercado Pago simulado. Financeiros incluem a origem financeira do Mercado Pago. Origens desconhecidas ficam fora dos dois totais e são rotuladas no extrato.
- **Distribuição dos planos** conta planos ativos. Um aluno com mais de um plano ativo é contado uma única vez no indicador de alunos ativos.
- **Atividades administrativas** exibe as recuperações de conta já registradas na auditoria, sem carregar segredos ou informações de autenticação.

## APIs

Todas as rotas administrativas exigem sessão válida e papel de administrador verificado no banco. As respostas autenticadas usam `Cache-Control: no-store`.

- Novas leituras em `/api/admin`: `GET /indicadores`, `GET /auditoria` e `GET /unidades`.
- Reutilizadas: `GET /resumo`, `GET /alunos`, `GET /logins`, `GET /vencimentos`, `GET /pagamentos`, `GET /agendamentos-proximos` e `GET /cadastros-semana`. Alunos aceita `busca` e `pagina`; logs e agenda retornam somente os campos de operação do painel.
- Sessão, alteração de senha e recuperação administrativa usam os fluxos existentes de `/api/auth`.

O extrato apresenta as 100 transações mais recentes, a agenda apresenta até seis sessões futuras e a auditoria lista as 30 recuperações mais recentes. Funcionários fica disponível como seção informativa até que exista backend de gestão de equipe. O painel administrativo não adiciona migration.

## Pool Prisma no Render demonstrativo

No serviço demonstrativo autorizado, configure `DEMO_PRISMA_POOL=serial`. Mantenha a `DATABASE_URL` original e a política TLS já aprovada. O Prisma acrescenta `connection_limit=1` e `pool_timeout=30` somente ao datasource interno, depois de validar destino, porta, schema e TLS. Não acrescente esses parâmetros à `DATABASE_URL`. A configuração é optativa e não se aplica aos outros ambientes.

`/api/admin/resumo` e `/api/admin/indicadores` executam suas consultas uma por vez por processo. Uma resposta parcial retorna HTTP 200 com `null` nos campos indisponíveis. Se nenhuma consulta do endpoint passar, a resposta é HTTP 503. O painel mantém os dados disponíveis e distingue zero de indisponibilidade.

Os logs incluem a operação, a classe do erro, o código Prisma ou de rede e um código MySQL conhecido quando disponível nos campos estruturados. `P2024` indica tempo de espera esgotado no pool. Um erro Prisma desconhecido sem código estruturado não identifica a causa no MySQL.
