import { describe, expect, it } from "vitest";
import { HttpStatusError } from "./http";
import { enqueuePoints, flushQueue, MAX_QUEUE, memoryQueue } from "./queue";

const pt = (i: number) => ({ lat: -18.9, lng: 47.5, recordedAt: 1_700_000_000_000 + i, source: "GPS" as const });

describe("file d'attente hors ligne", () => {
  it("envoie tout par lots dans l'ordre", async () => {
    const q = memoryQueue();
    await enqueuePoints(q, Array.from({ length: 450 }, (_, i) => pt(i)));
    const batches: number[][] = [];
    const r = await flushQueue(q, async (points) => {
      batches.push(points.map((p) => Number(p.recordedAt)));
    });
    expect(r).toEqual({ sent: 450, dropped: 0, remaining: 0 });
    expect(batches.map((b) => b.length)).toEqual([200, 200, 50]);
    expect(batches[0]![0]).toBe(1_700_000_000_000);
  });

  it("garde les positions si le réseau est coupé", async () => {
    const q = memoryQueue();
    await enqueuePoints(q, [pt(1), pt(2)]);
    const r = await flushQueue(q, async () => {
      throw new TypeError("Network request failed");
    });
    expect(r.sent).toBe(0);
    expect(r.remaining).toBe(2);
  });

  it("garde les positions si le serveur est en panne (500) ou si le jeton est refusé (401)", async () => {
    for (const status of [500, 401, 429]) {
      const q = memoryQueue();
      await enqueuePoints(q, [pt(1)]);
      const r = await flushQueue(q, async () => {
        throw new HttpStatusError(status, "x");
      });
      expect(r.remaining).toBe(1);
    }
  });

  it("abandonne un lot refusé définitivement (400) sans bloquer les suivants", async () => {
    const q = memoryQueue();
    await enqueuePoints(q, Array.from({ length: 250 }, (_, i) => pt(i)));
    let call = 0;
    const r = await flushQueue(q, async () => {
      call++;
      if (call === 1) throw new HttpStatusError(400, "Données invalides");
    });
    expect(r).toEqual({ sent: 50, dropped: 200, remaining: 0 });
  });

  it("ignore les entrées corrompues", async () => {
    const q = memoryQueue();
    await q.add(["{pas du json", JSON.stringify(pt(1))]);
    const r = await flushQueue(q, async () => {});
    expect(r).toEqual({ sent: 1, dropped: 1, remaining: 0 });
  });

  it("limite la taille de la file en supprimant les plus anciennes", async () => {
    const q = memoryQueue();
    await enqueuePoints(q, Array.from({ length: MAX_QUEUE + 10 }, (_, i) => pt(i)));
    expect(await q.count()).toBe(MAX_QUEUE);
    expect(JSON.parse(q.items[0]!.payload).recordedAt).toBe(1_700_000_000_010);
  });
});
