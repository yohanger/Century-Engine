/** Shared geometry, motion limits and measurements for the open Jolt cup. */
const vector=(x,y,z)=>Object.freeze({x,y,z});
const inner=.16, thickness=.07, floor=.066, rim=.20;
const outside=inner+thickness, wallY=(floor+rim)/2, wallH=(rim-floor)/2;
const box=(center,halfExtents)=>Object.freeze({center,halfExtents});
export const CUP=Object.freeze({
  inner,floor,rim,outside,
  position:vector(0,.60,0),
  boxes:Object.freeze([
    box(vector(0,floor/2,0),vector(outside,floor/2,outside)),
    box(vector(-inner-thickness/2,wallY,0),vector(thickness/2,wallH,outside)),
    box(vector(inner+thickness/2,wallY,0),vector(thickness/2,wallH,outside)),
    box(vector(0,wallY,-inner-thickness/2),vector(inner,wallH,thickness/2)),
    box(vector(0,wallY,inner+thickness/2),vector(inner,wallH,thickness/2)),
  ]),
});
const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,x));
const tiltOf=pose=>2*Math.atan2(pose.rotation[2],pose.rotation[3]);

export function nextCupPose(pose,target,tank,contactRadius,dt) {
  const angle=tiltOf(pose);
  const tilt=angle+clamp(clamp(target.tilt,-2.2,2.2)-angle,-.85*dt,.85*dt);
  const [x,y,z]=pose.position;
  const dx=target.position.x-x,dy=target.position.y-y,dz=target.position.z-z;
  const length=Math.hypot(dx,dy,dz);
  const factor=length===0?0:Math.min(1,.48*dt/length);
  const sin=Math.sin(tilt),cos=Math.cos(tilt);
  const minX=-outside*Math.abs(cos)+Math.min(0,-rim*sin);
  const maxX=outside*Math.abs(cos)+Math.max(0,-rim*sin);
  const minY=-outside*Math.abs(sin)+Math.min(0,rim*cos);
  // A gap narrower than a particle diameter can trap a particle between the
  // fixed tank and the moving parallel face. Keep both collision skins apart.
  const gap=2*contactRadius+.008;
  return {
    position:vector(clamp(x+factor*dx,-tank.width/2-minX+gap,tank.width/2-maxX-gap),
      clamp(y+factor*dy,gap-minY,1.08),
      clamp(z+factor*dz,-tank.depth/2+outside+gap,tank.depth/2-outside-gap)),
    tilt,
  };
}

export function localInCup(pose,x,y,z) {
  const angle=tiltOf(pose),cos=Math.cos(angle),sin=Math.sin(angle);
  const dx=x-pose.position[0],dy=y-pose.position[1];
  return [cos*dx+sin*dy,-sin*dx+cos*dy,z-pose.position[2]];
}

export function cupContents(snapshot,pose) {
  const ids=[];
  let massKg=0;
  for (let i=0;i<snapshot.count;i++) {
    const offset=3*i;
    const [x,y,z]=localInCup(pose,...snapshot.positionsXYZ.subarray(offset,offset+3));
    if (Math.abs(x)>inner || Math.abs(z)>inner || y<floor || y>rim) continue;
    ids.push(snapshot.ids[i]);
    massKg+=snapshot.massesKg[i];
  }
  return {ids,massKg};
}

export function voxelCupContents(world, pose) {
  const h = world.cellSizeMeters;
  let volumeM3 = 0;
  for (const cell of world.cells()) {
    let inside = 0;
    for (const a of [.25, .75]) for (const b of [.25, .75]) for (const c of [.25, .75]) {
      const [x, y, z] = localInCup(pose, (cell.x + a) * h,
        cell.floorMeters + b * (cell.surfaceMeters - cell.floorMeters), (cell.z + c) * h);
      if (Math.abs(x) <= inner && Math.abs(z) <= inner && y >= floor && y <= rim) inside++;
    }
    volumeM3 += inside * cell.volumeM3 / 8;
  }
  return {volumeM3, massKg: volumeM3 * world.getConfig().restDensityKgM3};
}
