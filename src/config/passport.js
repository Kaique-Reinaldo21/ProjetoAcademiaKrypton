import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

// Configuração da estratégia do Google OAuth
passport.use(
    new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "http://localhost:3000/auth/google/callback",
    }, (accessToken, refreshToken, profile, done) => {
        // Lógica para lidar com o usuário autenticado
        return done(null, profile);
    })
);

// Como guardar o utilizador na sessão
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));