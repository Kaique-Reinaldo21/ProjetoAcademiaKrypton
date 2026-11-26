# Segurança e gerenciamento de contas

## Rotas

| Método e rota | Acesso e operação |
| --- | --- |
| POST `/api/auth/recuperacao` | Público. Aceita `email`, limita solicitações e usa resposta genérica |
| POST `/api/auth/redefinir` | Público com token válido. Aceita `token`, `novaSenha` e `confirmacao` |
| POST `/api/auth/senha` | Conta autenticada. Aceita `senhaAtual`, `novaSenha` e `confirmacao` |
| POST `/api/auth/admin/recuperacao` | Administrador autenticado. Aceita `email` do alvo e `senhaAdmin` para confirmar a operação |
| GET `/api/auth/me` | Sessão autenticada. Inclui `possuiSenhaLocal` para a página de configurações |

Os POSTs aceitam JSON de mesma origem. O aluno e o administrador acessam a mesma página `/configuracoes-conta.html`. Os painéis futuros de recepção, personal e nutrição poderão apontar para essa página. Contas que usam apenas Google continuam recuperando o acesso pelo Google. A operação sensível de administrador exige uma senha local. Perfis e privilégios são lidos do banco em cada requisição autenticada.

A migration `20261126_seguranca_contas` adiciona versão de sessão e marcação de redefinição obrigatória em `usuarios`, uma recuperação por conta em `recuperacoes_senha`, contadores em `limites_conta` e trilha de eventos em `auditoria_contas`. A sessão Google usa o mesmo JWT revogável do login tradicional. As sessões antigas sem versão são compatíveis com contas na versão zero. Uma alteração ou redefinição incrementa a versão e invalida os JWTs anteriores. A recuperação administrativa revoga sessões imediatamente e suspende novos logins no alvo até a redefinição. A auditoria registra ação, IDs e data, sem senhas ou tokens.

Cada token tem 256 bits aleatórios e validade de 15 minutos. O banco recebe somente SHA-256 do token. Emitir um novo substitui o anterior. Consumo e gravação da nova senha ocorrem na mesma transação. O link usa fragmento de URL e a página o retira do endereço antes de enviar via POST. Os limites são persistidos com identificadores HMAC. A solicitação pública aceita até 12 requisições por IP em 15 minutos e emite até 3 links por conta em uma hora. A redefinição aceita até 20 tentativas por IP em 15 minutos. Alteração e recuperação administrativa aceitam até 8 tentativas por conta autenticada em 15 minutos.

## Homologação acadêmica no Render

1. Use um serviço separado, com contas fictícias e banco de homologação. Aponte o serviço para a branch em revisão. Use Node.js 20 ou superior e gere o cliente Prisma no build. Confira o banco e aplique a migration manualmente somente após a revisão.
2. Configure os segredos do serviço. `JWT_SECRET` deve ser exclusivo do ambiente e já é usado pela autenticação. Defina `CONTA_ORIGEM_PUBLICA` com a origem HTTPS do próprio serviço. O link sempre usa esse valor.
3. Configure `CONTA_SMTP_HOST`, `CONTA_SMTP_PORTA`, `CONTA_SMTP_USUARIO`, `CONTA_SMTP_SENHA` e `CONTA_EMAIL_REMETENTE` com os dados da caixa de testes. O transporte exige TLS com validação de certificado. Uma opção de homologação é Mailtrap Email Sandbox, com `sandbox.smtp.mailtrap.io` na porta 2525. O Render gratuito bloqueia as portas 25, 465 e 587. [Mailtrap Email Sandbox](https://docs.mailtrap.io/email-sandbox/setup) · [Limites de SMTP do Render](https://render.com/articles/can-i-send-email-over-smtp-from-render)
4. Solicite recuperação de uma conta fictícia e de um endereço inexistente. Compare as respostas da página e confirme que só a conta existente recebe e-mail no sandbox. Abra o link, redefina a senha e verifique o bloqueio de reutilização e a invalidação em uma segunda sessão. Repita pelo painel de administrador, com outra conta fictícia, e confirme os eventos na auditoria.
5. Teste a alteração de senha e a recuperação administrativa com senha incorreta e com uma conta de aluno. Confira o login tradicional, o cadastro, o Google quando configurado e os links de configurações dos perfis atuais.

O envio público roda em segundo plano após a resposta. Se o processo reiniciar antes da entrega ou se o transporte falhar, o usuário pode solicitar outro link respeitando os limites. Se a recuperação administrativa registrar a suspensão e o e-mail falhar, o usuário pode solicitar outro link pela página pública. O log de falha do transporte omite o endereço e o token. Use o painel do sandbox para verificar a entrega.

## Primeiro administrador da apresentação

Use um terminal de acesso administrativo e confirme que `DATABASE_URL` foi explicitamente carregada para o banco isolado da apresentação com a migration aplicada. Use uma conta de banco com as permissões necessárias para criar o usuário e registrar a auditoria. O seed comum cria apenas unidades locais e é bloqueado em produção.

Em Bash, informe `ADMIN_INICIAL_NOME`, `ADMIN_INICIAL_EMAIL` e `ADMIN_INICIAL_NASCIMENTO` (AAAA-MM-DD) por variáveis de ambiente. Use um endereço fictício acessível pelo sandbox. Gere uma senha de demonstração exclusiva em um gerenciador de senhas e forneça-a pela entrada protegida do terminal.

```bash
read -rs -p 'Senha inicial do administrador: ' krypton_senha_inicial
printf '\n'
printf '%s' "$krypton_senha_inicial" | ADMIN_INICIAL_CONFIRMACAO=CRIAR_PRIMEIRO_ADMIN npm run conta:admin-inicial
unset krypton_senha_inicial
```

O comando cria somente o primeiro administrador e recusa um banco que já contém administrador ou conta com o mesmo e-mail. Para administrador existente, use alteração autenticada ou recuperação pela caixa de testes. Cadastre alunos de apresentação pela interface, com credenciais fictícias e distintas. Senhas novas de alunos exigem 6 caracteres no cadastro, na alteração e na recuperação. Os demais perfis continuam com mínimo de 12 caracteres. Prefira uma frase longa e exclusiva, especialmente na administração. Todas as senhas novas aceitam até 72 bytes UTF-8, o limite do bcrypt. As senhas existentes continuam aceitas pela validação de login. As credenciais fixas retiradas dos seeds podem ter sido usadas anteriormente em ambientes existentes. Revise essas contas pelo procedimento autorizado de recuperação.

## Diagnóstico de sessão

A resposta «Serviço de autenticação indisponível» (HTTP 503) indica falha na consulta da conta usada para validar uma sessão. Confira no log do serviço o evento `Falha na consulta de sessão`, que registra apenas a classe, o código e a categoria da falha. `P2021` ou `P2022` indicam tabela ou coluna ausente. Confira o destino e o histórico de migrations, incluindo `20261126_seguranca_contas`. `P1001` aponta para conexão indisponível, `P1011` para TLS e `P2024` para esgotamento do pool. A resposta pública permanece genérica.
