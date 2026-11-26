import { PrismaClient } from '@prisma/client';
import { datasourcePoolDemo } from '../config/demo-db.js';

const datasourceUrl = datasourcePoolDemo();
const prisma = new PrismaClient(datasourceUrl ? { datasourceUrl } : undefined);

export default prisma;
