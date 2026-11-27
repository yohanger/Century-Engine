/** A contained coastal flume. The visible terrain and the contact field share these samples. */
const vector=(x,y,z)=>({x,y,z});
const origin=vector(-1.40,0,-1.38);
const columns=73, rows=73, cellSizeXMeters=.0385, cellSizeZMeters=.041;

function bed(x,z) {
  const beach=.014+.28*Math.max(0,z+.43);
  const bank=.56*(1-Math.exp(-12*Math.max(0,Math.abs(x)-.42)**2));
  const outcrop=(cx,cz,w,d,h)=>h*Math.exp(-(((x-cx)/w)**2+((z-cz)/d)**2));
  const rock=outcrop(-.61,-.60,.22,.44,.22)+outcrop(.54,-.19,.19,.40,.16)+
    outcrop(-.76,.55,.32,.30,.19)+outcrop(.85,.66,.34,.43,.20);
  const relief=.005*Math.sin(18*x+7*z)*Math.sin(13*z)+.003*Math.sin(37*x-28*z);
  // The rear bank starts beyond the paddle's entire physical stroke.
  const rearBank=Math.min(1,Math.max(0,(-1.30-z)/.077))*(.37+.065*Math.sin(13*x)+.021*Math.sin(49*x));
  return beach+bank+rock+relief+rearBank;
}

const terrain=Object.freeze({
  kind:'heightfield', origin, columns, rows, cellSizeXMeters, cellSizeZMeters,
  heightsMeters:Object.freeze(Array.from({length:columns*rows},(_,i)=>{
    const x=origin.x+(i%columns)*cellSizeXMeters,z=origin.z+Math.floor(i/columns)*cellSizeZMeters;
    return bed(x,z);
  })),
});

export function terrainHeight(field,x,z){
  const {origin:base,columns:nx,rows:nz,cellSizeXMeters:dx,cellSizeZMeters:dz,heightsMeters:heights}=field;
  const u=Math.max(0,Math.min(nx-1,(x-base.x)/dx)),v=Math.max(0,Math.min(nz-1,(z-base.z)/dz));
  const a=Math.min(nx-2,Math.floor(u)),b=Math.min(nz-2,Math.floor(v)),fu=u-a,fv=v-b;
  const i=b*nx+a;
  const near=heights[i]*(1-fu)+heights[i+1]*fu;
  const far=heights[i+nx]*(1-fu)+heights[i+nx+1]*fu;
  return base.y+near*(1-fv)+far*fv;
}

export function makeShore(meta){
  const spacing=.0875,massKg=1000*spacing**3;
  const particles=[];
  for(let x=0;x<10;x++)for(let z=0;z<14;z++){
    const px=(x-4.5)*spacing,pz=-1.19+spacing*z;
    const base=terrainHeight(terrain,px,pz)+.040;
    for(let y=0;y<(z<4?3:2);y++){
      particles.push({position:vector(px,base+y*spacing,pz),velocity:vector(0,0,0),massKg});
    }
  }
  const wave={originZ:-1.29,strokeMeters:.255,periodSeconds:2.1};
  const boundaries=[
    terrain,
    {kind:'plane',point:vector(-.475,0,0),normal:vector(1,0,0),friction:.04},
    {kind:'plane',point:vector(.475,0,0),normal:vector(-1,0,0),friction:.04},
    {kind:'plane',point:vector(0,0,1.36),normal:vector(0,0,-1)},
    {kind:'plane',point:vector(0,0,wave.originZ),normal:vector(0,0,1)},
  ];
  return {meta,particles,boundaries,terrain,wave,floatSphere:null,tank:{width:.95,depth:2.65,height:.66},
    solver:{supportRadiusMeters:.245,particleContactRadiusMeters:.016},
    surface:{influenceRadiusMeters:.183,isoLevel:.67},surfaceVerticalScale:1.53};
}

export function paddlePosition(wave,seconds){
  return wave.originZ+.5*wave.strokeMeters*(1-Math.cos(2*Math.PI*seconds/wave.periodSeconds));
}
