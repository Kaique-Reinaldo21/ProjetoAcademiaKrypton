import { Router } from 'express';
import auth from '../middleware/auth.js';
import { permitirPapeis } from '../middleware/papeis-profissionais.js';
import { responder } from '../controllers/perfis-profissionais.controller.js';
import { criarServicoProfissionais, ErroProfissional, id } from '../services/perfis-profissionais.service.js';
import { criarServicoNotificacoes } from '../services/notificacoes.service.js';
import { criarServicoDocumentos } from '../services/documentos-profissionais.service.js';
import { criarRotasDocumentos } from './documentos-profissionais.routes.js';

const especialidades = ['personal', 'nutricionista'];
const agenda = ['aluno', 'recepcao', ...especialidades];
const todos = ['admin', ...agenda];

export function criarRotasProfissionais({ autenticar = auth, servico = criarServicoProfissionais(), notificacoes = criarServicoNotificacoes(), documentos = criarServicoDocumentos() } = {}) {
  const router = Router();
  router.use(autenticar);
  router.get('/contas', permitirPapeis('admin'), responder(() => servico.listarProfissionais()));
  router.post('/contas', permitirPapeis('admin'), responder((_, body) => servico.criarProfissional(body), 201));
  router.patch('/contas/:id', permitirPapeis('admin'), responder((_, body, p) => servico.alterarProfissional(p.id, body)));
  router.put('/contas/:id/alunos/:aluno', permitirPapeis('admin'), responder((_, __, p) => servico.vinculo(p.id, p.aluno)));
  router.delete('/contas/:id/alunos/:aluno', permitirPapeis('admin'), responder((_, __, p) => servico.vinculo(p.id, p.aluno, true)));
  router.get('/alunos', permitirPapeis('admin', 'recepcao'), responder((_, __, ___, q) => servico.buscarAlunos(q.busca, q.vencendo === '30')));
  router.post('/recepcao/alunos', permitirPapeis('recepcao'), responder((_, body) => servico.cadastrarAlunoRecepcao(body), 201));
  router.get('/meus-alunos', permitirPapeis(...especialidades), responder(u => servico.meusAlunos(u)));
  router.get('/opcoes', permitirPapeis('aluno', 'recepcao'), responder((u, _, __, q) => servico.opcoes(u.role === 'aluno' ? u.id : id(q.aluno_id))));
  router.get('/unidades', permitirPapeis('aluno', 'recepcao'), responder(() => servico.unidades()));
  router.get('/agenda', permitirPapeis(...agenda), responder(u => servico.agenda(u)));
  router.post('/agenda', permitirPapeis('aluno', 'recepcao'), responder((u, b) => servico.agendar(u, b), 201));
  router.patch('/agenda/:id', permitirPapeis(...agenda), responder((u, b, p) => servico.atualizarAgenda(u, p.id, b)));
  router.get('/recepcao', permitirPapeis('recepcao'), responder(() => servico.resumoRecepcao()));
  router.post('/recepcao', permitirPapeis('recepcao'), responder((u, b) => servico.registrarAtendimento(u, b), 201));
  router.get('/fichas', permitirPapeis('aluno', ...especialidades), responder((u, _, __, q) => servico.listarFichas(u, q.tipo)));
  router.post('/fichas', permitirPapeis(...especialidades), responder((u, b) => servico.salvarFicha(u, b), 201));
  router.put('/fichas/:id', permitirPapeis(...especialidades), responder((u, b, p) => servico.salvarFicha(u, b, p.id)));
  router.get('/notificacoes', permitirPapeis(...todos), responder(u => notificacoes.listar(u.id)));
  router.patch('/notificacoes/lidas', permitirPapeis(...todos), responder(async u => ({ marcada: await notificacoes.marcar(u.id) })));
  router.patch('/notificacoes/:id', permitirPapeis(...todos), responder(async (u, _, p) => {
    if (!await notificacoes.marcar(u.id, id(p.id))) throw new ErroProfissional(404, 'Notificação não encontrada.');
    return { marcada: true };
  }));
  router.use('/documentos', criarRotasDocumentos({ servico: documentos }));
  return router;
}
