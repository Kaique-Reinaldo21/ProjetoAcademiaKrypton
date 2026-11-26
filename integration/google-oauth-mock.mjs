import express from 'express';
import cookieParser from 'cookie-parser';
import { Passport } from 'passport';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';

export async function iniciarGoogleSimulado(perfilNavegador) {
  const codigos = new Map();
  const perfis = new Map();
  const provedor = express();
  provedor.use(express.urlencoded({ extended: false }));
  let trocas = 0;
  provedor.post('/token', (req, res) => {
    const perfil = codigos.get(req.body.code);
    if (!perfil) return res.status(400).json({ error: 'invalid_grant' });
    codigos.delete(req.body.code);
    trocas++;
    const token = randomUUID();
    perfis.set(token, perfil);
    return res.json({ access_token: token, token_type: 'Bearer' });
  });
  provedor.get('/userinfo', (req, res) => {
    const perfil = perfis.get(req.get('Authorization')?.replace(/^Bearer /, '') || req.query.access_token);
    return perfil ? res.json(perfil) : res.sendStatus(401);
  });
  function autorizar(perfil) {
    const code = randomUUID();
    codigos.set(code, perfil);
    return code;
  }
  const mock = provedor.listen(0, '127.0.0.1');
  await once(mock, 'listening');
  const origemMock = 'http://127.0.0.1:' + mock.address().port;
  const app = express();
  const servidor = app.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  const origem = 'http://127.0.0.1:' + servidor.address().port;
  const callback = origem + '/api/auth/google/callback';
  Object.assign(process.env, {
    NODE_ENV: 'development', GOOGLE_CLIENT_ID: 'cliente-ficticio',
    GOOGLE_CLIENT_SECRET: 'segredo-ficticio', GOOGLE_CALLBACK_URL: callback,
  });
  const { configurarGoogle } = await import('../src/config/passport.js');
  const { criarRotasGoogle } = await import('../src/routes/google-oauth.routes.js');
  const { default: auth } = await import('../src/routes/auth.routes.js');
  const { default: admin } = await import('../src/routes/admin.routes.js');
  const passport = new Passport();
  configurarGoogle(passport, process.env, {
    authorizationURL: perfilNavegador ? origem + '/__oauth-mock/autorizar' :
      'https://accounts.google.com/o/oauth2/v2/auth',
    tokenURL: origemMock + '/token',
    userProfileURL: origemMock + '/userinfo',
  });
  if (perfilNavegador) app.get('/__oauth-mock/autorizar', (req, res) => {
    if (req.query.redirect_uri !== callback || typeof req.query.state !== 'string') return res.sendStatus(400);
    const retorno = new URL(callback);
    retorno.searchParams.set('state', req.query.state);
    retorno.searchParams.set('code', autorizar(perfilNavegador));
    return res.redirect(retorno.href);
  });
  app.use(express.json(), express.urlencoded({ extended: false }), cookieParser());
  app.use(passport.initialize());
  app.use('/api/auth', criarRotasGoogle({ autenticador: passport, habilitado: true }));
  app.use('/api/auth', auth);
  app.use('/api/admin', admin);
  app.use(express.static('public'));
  return {
    origem, callback,
    autorizar,
    get trocas() { return trocas; },
    fechar() { servidor.close(); mock.close(); },
  };
}
