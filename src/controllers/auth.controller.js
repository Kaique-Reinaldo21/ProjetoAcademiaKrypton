import * as authService from '../services/auth.service.js';

// ─────────────────────────────────────────
// Login tradicional
// ─────────────────────────────────────────
    export async function login(req, res) {
        try {
        const { email, senha } = req.body;

        if (!email || !senha) {
        return res.status(400).json({
            erro: 'E-mail e senha são obrigatórios',
        });
        }

        const resultado = await authService.login(
        email,
        senha
        );

        await authService.registrarLogin(
          resultado.usuario.id,
          req.ip,
          req.get('user-agent')
        );

        res.cookie('token', resultado.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        });

        return res.status(200).json({
        mensagem: 'Login realizado com sucesso',

        // IMPORTANTE
        token: resultado.token,

        usuario: resultado.usuario,
        });

    } catch (error) {
        return res.status(401).json({
        erro: error.message,
        });
    }
}

// ─────────────────────────────────────────
// Cadastro
// ─────────────────────────────────────────

export async function cadastrar(req, res) {
  try {
    const {
      nome,
      email,
      senha,
      data_nascimento,
    } = req.body;

    if (!nome || !email || !senha || !data_nascimento) {
      return res.status(400).json({
        erro: 'Preencha todos os campos obrigatórios',
      });
    }

    const resultado = await authService.cadastrar({
      nome,
      email,
      senha,
      data_nascimento,
    });

    res.cookie('token', resultado.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return res.status(201).json({
      mensagem: 'Usuário cadastrado com sucesso',
      token: resultado.token,
      usuario: resultado.usuario,
    });

  } catch (error) {
    console.error(
      'Erro ao cadastrar:',
      error
    );

    return res.status(400).json({
      erro: error.message,
    });
  }
}


// ─────────────────────────────────────────
// Logout
// ─────────────────────────────────────────

export function logout(req, res, next) {
  // Remove JWT
  res.clearCookie('token');

  // Se estiver autenticado pelo Passport/Google
  if (req.isAuthenticated?.()) {
    return req.logout((error) => {
      if (error) {
        return next(error);
      }

      req.session?.destroy(() => {
        return res.status(200).json({
          mensagem: 'Logout realizado com sucesso',
        });
      });
    });
  }

  return res.status(200).json({
    mensagem: 'Logout realizado com sucesso',
  });
}


// ─────────────────────────────────────────
// Callback do Google OAuth
// ─────────────────────────────────────────

export async function googleCallback(req, res) {
  try {
    if (req.user) {
      await authService.registrarLogin(
        req.user.id,
        req.ip,
        req.get('user-agent')
      );
    }

    console.log(
      'Usuário autenticado com Google:',
      req.user
    );

    return res.redirect('/dashboard.html');

  } catch (error) {
    console.error(
      'Erro no callback do Google:',
      error
    );

    return res.redirect('/login.html');
  }
}