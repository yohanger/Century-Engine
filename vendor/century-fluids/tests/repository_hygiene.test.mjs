import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const json=(path)=>JSON.parse(readFileSync(join(root,path),'utf8'));
const expectedScripts=['build','playground','prepack','qa','test','typecheck'];
test('GitHub cleanup: six public package commands and no sprint-specific npm aliases',()=>{
 const pkg=json('package.json');
 assert.deepEqual(Object.keys(pkg.scripts).sort(),expectedScripts);
 assert.equal(pkg.scripts.playground,'node tests/run_playground.mjs');
 assert.equal(pkg.scripts.prepack,'npm run build');
 assert.equal(pkg.private,true,'npm publication not authorized');
 assert.equal(pkg.license,'UNLICENSED','license must be decided by owner');
});
test('GitHub cleanup: installed dependencies do not contaminate core or lockfile',()=>{
 const pkg=json('package.json'),lock=json('package-lock.json'),playground=json('playground/package.json');
 assert.ok(!pkg.dependencies || Object.keys(pkg.dependencies).length===0);
 assert.deepEqual(lock.packages[''].devDependencies,pkg.devDependencies);
 assert.equal(pkg.devDependencies.typescript,'5.8.3');
 assert.equal(playground.private,true);
 assert.equal(playground.dependencies['jolt-physics'],'1.1.0');
 assert.equal(playground.dependencies.three,'0.186.0');
 assert.equal(playground.devDependencies.vite,'8.3.8');
});
test('GitHub cleanup: Git excludes generated outputs but keeps documented historical QA',()=>{
 const ignore=readFileSync(join(root,'.gitignore'),'utf8');
 for(const line of ['node_modules/','**/node_modules/','dist/','**/dist/','playground/.local/','*.tgz','*.zip'])
  assert.ok(ignore.split('\n').includes(line),`missing gitignore entry ${line}`);
 assert.ok(!ignore.split('\n').includes('*.log'),'do not discard historical QA logs by wildcard');
 assert.ok(existsSync(join(root,'qa/MANIFEST.sha256')));
 assert.ok(existsSync(join(root,'tests/jolt-real/real_jolt.test.mjs')));
});
test('GitHub cleanup: Python legacy validators use direct tools, not deleted npm scripts',()=>{
 const forbidden=/(?:qa:s05|qa:s06:wasm|qa:s09:prepare|qa:s09:build|qa:vite:prepare|benchmark:s0[2349]|qa:s07:benchmark)/;
 for(const file of ['qa/verify_s02.py','qa/verify_s03.py','qa/verify_s04.py','qa/verify_s05.py',
    'qa/verify_s06.py','qa/verify_s07.py','qa/verify_s09.py']){
  const code=readFileSync(join(root,file),'utf8');
  assert.doesNotMatch(code,forbidden,file);
 }
});
