# Academia Krypton

Aplicação web para gestão de academia, desenvolvida como projeto acadêmico. O repositório contém uma API em Node.js/Express, páginas HTML/CSS/JavaScript e persistência em MySQL com Prisma ORM.

**Estado do projeto:** ambiente de desenvolvimento e homologação. O código não deve ser tratado como pronto para operação comercial ou cobrança real.

- [Aplicação de homologação (Render)](https://projetoacademiakrypton.onrender.com/)
- [Referência da API (Swagger UI)](https://projetoacademiakrypton.onrender.com/api-docs.html)
- [Documentação complementar (GitBook)](https://academia-krypton.gitbook.io/academia-krypton-docs/)

## Funcionalidades implementadas

- Cadastro, login e consulta do usuário autenticado.
- Autenticação JWT; integração com Google OAuth quando configurada.
- Consulta de planos e unidades, agendamentos básicos para alunos elegíveis.
- Painel administrativo com indicadores, consulta de alunos e histórico de acesso.
- Fluxo de assinaturas via Mercado Pago em homologação, sujeito a credenciais e validação.

**Fora do escopo implementado:** painéis completos de personal trainer, nutricionista e recepção; agenda por profissional com prevenção de conflitos; gestão de catracas; processamento de arquivos por filas. São funcionalidades planejadas, não entregues.

## Tecnologias

| Camada | Implementação |
| --- | --- |
| Servidor/API | Node.js, Express 4, JavaScript (ES Modules) |
| Interface | HTML, CSS, JavaScript, Bootstrap |
| Banco e ORM | MySQL 8, Prisma 5 |
| Autenticação | JWT, bcryptjs, Passport, Google OAuth 2.0 |
| Integrações | Mercado Pago (homologação), Google Maps |
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
SESSION_SECRET=SUBSTITUA_POR_OUTRO_SEGREDO_ALEATORIO_FORTE
JWT_EXPIRES_IN=7d
```

- `DATABASE_URL` é a conexão efetivamente utilizada pelo Prisma. As variáveis `DB_HOST`, `DB_USER` etc. existentes no exemplo não substituem essa URL.
- A senha embutida na URL deve usar codificação percentual quando contiver caracteres reservados (por exemplo, `@`, `#`, `%` e `/`).
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_CALLBACK_URL` são necessários para o login Google.
- `mercado_pago_access_token`, `MP_BACK_URL` e `MP_WEBHOOK_SECRET` são utilizados na integração de checkout, que permanece restrita a testes.
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

O seed geral (`npm run seed`) cria ou atualiza contas com senhas demonstrativas. **Não o utilize em bancos compartilhados, homologação ou produção.**

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

O deploy atual utiliza os seguintes comandos de referência no Render:

```text
Build: npm ci --include=dev && npx prisma generate
Start: npx prisma migrate deploy && npm start
Health check: /api/health
```

São configurações do ambiente de homologação existente, não uma recomendação de operação em produção. Para produção, revisar previamente migrations em uma etapa de release, backup, `NODE_ENV`, HTTPS/proxy, cookies, CORS e credenciais.

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
