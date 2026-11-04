import type { AgentCommand, CommandAckInput } from "@retrouve/shared";

/** Actions concrètes, fournies par l'app (ou simulées dans les tests). */
export interface CommandDeps {
  ring(): Promise<string | void>;
  locateNow(): Promise<string | void>;
  setLostMode(on: boolean, payload: AgentCommand["payload"]): Promise<void>;
  lock(pin: string | null): Promise<string | void>;
  wipe(): Promise<void>;
  ack(id: string, body: CommandAckInput): Promise<void>;
  alreadyDone(id: string): Promise<boolean>;
  markDone(id: string): Promise<void>;
}

/** Exécute les commandes reçues, une par une, et rend compte au serveur. */
export async function runCommands(commands: AgentCommand[], deps: CommandDeps): Promise<string[]> {
  const executed: string[] = [];
  for (const cmd of commands) {
    if (await deps.alreadyDone(cmd.id)) {
      // Déjà exécutée mais l'accusé n'était pas parti : on le renvoie seulement.
      await deps.ack(cmd.id, { status: "DONE" }).catch(() => {});
      continue;
    }
    try {
      await deps.ack(cmd.id, { status: "ACKED" }).catch(() => {});
      let result: string | void = undefined;
      switch (cmd.type) {
        case "RING":
          result = await deps.ring();
          break;
        case "LOCATE_NOW":
          result = await deps.locateNow();
          break;
        case "LOST_MODE_ON":
          await deps.setLostMode(true, cmd.payload);
          break;
        case "LOST_MODE_OFF":
          await deps.setLostMode(false, null);
          break;
        case "LOCK":
          result = await deps.lock(cmd.payload?.pin ?? null);
          break;
        case "WIPE":
          // L'appareil va être réinitialisé : on confirme AVANT d'effacer.
          await deps.markDone(cmd.id);
          await deps.ack(cmd.id, { status: "DONE", result: "Effacement lancé" }).catch(() => {});
          executed.push(cmd.id);
          await deps.wipe();
          continue;
        default:
          throw new Error(`Commande inconnue : ${String((cmd as AgentCommand).type)}`);
      }
      await deps.markDone(cmd.id);
      executed.push(cmd.id);
      await deps.ack(cmd.id, { status: "DONE", ...(result ? { result } : {}) }).catch(() => {});
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await deps.markDone(cmd.id);
      await deps.ack(cmd.id, { status: "FAILED", result: message.slice(0, 480) }).catch(() => {});
    }
  }
  return executed;
}
