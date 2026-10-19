// Middleware para verificar se o utilizador está autenticado
export function authMiddleware(req, res, next) {
// Se o Passport autenticou o utilizador com sucesso
    if (req.isAuthenticated()){
        return next(); // Continua para a rota desejada (ex: /dashboard)
    }
    // Se o utilizador não estiver autenticado, redireciona para a página de login ou devolve o erro
    return res.status(401).json({ erro: "Acesso não autorizado. Por favor, faça login." });
    
} 