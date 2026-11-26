import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { obterCallbackGoogle } from './google-oauth-config.js';

export function configurarGoogle(instancia, env, endpoints = {}) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return false;
  instancia.use(new GoogleStrategy({
    tokenURL: 'https://oauth2.googleapis.com/token',
    userProfileURL: 'https://openidconnect.googleapis.com/v1/userinfo',
    ...endpoints,
    clientID: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackURL: obterCallbackGoogle(env),
  }, (_accessToken, _refreshToken, perfil, done) => done(null, perfil)));
  return true;
}

export const googleConfigurado = configurarGoogle(passport, process.env);
