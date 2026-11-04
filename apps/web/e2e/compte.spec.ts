import { expect, test } from "@playwright/test";

async function register(page: import("@playwright/test").Page, email: string) {
  await page.goto("/inscription");
  await page.getByLabel("Votre nom").fill("Voahangy");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill("motdepasse123");
  await page.getByRole("checkbox", { name: /J'accepte les/ }).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("heading", { name: "Mes appareils" })).toBeVisible();
}

test("mot de passe oublié → email → nouveau mot de passe", async ({ page, request }) => {
  const email = `oubli-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemple.mg`;
  await register(page, email);
  await page.context().clearCookies();

  await page.goto("/connexion");
  await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page.getByText(/Si un compte existe avec cet email/)).toBeVisible();

  const mails: { to: string; text: string }[] = await (await request.get("/api/test/mails")).json();
  const mail = mails.filter((m) => m.to === email).at(-1)!;
  const link = /https?:\/\/\S+\/reinitialiser\?token=\S+/.exec(mail.text)![0];
  await page.goto(new URL(link).pathname + new URL(link).search);

  await page.getByLabel("Nouveau mot de passe").fill("nouveaumotdepasse");
  await page.getByLabel("Confirmez le mot de passe").fill("autre-chose");
  await page.getByRole("button", { name: "Enregistrer et me connecter" }).click();
  await expect(page.getByText("Les deux mots de passe ne sont pas identiques.")).toBeVisible();
  await page.getByLabel("Confirmez le mot de passe").fill("nouveaumotdepasse");
  await page.getByRole("button", { name: "Enregistrer et me connecter" }).click();
  await expect(page.getByRole("heading", { name: "Mes appareils" })).toBeVisible();

  // Le lien ne fonctionne qu'une fois.
  await page.goto(new URL(link).pathname + new URL(link).search);
  await page.getByLabel("Nouveau mot de passe").fill("encoreunautre1");
  await page.getByLabel("Confirmez le mot de passe").fill("encoreunautre1");
  await page.getByRole("button", { name: "Enregistrer et me connecter" }).click();
  await expect(page.getByText(/n'est plus valable/)).toBeVisible();
});

test("paramètres : alertes email, mot de passe, suppression du compte", async ({ page }) => {
  const email = `param-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemple.mg`;
  await register(page, email);
  await page.goto("/parametres");

  const toggle = page.getByRole("checkbox", { name: "Recevoir les alertes par email" });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Recevoir les alertes par email" })).not.toBeChecked();

  await page.getByLabel("Mot de passe actuel").fill("motdepasse123");
  await page.getByRole("textbox", { name: /^Nouveau mot de passe/ }).fill("nouveaumotdepasse");
  await page.getByLabel("Confirmez le nouveau mot de passe").fill("nouveaumotdepasse");
  await page.getByRole("button", { name: "Changer le mot de passe" }).click();
  await expect(page.getByText(/Mot de passe modifié/)).toBeVisible();

  await page.getByRole("button", { name: "Supprimer mon compte…" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Votre mot de passe/).fill("nouveaumotdepasse");
  await dialog.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(page.getByRole("heading", { name: /Retrouvez votre téléphone/ })).toBeVisible();

  await page.goto("/connexion");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill("nouveaumotdepasse");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Email ou mot de passe incorrect.")).toBeVisible();
});

test("pages publiques : légales, 404, hors ligne, installation", async ({ page, request }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Confidentialité" }).click();
  await expect(page.getByRole("heading", { name: "Politique de confidentialité" })).toBeVisible();
  await expect(page.getByText(/30 jours/).first()).toBeVisible();
  await page.getByRole("link", { name: "Conditions d'utilisation" }).click();
  await expect(page.getByRole("heading", { name: "Conditions d'utilisation" })).toBeVisible();

  const missing = await page.goto("/cette-page-n-existe-pas");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();

  await page.goto("/hors-ligne");
  await expect(page.getByRole("heading", { name: "Pas de connexion" })).toBeVisible();

  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.short_name).toBe("Retrouve");
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  expect((await request.get("/sw.js")).status()).toBe(200);
  expect((await request.get("/icons/icon-512.png")).status()).toBe(200);
});
