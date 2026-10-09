// Splits the document text into chunks at question boundaries, so each AI call is short.
// If an answer key sits at the end of the document, it is attached to every chunk.
const TARGET = 3500;

export function splitDocument(raw) {
  const text = raw.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  let body = text;
  let key = '';

  const re = /^[ \t]*(answer\s*key|answers?|model\s*answers?|solutions?|الإجابات|الاجابات|الإجابات النموذجية|مفتاح الإجابة|مفتاح الاجابة)[ \t]*[:：]?[ \t]*$/gim;
  let m, last = null;
  while ((m = re.exec(text))) last = m;
  if (last && last.index > text.length * 0.5 && text.length - last.index <= 12000) {
    body = text.slice(0, last.index).trim();
    key = text.slice(last.index).trim();
  }

  const qStart = /^\s*(?:Q(?:uestion)?\.?\s*)?[\d٠-٩]+\s*[\.\)\-:]\s*\S/i;
  const chunks = [];
  let cur = [];
  let len = 0;
  for (const line of body.split('\n')) {
    if (len > TARGET && qStart.test(line)) {
      chunks.push(cur.join('\n'));
      cur = [];
      len = 0;
    }
    cur.push(line);
    len += line.length + 1;
  }
  if (cur.length) chunks.push(cur.join('\n'));

  // Fallback for text with no detectable numbering: cut by size
  const final = [];
  for (const c of chunks) {
    if (c.length <= 9000) { final.push(c); continue; }
    let rest = c;
    while (rest.length > 0) {
      let cut = Math.min(4000, rest.length);
      if (cut < rest.length) {
        const nl = rest.lastIndexOf('\n', cut);
        if (nl > 1000) cut = nl;
      }
      final.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
  }

  return final
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => (key ? `${c}\n\n[ANSWER KEY FROM THE END OF THE DOCUMENT]\n${key}` : c));
}
