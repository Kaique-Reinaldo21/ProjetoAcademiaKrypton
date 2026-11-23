# Academia Krypton — Guia de continuidade (PT-BR)
> **Homologação acadêmica, não produção.** Este guia é complemento ao [README](../README.md). A documentação visual da API fica em `/api-docs.html` e o contrato em `/openapi.json`.

## 1. Retomar o projeto na faculdade (Windows PowerShell)
1. Instale Node.js LTS, Git e tenha acesso a um MySQL 8 compatível.
2. No PowerShell:

```powershell
git clone https://github.com/Kaique-Reinaldo21/ProjetoAcademiaKrypton.git
cd ProjetoAcademiaKrypton
npm.cmd ci
Copy-Item .env.example .env
```

Se o repositório já existir, execute `git status` e salve alterações locais antes de `git pull --ff-only origin main`. **Não execute `Copy-Item` sobre um `.env` já configurado.** É possível restaurar um `.env` de seu dispositivo pessoal depois de confirmar que ele pertence a este projeto e ambiente.

3. Edite `.env`: `DATABASE_URL` (MySQL local ou de homologação), `JWT_SECRET`, `SESSION_SECRET`. Nunca publique o arquivo. Mantenha o ambiente de produção separado.
4. Rode:

```powershell
npm.cmd run check:env
npx.cmd prisma generate
npm.cmd run check:db
npm.cmd run prisma:status
npm.cmd run check:syntax
npm.cmd run dev
```

5. Acesse `http://localhost:3000`, `http://localhost:3000/api/health` e `http://localhost:3000/api-docs.html`.

> `check:env` verifica campos sem acessar o banco; `check:db` executa apenas consultas de leitura e mostra contagens agregadas. `prisma:status` inspeciona migrations sem aplicá-las. Não use `npm run seed` em banco compartilhado: o seed atual contém senhas previsíveis e atualiza dados de demonstração.

## 2. No Zorin/Linux
```bash
git clone https://github.com/Kaique-Reinaldo21/ProjetoAcademiaKrypton.git
cd ProjetoAcademiaKrypton
npm ci
cp .env.example .env
# edite .env; configure MySQL e segredos
npm run check:env
npx prisma generate
npm run check:db
npm run prisma:status
npm run check:syntax
npm run dev
```

Se o clone já existir, execute `git status` antes de `git pull --ff-only origin main` e preserve seu `.env`.

## 3. Transportar o .env por pendrive
- O arquivo `.env` **já é ignorado pelo Git**. Transfira somente por dispositivo pessoal criptografado (BitLocker, VeraCrypt ou volume criptografado equivalente), evite pendrives públicos e não faça backup em repositórios.
- Melhor opção para faculdade: **outro `.env` com MySQL local e segredos de desenvolvimento**, separado do Render/Clever Cloud. Não leve credenciais de serviço público desnecessariamente.
- No Windows, dentro da pasta do projeto: `Copy-Item "E:\Krypton\.env" ".\.env"` (**ajuste a letra da unidade**). Antes, confira se não está sobrescrevendo uma configuração que deseja conservar.
- No Linux: `cp /media/$USER/SEU_PENDRIVE/.env ./.env` (substitua o caminho real). Restrinja permissões com `chmod 600 .env`.
- Nunca copie `.env` em prints, Teams, GitHub, mensagens ou GitBook. Não envie sua senha para diagnóstico. Rotacione qualquer segredo se o pendrive for perdido.
- Se a senha MySQL contiver caracteres especiais (`@`, `#`, `:`, `/`, `%` etc.), codifique-a corretamente na URL do Prisma. O host, usuário, senha, porta e nome do banco precisam corresponder ao ambiente escolhido.
- No Render, configure segredos **no painel de variáveis de ambiente**, nunca fazendo upload de seu `.env`.

## 4. API retorna [], mas servidor funciona?
- `GET /api/health` retorna `{status:'ok',env:'...'}`, sem testar MySQL.
- `GET /api/unidades` retorna `{unidades:[]}` se não houver unidades no banco consultado.
- Rode `npm run check:db` para confirmar conexão e contagem sem alterar nada.
- Clever Cloud e MySQL local são bancos **diferentes**, mesmo usando o mesmo schema.
- `prisma migrate deploy` aplica estrutura, mas **não preenche automaticamente tabelas**.
- **Não execute `prisma migrate reset`, `prisma db push`, seeds demonstrativos ou scripts destrutivos para tentar resolver a lista vazia.** Registre unidades por fluxo administrativo validado quando esse módulo estiver disponível.
- Se o phpMyAdmin não abrir, confira `check:db` ou use um cliente SQL de sua confiança. Falha na interface phpMyAdmin não prova falha na API.

## 5. Render: mudanças de ambiente
O código atual usa uma origem CORS fixa em modo `production` (`https://academiakripton.com.br`); antes de alterar `NODE_ENV`, alinhe CORS, cookies seguros, proxy HTTPS e Google OAuth com o domínio efetivamente publicado no Render. **Não altere `NODE_ENV` cegamente durante a apresentação.**

## 6. Próximas entregas (não implementadas nesta preparação)
1. Estabilizar dados e testar cadastro/login/checkout **somente homologação**.
2. Agendamento: adicionar profissional, duração, unidade, status e validação de conflitos com transações.
3. Painéis de personal e nutricionista: prontuário mínimo necessário, treinos e planos alimentares, agenda e arquivos privados.
4. Aluno: navegação para matrícula, agenda, treinos e alimentação.
5. Recepção: novo papel com permissão restrita, pré-matrícula, check-in e assistência ao atendimento.
6. Administração: módulos separados; métricas e gestão operacional.
7. Jobs: geração de PDF e notificações com fila persistente e worker separado; **não executar worker confiando no ciclo de vida do Render Free**.
8. Controle de acesso por função/atributo e proteção de dados de saúde (LGPD). Não guardar documentos médicos em diretório público.

## 7. Antes de demonstrar
- `npm run check:env`; `npm run check:db`; `npm run check:syntax`.
- Site, login e APIs conferidos com **contas fictícias próprias**.
- Migrations verificadas; nada de reset/seed no banco remoto.
- Testar fluxo de pagamento exclusivamente no ambiente de testes.
- Confirmar que `/api-docs.html` documenta apenas rotas implementadas.
