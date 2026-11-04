import { describe, expect, it, vi } from "vitest";
import type { AgentCommand } from "@retrouve/shared";
import { runCommands, type CommandDeps } from "./commands";

function deps(overrides: Partial<CommandDeps> = {}) {
  const done = new Set<string>();
  const acks: { id: string; status: string; result?: string }[] = [];
  const log: string[] = [];
  const d: CommandDeps = {
    ring: vi.fn(async () => { log.push("ring"); }),
    locateNow: vi.fn(async () => { log.push("locate"); return "Position envoyée"; }),
    setLostMode: vi.fn(async (on) => { log.push(on ? "lost-on" : "lost-off"); }),
    lock: vi.fn(async () => { log.push("lock"); }),
    wipe: vi.fn(async () => { log.push("wipe"); }),
    ack: vi.fn(async (id, body) => { acks.push({ id, ...body }); }),
    alreadyDone: async (id) => done.has(id),
    markDone: async (id) => { done.add(id); },
    ...overrides,
  };
  return { d, acks, log, done };
}

const cmd = (id: string, type: AgentCommand["type"], payload: AgentCommand["payload"] = null): AgentCommand => ({
  id, type, payload, createdAt: new Date().toISOString(),
});

describe("exécution des commandes", () => {
  it("exécute dans l'ordre et confirme chaque commande", async () => {
    const { d, acks, log } = deps();
    await runCommands([cmd("1", "RING"), cmd("2", "LOCATE_NOW"), cmd("3", "LOST_MODE_ON", { message: "Perdu" })], d);
    expect(log).toEqual(["ring", "locate", "lost-on"]);
    expect(acks.filter((a) => a.status === "DONE").map((a) => a.id)).toEqual(["1", "2", "3"]);
    expect(acks.find((a) => a.id === "2" && a.status === "DONE")?.result).toBe("Position envoyée");
    expect(d.setLostMode).toHaveBeenCalledWith(true, { message: "Perdu" });
  });

  it("signale l'échec avec le message d'erreur et continue", async () => {
    const { d, acks, log } = deps({ lock: async () => { throw new Error("Administrateur de l'appareil non activé"); } });
    await runCommands([cmd("1", "LOCK", { pin: "1234" }), cmd("2", "RING")], d);
    expect(acks.find((a) => a.id === "1" && a.status === "FAILED")?.result).toContain("Administrateur");
    expect(log).toEqual(["ring"]);
  });

  it("n'exécute jamais deux fois la même commande", async () => {
    const { d, log } = deps();
    await runCommands([cmd("1", "RING")], d);
    await runCommands([cmd("1", "RING")], d);
    expect(log).toEqual(["ring"]);
  });

  it("confirme l'effacement avant de le lancer", async () => {
    const order: string[] = [];
    const { d } = deps({
      ack: async (_id, body) => { order.push(`ack:${body.status}`); },
      wipe: async () => { order.push("wipe"); },
    });
    await runCommands([cmd("9", "WIPE")], d);
    expect(order).toEqual(["ack:ACKED", "ack:DONE", "wipe"]);
  });

  it("une erreur réseau sur l'accusé n'empêche pas l'exécution", async () => {
    const { d, log } = deps({ ack: async () => { throw new TypeError("Network request failed"); } });
    await runCommands([cmd("1", "RING"), cmd("2", "LOST_MODE_OFF")], d);
    expect(log).toEqual(["ring", "lost-off"]);
  });
});
