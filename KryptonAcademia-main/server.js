// server.js — ponto de entrada do servidor Express

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const { inicializarBanco } = require('./db/database');
const authRoutes    = require('./routes/auth');
const usuarioRoutes = require('./routes/usuario');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middlewares globais ──────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? 'https://academiakripton.com.br'
    : 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Rotas da API ─────────────────────────────────────────────────────────────

app.use('/api/auth',    authRoutes);
app.use('/api/usuario', usuarioRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Tratamento global de erros ───────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

// ─── Start: conecta ao MySQL antes de abrir o servidor ───────────────────────

inicializarBanco()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Academia Kripton → http://localhost:${PORT}`);
      console.log(`   Ambiente : ${process.env.NODE_ENV}`);
      console.log(`   Banco    : ${process.env.DB_NAME}@${process.env.DB_HOST}\n`);
    });
  })
  .catch(err => {
    console.error('❌ Falha ao conectar no MySQL:', err.message);
    console.error('   Verifique as variáveis DB_* no seu .env');
    process.exit(1);
  });
