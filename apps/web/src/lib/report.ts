import type { Device, Location, User } from "@prisma/client";
import { LABELS, mapLink } from "@retrouve/shared";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

/** Les polices standard du PDF ne connaissent que l'encodage WinAnsi : on remplace le reste. */
function winAnsi(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

const fmtDate = (d: Date) =>
  d.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: process.env.TZ || "Indian/Antananarivo" });

interface ReportInput {
  device: Device;
  owner: User;
  locations: Location[]; // plus récente d'abord
}

export async function buildReportPdf({ device, owner, locations }: ReportInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(winAnsi(`Déclaration de perte - ${device.name}`));
  pdf.setAuthor("Retrouve");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage([595.28, 841.89]); // A4
  const margin = 50;
  let y = 841.89 - margin;

  const newPageIfNeeded = (h: number) => {
    if (y - h < margin) {
      page = pdf.addPage([595.28, 841.89]);
      y = 841.89 - margin;
    }
  };
  const text = (t: string, opts: { size?: number; f?: PDFFont; color?: [number, number, number]; indent?: number } = {}) => {
    const size = opts.size ?? 11;
    const f = opts.f ?? font;
    const maxWidth = 595.28 - margin * 2 - (opts.indent ?? 0);
    // Retour à la ligne automatique.
    const words = winAnsi(t).split(" ");
    let line = "";
    const lines: string[] = [];
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) > maxWidth && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    lines.push(line);
    for (const l of lines) {
      newPageIfNeeded(size + 6);
      page.drawText(l, {
        x: margin + (opts.indent ?? 0),
        y: y - size,
        size,
        font: f,
        color: opts.color ? rgb(...opts.color) : rgb(0.1, 0.1, 0.12),
      });
      y -= size + 6;
    }
  };
  const gap = (h = 8) => (y -= h);
  const heading = (t: string) => {
    gap(6);
    text(t, { size: 13, f: bold, color: [0.11, 0.3, 0.85] });
    page.drawLine({ start: { x: margin, y: y + 2 }, end: { x: 595.28 - margin, y: y + 2 }, thickness: 0.5, color: rgb(0.8, 0.82, 0.88) });
    gap(6);
  };
  const field = (label: string, value: string | null | undefined) =>
    text(`${label} : ${value && value.trim() ? value : "non renseigné"}`, { indent: 8 });

  text("Déclaration de perte ou de vol d'appareil", { size: 18, f: bold });
  text(`Document généré le ${fmtDate(new Date())} par l'application Retrouve`, { size: 9, color: [0.4, 0.4, 0.45] });

  heading("Propriétaire");
  field("Nom", owner.name);
  field("Email", owner.email);
  field("Téléphone de contact", owner.contactPhone);

  heading("Appareil");
  field("Nom", device.name);
  field("Type", LABELS.deviceType[device.type]);
  field("Marque / modèle", device.model);
  field("IMEI", device.imei);
  field("Numéro de la carte SIM", device.simNumber);
  field("Dernier opérateur détecté", device.carrierName);
  field("Système", [device.platform, device.osVersion].filter(Boolean).join(" ") || null);

  heading("Dernière position connue");
  const last = locations[0];
  if (last) {
    field("Date", fmtDate(last.recordedAt));
    field("Coordonnées", `${last.lat.toFixed(6)}, ${last.lng.toFixed(6)}`);
    field("Précision", last.accuracy != null ? `${Math.round(last.accuracy)} m` : null);
    field("Source", LABELS.source[last.source]);
    field("Batterie", last.battery != null ? `${last.battery} %` : null);
    field("Carte", mapLink(last.lat, last.lng));
  } else {
    text("Aucune position reçue de cet appareil.", { indent: 8 });
  }

  if (locations.length > 1) {
    heading("Positions précédentes");
    for (const l of locations.slice(1, 15)) {
      text(`${fmtDate(l.recordedAt)}  -  ${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}${l.accuracy != null ? `  (±${Math.round(l.accuracy)} m)` : ""}`, { size: 9, indent: 8 });
    }
  }

  heading("Démarches conseillées");
  const steps = [
    "1. Ne tentez pas de récupérer vous-même l'appareil chez un inconnu : transmettez la position à la police ou à la gendarmerie.",
    "2. Déposez plainte (vol) ou faites une déclaration de perte au commissariat ou à la brigade de gendarmerie, en présentant ce document et la facture ou la boîte de l'appareil.",
    "3. Appelez votre opérateur mobile pour suspendre la carte SIM et demander le blocage de l'IMEI (mise sur liste noire) avec le numéro de plainte.",
    "4. Changez les mots de passe des comptes utilisés sur l'appareil (email, réseaux sociaux, mobile money, banque).",
  ];
  for (const s of steps) text(s, { indent: 8, size: 10 });

  gap(30);
  newPageIfNeeded(60);
  text("Fait à : ______________________     le : ____ / ____ / ________", { size: 10 });
  gap(10);
  text("Signature du propriétaire :", { size: 10 });

  return pdf.save();
}
