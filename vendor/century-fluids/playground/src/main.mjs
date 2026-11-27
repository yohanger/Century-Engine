import './style.css';
import {FLUID_TYPES} from './fluids.mjs';
import {SCENARIOS} from './scenarios.mjs';
import {SimulationSession} from './simulation.mjs';
import {createJoltHost} from './jolt-runtime.mjs';
import {PlaygroundRenderer} from './renderer.mjs';
import {advanceClock} from './clock.mjs';
const $=id=>document.getElementById(id);
const ui={fluid:$('fluidSelect'),scene:$('sceneSelect'),view:$('viewSelect'),quality:$('qualitySelect'),play:$('playButton'),playIcon:$('playIcon'),playLabel:$('playLabel'),step:$('stepButton'),reset:$('resetButton'),resetTop:$('resetTop'),speed:$('speedRange'),speedText:$('speedText'),mesh:$('meshRange'),meshText:$('meshText'),status:$('status'),notice:$('notice'),tint:$('waterTint'),transmission:$('waterTransmission'),foam:$('physicalFoam')};
for(const f of FLUID_TYPES)ui.fluid.add(new Option(f.label,f.id));
for(const s of SCENARIOS)ui.scene.add(new Option(s.name,s.id));
let graphics;
try{graphics=new PlaygroundRenderer($('viewport'));}
catch(error){
  $('viewport').textContent=`No se pudo inicializar WebGL: ${error.message}`;
  $('status').textContent='WEBGL BLOQUEADO';
  console.error('S09_WEBGL_BLOCKED',error);
  throw error;
}
let cupPress=null,press=null;
let jolt=null,session=null,playing=true,lastFrame=performance.now(),accumulator=0,lastMesh=-Infinity,lastPoints=-Infinity,meshStepTime=-Infinity,lastMetrics=-Infinity,frameCount=0,frameStart=performance.now(),fps=0,renderMs=0,physicsMs=0,meshMs=0,dropCount=0,simulationError=false,meshInfo=null;
const dt=1/120,smoothing={fast:.24,balanced:.67,fine:1};
const setText=(id,text)=>$(id).textContent=text;
function announce(message,isError=false){ui.notice.textContent=message;ui.notice.hidden=false;ui.notice.classList.toggle('error',isError);clearTimeout(announce.timer);announce.timer=setTimeout(()=>ui.notice.hidden=true,isError?7000:3200);}
function updatePlay(){ui.playLabel.textContent=playing?'Pausar':'Reproducir';ui.playIcon.textContent=playing?'❚❚':'▶';ui.status.textContent=simulationError?'ERROR':playing?'EJECUTANDO':'PAUSADO';ui.status.classList.toggle('status-error',simulationError);}
function refreshGeometry(force=false){
  if(!session)return;
  const now=performance.now();
  if((force||now-lastPoints>90)&&ui.view.value!=='surface'){
    graphics.updateParticles(session.snapshot());lastPoints=now;
  }
  if((force||(session.simulatedSeconds!==meshStepTime&&now-lastMesh>=Number(ui.mesh.value)))&&ui.view.value!=='particles'){
    const start=performance.now();
    // Only geometry. No fake water planes or alternate physical integrator.
    const level=smoothing[ui.quality.value];
    const next=session.extractChunks({smoothing:level,maxTriangles:100000});
    graphics.updateChunkSurfaces(next.changes,force?0:Math.min(160,Number(ui.mesh.value)));
    graphics.updateWetness(session.spec.terrain ? session.snapshot() : null, session.simulatedSeconds);
    meshMs=performance.now()-start;meshInfo={triangleCount:next.triangles,chunks:next.chunks,rebuilt:next.rebuilt,reused:next.reused};lastMesh=now;meshStepTime=session.simulatedSeconds;
  }
  graphics.updateBody(session.bodyTransform);
  graphics.updateCup(session.cupTransform);
}
function restart(){
  playing=false;updatePlay();
  cupPress=null;press=null;graphics.setOrbitEnabled(true);
  session?.shutdown();session=null;simulationError=false;
  try{
    session=new SimulationSession({fluidId:ui.fluid.value,scenarioId:ui.scene.value,jolt,foam:ui.foam.checked});
    graphics.clearChunkSurfaces();graphics.showScenario(session.spec);graphics.setView(ui.view.value);
    setText('sceneName',session.spec.meta.name);
    setText('modeLabel',session.spec.meta.usesJolt?'Agua voxelizada + Jolt':'Agua · flujo entre celdas');
    $('cupMetrics').hidden=!session.spec.cup;
    setText('viewportHint',session.spec.cup
      ?'Arrastra el vaso · Mayús + arrastrar: inclinar · Rueda al agarrar: profundidad'
      :'Clic en agua: oleaje · Arrastrar: orbitar · Rueda: zoom');
    accumulator=0;dropCount=0;lastMesh=-Infinity;lastPoints=-Infinity;meshInfo=null;
    refreshGeometry(true);playing=true;updatePlay();updateMetrics();announce('Escenario reiniciado');
  }catch(error){simulationError=true;updatePlay();announce(`Escenario bloqueado: ${error.message}`,true);console.error('S09_SCENE_FAIL',error);}
}
function stepOnce(){
  if(!session)return;
  try{
    const start=performance.now();session.step(dt);physicsMs=performance.now()-start;
    refreshGeometry(true);
    updateMetrics();
  }catch(error){playing=false;simulationError=true;updatePlay();announce(`Física detenida: ${error.message}`,true);console.error('S09_PHYSICS_FAIL',error);}
}
function updateMetrics(){
  if(!session)return;
  setText('particleValue',session.occupiedCellCount.toLocaleString('es-ES'));
  setText('triangleValue',(meshInfo?.triangleCount??0).toLocaleString('es-ES'));
  setText('chunkCount',String(meshInfo?.chunks??0));setText('chunkRebuilt',String(meshInfo?.rebuilt??0));setText('chunkReused',String(meshInfo?.reused??0));
  setText('contactValue',(session.lastStep?.boundaryContacts??0).toLocaleString('es-ES'));
  setText('convergenceValue',String(session.lastStep?.facesProcessed??0));
  setText('physicsMs',`${physicsMs.toFixed(1)} ms`);setText('meshMs',`${meshMs.toFixed(1)} ms`);setText('renderMs',`${renderMs.toFixed(1)} ms`);
  setText('simTime',`${session.simulatedSeconds.toFixed(2)} s`);
  setText('dropValue',String(dropCount));
  setText('massValue',session.world.totalMassKg.toFixed(3)+' kg');
  if(session.spec.cup) {
    const contents=session.cupContents;
    setText('cupMass',`${contents.massKg.toFixed(2)} kg`);
    setText('cupWork',`${session.cupWorkJ.toFixed(2)} J`);
  }
  const memory=performance.memory?.usedJSHeapSize;
  setText('memoryValue',memory?`${(memory/1048576).toFixed(1)} MiB`:'No disponible');
  setText('fpsValue',`${Math.round(fps)} FPS`);
  const active=session.lastStep?.activeCells ?? 0;
  setText('stepState',(session.spec.meta.usesJolt?'Fluido + Jolt WASM':'Fluido')+' · '+active+' celdas activas');
}
function frame(now){
  const elapsed=Math.min((now-lastFrame)/1000,.25);lastFrame=now;
  if(playing&&session){
    try{
      const start=performance.now();
      const out=advanceClock({accumulatorSeconds:accumulator,elapsedSeconds:elapsed,rate:Number(ui.speed.value),stepSeconds:dt,maxSteps:4,advance:step=>session.step(step)});
      accumulator=out.accumulatorSeconds;dropCount+=out.dropped;
      if(out.performed)physicsMs=(performance.now()-start)/out.performed;
      refreshGeometry();
    }catch(error){playing=false;simulationError=true;updatePlay();announce(`Simulación detenida: ${error.message}`,true);console.error('S09_RUNTIME_FAIL',error);}
  }
  graphics.setWaterClock(now/1000,ui.foam.checked);
  const start=performance.now();graphics.render();renderMs=performance.now()-start;
  frameCount++;
  if(now-frameStart>=1000){fps=1000*frameCount/(now-frameStart);frameCount=0;frameStart=now;}
  if(now-lastMetrics>200){updateMetrics();lastMetrics=now;}
  requestAnimationFrame(frame);
}
ui.play.addEventListener('click',()=>{if(!session)return;playing=!playing;updatePlay();updateMetrics();});
ui.step.addEventListener('click',()=>{playing=false;updatePlay();stepOnce();});
ui.reset.addEventListener('click',restart);ui.resetTop.addEventListener('click',restart);
for(const input of [ui.fluid,ui.scene])input.addEventListener('change',restart);
ui.view.addEventListener('change',()=>{graphics.setView(ui.view.value);refreshGeometry(true);});
ui.quality.addEventListener('change',()=>refreshGeometry(true));
ui.mesh.addEventListener('input',()=>ui.meshText.textContent=`${ui.mesh.value} ms`);
ui.speed.addEventListener('input',()=>ui.speedText.textContent=`${Number(ui.speed.value).toFixed(2).replace('.',',')}×`);
function updateWaterAppearance(){
  graphics.setWaterAppearance({
    tint:ui.tint.value,transmission:Number(ui.transmission.value),
  });
}
for(const input of [ui.tint,ui.transmission])input.addEventListener('input',updateWaterAppearance);
const canvas=$('viewport').querySelector('canvas');
canvas.addEventListener('pointerdown',event=>{
  if(!event.isPrimary||event.button!==0)return;
  const cup=session?.cupTransform;
  const drag=cup?graphics.startCupDrag(event.clientX,event.clientY):null;
  if(drag){
    cupPress={id:event.pointerId,drag,x:event.clientX,y:event.clientY,
      tilt:2*Math.atan2(cup.rotation[2],cup.rotation[3]),position:{
        x:cup.position[0],y:cup.position[1],z:cup.position[2],
      }};
    graphics.setOrbitEnabled(false);
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  press={id:event.pointerId,x:event.clientX,y:event.clientY};
},{capture:true});
function dragged(event){
  return Math.hypot(event.clientX-press.x,event.clientY-press.y)>5;
}
canvas.addEventListener('pointermove',event=>{
  if(cupPress?.id===event.pointerId){
    if(event.shiftKey)cupPress.tilt=Math.max(-2.2,Math.min(2.2,cupPress.tilt+(event.clientY-cupPress.y)*.012));
    else cupPress.position=graphics.moveCupDrag(cupPress.drag,event.clientX,event.clientY)??cupPress.position;
    cupPress.x=event.clientX;cupPress.y=event.clientY;
    session.setCupTarget(cupPress.position,cupPress.tilt);
    return;
  }
  if(press?.id===event.pointerId&&dragged(event))press=null;
});
canvas.addEventListener('wheel',event=>{
  if(!cupPress)return;
  event.preventDefault();
  const depth=Math.sign(event.deltaY)*.035;
  cupPress.position=graphics.moveCupDrag(cupPress.drag,cupPress.x,cupPress.y,depth)??cupPress.position;
  session.setCupTarget(cupPress.position,cupPress.tilt);
},{passive:false});
function releaseCup(id){
  if(cupPress?.id!==id)return false;
  cupPress=null;graphics.setOrbitEnabled(true);return true;
}
canvas.addEventListener('pointercancel',event=>{press=null;releaseCup(event.pointerId);});
canvas.addEventListener('lostpointercapture',event=>{releaseCup(event.pointerId);});
canvas.addEventListener('pointerup',event=>{
  if(releaseCup(event.pointerId))return;
  if(press?.id!==event.pointerId)return;
  const click=!dragged(event);
  press=null;
  if(!click||!session||simulationError)return;
  const point=graphics.pickWater(event.clientX,event.clientY);
  if(!point)return;
  session.queueSurfaceDisturbance(point);
  announce(playing?'Oleaje en el agua':'Pulso preparado para el siguiente paso');
});
window.addEventListener('pagehide',()=>{session?.shutdown();jolt?.shutdown();graphics.dispose();},{once:true});
const badge=$('engineBadge');
try{jolt=await createJoltHost();badge.textContent='Jolt WASM · real';badge.className='engine-badge ready';}
catch(error){badge.textContent='Jolt · no disponible';badge.className='engine-badge error';announce(`Jolt WASM no disponible: ${error.message}. Escenarios sin cuerpos rígidos disponibles.`,true);console.warn('S09_JOLT_BLOCKED',error);}
updateWaterAppearance();restart();requestAnimationFrame(frame);

// Visible operational marker, not a claim of QA acceptance.
console.info('S09_BROWSER_READY', {fluidTypes:FLUID_TYPES.map(x=>x.id),joltWasmReal:!!jolt});
