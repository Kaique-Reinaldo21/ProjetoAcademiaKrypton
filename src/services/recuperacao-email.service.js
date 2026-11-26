import nodemailer from 'nodemailer';

export function criarEmailRecuperacao(env = process.env) {
  const base = URL.canParse(env.CONTA_ORIGEM_PUBLICA) ? new URL(env.CONTA_ORIGEM_PUBLICA) : null;
  const local = base && env.NODE_ENV !== 'production' &&
    base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname);
  const porta = Number(env.CONTA_SMTP_PORTA || 587);
  if (!base || (base.protocol !== 'https:' && !local) ||
      base.username || base.password || base.pathname !== '/' || base.search || base.hash ||
      !env.CONTA_SMTP_HOST || !env.CONTA_SMTP_USUARIO || !env.CONTA_SMTP_SENHA ||
      !env.CONTA_EMAIL_REMETENTE || !Number.isInteger(porta) || porta < 1 || porta > 65535) {
    return null;
  }

  const smtp = nodemailer.createTransport({
    host: env.CONTA_SMTP_HOST,
    port: porta,
    secure: porta === 465,
    requireTLS: porta !== 465,
    auth: { user: env.CONTA_SMTP_USUARIO, pass: env.CONTA_SMTP_SENHA },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  });

  return async (email, token) => {
    const link = new URL('/redefinir-senha.html', base);
    link.hash = new URLSearchParams({ token }).toString();
    await smtp.sendMail({
      from: env.CONTA_EMAIL_REMETENTE,
      to: { address: email, name: '' },
      subject: 'Redefinição de senha | Academia Krypton',
      text: `Defina uma nova senha em até 15 minutos:\n${link.href}\n\nCaso não reconheça a solicitação, ignore esta mensagem.`,
    });
  };
}
