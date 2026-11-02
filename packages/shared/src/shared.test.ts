import { describe, expect, it } from "vitest";
import {
  commandCreateSchema,
  deviceCreateSchema,
  distanceMeters,
  isInsideGeofence,
  isValidImei,
  locationBatchSchema,
} from "./index";

describe("IMEI", () => {
  it("accepte un IMEI valide (clé de Luhn)", () => {
    expect(isValidImei("490154203237518")).toBe(true);
  });
  it("refuse une mauvaise clé", () => {
    expect(isValidImei("490154203237519")).toBe(false);
  });
  it("nettoie les espaces et tirets", () => {
    const r = deviceCreateSchema.parse({ name: "Mon tel", imei: "49-015420-323751-8" });
    expect(r.imei).toBe("490154203237518");
  });
  it("affiche un message clair", () => {
    const r = deviceCreateSchema.safeParse({ name: "x", imei: "123" });
    expect(r.success).toBe(false);
  });
});

describe("positions", () => {
  it("convertit recordedAt en Date", () => {
    const r = locationBatchSchema.parse({
      points: [{ lat: -18.91, lng: 47.52, recordedAt: "2026-11-02T08:00:00.000Z" }],
    });
    expect(r.points[0].recordedAt).toBeInstanceOf(Date);
    expect(r.points[0].source).toBe("GPS");
  });
  it("refuse une latitude impossible", () => {
    expect(
      locationBatchSchema.safeParse({ points: [{ lat: 120, lng: 0, recordedAt: Date.now() }] }).success,
    ).toBe(false);
  });
});

describe("géographie", () => {
  it("calcule une distance plausible (Antananarivo → Antsirabe ≈ 120 km)", () => {
    const d = distanceMeters({ lat: -18.8792, lng: 47.5079 }, { lat: -19.8659, lng: 47.0333 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(125_000);
  });
  it("détecte la sortie de zone", () => {
    const fence = { lat: -18.8792, lng: 47.5079, radiusM: 500 };
    expect(isInsideGeofence({ lat: -18.8795, lng: 47.508 }, fence)).toBe(true);
    expect(isInsideGeofence({ lat: -18.9, lng: 47.52 }, fence)).toBe(false);
  });
});

describe("commandes", () => {
  it("valide le PIN", () => {
    expect(commandCreateSchema.safeParse({ type: "LOCK", pin: "12a4" }).success).toBe(false);
    expect(commandCreateSchema.safeParse({ type: "LOCK", pin: "1234" }).success).toBe(true);
  });
});
