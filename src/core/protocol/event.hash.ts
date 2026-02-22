import { createHash } from "crypto";
import { EventHasher } from "../model";

export class EventHasherImpl implements EventHasher {
  hash(data: Uint8Array): string {
    return createHash("sha256")
      .update(data)
      .digest("hex");
  }
}