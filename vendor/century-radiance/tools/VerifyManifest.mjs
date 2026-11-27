import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const manifest = JSON.parse(await readFile(join(root, 'ledger', 'SOURCE-MANIFEST.json'), 'utf8'));
const failures = [];
for (const entry of manifest.files) {
  try {
    const body = await readFile(join(root, entry.path));
    const hash = createHash('sha256').update(body).digest('hex');
    if (body.byteLength !== entry.bytes || hash !== entry.sha256) failures.push(entry.path);
  } catch {
    failures.push(entry.path);
  }
}
if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} manifest entries differ`);
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`PASS: ${manifest.fileCount} manifest entries match size and SHA-256`);
}
