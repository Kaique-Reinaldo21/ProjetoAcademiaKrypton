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
  // Aceita deliberadamente apenas o formato PDF simples emitido pelo Krypton.
  // Esse subconjunto não tem ações, anexos, filtros, objetos compactados, links,
  // formulários ou atualizações incrementais que uma busca por palavras não vê.
  const pdf = buffer.toString('latin1');
  if (!pdf.startsWith('%PDF-1.4\n') || /[^\x0a\x20-\x7e]/.test(pdf)) return false;
  const xref = pdf.lastIndexOf('xref\n0 ');
  if (xref < 0) return false;
  const fim = /^xref\n0 (\d+)\n0000000000 65535 f \n((?:\d{10} 00000 n \n)+)trailer\n<< \/Size (\d+) \/Root 1 0 R >>\nstartxref\n(\d+)\n%%EOF\n$/.exec(pdf.slice(xref));
  if (!fim || Number(fim[1]) !== Number(fim[3]) || Number(fim[4]) !== xref) return false;
  const tamanho = Number(fim[1]);
  const entradas = fim[2].trimEnd().split('\n');
  if (!Number.isSafeInteger(tamanho) || tamanho < 6 || entradas.length !== tamanho - 1) return false;
  const offsets = [0, ...entradas.map(linha => Number(linha.slice(0, 10)))];
  if (offsets.some((offset, indice) => !Number.isSafeInteger(offset) || offset < 0 || offset >= xref || (indice && offset <= offsets[indice - 1]))) return false;
  const objetos = [];
  for (let id = 1; id < tamanho; id++) {
    const inicio = offsets[id];
    if (!pdf.startsWith(`${id} 0 obj\n`, inicio)) return false;
    const fimObjeto = pdf.indexOf('\nendobj\n', inicio);
    if (fimObjeto < 0 || fimObjeto >= xref) return false;
    objetos[id] = pdf.slice(inicio + `${id} 0 obj\n`.length, fimObjeto);
    if (id < tamanho - 1 && offsets[id + 1] !== fimObjeto + '\nendobj\n'.length) return false;
  }
  const ultimoId = tamanho - 1;
  if (offsets[1] !== '%PDF-1.4\n'.length || offsets[ultimoId] + `${ultimoId} 0 obj\n`.length + objetos[ultimoId].length + '\nendobj\n'.length !== xref) return false;
  if (objetos[1] !== '<< /Type /Catalog /Pages 2 0 R >>' || objetos[3] !== '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>') return false;
  const pages = Number(/\/Count (\d+) >>$/.exec(objetos[2] || '')?.[1]);
  if (!Number.isSafeInteger(pages) || pages < 1 || tamanho !== 4 + pages * 2) return false;
  const kids = Array.from({ length: pages }, (_, i) => `${4 + i * 2} 0 R`).join(' ');
  if (objetos[2] !== `<< /Type /Pages /Kids [${kids}] /Count ${pages} >>`) return false;
  for (let pagina = 0; pagina < pages; pagina++) {
    const pageId = 4 + pagina * 2;
    const streamId = pageId + 1;
    if (objetos[pageId] !== `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`) return false;
    const streamMatch = /^<< \/Length (\d+) >>\nstream\n([\s\S]*)\nendstream$/.exec(objetos[streamId] || '');
    if (!streamMatch || Number(streamMatch[1]) !== Buffer.byteLength(streamMatch[2], 'ascii')) return false;
    const comandos = streamMatch[2].split('\n');
    if (comandos.length < 6 || comandos[0] !== 'BT' || comandos[1] !== '/F1 10 Tf' || comandos[2] !== '50 790 Td' || comandos[3] !== '14 TL' || comandos.at(-1) !== 'ET') return false;
    let indice = 4;
    while (indice < comandos.length - 1) {
      const linha = comandos[indice++];
      if (!linha.startsWith('(') || !linha.endsWith(') Tj')) return false;
      let escapado = false;
      for (let pos = 1; pos < linha.length - 4; pos++) {
        const caractere = linha[pos];
        if (escapado) { if (!['\\', '(', ')'].includes(caractere)) return false; escapado = false; }
        else if (caractere === '\\') escapado = true;
        else if (caractere === '(' || caractere === ')' || caractere.charCodeAt(0) < 0x20) return false;
      }
      if (escapado) return false;
      if (indice < comandos.length - 1) { if (comandos[indice++] !== 'T*') return false; }
    }
    if (indice !== comandos.length - 1) return false;
  }
  return true;
}
