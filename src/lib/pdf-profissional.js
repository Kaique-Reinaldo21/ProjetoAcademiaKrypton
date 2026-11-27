function textoSeguro(valor) {
  return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapar(valor) { return textoSeguro(valor).replace(/[\\()]/g, '\\$&'); }

function quebrar(texto, limite = 88) {
  const palavras = textoSeguro(texto).split(' ');
  const linhas = [];
  let linha = '';
  for (const palavra of palavras) {
    if (linha && linha.length + palavra.length + 1 > limite) { linhas.push(linha); linha = ''; }
    linha += (linha ? ' ' : '') + palavra;
  }
  if (linha) linhas.push(linha);
  return linhas.length ? linhas : [''];
}

export function gerarPdfProfissional(ficha) {
  const linhas = [
    'KRYPTON ACADEMIA - DOCUMENTO PROFISSIONAL',
    ficha.tipo === 'personal' ? 'FICHA DE TREINO' : 'PLANO ALIMENTAR',
    '', `Titulo: ${ficha.titulo}`, `Aluno: ${ficha.aluno.nome}`, `Profissional: ${ficha.profissional.nome}`,
    '', ...quebrar('Orientacoes gerais: ' + (ficha.orientacoes || 'Nenhuma orientacao geral informada.')),
  ];
  for (const [indice, item] of ficha.itens.entries()) {
    linhas.push('', `${indice + 1}. ${ficha.tipo === 'personal' ? item.divisao + ' - ' + item.nome : item.refeicao + ' - ' + item.horario}`);
    const detalhes = ficha.tipo === 'personal'
      ? [`Series: ${item.series}`, `Repeticoes: ${item.repeticoes}`, `Carga: ${item.carga || 'nao informada'}`,
        `Descanso: ${item.descanso || 'nao informado'}`, `Orientacoes: ${item.orientacoes || 'nenhuma'}`]
      : [`Alimentos: ${item.alimentos}`, `Quantidades: ${item.quantidades}`, `Orientacoes: ${item.orientacoes || 'nenhuma'}`];
    for (const detalhe of detalhes) linhas.push(...quebrar(detalhe));
  }

  const porPagina = 48;
  const paginas = [];
  for (let i = 0; i < linhas.length; i += porPagina) paginas.push(linhas.slice(i, i + porPagina));
  const objetos = [];
  objetos[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objetos[2] = `<< /Type /Pages /Kids [${paginas.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${paginas.length} >>`;
  objetos[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  paginas.forEach((conteudo, indice) => {
    const paginaId = 4 + indice * 2;
    const streamId = paginaId + 1;
    const comandos = ['BT', '/F1 10 Tf', '50 790 Td', '14 TL', ...conteudo.flatMap((linha, pos) => [
      `(${escapar(linha)}) Tj`, ...(pos < conteudo.length - 1 ? ['T*'] : []),
    ]), 'ET'].join('\n');
    objetos[paginaId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`;
    objetos[streamId] = `<< /Length ${Buffer.byteLength(comandos, 'ascii')} >>\nstream\n${comandos}\nendstream`;
  });
  const partes = ['%PDF-1.4\n'];
  const offsets = [0];
  let tamanho = Buffer.byteLength(partes[0], 'ascii');
  for (let id = 1; id < objetos.length; id++) {
    offsets[id] = tamanho;
    const parte = `${id} 0 obj\n${objetos[id]}\nendobj\n`;
    partes.push(parte);
    tamanho += Buffer.byteLength(parte, 'ascii');
  }
  const xref = tamanho;
  partes.push(`xref\n0 ${objetos.length}\n0000000000 65535 f \n`);
  for (let id = 1; id < objetos.length; id++) partes.push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  partes.push(`trailer\n<< /Size ${objetos.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return Buffer.from(partes.join(''), 'ascii');
}

export function validarPdf(buffer, limite = 5 * 1024 * 1024) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 32 || buffer.length > limite) return false;
  if (!/^%PDF-1\.[0-7]/.test(buffer.subarray(0, 8).toString('ascii'))) return false;
  const fim = buffer.subarray(Math.max(0, buffer.length - 2048)).toString('latin1');
  const conteudo = buffer.toString('latin1');
  if (/\/(?:JavaScript|JS|Launch|EmbeddedFile|RichMedia|OpenAction|AA)\b/.test(conteudo)) return false;
  const marcador = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(fim);
  if (!marcador) return false;
  const xref = Number(marcador[1]);
  if (!Number.isSafeInteger(xref) || xref < 8 || xref >= buffer.length) return false;
  const inicio = buffer.subarray(xref, Math.min(buffer.length, xref + 80)).toString('latin1');
  return /^xref(?:\s|$)/.test(inicio) || /^\d+\s+\d+\s+obj\b/.test(inicio);
}
