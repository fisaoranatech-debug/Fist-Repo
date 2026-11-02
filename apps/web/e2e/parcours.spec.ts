import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";

const ROOT = path.resolve(__dirname, "../../..");

/** Lance le simulateur d'appareil en mode « une fois » et renvoie son jeton. */
function simulate(code: string, baseURL: string): string {
  const out = execFileSync(
    process.execPath,
    ["--experimental-strip-types", "--no-warnings", path.join(ROOT, "scripts/simulate-device.ts"), "--code", code, "--once", "--url", baseURL],
    { encoding: "utf8" },
  );
  const m = /TOKEN=(\S+)/.exec(out);
  if (!m) throw new Error(`Simulateur : ${out}`);
  return m[1]!;
}

test("parcours complet : inscription, ajout, association, carte, commandes, PDF", async ({ page, request, baseURL }) => {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemple.mg`;

  // 1. Inscription
  await page.goto("/inscription");
  await page.getByLabel("Votre nom").fill("Hery Rakoto");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill("motdepasse123");
  await page.getByLabel(/Téléphone de contact/).fill("+261 34 11 222 33");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByText(/Vous devez accepter les conditions/).first()).toBeVisible();
  await page.getByRole("checkbox", { name: /J'accepte les/ }).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("heading", { name: "Mes appareils" })).toBeVisible();

  // 2. Ajout d'un appareil (IMEI invalide d'abord : message clair)
  await page.getByRole("link", { name: "+ Ajouter un appareil" }).click();
  await page.getByLabel("Nom de l'appareil").fill("Téléphone de Hery");
  await page.getByLabel("IMEI").fill("123");
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText(/IMEI invalide/).first()).toBeVisible();
  await page.getByLabel("IMEI").fill("490154203237518");
  await page.getByRole("button", { name: "Continuer" }).click();

  // 3. Code d'association → simulateur
  const codeEl = page.getByTestId("pairing-code");
  await expect(codeEl).toHaveText(/^\d{6}$/);
  const token = simulate((await codeEl.textContent())!, baseURL!);
  await expect(page.getByText("Appareil associé")).toBeVisible();
  await page.getByRole("link", { name: "Voir l'appareil" }).click();

  // 4. Carte et dernière position
  await expect(page.getByRole("heading", { name: "Téléphone de Hery" })).toBeVisible();
  await expect(page.getByText("Dernière position :")).toBeVisible();
  await expect(page.locator(".device-pin")).toBeVisible();
  await expect(page.getByText("📶 Telma")).toBeVisible();

  // 5. Faire sonner → l'appareil exécute
  await page.getByRole("button", { name: "🔊 Faire sonner" }).click();
  await expect(page.getByText("Commande « Faire sonner » envoyée")).toBeVisible();
  const cmds = await (await request.get("/api/agent/commands", { headers: { Authorization: `Bearer ${token}` } })).json();
  expect(cmds[0].type).toBe("RING");
  await request.post(`/api/agent/commands/${cmds[0].id}/ack`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { status: "DONE" },
  });
  await expect(page.getByText("Exécutée").first()).toBeVisible();

  // 6. Mode perdu
  await page.getByRole("button", { name: "🚨 Mode perdu" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Activer le mode perdu" }).click();
  await expect(page.getByText("🚨 Mode perdu").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "✅ Retrouvé" })).toBeVisible();

  // 7. Verrouiller sans mot de passe correct → refus
  await page.getByRole("button", { name: "🔒 Verrouiller" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Votre mot de passe Retrouve").fill("mauvais");
  await dialog.getByRole("button", { name: "Verrouiller" }).click();
  await expect(page.getByText("Mot de passe incorrect.")).toBeVisible();
  await page.keyboard.press("Escape");

  // 8. PDF de déclaration
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: /Déclaration de perte/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^declaration-.*\.pdf$/);

  // 9. Alertes et déconnexion
  await page.getByRole("link", { name: /Alertes/ }).click();
  await expect(page.getByRole("heading", { name: "Alertes" })).toBeVisible();
  await page.getByRole("link", { name: /Paramètres/ }).click();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/connexion/);
  await page.goto("/appareils");
  await expect(page).toHaveURL(/\/connexion/);
});
