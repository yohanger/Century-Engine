import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const forbiddenPackages = new Set(['vue', 'electron', 'pinia', 'vuex']);
const forbiddenSegments = [/\/(?:editor|stores?)\//i, /century[\\/ -]?engine/i, /radiance[\\/ -]?(?:gen(?:eration)?[\\/ -]?)?i(?:\b|[\\/])/i];
const failures = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (['.ts', '.js', '.mjs'].includes(extname(entry.name))) await inspect(path);
  }
}

async function inspect(path) {
  const source = await readFile(path, 'utf8');
  const imports = source.matchAll(/(?:from\s*|import\s*(?:\()?)\s*['"]([^'"]+)['"]/g);
  for (const match of imports) {
    const specifier = match[1];
    if (!specifier) continue;
    const packageName = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
    if (forbiddenPackages.has(packageName)) failures.push(`${relative(root, path)} imports forbidden package ${specifier}`);
    for (const pattern of forbiddenSegments) {
      if (pattern.test(specifier)) failures.push(`${relative(root, path)} crosses forbidden boundary ${specifier}`);
    }
  }
}

await walk(root);
if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('PASS: src has no Century Engine, Generation I, Vue, Electron, store, or editor-only imports');
}
