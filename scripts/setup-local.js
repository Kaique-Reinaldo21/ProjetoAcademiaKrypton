// Preparacao rapida e segura para banco de demonstracao LOCAL.
// Executa generate, migrate deploy e cadastro de unidades, nesta ordem.
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validarBancoLocal } from './local-db-guard.js';

try {
  const alvo = validarBancoLocal();
  console.log('Setup MySQL LOCAL confirmado:', alvo.host, '/', alvo.banco);
  console.log('Nao modifica banco remoto. As migrations criam/atualizam tabelas apenas no banco local indicado.');
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const prismaCli = path.join(raiz, 'node_modules', 'prisma', 'build', 'index.js');
  const seed = path.join(raiz, 'scripts', 'seed-local-unidades.js');
  for (const args of [[prismaCli, 'generate'], [prismaCli, 'migrate', 'deploy'], [seed]]) {
    // NODE_ENV e DATABASE_URL continuam sendo os do .env validado.
    const r = spawnSync(process.execPath, args, { cwd: raiz, stdio: 'inherit', env: process.env });
    if (r.error) throw r.error;
    if (r.status !== 0) throw new Error('Etapa falhou (codigo ' + (r.status ?? 'desconhecido') + '). Setup interrompido.');
  }
  console.log('Setup local concluido. Inicie com: npm run dev');
} catch (erro) {
  console.error('Setup local cancelado:', erro.message);
  process.exitCode = 1;
}
