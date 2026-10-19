import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from '../lib/prisma.js';

// Verifica se as credenciais do Google existem no .env
const googleConfigurado =
  Boolean(process.env.GOOGLE_CLIENT_ID) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET);

if (googleConfigurado) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,

        // Mantém a rota usada originalmente pelo grupo.
        // Se GOOGLE_CALLBACK_URL existir no .env, ela terá prioridade.
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL ||
          'http://localhost:3000/auth/google/callback',
      },

      async (
        accessToken,
        refreshToken,
        profile,
        done
      ) => {
        try {
          // 1 - Extrai os dados que vieram do Google
          const email =
            profile.emails?.[0]?.value;

          const nome =
            profile.displayName;

          if (!email) {
            return done(
              new Error(
                'A conta Google não forneceu um e-mail.'
              ),
              null
            );
          }

          // 2 - Verifica se o usuário já existe no banco
          let usuario =
            await prisma.usuarios.findUnique({
              where: {
                email: email,
              },
            });

          // 3 - Se não existir, cria um novo registro
          if (!usuario) {
            usuario =
              await prisma.usuarios.create({
                data: {
                  nome: nome,
                  email: email,

                  // Usuário Google não possui senha
                  // tradicional neste momento
                  senha_hash: '',

                  // Valor temporário do MVP,
                  // pois o Google não fornece
                  // data de nascimento por padrão
                  data_nascimento:
                    new Date('2000-01-01'),
                },
              });

            console.log(
              'Novo aluno criado via Google:',
              usuario.email
            );
          } else {
            console.log(
              'Aluno já existente:',
              usuario.email
            );
          }

          // 4 - Devolve o usuário encontrado ou criado
          // para a sessão do Passport
          return done(null, usuario);
        } catch (error) {
          console.error(
            'Erro ao autenticar com o Google:',
            error
          );

          return done(error, null);
        }
      }
    )
  );
} else {
  // Sem GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET,
  // o restante da aplicação continua funcionando.
  console.warn(
    '⚠ Google OAuth não configurado. Login Google desativado neste ambiente.'
  );
}

// Guarda apenas o ID do usuário na sessão
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Recupera o usuário a partir do ID salvo na sessão
passport.deserializeUser(
  async (id, done) => {
    try {
      const usuario =
        await prisma.usuarios.findUnique({
          where: {
            id: id,
          },
        });

      done(null, usuario);
    } catch (error) {
      done(error, null);
    }
  }
);