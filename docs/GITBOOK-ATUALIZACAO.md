# Atualização proposta para o GitBook

**Status:** material preparado no repositório; **a publicação direta no GitBook não foi realizada**.

O GitBook existente pode ser atualizado sem perder suas páginas atuais. Sugestão de navegação:

- **Comece aqui / Getting started / Primeros pasos**
  - Português — [Guia da Faculdade](GUIA-FACULDADE.md)
  - English — [Classroom Quickstart](QUICKSTART-EN.md)
  - Español — [Inicio rápido](INICIO-RAPIDO-ES.md)
- **Arquitetura existente** — Node.js, Express, Prisma, MySQL, serviços e rotas.
- **API de homologação** — `/api-docs.html` e `/openapi.json`. Rotas listadas conforme código atual.
- **Ambientes** — Windows PowerShell, Zorin/Linux, MySQL local versus Clever Cloud, Render.
- **Próximos módulos** — aluno, personal, nutricionista, recepção, administração, jobs.

Este conteúdo é uma base para sincronização/cópia editorial no GitBook. **Não confundir a trilíngue documentação com interface do site traduzida**: suporte PT/EN/ES no produto requer internacionalização de frontend/backend e deve ser projeto posterior.

## Evidências a atualizar depois do deploy
- Resultado local de `npm run check:env` e `npm run check:db` (sem segredos).
- Captura da documentação em `/api-docs.html`.
- Status das migrations, sem revelar informações privadas.
- Confirmação de quais unidades foram cadastradas por via administrativa legítima.
