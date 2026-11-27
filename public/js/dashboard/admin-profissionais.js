import { elemento } from './design-system.js';
import { acao, base, bloco, campo, escolha, formulario, ler, papeis, salvar } from './profissionais-views.js';
import { api } from './aluno-dados.js';

export function gerirProfissionais(raiz) {
  let ativo = true;
  async function carregar() {
    if (!ativo) return;
    raiz.replaceChildren(elemento('p', 'Carregando profissionais…'));
    try {
      const contas = await ler('/contas');
      if (!ativo) return;
      const cadastrar = formulario([
        campo('nome', 'Nome'), campo('email', 'E-mail', 'email'), campo('senha', 'Senha inicial', 'password'),
        escolha('role', 'Papel', Object.entries(papeis)),
      ], 'Cadastrar profissional', async dados => { await salvar('/contas', dados); await carregar(); });
      const busca = elemento('div');
      const buscar = formulario([campo('busca', 'Nome do aluno', 'search', '', true)], 'Buscar aluno', async d => {
        const alunos = await ler('/alunos?busca=' + encodeURIComponent(d.busca));
        busca.replaceChildren(...(alunos.length ? alunos.map(a => elemento('p', a.nome + ' · ID ' + a.id)) : [elemento('p', 'Nenhum aluno encontrado.')]));
      });
      raiz.replaceChildren(bloco('Cadastrar profissional', cadastrar), bloco('Localizar ID do aluno', buscar, busca));
      if (!contas.length) raiz.append(elemento('p', 'Nenhum profissional cadastrado.'));
      for (const c of contas) {
        const perfil = bloco(c.nome, elemento('p', [papeis[c.role], c.email, c.profissional_ativo ? 'Ativo' : 'Inativo'].join(' · ')));
        perfil.append(formulario([
          campo('nome', 'Nome', 'text', c.nome), campo('senha', 'Nova senha (opcional)', 'password', '', true),
          escolha('ativo', 'Status', [['true', 'Ativo'], ['false', 'Inativo']], String(c.profissional_ativo)),
        ], 'Salvar conta', async d => {
          await salvar('/contas/' + c.id, { nome: d.nome, ativo: d.ativo === 'true', ...(d.senha && { senha: d.senha }) }, 'PATCH');
          await carregar();
        }));
        if (c.role !== 'recepcao') {
          const statusVinculo = elemento('p');
          statusVinculo.setAttribute('role', 'status');
          perfil.append(formulario([campo('aluno_id', 'ID do aluno')], 'Vincular aluno', async d => {
            await salvar('/contas/' + c.id + '/alunos/' + encodeURIComponent(d.aluno_id), {}, 'PUT');
            await carregar();
          }), statusVinculo);
          for (const { aluno } of c.vinculos_profissional) {
            const linha = elemento('p', aluno.nome + ' ');
            linha.append(acao('Remover vínculo', async e => {
              e.target.disabled = true;
              try {
                await api(base + '/contas/' + c.id + '/alunos/' + aluno.id, { method: 'DELETE' });
                await carregar();
              } catch (erro) {
                statusVinculo.textContent = erro.message;
                e.target.disabled = false;
              }
            }));
            perfil.append(linha);
          }
        }
        raiz.append(perfil);
      }
    } catch (e) {
      if (ativo) raiz.replaceChildren(elemento('p', e.message), acao('Tentar novamente', carregar));
    }
  }
  carregar();
  return () => { ativo = false; };
}
