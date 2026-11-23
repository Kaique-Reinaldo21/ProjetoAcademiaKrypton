// Diagnostico local: verifica configuracoes sem exibir credenciais.
import 'dotenv/config';

const obrigatorias = ['DATABASE_URL', 'JWT_SECRET', 'SESSION_SECRET'];
const faltando = obrigatorias.filter((nome) => !process.env[nome]?.trim());

let banco = 'nao configurado';
let urlValida = false;
let tipoBanco = 'desconhecido';
const valor = process.env.DATABASE_URL;
if (valor) {
  try {
    const url = new URL(valor);
    urlValida = url.protocol === 'mysql:';
    const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    const local = ['localhost', '127.0.0.1', '::1'].includes(host);
    tipoBanco = local ? 'local' : 'remoto';
    banco = urlValida ? tipoBanco : 'protocolo invalido (esperado mysql://)';
  } catch {
    banco = 'URL invalida';
  }
}

console.log('Academia Krypton | verificacao do ambiente');
console.log('NODE_ENV:', process.env.NODE_ENV || '(nao definido)');
console.log('MySQL:', banco);
console.log('Variaveis obrigatorias:', faltando.length ? 'faltando: ' + faltando.join(', ') : 'presentes');
console.log('Google OAuth:', process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? 'configurado' : 'opcional/nao configurado');
console.log('Mercado Pago:', process.env.mercado_pago_access_token ? 'configurado (validar ambiente de teste)' : 'opcional/nao configurado');
console.log('Este comando nao acessa o banco e nao exibe senhas.');

if (!urlValida || faltando.length) {
  console.error('Configuracao incompleta: revise o .env antes de iniciar.');
  process.exitCode = 1;
}
