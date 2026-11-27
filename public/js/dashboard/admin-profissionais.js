import { elemento } from './design-system.js';
import { acao, base, bloco, campo, escolha, formulario, ler, papeis, salvar } from './profissionais-views.js';
import { api } from './aluno-dados.js';

export function gerirProfissionais(raiz) {
  let ativo = true;
  const avisosVinculos = new Map();
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
          statusVinculo.textContent = avisosVinculos.get(c.id) || '';
          avisosVinculos.delete(c.id);
          const busca = elemento('input', null, 'kd-input');
          busca.type = 'search'; busca.placeholder = 'Digite o nome do aluno'; busca.setAttribute('aria-label', 'Pesquisar aluno para vincular');
          const seletor = elemento('select', null, 'kd-input');
          seletor.setAttribute('aria-label', 'Selecionar aluno');
          seletor.append(new Option('Pesquise e selecione um aluno', ''));
          const vincular = acao('Vincular aluno selecionado', async botao => {
            const alunoId = seletor.value;
            if (!alunoId) { statusVinculo.textContent = 'Selecione um aluno pelos resultados da pesquisa.'; return; }
            botao.target.disabled = true;
            try {
              const resultado = await salvar('/contas/' + c.id + '/alunos/' + encodeURIComponent(alunoId), {}, 'PUT');
              avisosVinculos.set(c.id, resultado.existente ? 'Este vínculo já estava ativo.' : 'Aluno vinculado com sucesso.');
              await carregar();
            } catch (falha) { statusVinculo.textContent = falha.message; botao.target.disabled = false; }
          });
          vincular.setAttribute('aria-label', 'Vincular aluno selecionado ao profissional');
          const resultados = elemento('div');
          let timer;
          busca.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(async () => {
              const termo = busca.value.trim();
              seletor.replaceChildren(new Option(termo ? 'Carregando resultados…' : 'Pesquise e selecione um aluno', ''));
              if (!termo) return;
              try {
                const alunos = await ler('/alunos?busca=' + encodeURIComponent(termo));
                seletor.replaceChildren(new Option(alunos.length ? 'Selecione um aluno' : 'Nenhum aluno encontrado', ''));
                for (const aluno of alunos) seletor.append(new Option(aluno.nome, aluno.id));
              } catch (falha) { statusVinculo.textContent = falha.message; }
            }, 250);
          });
          const existentes = c.vinculos_profissional.map(({ aluno }) => {
            const linha = elemento('p', aluno.nome, 'kd-vinculo-existente');
            linha.append(acao('Remover vínculo', async botao => {
              botao.target.disabled = true;
              try { await api(base + '/contas/' + c.id + '/alunos/' + aluno.id, { method: 'DELETE' }); avisosVinculos.set(c.id, 'Vínculo removido.'); await carregar(); }
              catch (falha) { statusVinculo.textContent = falha.message; botao.target.disabled = false; }
            }));
            return linha;
          });
          resultados.append(...(existentes.length ? existentes : [elemento('p', 'Nenhum aluno vinculado.') ]));
          perfil.append(bloco('Vínculos com alunos', busca, seletor, vincular, statusVinculo, resultados));
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
