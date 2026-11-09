<div align="center">
  <img src="public/logo.png" alt="Logotipo da Academia Krypton" width="180" />
</div>

# Academia Krypton

**Plataforma web de gestão de academia**

Cadastro e autenticação de alunos, planos, unidades, agendamentos e recursos administrativos.

[Documentação no GitBook](https://academia-krypton.gitbook.io/academia-krypton-docs/) · [Código-fonte](https://github.com/Kaique-Reinaldo21/ProjetoAcademiaKrypton)

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

- Integração experimental com Mercado Pago para registro de planos, dependente de credenciais próprias.

> **Escopo:** esta documentação descreve a execução local da versão presente no repositório. Recursos planejados e extensões futuras são documentados separadamente no [GitBook](https://academia-krypton.gitbook.io/academia-krypton-docs/).

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

## Documentação e colaboração

A documentação funcional e de gestão do projeto está no [GitBook da Academia Krypton](https://academia-krypton.gitbook.io/academia-krypton-docs/).

Para contribuir, crie uma branch a partir da versão atual, faça alterações pequenas e revisáveis, atualize migrations e documentação quando necessário e envie um Pull Request descrevendo o objetivo e os procedimentos de validação.

---

**Academia Krypton — projeto acadêmico em desenvolvimento.**
