import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { bootstrapDatabase } from './database.bootstrap';
import { resolveDatabasePath } from './database.path';

const dbPath = resolveDatabasePath();
bootstrapDatabase();
const adapter = new PrismaBetterSqlite3({ url: dbPath });

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    adapter,
    log: ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
