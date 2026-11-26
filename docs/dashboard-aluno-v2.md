# Dashboard do Aluno V2

O painel mantém uma única estrutura de navegação e troca o conteúdo pelo fragmento da URL. Voltar e avançar no navegador mantém o menu e o cabeçalho. O menu responsivo tem controle de foco e fechamento por Escape. O painel administrativo e as páginas públicas anteriores permanecem em seus próprios arquivos.

## Design System

Use a classe `.kd` na raiz do painel para herdar a paleta original, Oswald, Nunito Sans e estilos isolados. Bootstrap e Bootstrap Icons continuam disponíveis.

| Componente | Recursos |
| --- | --- |
| Estrutura, menu e cabeçalho | `.kd-shell`, `.kd-sidebar`, `.kd-nav`, `.kd-header` e `configurarMenu()` |
| Cartão e botão | `.kd-card`, `.kd-card-link`, `.kd-button`, `.kd-button-primario` |
| Formulários e modais | `.kd-form`, `.kd-input`, `.kd-dialog` em um `dialog` nativo |
| Tabela | `.kd-tabela-scroll` e `.kd-tabela` |
| Situação e feedback | `badge()`, `estado()`, `erro()` |
| Gráfico | `graficoBarras(serie, titulo)`, com rótulos e valores acessíveis. Série vazia produz um estado sem medições |

O CSS específico do aluno fica em `dashboard-aluno.css`. A edição de perfil, as consultas e as visualizações estão separadas em módulos JavaScript em `public/js/dashboard/`.

## Recursos operacionais

- Início com nome e avatar, plano, próximo agendamento, atalhos e pendências obtidas do extrato.
- Faturas com dados do plano, benefícios, unidades aplicáveis, troca de plano no checkout existente, verificação de tentativa e extrato por método e status.
- Agendamentos com consulta por aluno e criação para Elite ativo. Plano vencido é recusado também no backend.
- Configurações com edição do nome, foto persistente e acesso às telas existentes de senha e vínculo Google. E-mail e nascimento ficam somente para leitura. O encerramento usa a rota existente.

Treinos, treinos extras, avaliações, progresso, nutrição e arquivos têm seções independentes. Frequência e gráficos dependem de dados de presença e medições que ainda não existem. Os atalhos para agendamentos de personal e nutrição dependem do Elite ativo.

## API e persistência

Reutiliza `/api/auth/me`, `/api/auth/logout`, `/api/usuario/perfil`, `/api/usuario/plano`, `/api/usuario/unidades`, `/api/usuario/agendamentos`, `/api/usuario/agendamento`, `/api/checkout/status/:tentativaId` e `/api/checkout/demo/historico`.

- `PUT /api/usuario/perfil` altera somente o nome do aluno autenticado.
- `GET /api/usuario/perfil` informa se existe foto, sem enviar seus bytes.
- `GET /api/usuario/perfil/foto` retorna a própria foto com `private, no-store`.
- `PUT /api/usuario/perfil/foto` recebe PNG. O navegador aceita PNG ou JPEG e reduz para até 320 × 320. O servidor limita a 512 KiB, confere dimensões, decodifica e recodifica em PNG antes de gravar. A foto fica no MySQL e é servida com tipo fixo.
- `DELETE /api/usuario/perfil/foto` remove a foto da própria conta. As mutações exigem sessão de aluno e origem do próprio site.

A migration aditiva `20261130_foto_perfil` cria a tabela `fotos_perfil` com chave por usuário. A exclusão da conta remove sua foto por relacionamento. O armazenamento não usa o disco do Render. Aplique a migration somente no destino autorizado durante a publicação do painel.
