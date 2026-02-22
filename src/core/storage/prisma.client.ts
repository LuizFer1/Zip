import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import Database from 'better-sqlite3';
import path from 'node:path';

function resolveDatabasePath(): string {
  const rawValue = (process.env.ZIP_DB_PATH ?? process.env.DATABASE_URL ?? '').trim();
  if (!rawValue) {
    return path.join(process.cwd(), 'zip.db');
  }

  const value = rawValue.toLowerCase().startsWith('file:')
    ? rawValue.slice(5)
    : rawValue;

  if (!value) {
    return path.join(process.cwd(), 'zip.db');
  }

  return path.isAbsolute(value)
    ? value
    : path.resolve(process.cwd(), value);
}

const dbPath = resolveDatabasePath();
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
