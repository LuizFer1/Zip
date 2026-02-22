import { Identity } from '../../../core/model';

type LocalIdentityRow = {
  publicKey: string;
  privateKey: string;
  username: string;
  avatar: string | null;
  createdAt: number;
};

type IdentityRow = {
  publicKey: string;
  username: string | null;
  avatar: string | null;
  updatedAt: number;
};

export class IdentityMapper {
  static localToDomain(row: LocalIdentityRow): Identity {
    return {
      publicKey: row.publicKey,
      privateKey: row.privateKey,
      username: row.username,
      avatar: row.avatar ?? null,
      createdAt: row.createdAt,
    };
  }

  static identityToDomain(row: IdentityRow): Identity {
    return {
      publicKey: row.publicKey,
      username: row.username ?? '',
      avatar: row.avatar ?? null,
      createdAt: row.updatedAt,
    };
  }
}
