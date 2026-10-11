# Vereinheitlicht Seitenkopf, Hauptaktion (Pill) und Fehlermeldung einer Seite.
# Aufruf: python3 scripts/normalize-page-header.py src/pages/X.tsx [...]
import re, sys
for p in sys.argv[1:]:
    s = open(p).read()
    s = re.sub(r'<h1 className="text-[23]xl font-bold text-(?:fg|content-heading)(?: mb-2)?">', '<h1 className="page-title">', s, count=1)
    s = re.sub(r'<p className="text-(?:fg-muted|content-secondary) mt-1">', '<p className="mt-2 text-sm text-fg-muted">', s, count=1)
    s = s.replace('<div className="flex items-center justify-between">\n        <div>\n          <h1 className="page-title">',
                  '<div className="flex flex-wrap items-end justify-between gap-4">\n        <div>\n          <h1 className="page-title">', 1)
    s = s.replace('className="flex items-center gap-2 px-4 py-2 bg-brand text-accent-fg rounded-lg hover:bg-brand-dark transition"', 'className="btn-cta"')
    s = re.sub(r'<Plus size=\{20\} />', '<Plus size={18} aria-hidden="true" />', s)
    s = s.replace('<div className="bg-danger-subtle border border-danger-subtle text-danger px-4 py-3 rounded-lg">\n          {error}',
                  '<div role="alert" className="rounded-lg border border-danger bg-danger-subtle px-4 py-3 text-danger">\n          <strong>Fehler:</strong> {error}')
    open(p, 'w').write(s)
    print('ok', p)
