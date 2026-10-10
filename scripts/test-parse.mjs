// Usage: node scripts/test-parse.mjs path/to/file.docx   (shows exactly what the AI will receive)
import fs from 'fs';
import { parseDocx } from '../lib/docx.js';
const { chunks, imageCount } = await parseDocx(fs.readFileSync(process.argv[2]));
console.log(`${chunks.length} chunk(s), ${imageCount} image(s)\n`);
chunks.forEach((c, i) => console.log(`=== CHUNK ${i + 1} (images: ${c.imageIds.join(',') || 'none'}) ===\n${c.text}\n`));
