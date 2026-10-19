// server.js — ponto de entrada do servidor Express

import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from 'passport';

import path from 'path';
import { fileURLToPath } from 'url';

import prisma from './src/lib/prisma.js';

// Rotas organizadas no src
import authRoutes from './src/routes/auth.routes.js';
import usuarioRoutes from './src/routes/usuario.routes.js';
import adminRoutes from './src/routes/admin.routes.js';

// Configuração do Passport / Google OAuth
import './src/config/passport.js';

// rota 
import { authMiddleware as isAuthenticated } from './src/middleware/authMiddleware.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;


// ─────────────────────────────────────────
// Middlewares globais
// ─────────────────────────────────────────

app.use(cors({
  origin:
    process.env.NODE_ENV === 'production'
      ? 'https://academiakripton.com.br'
      : 'http://localhost:3000',

  credentials: true,
}));

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(cookieParser());


// ─────────────────────────────────────────
// Sessão e Passport
// ─────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  },
}));

app.use(passport.initialize());

app.use(passport.session());


// ─────────────────────────────────────────
// Rota protegida do Dashboard
// ─────────────────────────────────────────

app.get('/dashboard', isAuthenticated, (req, res) => {
    // O req.user contém os dados do utilizador que foram buscados no banco pelo deserializeUser!
    res.json({
        mensagem: "Bem-vindo ao painel da Academia Kripton!",
        aluno: req.user 
    });
});



// ─────────────────────────────────────────
// Arquivos públicos
// ─────────────────────────────────────────

app.use(
  express.static(
    path.join(__dirname, 'public')
  )
);


// ─────────────────────────────────────────
// Rotas da API
// ─────────────────────────────────────────

app.use('/api/auth', authRoutes);

app.use('/api/usuario', usuarioRoutes);

app.use('/api/admin', adminRoutes);


// Health Check

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV,
  });
});


// ─────────────────────────────────────────
// Front-end fallback
// ─────────────────────────────────────────

app.use((req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      'public',
      'index.html'
    )
  );
});


// ─────────────────────────────────────────
// Tratamento global de erros
// ─────────────────────────────────────────

app.use((err, req, res, next) => {

  console.error(
    'Erro não tratado:',
    err
  );

  res.status(500).json({
    erro: 'Erro interno do servidor.',
  });

});


// ─────────────────────────────────────────
// Inicialização do servidor
// ─────────────────────────────────────────
async function iniciarServidor() {
  try {
    await prisma.$connect();

    app.listen(PORT, () => {
      console.log(
        `🚀 Academia Krypton → http://localhost:${PORT}`
      );

      console.log(
        `   Ambiente: ${process.env.NODE_ENV}`
      );

      console.log(
        '   Banco: MySQL via Prisma'
      );
    });
  } catch (err) {
    console.error(
      'Erro ao conectar ao banco de dados:',
      err
    );

    process.exit(1);
  }
}

iniciarServidor();