import assert from "node:assert/strict";
import { test } from "node:test";
import { execute, plan } from "./actions.js";

test("verrouillage selon le système", () => {
  assert.deepEqual(plan("LOCK", null, "win32"), [["rundll32.exe", ["user32.dll,LockWorkStation"]]]);
  assert.equal(plan("LOCK", null, "linux")[0][0], "loginctl");
});

test("le message du mode perdu inclut le numéro", () => {
  const [[cmd, args]] = plan("LOST_MODE_ON", { message: "Perdu !", contactPhone: "+261 34 00" }, "linux");
  assert.equal(cmd, "notify-send");
  assert.match(args.at(-1), /Perdu ! Appelez le \+261 34 00\./);
});

test("le message est échappé pour AppleScript", () => {
  const [[, args]] = plan("LOST_MODE_ON", { message: 'Il a dit "stop"' }, "darwin");
  assert.match(args[1], /display dialog "Il a dit \\"stop\\""/);
});

test("l'effacement est refusé sur ordinateur", async () => {
  await assert.rejects(execute("WIPE", null), /non disponible/);
});
