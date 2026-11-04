/** Erreur HTTP avec code de statut (pour décider s'il faut réessayer). */
export class HttpStatusError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** true si la requête ne doit pas être retentée (données refusées par le serveur). */
export function isPermanentFailure(err: unknown): boolean {
  return err instanceof HttpStatusError && err.status >= 400 && err.status < 500 && ![401, 408, 429].includes(err.status);
}
