import { api, dia } from './aluno-dados.js';
import { elemento, erro, estado, graficoBarras } from './design-system.js';

const dias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const nomes = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
function deslocar(data, dias) {
  const valor = new Date(data);
  valor.setUTCDate(valor.getUTCDate() + dias);
  return valor.toISOString().slice(0, 10);
}

function botao(texto, classe = '') {
  const node = elemento('button', texto, 'kd-button ' + classe);
  node.type = 'button';
  return node;
}

function consultar(semanas = 0) {
  return api('/api/usuario/treinos?semanas=' + semanas);
}

export function calendarioTreinos() {
  const area = elemento('div');
  let semanas = 0;
  async function carregar() {
    area.setAttribute('aria-busy', 'true');
    try {
      const dados = await consultar(semanas);
      const registros = new Set(dados.registros.map(item => item.dia));
      const anterior = botao('Anterior');
      const seguinte = botao('Seguinte');
      anterior.disabled = semanas === 520;
      seguinte.disabled = semanas === 0;
      for (const [controle, incremento] of [[anterior, 1], [seguinte, -1]]) {
        controle.addEventListener('click', async () => {
          anterior.disabled = seguinte.disabled = true;
          semanas += incremento;
          await carregar();
          if (area.isConnected) {
            const controles = [...area.querySelectorAll('button:not(:disabled)')];
            (controles.find(item => item.textContent === controle.textContent) || controles[0])?.focus();
          }
        });
      }
      const navegacao = elemento('div', null, 'aluno-semana-nav');
      navegacao.append(anterior, elemento('span', dia(dados.segunda).slice(0, 5) + ' – ' + dia(deslocar(dados.segunda, 6)).slice(0, 5)), seguinte);
      const lista = elemento('ul', null, 'aluno-semana');
      let total = 0;
      for (const [indice, rotulo] of dias.entries()) {
        const data = deslocar(dados.segunda, indice);
        const treinado = registros.has(data);
        const item = elemento('li', rotulo);
        item.append(elemento('strong', data.slice(8)));
        if (treinado) {
          item.dataset.concluido = '';
          total++;
        }
        if (data === dados.hoje) item.setAttribute('aria-current', 'date');
        item.setAttribute('aria-label', `${nomes[indice]}, ${dia(data)}: ${treinado ? 'treino concluído' : 'sem treino registrado'}`);
        lista.append(item);
      }
      const situacao = elemento('p', total + (total === 1 ? ' dia treinado' : ' dias treinados'), 'kd-texto-suave');
      situacao.setAttribute('role', 'status');
      area.replaceChildren(navegacao, lista, situacao);
    } catch {
      erro(area, 'Não foi possível consultar a frequência.', carregar);
    } finally {
      area.setAttribute('aria-busy', 'false');
    }
  }
  area.append(estado('Carregando frequência…'));
  carregar();
  return area;
}

export function registrarTreino() {
  const area = elemento('div');
  async function carregar(mensagem) {
    try {
      const dados = await consultar();
      const concluido = dados.registros.some(item => item.dia === dados.hoje);
      const acao = botao(concluido ? 'Desfazer registro de hoje' : 'Registrar treino concluído', concluido ? '' : 'kd-button-primario');
      const feedback = elemento('p', mensagem || '', 'kd-feedback');
      feedback.setAttribute('role', 'status');
      acao.addEventListener('click', async () => {
        acao.disabled = true;
        try {
          await api('/api/usuario/treinos/hoje', { method: concluido ? 'DELETE' : 'PUT' });
          await carregar(concluido ? 'Registro desfeito.' : 'Treino de hoje registrado.');
          area.querySelector('button')?.focus();
        } catch (falha) {
          feedback.textContent = falha.status === 403 ? 'Esta ação é exclusiva do aluno.' : 'Não foi possível salvar. Tente novamente.';
          acao.disabled = false;
        }
      });
      area.replaceChildren(elemento('p', concluido ? 'O treino de hoje está registrado.' : 'Registre o treino após concluir a sessão.', 'kd-texto-suave'), acao, feedback);
    } catch {
      erro(area, 'Não foi possível consultar o treino de hoje.', () => carregar());
    }
  }
  area.append(estado('Carregando treino…'));
  carregar();
  return area;
}

export function historicoTreinos() {
  const area = elemento('div', null, 'kd-grid');
  async function carregar() {
    area.replaceChildren(estado('Carregando histórico…'));
    try {
      const dados = await consultar();
      if (!dados.registros.length) {
        area.replaceChildren(estado('Nenhum treino nas últimas oito semanas.'));
        return;
      }
      const semanas = Array.from({ length: 8 }, (_, indice) => deslocar(dados.segunda, (indice - 7) * 7));
      const serie = semanas.map(segunda => ({
        rotulo: dia(segunda).slice(0, 5),
        valor: dados.registros.filter(item => item.dia >= segunda && item.dia < deslocar(segunda, 7)).length,
      }));
      const lista = elemento('ul', null, 'aluno-lista');
      for (const registro of dados.registros) {
        lista.append(elemento('li', dia(registro.dia) + ' · Treino concluído'));
      }
      area.replaceChildren(
        elemento('p', `${dados.registros.length} dias treinados nas últimas oito semanas.`),
        graficoBarras(serie, 'Dias treinados por semana'), elemento('h3', 'Histórico de treinos'), lista,
      );
    } catch {
      erro(area, 'Não foi possível consultar o histórico.', carregar);
    }
  }
  carregar();
  return area;
}
