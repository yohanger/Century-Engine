import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const output = join(root, 'ledger', 'SOURCE-MANIFEST.json');
const excludedDirectories = new Set(['node_modules', '.git']);
const excludedFiles = new Set([relative(root, output).replaceAll('\\', '/')]);
const files = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else {
      const name = relative(root, path).replaceAll('\\', '/');
      if (excludedFiles.has(name)) continue;
      const body = await readFile(path);
      const info = await stat(path);
      files.push({ path: name, bytes: info.size, sha256: createHash('sha256').update(body).digest('hex') });
    }
  }
}

await walk(root);
const manifest = {
  schema: 'century-radiance-source-manifest/v1',
  package: '@century/radiance',
  version: '0.0.1-s00',
  gate: 'CENTURY-RADIANCE-S00-G001-UNREAL-INSPIRED-LIGHTING-FOUNDATION',
  generatedAt: new Date().toISOString(),
  exclusions: ['node_modules', '.git', 'ledger/SOURCE-MANIFEST.json'],
  fileCount: files.length,
  files,
};
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Wrote ${files.length} entries to ${output}`);
