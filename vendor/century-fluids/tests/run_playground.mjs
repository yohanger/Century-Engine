/** Host-independent S09 entrypoint. Packs the library, installs ONLY in playground/, serves browser. */
import {spawnSync,spawn} from 'node:child_process';
import {copyFile,mkdir,readFile,stat} from 'node:fs/promises';
import {refreshInstalledPackage} from './playground_install.mjs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,join} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const playground=join(root,'playground');
const local=join(playground,'.local');
const npm=process.platform==='win32'?'npm.cmd':'npm';
const args=process.argv.slice(2);
if(args.some(a=>!['--prepare-only','--build'].includes(a))||args.length>1)throw Error('Valid options: --prepare-only or --build');
function command(cmd,params,cwd){
  const r=spawnSync(cmd,params,{cwd,encoding:'utf8',maxBuffer:8e6,timeout:120000,env:{...process.env,npm_config_audit:'false',npm_config_fund:'false'}});
  if(r.error||r.status!==0)throw Error(`S09 command failed: ${cmd} ${params.join(' ')}\n${r.stdout??''}\n${r.stderr??''}`);
  return (r.stdout??'').trim();
}
await mkdir(local,{recursive:true});
const pkg=JSON.parse(await readFile(join(playground,'package.json'),'utf8'));
if(pkg.dependencies['@century/fluids']!=='file:./.local/century-fluids-0.1.0.tgz')throw Error('S09 isolated npm tarball dependency changed');
if(pkg.dependencies['jolt-physics']!=='1.1.0')throw Error('S09 Jolt WASM must be pinned to 1.1.0');
const packed=JSON.parse(command(npm,['pack','--json','--pack-destination',local],root))[0];
if(!packed||packed.name!=='@century/fluids'||!/^century-fluids-[A-Za-z0-9.-]+\.tgz$/.test(packed.filename))throw Error('Unexpected fluid tarball');
const dependencyFilename='century-fluids-0.1.0.tgz';
if(packed.filename!==dependencyFilename)await copyFile(join(local,packed.filename),join(local,dependencyFilename));
if(!packed.files.some(f=>f.path==='dist/fluids/water/index.js')||!packed.files.some(f=>f.path==='dist/surface/index.js')||!packed.files.some(f=>f.path==='dist/adapters/jolt.js'))throw Error('S09 missing exported library submodule');
await stat(join(local,packed.filename));
console.log(`S09_PACKED_CONSUMER_PREPARED package=${packed.filename} files=${packed.files.length} bytes=${packed.size}`);
if(args.includes('--prepare-only')){
  console.log('S09_PREPARE_PASS browser=NOT_VERIFIED dependencies=NOT_INSTALLED');
  process.exit(0);
}
console.log('S09_INSTALL_BROWSER_DEPENDENCIES into playground only (pinned Three.js, Vite, Jolt WASM)...');
command(npm,['install','--prefix',playground,'--ignore-scripts','--no-audit','--no-fund','--package-lock=false'],root);
const refreshed=await refreshInstalledPackage({
  sourceRoot:root,
  installedRoot:join(playground,'node_modules','@century','fluids'),
  packedFiles:packed.files.map(file=>file.path).filter(path=>path==='package.json'||path.startsWith('dist/')),
  install:()=>command(npm,['install','--prefix',playground,'--ignore-scripts','--no-audit','--no-fund','--package-lock=false'],root),
});
console.log(refreshed?'S09_PACKAGED_LIBRARY_REFRESH_PASS':'S09_PACKAGED_LIBRARY_CURRENT_PASS');
if(args.includes('--build')){
  const result=command(npm,['run','build','--prefix',playground],root);
  console.log(result);
  console.log('S09_BROWSER_BUILD_PASS (NOT browser GUI QA)');
  process.exit(0);
}
console.log('S09_GUI_PENDING navigate to http://127.0.0.1:5174/ (browser graphical, real Jolt required for flotation)');
const child=spawn(npm,['run','dev','--prefix',playground],{cwd:root,stdio:'inherit',env:process.env});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',(code,signal)=>{process.exitCode=code??(signal?1:0);});
