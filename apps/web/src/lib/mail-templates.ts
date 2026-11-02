import { ALERT_ICONS, describeAlert, LABELS, mapLink, type AlertType } from "@retrouve/shared";
import type { Mail } from "./mail";
import { appUrl } from "./env";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

interface LayoutInput {
  title: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  footnote?: string;
}

/** Gabarit commun : simple, lisible sur téléphone, compatible avec les clients email. */
function layout({ title, paragraphs, cta, footnote }: LayoutInput): { html: string; text: string } {
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f6f7fb;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#141824">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e3e6ee;border-radius:16px">
<tr><td style="padding:24px 24px 8px"><span style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;border-radius:8px;background:#2453e6;color:#fff;font-weight:700">◎</span>
<span style="font-weight:700;font-size:17px;vertical-align:middle;margin-left:8px">Retrouve</span></td></tr>
<tr><td style="padding:8px 24px 4px"><h1 style="font-size:20px;margin:8px 0 12px">${esc(title)}</h1>
${paragraphs.map((p) => `<p style="font-size:15px;line-height:22px;margin:0 0 12px">${esc(p)}</p>`).join("\n")}
${cta ? `<p style="margin:20px 0"><a href="${esc(cta.url)}" style="display:inline-block;background:#2453e6;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">${esc(cta.label)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:8px 24px 24px;font-size:12px;line-height:18px;color:#5c6475">${esc(footnote ?? "Vous recevez cet email car vous avez un compte Retrouve.")}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [title, "", ...paragraphs, ...(cta ? ["", `${cta.label} : ${cta.url}`] : []), "", footnote ?? ""].join("\n").trim();
  return { html, text };
}

export function resetPasswordMail(to: string, name: string, token: string): Mail {
  const url = `${appUrl()}/reinitialiser?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: "Réinitialiser votre mot de passe Retrouve",
    ...layout({
      title: "Réinitialiser votre mot de passe",
      paragraphs: [
        `Bonjour ${name},`,
        "Vous avez demandé à changer le mot de passe de votre compte Retrouve. Ce lien est valable 1 heure et ne peut servir qu'une fois.",
      ],
      cta: { label: "Choisir un nouveau mot de passe", url },
      footnote: "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe ne change pas.",
    }),
  };
}

export function passwordChangedMail(to: string, name: string): Mail {
  return {
    to,
    subject: "Votre mot de passe Retrouve a été modifié",
    ...layout({
      title: "Mot de passe modifié",
      paragraphs: [
        `Bonjour ${name},`,
        "Le mot de passe de votre compte Retrouve vient d'être modifié. Toutes les autres sessions ont été déconnectées.",
        "Si ce n'est pas vous, réinitialisez immédiatement votre mot de passe.",
      ],
      cta: { label: "Mot de passe oublié", url: `${appUrl()}/mot-de-passe-oublie` },
    }),
  };
}

export function accountDeletedMail(to: string, name: string): Mail {
  return {
    to,
    subject: "Votre compte Retrouve a été supprimé",
    ...layout({
      title: "Compte supprimé",
      paragraphs: [
        `Bonjour ${name},`,
        "Votre compte Retrouve et toutes ses données (appareils, positions, alertes, partages) ont été supprimés définitivement.",
        "Pensez à désinstaller l'application Retrouve de vos appareils.",
      ],
      footnote: "Cet email est le dernier que vous recevrez de Retrouve.",
    }),
  };
}

export function alertMail(input: {
  to: string;
  name: string;
  deviceId: string;
  deviceName: string;
  type: AlertType;
  data: Record<string, unknown> | null;
}): Mail {
  const description = describeAlert(input.type, input.data);
  const lat = input.data?.lat;
  const lng = input.data?.lng;
  const paragraphs = [`Bonjour ${input.name},`, `${input.deviceName} : ${description}`];
  if (typeof lat === "number" && typeof lng === "number") paragraphs.push(`Position : ${mapLink(lat, lng)}`);
  return {
    to: input.to,
    subject: `${ALERT_ICONS[input.type]} ${LABELS.alert[input.type]} : ${input.deviceName}`,
    ...layout({
      title: `${LABELS.alert[input.type]} : ${input.deviceName}`,
      paragraphs,
      cta: { label: "Voir l'appareil sur la carte", url: `${appUrl()}/appareils/${input.deviceId}` },
      footnote: "Vous pouvez désactiver les alertes par email dans Paramètres sur le site Retrouve.",
    }),
  };
}
