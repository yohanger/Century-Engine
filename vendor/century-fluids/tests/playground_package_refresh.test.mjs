import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,writeFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {packageIsCurrent,refreshInstalledPackage} from './playground_install.mjs';

async function fixture(t){
  const base=await mkdtemp(join(tmpdir(),'century-packaged-refresh-'));
  t.after(()=>rm(base,{recursive:true,force:true}));
  const source=join(base,'source');
  const installed=join(base,'playground','node_modules','@century','fluids');
  for(const dir of [join(source,'dist','surface'),join(installed,'dist','surface')])
    await mkdir(dir,{recursive:true});
  const files=['package.json','dist/surface/index.js'];
  await writeFile(join(source,'package.json'),'{"name":"@century/fluids","version":"0.1.0"}');
  await writeFile(join(installed,'package.json'),'{"name":"@century/fluids","version":"0.1.0"}');
  await writeFile(join(source,'dist/surface/index.js'),"export {ChunkedSurfaceCache} from './chunked.js';\n");
  await writeFile(join(installed,'dist/surface/index.js'),"export {extractSurface} from './mesh.js';\n");
  return {base,source,installed,files};
}

const copyPublished=async(source,installed,files)=>{
  await mkdir(join(installed,'dist','surface'),{recursive:true});
  for(const file of files)await writeFile(join(installed,file),await readFile(join(source,file)));
};

test('S09 packaged consumer refreshes a stale same-version local tarball without touching other dependencies',async t=>{
  const f=await fixture(t);
  const other=join(f.base,'playground','node_modules','three','sentinel');
  await mkdir(join(f.base,'playground','node_modules','three'),{recursive:true});
  await writeFile(other,'do not touch');
  assert.equal(await packageIsCurrent(f.source,f.installed,f.files),false);
  let installs=0;
  const install=async()=>{installs++;await copyPublished(f.source,f.installed,f.files);};
  assert.equal(await refreshInstalledPackage({sourceRoot:f.source,installedRoot:f.installed,packedFiles:f.files,install}),true);
  assert.equal(installs,1);
  assert.equal(await packageIsCurrent(f.source,f.installed,f.files),true);
  assert.equal(await readFile(other,'utf8'),'do not touch');
  assert.equal(await refreshInstalledPackage({sourceRoot:f.source,installedRoot:f.installed,packedFiles:f.files,install}),false);
  assert.equal(installs,1);
});

test('S09 packaged consumer does not accept missing exports or an ineffective reinstall',async t=>{
  const f=await fixture(t);
  await assert.rejects(refreshInstalledPackage({sourceRoot:f.source,installedRoot:f.installed,packedFiles:f.files,install:async()=>{
    await mkdir(f.installed,{recursive:true});
    await writeFile(join(f.installed,'package.json'),await readFile(join(f.source,'package.json')));
  }}),/differs from the freshly packed tarball/);
  await assert.rejects(packageIsCurrent(f.source,f.installed,['../escape','dist/surface/index.js']),/inventory|unexpected|unsafe/);
});

test('S09 packaged consumer never deletes a user-managed link',async t=>{
  const f=await fixture(t);
  await rm(f.installed,{recursive:true});
  const external=join(f.base,'external');
  await mkdir(external);
  await symlink(external,f.installed,'dir');
  await assert.rejects(refreshInstalledPackage({sourceRoot:f.source,installedRoot:f.installed,packedFiles:f.files,install:async()=>{}}),/refuses to replace/);
  assert.ok(await readFile(join(f.source,'dist/surface/index.js'),'utf8'));
});

// Offline npm regression: replacing an unchanged-version local tarball must not leave stale exports.
test('S09 npm offline repack at the same 0.1.0 version installs the current published export',async t=>{
  const {spawnSync}=await import('node:child_process');
  const f=await fixture(t);
  const local=join(f.base,'playground','.local');
  await mkdir(local,{recursive:true});
  await writeFile(join(f.source,'package.json'),JSON.stringify({name:'@century/fluids',version:'0.1.0',files:['dist'],type:'module'}));
  await writeFile(join(f.source,'dist/surface/index.js'),'export const legacy = true;\n');
  const consumer=join(f.base,'playground');
  await writeFile(join(consumer,'package.json'),JSON.stringify({name:'refresh-test',private:true,dependencies:{'@century/fluids':'file:./.local/century-fluids-0.1.0.tgz'}}));
  const npm=process.platform==='win32'?'npm.cmd':'npm';
  const invoke=(cwd,args)=>{
    const result=spawnSync(npm,args,{cwd,encoding:'utf8',timeout:90000});
    assert.equal(result.status,0,`npm ${args.join(' ')} failed: ${result.stderr}`);
  };
  const pack=()=>invoke(f.source,['pack','--json','--ignore-scripts','--pack-destination',local]);
  const install=()=>invoke(consumer,['install','--offline','--ignore-scripts','--no-audit','--no-fund','--package-lock=false']);
  pack();install();
  await writeFile(join(f.source,'dist/surface/index.js'),'export const ChunkedSurfaceCache = class {};\n');
  pack();install(); // npm may retain legacy contents at identical name/version.
  const reinstalled=await refreshInstalledPackage({sourceRoot:f.source,installedRoot:f.installed,packedFiles:f.files,install});
  assert.equal(await packageIsCurrent(f.source,f.installed,f.files),true);
  assert.match(await readFile(join(f.installed,'dist/surface/index.js'),'utf8'),/ChunkedSurfaceCache/);
  assert.equal(typeof reinstalled,'boolean');
});
