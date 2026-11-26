import { diagnosticarInicializacao } from './diagnostico-inicializacao.js';

// Uma consulta desses indicadores por vez por processo, inclusive entre requisições.
let fila = Promise.resolve();
const codigosMysql = {
  '1040': 'limite_de_conexoes',
  '1203': 'limite_de_conexoes_por_usuario',
  '1226': 'limite_de_recursos_por_usuario',
  '2006': 'conexao_interrompida',
  '2013': 'conexao_perdida',
};

function diagnosticarConsulta(erro) {
  const diagnostico = diagnosticarInicializacao(erro);
  const codigoMysql = [erro?.meta?.code, erro?.cause?.errno, erro?.errno]
    .map(valor => typeof valor === 'number' ? String(valor) : valor)
    .find(valor => typeof valor === 'string' && Object.hasOwn(codigosMysql, valor));
  if (codigoMysql) return { ...diagnostico, codigoMysql, categoria: codigosMysql[codigoMysql] };
  if (diagnostico.codigo === 'P2037') return { ...diagnostico, categoria: 'limite_de_conexoes' };
  return diagnostico;
}

async function consultar(operacao, executar) {
  const resultado = fila.then(executar);
  fila = resultado.then(() => {}, () => {});
  try {
    return await resultado;
  } catch (erro) {
    console.error('Falha na consulta administrativa.', { operacao, ...diagnosticarConsulta(erro) });
    return null;
  }
}

export async function consultarCamposAdmin(prefixo, consultas) {
  const dados = {};
  for (const [campo, executar] of Object.entries(consultas)) {
    dados[campo] = await consultar(prefixo + '.' + campo, executar);
  }
  return dados;
}
