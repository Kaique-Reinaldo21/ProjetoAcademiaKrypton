// middleware/admin.js
// Permite acesso somente para usuários administradores

function adminMiddleware(req, res, next) {
  if (!req.usuario) {
    return res.status(401).json({
      erro: 'Usuário não autenticado.'
    });
  }

  if (req.usuario.role !== 'admin') {
    return res.status(403).json({
      erro: 'Acesso negado. Apenas administradores podem acessar este recurso.'
    });
  }

  next();
}

module.exports = adminMiddleware;