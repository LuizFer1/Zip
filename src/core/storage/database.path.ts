import path from 'node:path';

export function resolveDatabasePath(): string {
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
