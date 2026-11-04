import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export const unauthorized = () => new HttpError(401, "Vous devez être connecté.");
export const notFound = (what = "Ressource") => new HttpError(404, `${what} introuvable.`);
export const forbidden = (msg = "Accès refusé.") => new HttpError(403, msg);

export function json<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

function zodDetails(err: ZodError): Record<string, string[]> {
  const flat = z.flattenError(err);
  const details: Record<string, string[]> = { ...(flat.fieldErrors as Record<string, string[]>) };
  if (flat.formErrors.length) details._ = flat.formErrors;
  return details;
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Enveloppe une route : erreurs HTTP, validation et erreurs inattendues → JSON propre. */
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return json({ error: err.message, details: err.details }, err.status);
      }
      if (err instanceof ZodError) {
        const details = zodDetails(err);
        const first = Object.values(details)[0]?.[0];
        return json({ error: first ?? "Données invalides.", details }, 400);
      }
      console.error(err);
      return json({ error: "Erreur interne du serveur." }, 500);
    }
  };
}

/** Lit et valide un corps JSON. */
export async function readJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.output<S>> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) {
    throw new HttpError(415, "Le corps de la requête doit être en JSON.");
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "JSON invalide.");
  }
  return schema.parse(body);
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "local";
}
