import 'dotenv/config';
import { constants, openSync, fstatSync, readFileSync, closeSync } from 'node:fs';
import { validarModoDemo, validarArquivoCaDemo } from '../src/config/demo-db.js';
import { exigeModoAcademico, DESTINO_ACADEMICO_OFICIAL } from '../src/config/demo-hosts.js';
import { gerarHashSenha } from '../src/services/politica-senha.js';

const contas = {
  admin: 'Administração', recepcao: 'Recepção', personal: 'Personal',
  nutricionista: 'Nutrição', aluno: 'Aluno Elite',
};
const marca = 'demo_academico_provisionado';
const email = role => 'krypton.demo.' + role + '@example.invalid';
const nome = role => 'Demonstração Krypton · ' + contas[role];

function validarDestino(env) {
  if (env.KRYPTON_PROVISIONAR_DEMO !== 'CONFIRMO_DADOS_FICTICIOS') throw new Error('SEM_AUTORIZACAO');
  if (env.NODE_ENV === 'production') {
    if (env.KRYPTON_PROVISIONAR_HOSPEDADO !== 'CONFIRMO_RENDER_OFICIAL' ||
        env.DEMO_DEPLOYMENT !== 'academico_oficial' || env.RENDER_EXTERNAL_HOSTNAME !== DESTINO_ACADEMICO_OFICIAL.render) {
      throw new Error('HOSPEDADO_NAO_AUTORIZADO');
    }
    validarModoDemo(env);
    validarArquivoCaDemo(env);
    return;
  }
  if (exigeModoAcademico(env) || env.RENDER || env.NODE_ENV !== 'development') throw new Error('DESTINO_NAO_AUTORIZADO');
  validarModoDemo({ ...env, PAYMENT_MODE: 'demo' });
}

function lerSenhas(arquivo) {
  if (!arquivo) throw new Error('ARQUIVO_OBRIGATORIO');
  const fd = openSync(arquivo, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0 || stat.size > 4096) {
      throw new Error('ARQUIVO_INSEGURO');
    }
    const senhas = JSON.parse(readFileSync(fd, 'utf8'));
    if (!senhas || typeof senhas !== 'object' || Object.keys(senhas).length !== Object.keys(contas).length) throw new Error('SENHAS_INVALIDAS');
    const valores = Object.keys(contas).map(role => senhas[role]);
    if (new Set(valores).size !== valores.length || valores.some(s => typeof s !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(s))) {
      throw new Error('SENHAS_INVALIDAS');
    }
    return senhas;
  } finally {
    closeSync(fd);
  }
}

async function provisionar(prisma, senhas) {
  const hashes = {};
  for (const role of Object.keys(contas)) hashes[role] = await gerarHashSenha(senhas[role]);

  return prisma.$transaction(async tx => {
    const ids = {};
    const unidade = await tx.unidades.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
    if (!unidade) throw new Error('UNIDADE_OBRIGATORIA');
    for (const role of Object.keys(contas)) {
      let usuario = await tx.usuarios.findUnique({ where: { email: email(role) }, select: { id: true, role: true, nome: true } });
      if (usuario) {
        const auditoria = await tx.auditoria_contas.findFirst({ where: { usuario_id: usuario.id, evento: marca }, select: { id: true } });
        if (!auditoria || usuario.role !== role || usuario.nome !== nome(role)) throw new Error('IDENTIDADE_RESERVADA_OCUPADA');
      } else {
        usuario = await tx.usuarios.create({
          data: { nome: nome(role), email: email(role), role, senha_hash: hashes[role] }, select: { id: true },
        });
        await tx.auditoria_contas.create({ data: { usuario_id: usuario.id, evento: marca } });
      }
      ids[role] = usuario.id;
    }

    const plano = await tx.planos.findFirst({ where: { usuario_id: ids.aluno, ativo: true }, select: { id: true, tipo: true } });
    if (plano && plano.tipo !== 'elite') throw new Error('PLANO_FIXTURE_INCOMPATIVEL');
    if (!plano) await tx.planos.create({
      data: { usuario_id: ids.aluno, tipo: 'elite', vencimento: new Date(Date.now() + 30 * 86400000) },
    });

    const materiais = {
      personal: { titulo: 'Demonstração · Treino A', itens: [{ divisao: 'A', nome: 'Agachamento', series: 3, repeticoes: '10', carga: 'Livre', descanso: '60 s' }] },
      nutricionista: { titulo: 'Demonstração · Plano alimentar', itens: [{ refeicao: 'Almoço', horario: '12:00', alimentos: 'Arroz e feijão', quantidades: 'Porções fictícias' }] },
    };
    let indice = 0;
    for (const [tipo, material] of Object.entries(materiais)) {
      const vinculo = { aluno_id: ids.aluno, profissional_id: ids[tipo] };
      await tx.vinculos_profissionais.createMany({ data: [vinculo], skipDuplicates: true });
      if (!await tx.fichas_profissionais.findFirst({ where: { ...vinculo, tipo, titulo: material.titulo }, select: { id: true } })) {
        await tx.fichas_profissionais.create({ data: { ...vinculo, tipo, ...material } });
      }
      const observacao = 'Demonstração acadêmica · consulta ' + tipo;
      if (!await tx.agendamentos.findFirst({ where: { usuario_id: ids.aluno, profissional_id: ids[tipo], observacao }, select: { id: true } })) {
        const data_hora = new Date(Date.now() + 86400000);
        data_hora.setUTCHours(15 + indice, 0, 0, 0);
        await tx.agendamentos.create({ data: { usuario_id: ids.aluno, profissional_id: ids[tipo], unidade_id: unidade.id, tipo,
          data_hora, observacao, vaga: ids[tipo] + ':' + data_hora.toISOString() } });
      }
      indice++;
    }
    return Object.keys(ids).length;
  }, { isolationLevel: 'Serializable', timeout: 15000 });
}

let prisma;
try {
  validarDestino(process.env);
  const senhas = lerSenhas(process.argv[2]);
  ({ default: prisma } = await import('../src/lib/prisma.js'));
  const total = await provisionar(prisma, senhas);
  console.log('Demonstração acadêmica preparada. Perfis:', total);
} catch (erro) {
  const permitido = new Set([
    'SEM_AUTORIZACAO','HOSPEDADO_NAO_AUTORIZADO','DESTINO_NAO_AUTORIZADO','ARQUIVO_OBRIGATORIO','ARQUIVO_INSEGURO',
    'SENHAS_INVALIDAS','UNIDADE_OBRIGATORIA','IDENTIDADE_RESERVADA_OCUPADA','PLANO_FIXTURE_INCOMPATIVEL',
  ]);
  console.error('Provisionamento recusado:', permitido.has(erro.message) ? erro.message : erro.codigoConfiguracao || 'VERIFIQUE_DESTINO_E_CONFIGURACAO');
  process.exitCode = 1;
} finally {
  await prisma?.$disconnect();
}
