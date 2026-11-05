import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from '../lib/prisma.js'; // Utiliza a conexão centralizada que você já possui

passport.use(
    new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/auth/google/callback",
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            // 1 - Extrai os dados (e-mail e nome) que vieram do Google
            const email = profile.emails[0].value;
            const nome = profile.displayName;

            // 2 - Verifica se o usuário já existe no banco de dados
            let usuario = await prisma.usuarios.findUnique({
                where: { email: email }
            });

            // 3 - Se o usuário não existir, cria um novo registro
            if (!usuario) {
                usuario = await prisma.usuarios.create({
                    data: {
                        nome: nome,
                        email: email,
                        senha_hash: "", 
                        data_nascimento: new Date("2000-01-01"), 
                    }
                });
                console.log("Novo aluno criado via Google:", usuario.email);
            } else {
                console.log("Aluno já existente:", usuario.email);
            }

            // 4. Devolve o usuário para a sessão do Passport
            return done(null, usuario);

        } catch (error) {
            console.error("Erro ao autenticar com o Google:", error);
            return done(error, null);
        }
    })
);

// Salva o ID do usuário na sessão após o login
passport.serializeUser((user, done) => {
    done(null, user.id); 
});
    
// Recupera as informações completas do usuário a partir do ID salvo na sessão
passport.deserializeUser(async (id, done) => {
    try {
        const usuario = await prisma.usuarios.findUnique({
            where: { id: id }
        });
        done(null, usuario);
    } catch (error) {
        done(error, null);
    }
});