/** Deterministic scene descriptions. No physics authority or renderer-specific state. */
import {CUP} from './cup.mjs';
import {makeShore} from './shore.mjs';
export const SCENARIOS=Object.freeze([
  Object.freeze({id:'tank',name:'Tanque de líquido',description:'Agua y límites estáticos',usesJolt:false}),
  Object.freeze({id:'dam',name:'Rotura de presa',description:'Bloque de líquido liberado',usesJolt:false}),
  Object.freeze({id:'obstacle',name:'Interacción con obstáculo',description:'Contacto con una esfera fija',usesJolt:false}),
  Object.freeze({id:'float',name:'Flotabilidad (Jolt)',description:'Cuerpo dinámico con Jolt WASM real',usesJolt:true}),
  Object.freeze({id:'shore',name:'Orilla rocosa',description:'Oleaje físico con batidor y fondo inclinado',usesJolt:false}),
  Object.freeze({id:'cup',name:'Vaso interactivo (Jolt)',description:'Recoger y verter agua con el ratón',usesJolt:true}),
  Object.freeze({id:'fall',name:'Caída libre',description:'Masa suspendida sobre el estanque',usesJolt:false}),
  Object.freeze({id:'river',name:'Río en cauce',description:'Caudal con entrada y drenaje medibles',usesJolt:false}),
  Object.freeze({id:'volumes',name:'Varios volúmenes',description:'Tres masas de agua con un separador',usesJolt:false}),
]);
const V=(x,y,z)=>({x,y,z});
export function makeScenario(id){
  const meta=SCENARIOS.find(x=>x.id===id);
  if(!meta)throw new Error(`Escenario desconocido: ${id}`);
  if(id==='shore')return makeShore(meta);
  if(id==='fall'||id==='river'||id==='volumes')return makeVolumeScenario(meta);
  const particles=[];
  const spacing=id==='cup'?.11:.12, massKg=1000*spacing**3;
  const dimensions=id==='cup'?[8,5,5]:id==='tank'?[4,4,4]:id==='dam'?[4,6,4]:[5,4,4];
  const [nx,ny,nz]=dimensions;
  // Match the demonstration footprint to the volume at this resolution.
  // A wide basin would spread this small particle set into isolated droplets.
  const tankSize={
    tank:{width:.68,depth:.68,height:.75},
    dam:{width:1.60,depth:.68,height:.95},
    obstacle:{width:1.38,depth:.68,height:.80},
    float:{width:.80,depth:.78,height:1.0},
    cup:{width:.94,depth:.74,height:1.20}
  };
  const tank=tankSize[id];
  const left=id==='dam'?-.68:id==='obstacle'?-.55:-(nx-1)*spacing/2;
  const bottom=.035,back=-(nz-1)*spacing/2;
  for(let x=0;x<nx;x++)for(let y=0;y<ny;y++)for(let z=0;z<nz;z++){
    particles.push({position:V(left+x*spacing,bottom+y*spacing,back+z*spacing),velocity:V(0,0,0),massKg});
  }
  const halfWidth=tank.width/2,halfDepth=tank.depth/2;
  const boundaries=[
    {kind:'plane',point:V(0,0,0),normal:V(0,1,0)},
    {kind:'plane',point:V(-halfWidth,0,0),normal:V(1,0,0)},
    {kind:'plane',point:V(halfWidth,0,0),normal:V(-1,0,0)},
    {kind:'plane',point:V(0,0,-halfDepth),normal:V(0,0,1)},
    {kind:'plane',point:V(0,0,halfDepth),normal:V(0,0,-1)},
  ];
  if(id==='obstacle')boundaries.push({kind:'sphere',center:V(.30,.18,0),radiusMeters:.16,friction:.35});
  const floatSphere=id==='float'?{
    radiusMeters:.16,position:V(0,.594,0),densityKgM3:940
  }:null;
  return {meta,particles,boundaries,floatSphere,tank,...(id==='cup'?{cup:CUP}:{})};
}

const region = (min, max, volumeM3) => ({min:V(...min),max:V(...max),volumeM3});

function makeVolumeScenario(meta) {
  const river = meta.id === 'river';
  const tank = {width:river ? 2.8 : 1.92, depth:.96, height:1.1};
  const x = tank.width / 2, z = tank.depth / 2;
  const boundaries = [
    {kind:'plane',point:V(0,0,0),normal:V(river ? .085 : 0,1,0)},
    {kind:'plane',point:V(-x,0,0),normal:V(1,0,0)},
    {kind:'plane',point:V(x,0,0),normal:V(-1,0,0)},
    {kind:'plane',point:V(0,0,-z),normal:V(0,0,1)},
    {kind:'plane',point:V(0,0,z),normal:V(0,0,-1)},
  ];
  if (river) {
    const water = [region([-1.3,.14,-.28],[-.7,.52,.28],.087)];
    const source = {...region([-1.28,.16,-.20],[-1.01,.47,.20]),rateM3S:.075};
    const outlet = {...region([1.05,0,-.47],[1.4,.5,.47]),rateM3S:.075};
    return {meta,tank,boundaries,water,source,outlet,cellSizeMeters:.12};
  }
  const water = meta.id === 'fall' ? [region([-.24,.60,-.24],[.24,.84,.24],.055296)] : [
    region([-.84,0,-.42],[-.50,.27,.06],.041),
    region([-.35,.25,.03],[-.04,.55,.38],.030),
    region([.30,0,-.40],[.83,.21,.35],.075),
  ];
  if (meta.id === 'volumes') boundaries.push({kind:'box',center:V(.15,.34,0),halfExtents:V(.045,.34,.48)});
  return {meta,tank,boundaries,water,cellSizeMeters:.10};
}
