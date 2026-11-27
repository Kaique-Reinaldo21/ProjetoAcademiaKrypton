export function permitirPapeis(...papeis) {
  return (req, res, next) => {
    if (!papeis.includes(req.usuario?.role)) return res.status(403).json({ erro: 'Acesso restrito a outro perfil.' });
    next();
  };
}
