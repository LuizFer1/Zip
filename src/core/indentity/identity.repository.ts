import { Identity } from "../model";

export interface IdentityRepository {
  getLocalIdentity(): Promise<Identity | undefined>;
  createOrUpdateLocalIdentity(identity: Identity): Promise<Identity>;
  getIdentity(publicKey: string): Promise<Identity | null>;
  getAllIdentities(): Promise<Identity[]>;
}
