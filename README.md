<div align="center">
  <img src="public/logo.png" alt="Logotipo da Academia Krypton" width="180" />
</div>

# Academia Krypton

**Plataforma web de gestão de academia**

Cadastro e autenticação de alunos, planos, unidades, agendamentos e recursos administrativos.

[Site online — homologação](https://projetoacademiakrypton.onrender.com/) · [Documentação no GitBook](https://academia-krypton.gitbook.io/academia-krypton-docs/) · [Código-fonte](https://github.com/Kaique-Reinaldo21/ProjetoAcademiaKrypton)

---

## ⚡ Comece aqui — instalação rápida

**Requisitos:** Node.js LTS (com npm), Git e um MySQL 8 compatível acessível. O projeto tem duas opções: rodar **localmente com dados fictícios** (ideal para apresentação) ou usar apenas o **site de homologação no Render**. Não confunda com produção definitiva.

### Windows (PowerShell — VS Code)

**Primeira instalação** (na pasta em que deseja guardar o projeto):

```powershell
git clone https://github.com/Kaique-Reinaldo21/ProjetoAcademiaKrypton.git
cd ProjetoAcademiaKrypton
npm.cmd ci
Copy-Item .env.example .env
```

Abra o `.env` e informe **seu MySQL LOCAL** (host `localhost` ou `127.0.0.1`), nome do banco, usuário e senha na `DATABASE_URL`. Configure `JWT_SECRET` e `SESSION_SECRET` com valores longos e diferentes. Antes do próximo passo, o banco e o usuário MySQL precisam existir e ter permissão. Consulte [configuração local do MySQL](#configurar-o-mysql-local-se-ainda-nao-estiver-pronto).

```powershell
npm.cmd run check:env
npm.cmd run setup:local
npm.cmd run dev
```

Abra **http://localhost:3000**. A documentação visual da API está em **http://localhost:3000/api-docs.html**. O setup prepara o Prisma, aplica as migrations **somente no banco local confirmado** e cadastra três unidades *fictícias* que ainda não existam.

**Já instalou e voltou para a aula?** Na pasta do projeto:

```powershell
git status
git pull --ff-only origin main
npm.cmd ci
npm.cmd run check:db
npm.cmd run dev
```

Faça o `pull` somente com a árvore de trabalho limpa; preserve seu `.env`. Se houver migrations novas e você estiver usando um banco local, execute `npm.cmd run setup:local` antes de iniciar.

### Linux (Zorin / Ubuntu — terminal)

```bash
git clone https://github.com/Kaique-Reinaldo21/ProjetoAcademiaKrypton.git
cd ProjetoAcademiaKrypton
npm ci
cp .env.example .env
# Edite .env com MySQL LOCAL, JWT_SECRET e SESSION_SECRET
npm run check:env
npm run setup:local
npm run dev
```

**Na próxima aula:** `git status`, `git pull --ff-only origin main` (se não houver alterações locais), `npm ci`, `npm run check:db`, `npm run dev`. Não sobrescreva um `.env` existente.

### Configurar o MySQL local se ainda não estiver pronto

1. Instale/inicie o **MySQL Server 8** e crie o banco `academia_kripton` usando uma ferramenta como MySQL Workbench, DBeaver ou cliente `mysql`.
2. Crie um usuário exclusivo de desenvolvimento com senha forte e permissões **somente** nesse banco (não utilize um superusuário remoto). Exemplo executado por um administrador **no MySQL local**:

```sql
CREATE DATABASE IF NOT EXISTS academia_kripton
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'krypton_dev'@'localhost'
  IDENTIFIED BY 'SUBSTITUA_POR_SENHA_FORTE';
GRANT ALL PRIVILEGES ON academia_kripton.* TO 'krypton_dev'@'localhost';
```

3. Preencha o `.env` local (exemplo **sem senha verdadeira**):

```dotenv
NODE_ENV=development
DATABASE_URL="mysql://krypton_dev:SENHA_CODIFICADA@localhost:3306/academia_kripton"
JWT_SECRET=SUBSTITUA_POR_SEGREDO_FORTE
SESSION_SECRET=SUBSTITUA_POR_OUTRO_SEGREDO_FORTE
```

Se MySQL estiver em outro host/porta ou se o usuário for `'krypton_dev'@'127.0.0.1'`, ajuste as permissões e a URL. Caracteres especiais da senha na URL precisam de codificação percentual. O exemplo SQL cria usuário, mas se já houver usuário com esse nome, ajuste a senha/configuração de acordo com sua instalação.

### Criar somente as unidades no PC

Se o projeto já estiver configurado com **MySQL LOCAL**, execute:

```powershell
npm.cmd run demo:unidades:local
npm.cmd run check:db
```

No Linux, use `npm run demo:unidades:local` e `npm run check:db`.

Esse comando só cadastra as três unidades fictícias **Centro, Zona Leste e Vila Madalena** se não existir outra com o mesmo nome. Não altera unidades existentes, alunos, planos nem senhas. Confira em `http://localhost:3000/api/unidades` (reinicie a API se estiver fechada).

**Bloqueio importante:** `setup:local` e `demo:unidades:local` recusam `DATABASE_URL` com host remoto e `NODE_ENV=production`. Não execute esses scripts contra túneis ou redirecionamentos de porta que apontem um endereço `localhost` para um banco remoto. Nunca execute `npm run seed` em banco compartilhado: o seed geral inclui usuários e senhas demonstrativas.

### Acesso remoto e apresentação

- **Sem instalar nada:** [abrir o site já hospedado no Render](https://projetoacademiakrypton.onrender.com/). Basta internet; pode haver demora ao despertar o serviço gratuito. [API de unidades no Render](https://projetoacademiakrypton.onrender.com/api/unidades).
- **Site local usando Clever Cloud:** após `npm ci` e `npx prisma generate`, configure a `DATABASE_URL` remota no `.env`, execute `npm run check:env`, `npm run check:db` e `npm run dev`. **Não execute `setup:local`, `demo:unidades:local` nem seeds** nesse cenário.
- O MySQL local e o MySQL remoto **não compartilham dados automaticamente**. `/api/unidades` vazio no Render exige cadastrar dados por procedimento administrativo autorizado para o banco remoto, não copiar seeds inseguros.
- Prepare o ambiente um dia antes e teste cadastro/login, serviços e conexão. Evite mudar `NODE_ENV` para `production` no PC da faculdade: o aplicativo ainda exige validação de cookies, CORS e HTTPS.

### Ambiente e documentação

| Recurso | Atalho |
| --- | --- |
| Guia completo (PT-BR) | [Faculdade — Windows e Linux](docs/GUIA-FACULDADE.md) |
| English | [Classroom Quickstart](docs/QUICKSTART-EN.md) |
| Español | [Inicio rápido](docs/INICIO-RAPIDO-ES.md) |
| GitBook | [Plano de atualização editorial](docs/GITBOOK-ATUALIZACAO.md) |
| Documentação interativa | [Swagger UI (site hospedado)](https://projetoacademiakrypton.onrender.com/api-docs.html) |
| Verificar configurações | `npm run check:env` — não exibe senhas |
| Verificar banco | `npm run check:db` — apenas leitura |
| Testes | `npm test` e `npm run check:syntax` |

**Segurança:** `.env` está no `.gitignore`. Nunca o envie ao GitHub nem divulgue usuário/senha em prints. Guarde um `.env` separado para cada ambiente e, para transportá-lo, prefira um pendrive pessoal criptografado. `GET /api/health` confirma somente o Express; `{"unidades":[]}` significa lista vazia na base consultada.

---

## Visão geral

A **Academia Krypton** é uma aplicação web desenvolvida com **Node.js e Express**, utilizando **MySQL** e **Prisma ORM** para persistência de dados. O projeto disponibiliza páginas web servidas pelo próprio back-end, uma API HTTP e recursos associados à gestão de alunos e unidades.

### Funcionalidades presentes no repositório

- Interface institucional e páginas de cadastro, login, seleção de planos e painéis.

- Autenticação tradicional com JWT e controle de acesso por perfil.

- Fluxo de autenticação com Google OAuth 2.0, mediante configuração de credenciais.

- Planos Básico, Pro e Elite; informações de usuários e histórico de login.

- Consulta pública de unidades por API e visualização de endereços no Google Maps.

- Rotas de agendamentos e operações administrativas.

- Checkout de assinaturas e verificação de pagamento com Mercado Pago **em homologação**, dependentes de credenciais e testes de integração. Não utilizar cobranças reais antes da validação do fluxo completo.

> **Escopo:** este README reúne execução local e informações do ambiente online de **homologação/apresentação**. A hospedagem não significa que pagamentos reais ou todas as funcionalidades planejadas estejam prontos para produção. Consulte também o [GitBook](https://academia-krypton.gitbook.io/academia-krypton-docs/).

## Acesso online — homologação e apresentação

A Academia Krypton possui um ambiente público **para testes e demonstrações acadêmicas**:

- **[Abrir o site da Academia Krypton](https://projetoacademiakrypton.onrender.com/)**
- [Verificar a API (`GET /api/health`)](https://projetoacademiakrypton.onrender.com/api/health)
- [Consultar unidades (`GET /api/unidades`)](https://projetoacademiakrypton.onrender.com/api/unidades)

| Componente | Serviço | Observação |
| --- | --- | --- |
| Site e API Node.js/Express | Render (Web Service) | URL pública HTTPS; plano gratuito pode entrar em repouso após inatividade |
| Banco de dados MySQL 8 | Clever Cloud (plano DEV) | Banco remoto **separado do MySQL local**; limites e disponibilidade próprios de serviço de desenvolvimento |
| Estrutura de dados | Prisma Migrate | Migrations versionadas em `prisma/migrations/` |
| Checkout de assinaturas | Mercado Pago | **Em testes**; não usar pagamentos reais nem contas de clientes |

O deploy e a conexão com MySQL foram observados nos logs de **23/11/2026**; a disponibilidade e os dados devem ser verificados novamente antes de cada demonstração. O Render Free pode demorar a atender a primeira requisição após um período de inatividade.

### Como está organizada a hospedagem

1. O Render executa a aplicação Express, que também serve as páginas HTML/CSS/JavaScript.
2. A variável `DATABASE_URL`, configurada **somente no painel do Render**, aponta para o MySQL hospedado no Clever Cloud.
3. O Prisma aplica as migrations disponíveis ao banco remoto; isso **cria/atualiza tabelas**, mas não importa automaticamente os dados do MySQL local.
4. Alunos e unidades cadastrados pelo ambiente online ficam no banco remoto configurado para esse serviço.

**Importante:** os acessos, segredos e credenciais de produção não devem ser compartilhados no repositório ou enviados por mensagens. Não execute o seed demonstrativo no ambiente público: ele contém contas de teste e senhas previsíveis.

### Configuração de deploy (referência para mantenedores)

Para a configuração de apresentação no Render, os comandos utilizados são:

| Campo | Valor |
| --- | --- |
| Build Command | `npm ci --include=dev && npx prisma generate` |
| Start Command | `npx prisma migrate deploy && npm start` |
| Health Check Path | `/api/health` |

O comando de início aplica migrations pendentes antes de subir o Express. Essa estratégia é adequada à homologação atual; em produção, recomenda-se executar migrations em uma etapa de release separada, com backup e validação.

Configure as variáveis de ambiente no **painel do serviço** (não no Git):

- `DATABASE_URL`: conexão remota MySQL fornecida pelo Clever Cloud.
- `JWT_SECRET` e `SESSION_SECRET`: segredos distintos e fortes.
- `NODE_ENV`: revisar para `production` após validar cookies, HTTPS, CORS e integrações na URL publicada.
- `mercado_pago_access_token`, `MP_BACK_URL` e `MP_WEBHOOK_SECRET`: somente para testar o checkout. `MP_BACK_URL` deve ser uma URL HTTPS pública terminando em `/checkout/success`.

Os pagamentos **não devem ser feitos com dinheiro real** nessa fase. O webhook exige configuração no Mercado Pago e o processamento financeiro deve ser validado com dados de teste antes de qualquer liberação.

### Verificação do MySQL remoto sem modificar dados

No phpMyAdmin do Clever Cloud, expanda o banco e confira as tabelas. A consulta abaixo é **somente leitura**:

```sql
SHOW TABLES;
SELECT migration_name, finished_at, rolled_back_at
FROM _prisma_migrations
ORDER BY started_at;
SELECT COUNT(*) AS total_unidades FROM unidades;
SELECT COUNT(*) AS total_usuarios FROM usuarios;
SELECT COUNT(*) AS total_planos FROM planos;
```

Não envie capturas com senhas, connection strings ou dados pessoais dos alunos. **Não execute `prisma migrate reset`, `prisma db push` nem importe dados reais do banco local para solucionar erros de hospedagem.**

### Antes da apresentação

- Acessar a URL pública e testar cadastro, login, consulta de planos e unidades e painel administrativo com dados fictícios.
- Validar a conexão e as migrations; preparar unidades e contas fictícias com senhas fortes, sem usar o seed padrão no servidor público.
- Conferir as integrações com o Mercado Pago **exclusivamente em ambiente de teste**.
- Preparar uma alternativa local e uma gravação curta para o caso de indisponibilidade da internet ou da hospedagem.
- Verificar os avisos de `npm audit` sem aplicar atualizações forçadas na véspera da apresentação.

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Servidor e API | Node.js, Express 4, JavaScript (ES Modules) |
| Interface | HTML, CSS e JavaScript, servidos pelo Express |
| Persistência | MySQL 8, Prisma ORM 5 |
| Autenticação | JWT, bcryptjs, Passport e Google OAuth 2.0 |
| Integrações | Mercado Pago e Google Maps (links/iframe) |
| Desenvolvimento | npm, Git, Nodemon |

## Requisitos

- **Node.js 24 LTS** (recomendado) ou versão LTS compatível, com **npm** incluído.

- **Git** para obter o código-fonte.

- **MySQL Server 8.x**, instalado localmente ou acessível em outro servidor.

- Conexão com a internet para baixar ferramentas e dependências.

- Portas **3000** (aplicação, por padrão) e **3306** (MySQL, por padrão) disponíveis ou ajustadas ao seu ambiente.

**Não é necessário instalar Express, Prisma, Passport ou Nodemon globalmente.** Eles já estão declarados no `package.json`. O **MySQL Workbench é opcional**: é uma interface de administração, não substitui o MySQL Server.

## Instalação

Selecione o procedimento correspondente ao seu sistema operacional. Cada guia contempla uma máquina nova, desde os pré-requisitos até a execução da aplicação.

- [Windows 10/11](#windows-1011)

- [Linux — Ubuntu, Zorin OS e derivados Debian](#linux--ubuntu-zorin-os-e-derivados-debian)

---

## Windows 10/11

### 1. Instalar as ferramentas

Instale, preferencialmente pelas fontes oficiais:

1. [Node.js LTS](https://nodejs.org/en/download) — inclui o npm.

2. [Git for Windows](https://git-scm.com/downloads/win).

3. [MySQL Community Server](https://dev.mysql.com/downloads/mysql/) — o **MySQL Installer** pode facilitar a instalação e a configuração do serviço no Windows.

4. Opcional: [MySQL Workbench](https://dev.mysql.com/downloads/workbench/) e [Visual Studio Code](https://code.visualstudio.com/).

Durante a instalação do MySQL, configure uma senha para a conta administrativa e mantenha o serviço habilitado. Depois, abra um novo terminal **PowerShell** e verifique:

```powershell
node --version

npm.cmd --version

git --version
```

> No PowerShell, este guia usa `npm.cmd` e `npx.cmd`, que chamam os executáveis do npm sem depender da execução de scripts `.ps1`.

### 2. Clonar o repositório

```powershell
git clone https://github.com/Kaique-Reinaldo21/ProjetoAcademiaKrypton.git

cd ProjetoAcademiaKrypton
```

### 3. Instalar as dependências

Execute na pasta que contém `package.json`:

```powershell
npm.cmd ci
```

O comando `npm ci` instala as versões registradas no `package-lock.json`, preservando uma instalação reproduzível.

### 4. Criar o banco e um usuário local

Abra uma conexão administrativa no **MySQL Workbench** e execute o SQL abaixo. Como alternativa, use o cliente de linha de comando MySQL conectado como administrador.

```sql
CREATE DATABASE IF NOT EXISTS academia_kripton

  CHARACTER SET utf8mb4

  COLLATE utf8mb4_unicode_ci;



CREATE USER IF NOT EXISTS 'krypton_dev'@'127.0.0.1'

  IDENTIFIED BY 'SUBSTITUA_POR_UMA_SENHA_FORTE';



GRANT ALL PRIVILEGES ON academia_kripton.*

  TO 'krypton_dev'@'127.0.0.1';
```

Substitua a senha de exemplo por uma senha exclusiva para o ambiente local. Se o MySQL estiver em outro servidor, ajuste o host e as permissões para esse ambiente em vez de utilizar `127.0.0.1`.

### 5. Configurar as variáveis de ambiente

Na raiz do projeto:

```powershell
Copy-Item .env.example .env
```

Edite o arquivo `.env` com os dados do seu MySQL e com **segredos exclusivos** para JWT e sessão. As variáveis principais são:

```dotenv
PORT=3000

NODE_ENV=development

DATABASE_URL="mysql://krypton_dev:SENHA_DO_BANCO@127.0.0.1:3306/academia_kripton"

JWT_SECRET="SUBSTITUA_POR_UM_SEGREDO_LONGO_E_ALEATORIO"

JWT_EXPIRES_IN=7d

SESSION_SECRET="SUBSTITUA_POR_OUTRO_SEGREDO_LONGO_E_ALEATORIO"

GOOGLE_CLIENT_ID=

GOOGLE_CLIENT_SECRET=

GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
```

Preserve também as demais variáveis do `.env.example`, quando necessárias. Se a senha do MySQL contiver `@`, `#`, `%`, `:` ou caracteres especiais, codifique esses caracteres na parte da senha da `DATABASE_URL` (percent-encoding).

**Nunca faça commit do arquivo `.env` ou compartilhe credenciais reais.**

### 6. Preparar o Prisma e os dados

```powershell
npx.cmd prisma generate

npx.cmd prisma migrate deploy

npx.cmd prisma migrate status
```

Para preencher **um banco local de desenvolvimento** com unidades e contas demonstrativas:

```powershell
npm.cmd run seed
```

O seed oficial (`prisma/seed.js`) também pode **atualizar usuários, planos e unidades existentes**. Não o execute em ambientes de produção ou em bancos com dados importantes. O próprio script bloqueia sua execução quando `NODE_ENV=production`.

### 7. Iniciar e verificar a aplicação

```powershell
npm.cmd run dev
```

Abra:

- Aplicação: <http://localhost:3000>

- Status da API: <http://localhost:3000/api/health>

- Unidades cadastradas: <http://localhost:3000/api/unidades>

Para executar sem o monitor de alterações do Nodemon, utilize `npm.cmd start`.

---

## Linux — Ubuntu, Zorin OS e derivados Debian

Os comandos abaixo utilizam `apt` e `systemd`. Em outras distribuições, adapte a instalação de pacotes e o gerenciamento do serviço MySQL.

### 1. Instalar Git, ferramentas básicas e MySQL

```bash
sudo apt update

sudo apt install -y git curl ca-certificates mysql-server

sudo systemctl enable --now mysql
```

Confira o serviço:

```bash
sudo systemctl status mysql
```

Se a distribuição não oferecer `mysql-server` nos repositórios habilitados, utilize os pacotes oficiais compatíveis disponibilizados pela [MySQL Community](https://dev.mysql.com/downloads/mysql/).

### 2. Instalar Node.js LTS com nvm

Recomendamos o [nvm](https://github.com/nvm-sh/nvm) para gerenciar versões do Node.js sem instalar pacotes globais como administrador. Siga as instruções de instalação oficiais do nvm e, após reiniciar o terminal, execute:

```bash
nvm install 24

nvm alias default 24

node --version

npm --version

git --version
```

### 3. Clonar o repositório e instalar as dependências

```bash
git clone https://github.com/Kaique-Reinaldo21/ProjetoAcademiaKrypton.git

cd ProjetoAcademiaKrypton

npm ci
```

### 4. Criar o banco e um usuário local

Em instalações Ubuntu/Zorin, a conta administrativa do MySQL normalmente pode ser acessada com:

```bash
sudo mysql
```

No terminal do MySQL, execute:

```sql
CREATE DATABASE IF NOT EXISTS academia_kripton

  CHARACTER SET utf8mb4

  COLLATE utf8mb4_unicode_ci;



CREATE USER IF NOT EXISTS 'krypton_dev'@'127.0.0.1'

  IDENTIFIED BY 'SUBSTITUA_POR_UMA_SENHA_FORTE';



GRANT ALL PRIVILEGES ON academia_kripton.*

  TO 'krypton_dev'@'127.0.0.1';



EXIT;
```

O usuário `krypton_dev` deve ter permissões somente no banco da aplicação. Ajuste as permissões conforme a política do seu ambiente se estiver utilizando um servidor MySQL remoto.

### 5. Configurar as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` (por exemplo, com `nano .env`) e configure as variáveis fundamentais:

```dotenv
PORT=3000

NODE_ENV=development

DATABASE_URL="mysql://krypton_dev:SENHA_DO_BANCO@127.0.0.1:3306/academia_kripton"

JWT_SECRET="SUBSTITUA_POR_UM_SEGREDO_LONGO_E_ALEATORIO"

JWT_EXPIRES_IN=7d

SESSION_SECRET="SUBSTITUA_POR_OUTRO_SEGREDO_LONGO_E_ALEATORIO"

GOOGLE_CLIENT_ID=

GOOGLE_CLIENT_SECRET=

GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
```

As credenciais de Google e Mercado Pago só são necessárias para utilizar essas integrações. Codifique caracteres especiais da senha na URL de conexão e mantenha o `.env` fora do controle de versão.

### 6. Preparar o Prisma e os dados

```bash
npx prisma generate

npx prisma migrate deploy

npx prisma migrate status
```

Opcional, **somente para banco de desenvolvimento**:

```bash
npm run seed
```

### 7. Iniciar e verificar a aplicação

```bash
npm run dev
```

Acesse:

- Aplicação: <http://localhost:3000>

- Status da API: <http://localhost:3000/api/health>

- Unidades cadastradas: <http://localhost:3000/api/unidades>

Para execução sem Nodemon, utilize `npm start`.

---

## Configuração do ambiente

A aplicação lê as variáveis de um arquivo `.env` na raiz do repositório. Use **`.env.example` como referência**, sem incluir dados sensíveis nesse arquivo de exemplo.

| Variável | Uso | Obrigatoriedade |
| --- | --- | --- |
| `DATABASE_URL` | Conexão do Prisma com MySQL | Obrigatória |
| `PORT` | Porta HTTP da aplicação; padrão `3000` | Opcional |
| `NODE_ENV` | `development` para execução local | Recomendada |
| `JWT_SECRET` | Assinatura e validação dos tokens JWT | Obrigatória para autenticação |
| `JWT_EXPIRES_IN` | Expiração do JWT, por exemplo `7d` | Opcional |
| `SESSION_SECRET` | Assinatura das sessões Express | Obrigatória para uso seguro de sessões |
| `GOOGLE_CLIENT_ID` | Identificador OAuth do Google | Somente para login Google |
| `GOOGLE_CLIENT_SECRET` | Segredo OAuth do Google | Somente para login Google |
| `GOOGLE_CALLBACK_URL` | Callback OAuth autorizado | Somente para login Google |
| `mercado_pago_access_token` | Token do Mercado Pago | Somente para a integração de pagamentos |
| `MP_BACK_URL` | URL HTTPS pública de retorno do checkout (`/checkout/success`) | Para pagamentos em homologação |
| `MP_WEBHOOK_SECRET` | Validação de notificações assinadas do Mercado Pago | Para webhook em homologação |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Campos auxiliares mantidos no template | O Prisma nesta versão utiliza `DATABASE_URL` |

Para o login Google em desenvolvimento, o callback usado pelo servidor, quando não sobrescrito, é:

```text
http://localhost:3000/api/auth/google/callback
```

Esse endereço deve ser autorizado na configuração OAuth do provedor. Sem credenciais Google, o login tradicional pode ser utilizado e o fluxo Google permanece desabilitado.

O módulo do Mercado Pago utiliza o nome de variável **`mercado_pago_access_token`**, em letras minúsculas, conforme a implementação atual. Não utilize tokens reais em documentação ou ambientes compartilhados.

## Banco de dados e migrations

A estrutura do MySQL é declarada em `prisma/schema.prisma` e suas alterações devem ser versionadas em `prisma/migrations/`.

| Comando | Finalidade |
| --- | --- |
| `npx prisma generate` | Gerar o Prisma Client |
| `npx prisma migrate deploy` | Aplicar migrations existentes, inclusive em uma instalação nova |
| `npx prisma migrate status` | Consultar o estado das migrations |
| `npx prisma migrate dev --name descricao` | Criar uma migration durante o desenvolvimento de alterações no schema |
| `npm run seed` | Popular ou atualizar dados de demonstração no banco de desenvolvimento |

### Versionamento do banco de dados

A estrutura do banco de dados é gerenciada pelo Prisma ORM. Todas as alterações em `prisma/schema.prisma` devem ser acompanhadas por migrations versionadas no diretório `prisma/migrations/`.

O histórico de migrations inclui:

- `0_init` — criação da estrutura inicial do banco de dados.

- `20261109_sync_schema_atual` — sincronização da estrutura atual, incluindo coordenadas das unidades, identificador dos planos no Mercado Pago e ajustes no modelo de usuários.

- `20261116_checkout_tentativas` — estrutura para tentativas de checkout e vínculo de assinaturas ao fluxo de confirmação do pagamento.

Em uma instalação nova, execute `npx prisma migrate deploy` para aplicar as migrations disponíveis e `npx prisma migrate status` para verificar o estado do banco.

> **Importante:** `prisma db push` não gera migrations versionadas e não substitui o processo oficial de instalação. `prisma migrate resolve` é destinado a situações específicas de reconciliação do histórico, não à configuração inicial de uma máquina nova.

## Scripts disponíveis

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor com Nodemon |
| `npm start` | Inicia o servidor com Node.js |
| `npm run seed` | Executa `prisma/seed.js` no banco de desenvolvimento |

No Windows PowerShell, substitua `npm` por `npm.cmd` e `npx` por `npx.cmd` caso necessário.

## Estrutura do projeto

```text
ProjetoAcademiaKrypton/

├── public/                 # HTML e recursos estáticos servidos pelo Express

├── assets/                 # Imagens e recursos visuais

├── css/                    # Estilos

├── src/

│   ├── config/             # Configuração do Passport

│   ├── controllers/        # Controladores HTTP

│   ├── gatewary/           # Integração de pagamentos (nome atual da pasta)

│   ├── lib/                # Instância central do Prisma

│   ├── middleware/         # Autenticação e autorização

│   ├── routes/             # Endpoints públicos, aluno, admin e autenticação

│   └── services/           # Regras de autenticação

├── prisma/

│   ├── migrations/         # Evolução versionada do banco

│   ├── schema.prisma       # Modelos e relacionamentos

│   ├── seed.js             # Seed usado por npm run seed

│   └── seed.ts             # Script auxiliar não chamado pelo npm run seed

├── .env.example            # Referência sem segredos

├── .gitignore

├── nodemon.json

├── package.json

├── package-lock.json

├── server.js               # Ponto de entrada da aplicação

└── README.md
```

## Verificação de instalação

Após iniciar o servidor, as seguintes respostas são esperadas:

- `GET /api/health`: JSON com `status: "ok"`.

- `GET /api/unidades`: JSON contendo a propriedade `unidades` (uma lista, que pode estar vazia antes do seed).

- `GET /`: página institucional da academia.

Se um serviço externo não estiver configurado, suas funcionalidades específicas podem permanecer indisponíveis; isso não impede necessariamente a execução das demais partes da aplicação.

## Segurança e ambientes

- Use segredos exclusivos para cada instalação e nunca publique arquivos `.env`.

- O seed contém **contas de demonstração com senhas previsíveis** e não deve ser utilizado em produção.

- Não exponha publicamente o MySQL; prefira conexão restrita à aplicação e privilégio mínimo para os usuários do banco.

- A execução local não equivale a uma implantação pronta para produção. Antes de publicar, revise HTTPS, CORS, armazenamento de sessões, credenciais, logs, configuração do provedor OAuth e integração de pagamentos.

- Não inclua arquivos `.env`, chaves, tokens ou dados reais em arquivos ZIP de distribuição.

- **Atenção ao ambiente online:** o deploy inicial registrou `NODE_ENV=development`; revisar a configuração de produção, proteção de sessões, CORS e endpoints financeiros antes de divulgar o sistema para uso real.

- A verificação de dependências no deploy indicou vulnerabilidades; avaliar com `npm audit` em branch de manutenção, sem executar `npm audit fix --force` indiscriminadamente.

## Documentação e colaboração

A documentação funcional e de gestão do projeto está no [GitBook da Academia Krypton](https://academia-krypton.gitbook.io/academia-krypton-docs/).

Para contribuir, crie uma branch a partir da versão atual, faça alterações pequenas e revisáveis, atualize migrations e documentação quando necessário e envie um Pull Request descrevendo o objetivo e os procedimentos de validação.

---

**Academia Krypton — projeto acadêmico em desenvolvimento.**
