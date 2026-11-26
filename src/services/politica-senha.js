import bcrypt from 'bcryptjs';

export function senhaCabeNoBcrypt(senha) {
  return typeof senha === 'string' && Buffer.byteLength(senha, 'utf8') <= 72;
}

export function erroNovaSenha(senha, confirmacao = senha) {
  if (typeof senha !== 'string' || [...senha].length < 12) return 'Use pelo menos 12 caracteres.';
  if (!senhaCabeNoBcrypt(senha)) return 'A senha pode ter até 72 bytes em UTF-8.';
  if (senha !== confirmacao) return 'As senhas precisam ser iguais.';
  return null;
}

export function gerarHashSenha(senha) {
  return bcrypt.hash(senha, 12);
}

export function conferirSenha(senha, hash) {
  return senhaCabeNoBcrypt(senha) && hash ? bcrypt.compare(senha, hash) : false;
}
