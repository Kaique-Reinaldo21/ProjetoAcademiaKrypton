// Carregado antes dos testes unitários: nenhuma credencial herdada ou do .env é usada.
import net from 'node:net';
import tls from 'node:tls';
process.env.DATABASE_URL = 'mysql://teste:teste@127.0.0.1:1/testes_sem_banco';
process.env.mercado_pago_access_token = 'token-ficticio-de-teste';
process.env.NODE_ENV = 'test';
process.env.PAYMENT_MODE = 'real';
const bloquear = () => { throw new Error('Rede bloqueada nos testes unitários'); };
net.connect = bloquear;
net.createConnection = bloquear;
net.Socket.prototype.connect = bloquear;
tls.connect = bloquear;
globalThis.fetch = async () => { throw new Error('Rede bloqueada nos testes unitários'); };
