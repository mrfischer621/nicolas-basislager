// Ergaenzt aria-label bei <button>, die nur ein title haben (Icon-Knoepfe),
// und entfernt fill="currentColor" an Lucide-Icons (keine gefuellten Icons).
import fs from 'node:fs';
import path from 'node:path';
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : /\.tsx$/.test(p) && !/\.test\./.test(p) && files.push(p); } })('src');
let total = 0;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  let out = '';
  let i = 0;
  let changed = 0;
  while (true) {
    const start = s.indexOf('<button', i);
    if (start < 0) { out += s.slice(i); break; }
    // Ende des oeffnenden Tags: erstes '>' ausserhalb von {} und Strings
    let depth = 0, j = start + 7, quote = null;
    for (; j < s.length; j++) {
      const c = s[j];
      if (quote) { if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0 && s[j - 1] !== '=') break;
    }
    let tag = s.slice(start, j);
    if (!/aria-label/.test(tag)) {
      const t = /\btitle=(\{[^}]*\}|"[^"]*")/.exec(tag);
      if (t) { tag = tag.replace(t[0], `${t[0]}\n          aria-label=${t[1]}`); changed++; }
    }
    out += s.slice(i, start) + tag;
    i = j;
  }
  const before = out;
  out = out.replace(/\s+fill="currentColor"/g, '');
  if (out !== before) changed++;
  if (changed) { fs.writeFileSync(f, out); total += changed; console.log(changed, f); }
}
console.log('gesamt', total);
