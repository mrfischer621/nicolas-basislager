import { Mail, Phone } from 'lucide-react';
import { mailHref, telHref } from '../utils/contactLinks';

/**
 * Anrufen und E-Mail als 44-px-Knoepfe (Handy-Ablauf «Kontakt anrufen oder
 * anschreiben»). Ohne Nummer bzw. Adresse erscheint der Knopf nicht.
 */
export function ContactActions({ name, phone, email, className = '' }: { name: string; phone?: string | null; email?: string | null; className?: string }) {
  const tel = telHref(phone);
  const mail = mailHref(email);
  if (!tel && !mail) return null;
  const cls = 'tap h-11 w-11 rounded-lg border border-line-strong bg-surface text-fg hover:bg-raised';
  return (
    <span className={`flex shrink-0 items-center gap-2 ${className}`} onClick={(e) => e.stopPropagation()}>
      {tel && (
        <a href={tel} className={cls} aria-label={`${name} anrufen`} title={phone ?? undefined}>
          <Phone size={18} strokeWidth={1.5} aria-hidden="true" />
        </a>
      )}
      {mail && (
        <a href={mail} className={cls} aria-label={`${name} eine E-Mail schreiben`} title={email ?? undefined}>
          <Mail size={18} strokeWidth={1.5} aria-hidden="true" />
        </a>
      )}
    </span>
  );
}
