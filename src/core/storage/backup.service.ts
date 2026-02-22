import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveDatabasePath } from './database.path';

export interface BackupService {
  backup(): Promise<void>;
}

export class FileBackupService implements BackupService {
  private readonly sourcePath: string;
  private readonly targetDir: string;

  constructor(
    sourcePath: string = resolveDatabasePath(),
    targetDir?: string,
  ) {
    this.sourcePath = sourcePath;
    this.targetDir = targetDir ?? path.resolve(process.cwd(), 'backups');
  }

  async backup(): Promise<void> {
    await fs.mkdir(this.targetDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `zip-backup-${timestamp}.db`;
    await fs.copyFile(this.sourcePath, path.join(this.targetDir, fileName));
  }
}

export class HttpBackupService implements BackupService {
  constructor(
    private readonly sourcePath: string,
    private readonly endpoint: string,
    private readonly token?: string,
  ) {}

  async backup(): Promise<void> {
    const bytes = await fs.readFile(this.sourcePath);
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/octet-stream',
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
      body: bytes,
    });

    if (!response.ok) {
      throw new Error(`HTTP backup failed: ${response.status} ${response.statusText}`);
    }
  }
}

export class CompositeBackupService implements BackupService {
  constructor(private readonly services: BackupService[]) {}

  async backup(): Promise<void> {
    for (const service of this.services) {
      await service.backup();
    }
  }
}
