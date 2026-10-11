/** Fehler aus catch (unknown) sicher lesen: Supabase-, Postgres- und JS-Fehler. */
export interface ErrorLike {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

export function asError(caught: unknown): ErrorLike {
  if (caught && typeof caught === 'object') return caught as ErrorLike;
  return { message: typeof caught === 'string' ? caught : undefined };
}
