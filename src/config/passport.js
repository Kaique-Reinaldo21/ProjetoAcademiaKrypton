import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from '../lib/prisma.js'; // Utiliza a conexão centralizada que você já possui

const googleConfigurado =
    Boolean(process.env.GOOGLE_CLIENT_ID) &&
    Boolean(process.env.GOOGLE_CLIENT_SECRET);

if (googleConfigurado) {
    passport.use(
        new GoogleStrategy({
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/api/auth/google/callback",
        }, async (accessToken, refreshToken, profile, done) => {
            try {
                // 1 - Extrai os dados (e-mail e nome) que vieram do Google
                const email = profile.emails?.[0]?.value;
                const nome = profile.displayName;

                if (!email) {
                    return done(new Error("A conta Google não forneceu um e-mail."), null);
                }

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
                            role: 'aluno',
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
} else {
    console.warn("⚠ Google OAuth não configurado no .env. Login Google desativado neste ambiente.");
}

// Salva o ID do usuário na sessão após o login
passport.serializeUser((user, done) => {
    done(null, Number(user.id)); 
});
    
// Recupera as informações completas do usuário a partir do ID salvo na sessão
passport.deserializeUser(async (id, done) => {
    try {
        const usuario = await prisma.usuarios.findUnique({
            where: { id: Number(id) }
        });
        done(null, usuario);
    } catch (error) {
        done(error, null);
    }
});
