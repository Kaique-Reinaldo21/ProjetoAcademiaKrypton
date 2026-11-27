import { PrismaClient } from '@prisma/client';
import { datasourcePoolDemo, validarModoDemo } from '../config/demo-db.js';
import { exigeModoOficial } from '../config/demo-hosts.js';

const datasourceUrl = datasourcePoolDemo();
if (!datasourceUrl && exigeModoOficial(process.env)) validarModoDemo();
const prisma = new PrismaClient(datasourceUrl ? { datasourceUrl } : undefined);

export default prisma;
