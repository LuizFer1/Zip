// Scaffold only: structure placeholder (no business logic).
// File: projector.interfaces.ts

/* ==========================================================
   PROJECTOR (STATE MATERIALIZATION)
========================================================== */

export interface Projector {
  apply(event: Event): Promise<void>;
  applyBatch(events: Event[]): Promise<void>;
  rebuildAll(): Promise<void>;
}