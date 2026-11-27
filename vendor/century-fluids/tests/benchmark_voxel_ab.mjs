import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {cpus} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';

const ids=['fall','pond','river','cup','body','volumes'];
const dt=1/120;
const repetitions=Number(process.env.CENTURY_VOXEL_REPEATS ?? 5);
const steps=Number(process.env.CENTURY_VOXEL_STEPS ?? 96);
const density=1000;

function v(x,y,z){return [x,y,z];}
const region=(x,y,z,w,h,d)=>({min:v(x,y,z),max:v(x+w,y+h,z+d)});
const walls=(x,z)=>[
  [v(-x,0,0),v(1,0,0)],[v(x,0,0),v(-1,0,0)],
  [v(0,0,-z),v(0,0,1)],[v(0,0,z),v(0,0,-1)]
];
const geometricVolume=({min,max})=>min.reduce((a,n,i)=>a*(max[i]-n),1);
const at=(p,r)=>p.every((n,i)=>n>=r.min[i]&&n<r.max[i]);
const quantile=(values,f)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(f*values.length))]??0;

function fixture(id,stress){
  const k=stress?2:1;
  const plane=[v(0,0,0),v(id==='river'?.08:0,1,0)];
  const boundaries=[plane,...walls(1.6*k,.54*k)];
  let water=[region(-.62*k,.018,-.32*k,.78*k,.36,.64*k)], source=null, sink=null, body=null, cup=null;
  if(id==='fall')water=[region(-.28*k,.72,-.19*k,.56*k,.27,.38*k)];
  if(id==='river'){
    water=[region(-1.44*k,.14*k,-.27*k,1.69*k,.22,.54*k)];
    source=region(-1.55*k,.25*k,-.20*k,.30*k,.35,.42*k);
    sink=region(1.02*k,0,-.54*k,.58*k,.74,1.08*k);
  }
  if(id==='pond'){
    water=[region(-.64*k,.29,-.24*k,.62*k,.34,.48*k)];
    source=region(-.26*k,.24,-.23*k,.49*k,.30,.48*k);
  }
  if(id==='cup'){
    water=[region(-.20, .37, -.20, .40,.24,.40)];
    cup={center:v(0,.03,0), half:.155, wall:.060, rim:.155};
  }
  if(id==='body')body={position:v(.16,.52,0),radius:.16,densityKgM3:810};
  if(id==='volumes'){
    water=[region(-1.45*k,.02,-.37*k,.49*k,.32,.42*k),
      region(-.42*k,.25,-.03*k,.52*k,.29,.42*k),
      region(.62*k,.03,-.40*k,.57*k,.26,.47*k)];
  }
  return {id,water,boundaries,source,sink,body,cup,packetM3:.003,spacing: .105,cell: id==='cup'?.075:.15};
}

async function run(root,mode,id,stress){
  const fs=fixture(id,stress);
  const path=part=>pathToFileURL(resolve(root,part)).href;
  const [{Vec3},water,surface,joltLib]=await Promise.all([
    import(path('dist/index.js')),import(path('dist/fluids/water/index.js')),import(path('dist/surface/index.js')),
    fs.body?import(path('playground/src/jolt-runtime.mjs')):null]);
  const joltBridge=fs.body?await import(path('dist/adapters/jolt.js')):null;
  const isVoxel=mode==='voxel', vec=a=>Vec3.of(...a);
  const posBox=b=>({min:vec(b.min),max:vec(b.max)});
  const getRSS=()=>process.resourceUsage().maxRSS*1024;
  global.gc?.();
  const zeroRSS=process.memoryUsage().rss;
  const initialPeakRSS=getRSS();
  const world=water.createWaterWorld(isVoxel?{voxels:{cellSizeMeters:fs.cell}}:{
    solver:{supportRadiusMeters:.265,particleContactRadiusMeters:.014}});
  for(const [point,normal] of fs.boundaries)world.addBoundary({kind:'plane',point:vec(point),normal:vec(normal)});
  if(id==='volumes')world.addBoundary({kind:'box',center:vec([.42*(stress?2:1),.27,0]),halfExtents:vec([.028,.27,.52*(stress?2:1)])});
  if(fs.cup){
    const {half,wall,rim}=fs.cup;
    const side=half+wall/2, wide=half+wall;
    const bottom=rim/2+wall;
    for(const [center,halfExtents] of [
      [v(0,wall/2,0),v(wide,wall/2,wide)],
      [v(side,bottom,0),v(wall/2,rim/2,wide)],[v(-side,bottom,0),v(wall/2,rim/2,wide)],
      [v(0,bottom,side),v(half,rim/2,wall/2)],[v(0,bottom,-side),v(half,rim/2,wall/2)]
    ])world.addBoundary({kind:'box',center:vec(center),halfExtents:vec(halfExtents)});
  }
  function emit(b,amount,packet=false){
    if(isVoxel)return world.fillBox(posBox(b),amount);
    const count=b.max.map((n,i)=>Math.max(1,Math.round((n-b.min[i])/fs.spacing)));
    const points=[];
    for(let i=0;i<count[0];i++)for(let j=0;j<count[1];j++)for(let k=0;k<count[2];k++){
      const index=[i,j,k], center=b.min.map((n,a)=>n+(b.max[a]-n)*(index[a]+.5)/count[a]);
      points.push({position:vec(center),velocity:Vec3.zero(),massKg:amount*density/(count[0]*count[1]*count[2])});
    }
    if(packet){
      const count=Math.max(1,Math.round(amount/fs.spacing**3));
      const chosen=Array.from({length:count},(_,i)=>({...points[Math.floor((i+.5)*points.length/count)],massKg:amount*density/count}));
      world.emitParticles(chosen);
    }else world.emitParticles(points);
    return amount;
  }
  const initialized=fs.water.reduce((sum,b)=>sum+emit(b,geometricVolume(b)),0);
  if(Math.abs(initialized-fs.water.reduce((sum,b)=>sum+geometricVolume(b),0))>1e-8)throw Error('initial volume differs');
  let bridge=null,jolt=null,body=null;
  if(fs.body){
    jolt=await joltLib.createJoltHost();
    const limits=jolt.createTank({width:3.2,depth:1.08,height:1});
    body=jolt.createSphere({...fs.body,radiusMeters:fs.body.radius,position:{x:fs.body.position[0],y:fs.body.position[1],z:fs.body.position[2]}});
    bridge=new joltBridge.JoltFluidBridge(world,jolt.J,jolt.bi,new water.WaterHydrodynamics());
    bridge.register({id:body.id,motion:'dynamic',shape:{kind:'sphere',radiusMeters:fs.body.radius},
      buoyancyScale:1,linearDragKgPerSecond:1,friction:0});
    body={ball:body,limits};
  }
  const meshCache=isVoxel?new surface.VoxelSurfaceCache():new surface.ChunkedSurfaceCache();
  const physics=[],meshing=[],checkpoints=[];
  let timedCpuUS=0;
  let emitted=0,drained=0,triangles=0,contacts=0,bytePeak=0,heapPeak=0,iterationLimits=0;
  function spatial(){
    if(isVoxel)return [...world.cells()].map(c=>({
      p:[(c.x+.5)*fs.cell,(c.floorMeters+c.surfaceMeters)/2,(c.z+.5)*fs.cell],m:c.volumeM3*density}));
    const f=world.particleSnapshot();
    return Array.from({length:f.count},(_,i)=>({p:[...f.positionsXYZ.subarray(3*i,3*i+3)],m:f.massesKg[i]}));
  }
  try{
    for(let i=0;i<steps;i++){
      const cpuStart=process.cpuUsage();
      const start=performance.now();
      if(fs.source && i%12===0)emitted+=emit(fs.source,fs.packetM3,true);
      if(fs.sink && i%12===0){
        if(isVoxel)drained+=world.drainBox(posBox(fs.sink),.006);
        else{
          const f=world.particleSnapshot();
          const ids=[];
          let quantity=0;
          for(let j=0;j<f.count&&quantity<.006;j++)if(at([...f.positionsXYZ.subarray(3*j,3*j+3)],fs.sink)){
            ids.push(f.ids[j]);quantity+=f.massesKg[j]/density;
          }
          drained+=world.drainParticles(ids)/density;
        }
      }
      const result=bridge?bridge.step(dt).liquid:world.step(dt);
      if(jolt)jolt.step(dt);
      if(i>=12){
        physics.push(performance.now()-start);
        const cpu=process.cpuUsage(cpuStart);
        timedCpuUS+=cpu.user+cpu.system;
      }
      contacts+=result.boundaryContacts;
      iterationLimits+=Number(result.convergence==='iteration_limit');
      if(i%12===0){
        const startMesh=performance.now();
        const mesh=isVoxel?meshCache.update(world,{smoothing:.67}):
          meshCache.update(world.particleSnapshot(),water.waterSurfaceConfig(world,{cellSizeMeters:.085,isoLevel:.65,
            influenceRadiusMeters:.17,maxTriangles:800000,maxGridPoints:800000}));
        triangles=mesh.triangles;
        if(i>=12)meshing.push(performance.now()-startMesh);
        const m=process.memoryUsage();
        bytePeak=Math.max(bytePeak,m.arrayBuffers);
        heapPeak=Math.max(heapPeak,m.heapUsed);
      }
      if([23,47,steps-1].includes(i)){
        const points=spatial();
        const mass=points.reduce((a,p)=>a+p.m,0);
        const insideCup=fs.cup?points.filter(p=>Math.abs(p.p[0])<fs.cup.half&&Math.abs(p.p[2])<fs.cup.half&&p.p[1]>=fs.cup.wall&&p.p[1]<fs.cup.rim+fs.cup.wall):[];
        checkpoints.push({seconds:(i+1)*dt,massKg:mass,
          centerY:points.reduce((a,p)=>a+p.m*p.p[1],0)/mass,
          cupKg:insideCup.reduce((a,p)=>a+p.m,0),furthestX:Math.max(...points.map(p=>p.p[0])),
          bodyY:body?jolt.bodyTransform(body.ball).position[1]:null,
          massErrorKg:Math.abs(mass-density*(initialized+emitted-drained))});
      }
    }
    return {id,mode,stress,resolutionMeters:isVoxel?fs.cell:fs.spacing,initialized,emitted,drained,physicsP50:quantile(physics,.5), physicsP95:quantile(physics,.95),
      meshP50:quantile(meshing,.5),meshP95:quantile(meshing,.95),updateMsPerSimSecond:physics.reduce((a,b)=>a+b,0)/(physics.length*dt),cpuMsPerSimSecond:timedCpuUS/(1000*physics.length*dt),
      initialPeakRSS,baselineRSS:zeroRSS,peakRSS:getRSS(),incrementalPeakRSS:Math.max(0,getRSS()-Math.max(zeroRSS,initialPeakRSS)),
      bytePeak,heapPeak,checkpoints,triangles,contacts,iterationLimits};
  } finally {
    bridge?.shutdown();
    if(body){jolt.releaseBody(body.ball);for(const wall of body.limits)jolt.releaseBody(wall);}
    jolt?.shutdown();
    world.shutdown();
  }
}

if(process.argv[2]==='--sample'){
  const [root,mode,id,size]=process.argv.slice(3);
  console.log(JSON.stringify(await run(root,mode,id,size==='stress')));
}else{
  const [reference,candidate,destination]=process.argv.slice(2);
  if(!reference||!candidate||!destination||!Number.isInteger(repetitions)||repetitions<1||steps<26)
    throw Error('Usage: node tests/benchmark_voxel_ab.mjs SPH_ROOT VOXEL_ROOT OUTPUT_JSON');
  const results=[];
  const failures=[];
  const filter=process.env.CENTURY_VOXEL_SCENE;
  if(filter&&!ids.includes(filter))throw Error('Unknown voxel fixture: '+filter);
  for(const id of (filter?[filter]:ids))for(const size of ['nominal','stress']){
    for(let i=0;i<repetitions;i++){
      for(const mode of (i%2===0?['sph','voxel']:['voxel','sph'])){
        const sample=spawnSync(process.execPath,['--expose-gc',fileURLToPath(import.meta.url),'--sample',
          mode==='sph'?reference:candidate,mode,id,size],{encoding:'utf8',timeout:120000});
        if(sample.status!==0)failures.push({id,size,mode,repeat:i,error:(sample.stderr||sample.error?.message||'').slice(-2600)});
        else results.push({...JSON.parse(sample.stdout.trim().split('\n').at(-1)),repeat:i});
      }
    }
    writeFileSync(destination,JSON.stringify({runtime:process.version,cpu:cpus()[0].model,
      dt,steps,warmupSteps:12,repetitions,results,failures},null,2)+'\n');
    console.log(id,size,'samples',results.length,'failures',failures.length);
  }
  if(failures.length)process.exitCode=1;
}
