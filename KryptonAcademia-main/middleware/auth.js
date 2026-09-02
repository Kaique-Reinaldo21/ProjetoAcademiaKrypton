// valida o JWT em rotas protegidas
const jwt = require('jsonwebtoken');

/*
 * Middleware que protege rotas.
 * Procura o token em dois lugares (ordem de prioridade):
 *   1. Header "Authorization: Bearer <token>"
 *   2. Cookie httpOnly chamado "token"
 *
 * Se válido, injeta req.usuario = { id, nome, email }
 * Se inválido/ausente, retorna 401.
*/
function authMiddleware(req, res, next) {
  let token = null;

  // 1. Tenta o header Authorization
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // 2. Fallback: cookie httpOnly (Proteção da Autenticação)
  if (!token && req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ erro: 'Acesso negado. Faça login.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload; // { id, nome, email, iat, exp }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
    }
    return res.status(401).json({ erro: 'Token inválido.' });
  }
}

module.exports = authMiddleware;
