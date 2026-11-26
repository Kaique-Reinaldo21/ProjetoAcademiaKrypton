import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { diagnosticarInicializacao } from '../lib/diagnostico-inicializacao.js';

export default async function authMiddleware(req, res, next) {
  const authorization = req.get('Authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : req.cookies?.token;
  if (!token) return res.status(401).json({ erro: 'Acesso negado. Faça login.' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ erro: 'Sessão inválida ou expirada. Faça login novamente.' });
  }
  if (!Number.isSafeInteger(payload?.id)) return res.sendStatus(401);

  let usuario;
  try {
    usuario = await prisma.usuarios.findUnique({
      where: { id: payload.id },
      select: { id: true, nome: true, email: true, role: true, versao_sessao: true, senha_redefinicao_obrigatoria: true },
    });
  } catch (erro) {
    console.error('Falha na consulta de sessão:', diagnosticarInicializacao(erro));
    return res.status(503).json({ erro: 'Serviço de autenticação indisponível.' });
  }
  // JWTs emitidos antes da migration têm implicitamente versão zero.
  if (!usuario || usuario.senha_redefinicao_obrigatoria || usuario.versao_sessao !== (payload.versao_sessao ?? 0)) {
    return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
  }
  req.usuario = usuario;
  return next();
}
