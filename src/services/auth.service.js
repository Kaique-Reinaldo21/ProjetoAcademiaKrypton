import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';


function gerarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      role: usuario.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  );
}


// LOGIN
export async function login(email, senha) {

  const usuario = await prisma.usuarios.findUnique({
    where: {
      email,
    },
  });

  if (!usuario) {
    throw new Error('E-mail ou senha inválidos');
  }

  const senhaValida = await bcrypt.compare(
    senha,
    usuario.senha_hash
  );

  if (!senhaValida) {
    throw new Error('E-mail ou senha inválidos');
  }

  const token = gerarToken(usuario);

  return {
    token,

    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role,
    },
  };
}


// CADASTRO
export async function cadastrar(dados) {

  const {
    nome,
    email,
    senha,
    data_nascimento,
  } = dados;

  const usuarioExistente = await prisma.usuarios.findUnique({
    where: {
      email,
    },
  });

  if (usuarioExistente) {
    throw new Error('E-mail já cadastrado');
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  const usuario = await prisma.usuarios.create({
    data: {
      nome,
      email,
      senha_hash: senhaHash,
      data_nascimento: new Date(data_nascimento),
      role: 'aluno',
    },
  });

  const token = gerarToken(usuario);

  return {
    token,

    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role,
    },
  };
}

// HISTÓRICO DE LOGIN
export async function registrarLogin(
  usuarioId,
  ip,
  userAgent
) {
  try {
    await prisma.historico_logins.create({
      data: {
        usuario_id: usuarioId,
        ip: ip || null,
        user_agent: userAgent
          ? userAgent.slice(0, 255)
          : null,
      },
    });
  } catch (error) {
    // Falha no histórico não deve impedir o usuário de entrar.
    console.error(
      'Erro ao registrar histórico de login:',
      error
    );
  }
}