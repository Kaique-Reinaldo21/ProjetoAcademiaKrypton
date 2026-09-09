# Krypton Academia — Sistema de Gestão de Academia

> Plataforma integrada de gestão de preparo físico e nutricional para academias.
> link da documentação para mais detalhes : https://academia-krypton.gitbook.io/academia-krypton-docs/

---

## Sobre o Projeto

O **Krypton Academia** é um software de gestão voltado para academias de médio e grande porte, integrando o acompanhamento de treinos, nutrição e gestão de alunos em uma única plataforma. O sistema conecta donos de academia, personal trainers, nutricionistas e alunos com hierarquia de acesso definida por perfil.

---

## Como Rodar o Projeto

### Pré-requisitos

Certifique-se de ter instalado em sua máquina:

- [Node.js](https://nodejs.org/) 
- [npm](https://www.npmjs.com/) 
- [Express](https://expressjs.com/)
- [Git](https://git-scm.com/)
- [Banco de dados] (MySQL Workbench recomendado)


### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/krypton-academia.git
cd krypton-academia
```

---

### 2. Configure as variáveis de ambiente

Crie um arquivo .env e preencha com suas configurações:
```
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET= 
JWT_EXPIRES_IN= 

# MySQL
DB_HOST=localhost
DB_PORT=3306 
DB_USER=root 
DB_PASSWORD= 
DB_NAME=academia_kripton

```

Copie o texto acime e cole no arquivo `.env` com as informações do seu ambiente:

# Configurações do servidor
PORT=3000 (A porta onde o servidor Node.js vai rodar )
NODE_ENV=development(Define o ambiente. Em development, erros são mais verbosos. Em production, o app otimiza performance e oculta detalhes de erro).

# Autenticação (JWT- JSON Web Token)
JWT_SECRET=*String para assinar o token!* (Chave secreta usada para assinar e validar tokens JWT (login/sessão). Se vazar, alguém pode forjar tokens de autenticação)
JWT_EXPIRES_IN=7d

# MySQL
DB_HOST=localhost(Endereço do servidor MySQL.)
DB_PORT=3306 (Porta padrão do MySQL)
DB_USER=root (Usuário do banco. root é o superusuário (ok em dev, evitar em produção))
DB_PASSWORD= (Senha do MySQL Workbench)
DB_NAME=academia_kripton (Nome do projeto)
---

### 3. Instale as dependências

Baixe o Express(https://expressjs.com/)
```
npm install 
npm install express
```
npm install nodemon (Opcional, para desenvolvimento com hot reload)
```
npm install nodemo
```
Para rodar o arquivo execute o:
```
npm run dev
```

> Servidor disponível em: `http://localhost:3000`



## Estrutura do Projeto

```
krypton-academia/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/           # Autenticação e controle de acesso por perfil
│   │   │   ├── alunos/         # Perfil, anamnese, fotos e medidas corporais
│   │   │   ├── treinos/        # Fichas de treino, progressão de carga
│   │   │   ├── nutricao/       # Plano alimentar e diário alimentar
│   │   │   ├── dashboard/      # KPIs, retenção e relatórios gerenciais
│   │   │   └── notificacoes/   # Alertas entre profissionais
│   │   ├── config/
│   │   └── shared/
│   ├── prisma/                 # Schema e migrations do banco
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── services/           # Chamadas à API
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

---

## Módulos Principais

| Módulo | Descrição |
|---|---|
| **Dashboard** | KPIs de retenção, frequência, alunos inativos (+7 dias sem check-in) |
| **Treinos** | Fichas digitais com séries, repetições, carga e progressão por aluno |
| **App do Aluno** | Acesso mobile à ficha de treino, registro de execução e evolução |
| **Nutrição** | Plano alimentar digital + diário alimentar com controle de privacidade (CFN) |
| **Perfil do Aluno** | Anamnese, fotos de progresso, medidas, restrições e exames em PDF |
| **Notificações** | Alertas internos entre personal e nutricionista (ex: mudança de objetivo) |
| **Relatórios** | Exportação em PDF e Excel por gestão e por profissional |

---
