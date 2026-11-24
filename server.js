// server.js — ponto de entrada do servidor Express

import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from 'passport';

import { createHmac, timingSafeEqual } from 'node:crypto';
import path from 'path';
import { fileURLToPath } from 'url';

import prisma from './src/lib/prisma.js';

// Rotas organizadas no src
import authRoutes from './src/routes/auth.routes.js';
import usuarioRoutes from './src/routes/usuario.routes.js';
import adminRoutes from './src/routes/admin.routes.js';
import publicRoutes from './src/routes/public.routes.js';
import checkoutRoutes from './src/routes/checkout.routes.js';


// Configuração do Passport / Google OAuth
import './src/config/passport.js';


// rota middleware 
import { authMiddleware as isAuthenticated } from './src/middleware/authMiddleware.js';


// Rota de Assinatura - Mercado Pago
import { consultarFatura } from './src/gatewary/mercadopago.js';
import { confirmarCheckoutPorAssinatura } from './src/services/checkout.service.js';
import { validarModoDemo } from './src/services/checkout-demo.service.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
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
  secret: process.env.SESSION_SECRET || 'chave-secreta-padrao-dev',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
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
// Checkout autenticado — nunca usar IDs de usuários fictícios.
// ─────────────────────────────────────────
app.use('/api/checkout', checkoutRoutes);

// Retorno do navegador: consulta o provedor; não considera a query como prova de pagamento.
app.get('/checkout/success', async (req, res) => {
  if (process.env.PAYMENT_MODE === 'demo') return res.redirect('/dashboard.html');
  try {
    const id = req.query.preapproval_id;
    if (typeof id !== 'string') return res.redirect('/dashboard.html?pagamento=pendente');
    const resultado = await confirmarCheckoutPorAssinatura(id);
    const situacao = resultado.status === 'confirmado' ? 'aprovado' : 'pendente';
    return res.redirect('/dashboard.html?pagamento=' + situacao);
  } catch (error) {
    console.error('Erro no retorno do pagamento:', error);
    return res.redirect('/dashboard.html?pagamento=pendente');
  }
});

function validarAssinaturaWebhook(req) {
  const segredo = process.env.MP_WEBHOOK_SECRET;
  const header = req.get('x-signature') || '';
  const requestId = req.get('x-request-id') || '';
  const dataId = String(req.query['data.id'] || req.body?.data?.id || '');
  if (!segredo || !requestId || !dataId) return false;
  const partes = Object.fromEntries(header.split(',').map(parte => parte.trim().split('=')));
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!/^\d{10,13}$/.test(ts || '') || !/^[a-f0-9]{64}$/i.test(v1 || '')) return false;
  const instante = Number(ts) > 1e12 ? Number(ts) / 1000 : Number(ts);
  if (Math.abs(Date.now() / 1000 - instante) > 300) return false;
  const manifesto = 'id:' + dataId.toLowerCase() + ';request-id:' + requestId + ';ts:' + ts + ';';
  const esperado = createHmac('sha256', segredo).update(manifesto).digest('hex');
  return timingSafeEqual(Buffer.from(esperado, 'hex'), Buffer.from(v1, 'hex'));
}

// Webhook assinado: o payload é somente uma indicação para consultar a API do Mercado Pago.
app.post('/api/webhooks/mercadopago', async (req, res) => {
  if (process.env.PAYMENT_MODE === 'demo') return res.sendStatus(404);
  if (!validarAssinaturaWebhook(req)) return res.sendStatus(401);
  try {
    const tipo = req.body?.type || req.query.type || req.body?.topic;
    const id = String(req.body?.data?.id || req.query['data.id'] || '');
    if (tipo === 'subscription_preapproval') {
      await confirmarCheckoutPorAssinatura(id);
    } else if (tipo === 'subscription_authorized_payment') {
      const fatura = await consultarFatura(id);
      if (fatura.preapproval_id) {
        await confirmarCheckoutPorAssinatura(String(fatura.preapproval_id));
      }
    }
    return res.sendStatus(200);
  } catch (error) {
    console.error('Erro ao processar webhook Mercado Pago:', error);
    return res.sendStatus(500);
  }
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
// Google OAuth - atalhos para /api/auth/google
// ─────────────────────────────────────────

app.get('/auth/google', (req, res) => {
  res.redirect('/api/auth/google');
});

app.get(['/auth/google/callback', '/auth/callback/google'], (req, res) => {
  const query = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  res.redirect('/api/auth/google/callback' + query);
});

// ─────────────────────────────────────────
// Rotas da API
// ─────────────────────────────────────────

app.use('/api/auth', authRoutes);

app.use('/api/usuario', usuarioRoutes);

app.use('/api/admin', adminRoutes);


// Unidades públicas (rota pública)
app.use('/api', publicRoutes);



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
    if (process.env.PAYMENT_MODE === 'demo') validarModoDemo();
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
