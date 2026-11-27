import { createWaterWorld, waterPhysicalConfig, waterSolverConfig, WaterHydrodynamics } from '../dist/fluids/water/index.js';
/** S06 package subpath regression: an installed tarball exposes optional typed bridge. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const npm=process.platform==='win32'?'npm.cmd':'npm';
function run(cmd,args,cwd){
 const r=spawnSync(cmd,args,{cwd,encoding:'utf8',timeout:90000,env:{...process.env,npm_config_audit:'false',npm_config_fund:'false'}});
 if(r.error||r.status!==0)throw new Error(`command failed: ${cmd} ${args.join(' ')}\n${r.stdout||''}\n${r.stderr||''}`);
 return r.stdout.trim();
}
test('S06 optional Jolt adapter survives npm pack, Node import and TypeScript consumer',async()=>{
 const tmp=await mkdtemp(join(tmpdir(),'century-s06-package-'));
 try{
  const c=join(tmp,'consumer');await mkdir(c);
  await writeFile(join(c,'package.json'),JSON.stringify({name:'s06-consumer',type:'module',private:true}));
  const pkg=JSON.parse(run(npm,['pack','--json','--pack-destination',tmp],root))[0];
  assert.equal(pkg.name,'@century/fluids');
  assert.ok(pkg.files.some(f=>f.path==='dist/adapters/jolt.js'));
  assert.ok(pkg.files.some(f=>f.path==='dist/adapters/jolt.d.ts'));
  assert.ok(pkg.files.some(f=>f.path==='dist/fluids/water/index.d.ts'));
  assert.ok(pkg.files.some(f=>f.path==='dist/surface/index.d.ts'));
  run(npm,['install','--offline','--ignore-scripts','--no-save','--package-lock=false',join(tmp,pkg.filename)],c);
  const manifest=JSON.parse(await readFile(join(c,'node_modules/@century/fluids/package.json'),'utf8'));
  assert.equal(manifest.dependencies,undefined);
  assert.equal(manifest.exports['./adapters/jolt'].types,'./dist/adapters/jolt.d.ts');
  assert.equal(manifest.exports['./water'].types,'./dist/fluids/water/index.d.ts');
  assert.equal(manifest.exports['./surface'].types,'./dist/surface/index.d.ts');
  const code=`import {FluidWorld,FluidConfig,Vec3} from '@century/fluids';\nimport {JoltFluidBridge,Quat} from '@century/fluids/adapters/jolt';\nimport {createWaterWorld,extractWaterSurface} from '@century/fluids/water';\nimport {SurfaceConfig,extractSurface} from '@century/fluids/surface';\nconst world=createWaterWorld();\nworld.addParticle({position:Vec3.zero(),velocity:Vec3.zero(),massKg:1});\nif(extractWaterSurface(world).triangleCount===0||extractSurface(world.particleSnapshot(),SurfaceConfig.create({cellSizeMeters:.05,influenceRadiusMeters:.3,isoLevel:.3})).triangleCount===0)throw Error('no mesh');\nconst rot=Quat.identity();\nif(typeof JoltFluidBridge!=='function'||rot.w!==1||Vec3.zero().y!==0) throw Error('not exported');\nworld.shutdown();console.log('S06_INSTALLED_ADAPTER_JS_PASS');`;
  await writeFile(join(c,'smoke.mjs'),code);
  assert.match(run(process.execPath,['smoke.mjs'],c),/S06_INSTALLED_ADAPTER_JS_PASS/);
  const typeSource=`import {FluidWorld,FluidConfig,Vec3} from '@century/fluids';\nimport {JoltFluidBridge,Quat, type JoltBridgeBody} from '@century/fluids/adapters/jolt';\nimport {createWaterWorld,extractWaterSurface} from '@century/fluids/water';\nimport {SurfaceConfig,extractSurface,type SurfaceMesh} from '@century/fluids/surface';\nconst q:Quat=Quat.identity();\nconst w:FluidWorld=createWaterWorld();\nconst body:JoltBridgeBody={id:{GetIndexAndSequenceNumber:()=>42},motion:'static',shape:{kind:'box',halfExtents:Vec3.of(1,2,3)}};\nconst mesh:SurfaceMesh=extractWaterSurface(w);\nvoid [q,w,body,JoltFluidBridge,mesh,SurfaceConfig,extractSurface];`;
  await writeFile(join(c,'consumer.mts'),typeSource);
  run('tsc',['--strict','--noEmit','--skipLibCheck','--target','ES2022','--module','NodeNext','--moduleResolution','NodeNext','consumer.mts'],c);
  console.log(`S06_INSTALLED_PACKAGE_PASS files=${pkg.files.length} packedBytes=${pkg.size} js=yes types=yes joltRuntime=optional`);
 }finally{await rm(tmp,{force:true,recursive:true})}
});
