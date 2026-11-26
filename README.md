<div align="center">
  <img src="public/logo.png" alt="Logotipo da Academia Krypton" width="140">
</div>

# Academia Krypton

## Apresentação

A Academia Krypton é um projeto acadêmico de desenvolvimento de sistemas voltado à gestão de academias. A aplicação reúne uma interface web e uma API para operações como cadastro de usuários, consulta de planos e unidades, agendamentos e acompanhamento administrativo. O sistema utiliza Node.js, Express, MySQL e Prisma ORM.

## Objetivo do projeto

O objetivo é centralizar e simplificar os processos de cadastro, matrícula e atendimento, reduzindo a dependência de procedimentos presenciais e facilitando o acesso dos alunos às informações da academia. A evolução planejada inclui ferramentas de gestão para recepcionistas, personal trainers e nutricionistas, além de recursos de controle de acesso. Essas funcionalidades futuras não devem ser confundidas com as já implementadas.

**Versão acadêmica v1.0.0 em preparação.** O fluxo de apresentação opera em modo simulado e usa dados fictícios. A publicação no Render oficial depende do [checklist de release](docs/publicacao-academica-v1.0.0.md).

- [Aplicação de homologação (Render)](https://projetoacademiakrypton.onrender.com/)
- [Referência da API (Swagger UI)](https://projetoacademiakrypton.onrender.com/api-docs.html)
- [Documentação complementar (GitBook)](https://academia-krypton.gitbook.io/academia-krypton-docs/)

## Funcionalidades implementadas

- Cadastro, login, autenticação JWT revogável e Google OAuth quando configurado. O vínculo Google de conta tradicional exige senha atual e e-mail confirmado.
- Alteração de senha, recuperação por link temporário via SMTP e recuperação administrativa auditada. Senhas novas exigem 6 caracteres para alunos e 12 para os demais perfis, com limite de 72 bytes UTF-8.
- Planos, unidades, agendamentos básicos e histórico de pagamentos por método no painel do aluno. O painel administrativo mantém seus indicadores, consulta de alunos e histórico de acesso.
- Checkout acadêmico com QR Code Krypton, confirmação em outra sessão e redirecionamento demonstrativo ao Rickroll.
- Mercado Pago simulado por adaptador local, com aprovação, pendência e recusa. O adaptador usa o serviço de assinaturas existente. O gateway original, o webhook e a reconciliação foram preservados.

## Limitações conhecidas

- A API oficial de Assinaturas do Mercado Pago permanece pendente de homologação para esta versão. O checkout acadêmico usa somente QR e respostas locais simuladas.
- Google OAuth e SMTP dependem da configuração do ambiente. Os testes locais usam Google simulado e SMTP de teste. O checklist exige verificar as integrações no destino antes da publicação.
- Contas exclusivamente Google criadas pelo fluxo antigo, sem identificador do provedor, precisam de triagem antes de recuperar acesso. Os registros e históricos são mantidos.
- A exceção TLS do MySQL está limitada ao banco demonstrativo aprovado e a dados fictícios. A publicação oficial exige validação da identidade do servidor MySQL.
- Os painéis completos de recepção, personal trainer e nutrição, a agenda por profissional, catracas e filas de arquivos continuam planejados.

## Tecnologias

| Camada | Implementação |
| --- | --- |
| Servidor/API | Node.js, Express 4, JavaScript (ES Modules) |
| Interface | HTML, CSS, JavaScript, Bootstrap |
| Banco e ORM | MySQL 8, Prisma 5.22 |
| Autenticação | JWT, bcryptjs, Passport, Google OAuth 2.0 |
| Integrações | QR Code local, Mercado Pago com adaptador simulado, SMTP via Nodemailer, Google Maps |
| Hospedagem de homologação | Render (aplicação) e Clever Cloud (MySQL) |

## Pré-requisitos

- Node.js 24 LTS ou versão LTS compatível, com npm.
- Git.
- Acesso a MySQL 8 (local ou remoto) com banco e usuário configurados.
- Acesso à internet para instalar dependências.

Instale [Node.js](https://nodejs.org/en/download), [Git](https://git-scm.com/downloads) e, se for utilizar banco local, [MySQL Community Server](https://dev.mysql.com/downloads/mysql/). O MySQL Workbench é opcional; ele não substitui o servidor MySQL.

## Instalação no Windows

Execute no **PowerShell**, em uma pasta de sua escolha:

```powershell
git clone https://github.com/Kaique-Reinaldo21/ProjetoAcademiaKrypton.git
cd ProjetoAcademiaKrypton
npm.cmd ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Configure o arquivo `.env` conforme a seção [Variáveis de ambiente](#variáveis-de-ambiente). Para utilizar banco local, crie primeiro o banco e o usuário conforme [MySQL local](#mysql-local).

```powershell
npm.cmd run check:env
npm.cmd run setup:local
npm.cmd run dev
```

O comando `setup:local` **só deve ser usado com MySQL local**: gera o Prisma Client, aplica as migrations existentes e insere unidades fictícias de demonstração quando ainda não existirem. Não cria o servidor, o banco ou o usuário MySQL.

## Instalação no Linux (Ubuntu, Zorin OS e derivados)

Instale Git e MySQL conforme sua distribuição. Em Ubuntu/Zorin com os pacotes correspondentes disponíveis:

```bash
sudo apt update
sudo apt install git mysql-server
sudo systemctl enable --now mysql
```

Instale Node.js LTS pelas instruções oficiais do [Node.js](https://nodejs.org/en/download) ou do [nvm](https://github.com/nvm-sh/nvm), conforme a sua distribuição. Verifique: `node --version`, `npm --version` e `git --version`.

No terminal:

```bash
git clone https://github.com/Kaique-Reinaldo21/ProjetoAcademiaKrypton.git
cd ProjetoAcademiaKrypton
npm ci
test -f .env || cp .env.example .env
```

Configure `.env` e o banco local. Em seguida:

```bash
npm run check:env
npm run setup:local
npm run dev
```

Em ambos os sistemas, abra `http://localhost:3000`. O servidor usa a porta `3000` por padrão; ajuste `PORT` no `.env` se necessário.

## MySQL local

Crie o banco e um usuário de desenvolvimento com privilégios apenas sobre esse banco. Execute no MySQL **local** usando uma conta administrativa (Workbench, DBeaver ou cliente `mysql`):

```sql
CREATE DATABASE IF NOT EXISTS academia_kripton
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'krypton_dev'@'127.0.0.1'
  IDENTIFIED BY 'SUBSTITUA_POR_SENHA_FORTE';

GRANT ALL PRIVILEGES ON academia_kripton.*
  TO 'krypton_dev'@'127.0.0.1';
```

Este exemplo é exclusivo para desenvolvimento local. Se o usuário já existir, `CREATE USER IF NOT EXISTS` não altera sua senha; use as credenciais existentes ou configure uma nova senha administrativamente. A configuração de host do usuário MySQL deve corresponder à forma de conexão escolhida.

## Variáveis de ambiente

O arquivo `.env.example` é o modelo. O `.env` contém segredos locais e está excluído do Git pelo `.gitignore`.

Configuração mínima, com valores de exemplo:

```dotenv
PORT=3000
NODE_ENV=development
DATABASE_URL="mysql://krypton_dev:SENHA_CODIFICADA@127.0.0.1:3306/academia_kripton"
JWT_SECRET=SUBSTITUA_POR_SEGREDO_ALEATORIO_FORTE
JWT_EXPIRES_IN=7d
```

- `DATABASE_URL` é a conexão efetivamente utilizada pelo Prisma. As variáveis `DB_HOST`, `DB_USER` etc. existentes no exemplo não substituem essa URL.
- A senha embutida na URL deve usar codificação percentual quando contiver caracteres reservados (por exemplo, `@`, `#`, `%` e `/`).
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_CALLBACK_URL` são necessários para o login Google.
- Configure `PAYMENT_MODE=demo` e o destino autorizado conforme o [guia de checkout](docs/checkout-e-confirmacao.md) para usar os dois métodos acadêmicos. Mantenha as credenciais do gateway externo ausentes nesse ambiente.
- Para recuperação por e-mail, configure a origem pública e o SMTP conforme o [guia de segurança de contas](docs/seguranca-contas.md).
- Utilize segredos e credenciais diferentes para desenvolvimento e hospedagem. Não copie credenciais reais para o repositório, issues ou documentação.

Para usar o MySQL **remoto** do Clever Cloud na aplicação local, configure `DATABASE_URL` com as credenciais daquele serviço e execute `npx prisma generate` (Windows: `npx.cmd prisma generate`), `npm run check:db` e `npm run dev` (no Windows use `npm.cmd`). **Não execute `setup:local`, `demo:unidades:local` ou o seed geral contra o banco remoto.**

## Comandos de desenvolvimento

| Comando npm | Finalidade |
| --- | --- |
| `dev` | Executa o servidor com Nodemon. |
| `start` | Inicia o servidor Node.js sem Nodemon. |
| `check:env` | Verifica variáveis obrigatórias sem exibir segredos. |
| `check:db` | Testa a conexão e consulta contagens de registros, sem escrita. |
| `setup:local` | Aplica migrations e adiciona unidades fictícias somente no MySQL local. |
| `demo:unidades:local` | Adiciona apenas unidades fictícias ausentes no MySQL local. |
| `prisma:status` | Consulta o estado das migrations. |
| `check:syntax` | Verifica a sintaxe dos scripts selecionados. |
| `test` | Executa os testes automatizados existentes. |

No Windows/PowerShell, utilize `npm.cmd run <comando>`; no Linux, `npm run <comando>`. Para `start`, `dev` e `test`, também é possível executar `npm.cmd start`/`npm start`, conforme o sistema.

Os scripts de setup local recusam `NODE_ENV=production` ou um host remoto na `DATABASE_URL`. Eles não detectam um túnel que redirecione `localhost` para um banco remoto: não utilize esses scripts com encaminhamento de porta.

O seed geral (`npm run seed`) cria ou atualiza unidades para uso local. A primeira conta administrativa segue o procedimento protegido de [segurança de contas](docs/seguranca-contas.md).

## Atualização de um clone existente

Antes de atualizar, confirme que não há alterações locais que precisam ser preservadas:

```bash
git status
git pull --ff-only origin main
```

Reinstale dependências a partir do lockfile se houve alterações: `npm ci` (Windows: `npm.cmd ci`). Preserve o seu `.env` existente; não copie novamente `.env.example` sobre ele.

Se houver migrations pendentes, revise-as antes da aplicação. Para um banco local de desenvolvimento, `setup:local` pode ser executado novamente. Não execute alterações de schema automaticamente sobre um banco remoto sem backup e revisão.

## Endpoints de verificação

| Endereço local | Resultado |
| --- | --- |
| `/api/health` | Confirma que o servidor Express está respondendo; não testa o MySQL. |
| `/api/unidades` | Lista unidades cadastradas no banco configurado. |
| `/api-docs.html` | Interface de referência OpenAPI/Swagger UI. |
| `/openapi.json` | Especificação OpenAPI em JSON. |

Se `/api/unidades` retornar `{"unidades":[]}`, não há unidades no banco consultado. Use `check:db` para conferir a conexão e as contagens. Se o Prisma não conseguir autenticar, valide host, porta, banco, usuário, senha e compatibilidade do método de autenticação do MySQL.

## Homologação e dados

O site de demonstração utiliza **Render** para a aplicação e **Clever Cloud** para MySQL. O banco local e o remoto são independentes. `prisma migrate deploy` aplica alterações de estrutura, mas **não transfere usuários, administradores, planos nem outros registros**.

A migração de dados requer backup de origem e destino, conferência de schema e conciliação de chaves e e-mails antes de importar. Não execute `prisma migrate reset`, `prisma db push` ou dumps SQL destrutivos como tentativa de corrigir problemas de conexão. Hashes de senha, IDs e relações entre tabelas precisam ser preservados numa migração autorizada.

Para a release acadêmica, use no Render:

```text
Build: npm ci --include=dev && npx prisma generate
Start: npm start
Health check: /api/health
```

O [checklist do Render oficial](docs/publicacao-academica-v1.0.0.md) cobre a verificação do destino, as nove migrations, backup, aprovação manual, smoke test e rollback. Migrations ficam fora do build, do start e do pre-deploy.

## Estrutura do repositório

```text
public/                 Páginas e arquivos públicos; documentação OpenAPI
src/routes/             Definição de rotas HTTP
src/controllers/        Controladores existentes
src/services/           Regras de negócio e integrações
src/middleware/         Autenticação e autorização
src/lib/                Instância do Prisma
prisma/schema.prisma    Modelos de dados
prisma/migrations/      Histórico de migrations
scripts/                Diagnósticos e preparação local
tests/                  Testes automatizados
server.js               Inicialização do Express
```

## Documentação adicional

- [Guia detalhado para a faculdade](docs/GUIA-FACULDADE.md)
- [Quickstart em inglês](docs/QUICKSTART-EN.md)
- [Inicio rápido em espanhol](docs/INICIO-RAPIDO-ES.md)
- [Plano de atualização do GitBook](docs/GITBOOK-ATUALIZACAO.md)

Este repositório não publica uma interface trilíngue; os materiais de instalação em outros idiomas são documentação de apoio.
