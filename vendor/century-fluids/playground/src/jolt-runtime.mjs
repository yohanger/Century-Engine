/** Host-owned real JoltPhysics.js 1.1.0 WASM. Only the bridge manipulates fluid. */
export async function createJoltHost(){
  // The default package is the upstream WASM-compat flavour: embedded WASM asset.
  const {default:initJolt}=await import('jolt-physics');
  const J=await initJolt();
  if(!J?.JoltInterface || !J?.JoltSettings || !J?.Vec3)throw Error('Jolt WASM no pudo inicializarse');
  const settings=new J.JoltSettings();
  const pairs=new J.ObjectLayerPairFilterTable(2);
  pairs.EnableCollision(0,1);pairs.EnableCollision(1,1);
  const bp0=new J.BroadPhaseLayer(0),bp1=new J.BroadPhaseLayer(1);
  const bpi=new J.BroadPhaseLayerInterfaceTable(2,2);
  bpi.MapObjectToBroadPhaseLayer(0,bp0);bpi.MapObjectToBroadPhaseLayer(1,bp1);
  settings.mObjectLayerPairFilter=pairs;
  settings.mBroadPhaseLayerInterface=bpi;
  settings.mObjectVsBroadPhaseLayerFilter=new J.ObjectVsBroadPhaseLayerFilterTable(bpi,2,pairs,2);
  const jolt=new J.JoltInterface(settings);
  J.destroy(settings);J.destroy(bp0);J.destroy(bp1);
  const system=jolt.GetPhysicsSystem(),bi=system.GetBodyInterface();
  const gravity=new J.Vec3(0,-9.81,0);
  system.SetGravity(gravity);J.destroy(gravity);
  let disposed=false;
  const bodies=new Set();
  function staticBox(halfExtents,center){
    const half=new J.Vec3(...halfExtents);
    const ss=new J.BoxShapeSettings(half),res=ss.Create();
    if(!res.IsValid())throw Error('Jolt rejected tank geometry');
    const shape=res.Get();shape.AddRef();J.destroy(res);J.destroy(ss);J.destroy(half);
    const point=new J.RVec3(...center),q=J.Quat.prototype.sIdentity();
    const cs=new J.BodyCreationSettings(shape,point,q,J.EMotionType_Static,0);
    let id;
    try{
      const body=bi.CreateBody(cs);if(!body)throw Error('Jolt tank body creation failed');
      id=body.GetID();bi.AddBody(id,J.EActivation_DontActivate);
    }finally{J.destroy(cs);J.destroy(point);}
    const owned={id,shape,disposed:false};bodies.add(owned);return owned;
  }
  return {
    J,bi,
    // The rigid sphere and the fluid occupy the same open tank. The planes in
    // FluidWorld remain the fluid boundary authority; these boxes are Jolt-only.
    createTank({width,depth,height}){
      const x=width/2,z=depth/2,y=height/2,t=.09;
      const walls=[];
      try{
        walls.push(staticBox([x+2*t,t,z+2*t],[0,-t,0]));
        walls.push(staticBox([t,y,z+2*t],[-x-t,y,0]));
        walls.push(staticBox([t,y,z+2*t],[x+t,y,0]));
        walls.push(staticBox([x,y,t],[0,y,-z-t]));
        walls.push(staticBox([x,y,t],[0,y,z+t]));
        return walls;
      }catch(error){
        for(const wall of walls)this.releaseBody(wall);
        throw error;
      }
    },
    createSphere({radiusMeters,position,densityKgM3}){
      if(disposed)throw Error('Jolt cerrado');
      const ss=new J.SphereShapeSettings(radiusMeters);
      if(densityKgM3!==undefined)ss.mDensity=densityKgM3;
      const res=ss.Create();
      if(!res.IsValid())throw Error('Jolt no aceptó la forma esférica');
      const shape=res.Get();shape.AddRef();J.destroy(res);J.destroy(ss);
      const p=new J.RVec3(position.x,position.y,position.z),q=J.Quat.prototype.sIdentity();
      const cs=new J.BodyCreationSettings(shape,p,q,J.EMotionType_Dynamic,1);
      cs.mMotionQuality=J.EMotionQuality_LinearCast;
      let id;
      try{const body=bi.CreateBody(cs);if(!body)throw Error('Jolt no creó el cuerpo');id=body.GetID();bi.AddBody(id,J.EActivation_Activate);}
      finally{J.destroy(cs);J.destroy(p);}
      const owned={id,radiusMeters,shape,disposed:false};bodies.add(owned);
      return owned;
    },
    createCup(spec){
      if(disposed) throw Error('Jolt cerrado');
      const compound=new J.StaticCompoundShapeSettings();
      const q=J.Quat.prototype.sIdentity();
      let shape,p,cs;
      try{
        for(const box of spec.boxes){
          const h=box.halfExtents,c=box.center;
          const half=new J.Vec3(h.x,h.y,h.z),offset=new J.Vec3(c.x,c.y,c.z);
          const settings=new J.BoxShapeSettings(half);
          const result=settings.Create();
          try{
            if(!result.IsValid())throw Error('Jolt no aceptó una pared del vaso');
            compound.AddShapeShape(offset,q,result.Get(),0);
          }finally{J.destroy(result);J.destroy(settings);J.destroy(offset);J.destroy(half);}
        }
        const result=compound.Create();
        try{
          if(!result.IsValid())throw Error('Jolt no aceptó el vaso compuesto');
          shape=result.Get();shape.AddRef();
        }finally{J.destroy(result);}
        const center=shape.GetCenterOfMass();
        const centerOfMass={x:center.GetX(),y:center.GetY(),z:center.GetZ()};
        p=new J.RVec3(spec.position.x,spec.position.y,spec.position.z);
        cs=new J.BodyCreationSettings(shape,p,q,J.EMotionType_Kinematic,1);
        cs.mMotionQuality=J.EMotionQuality_LinearCast;
        const body=bi.CreateBody(cs);
        if(!body)throw Error('Jolt no creó el vaso');
        const id=body.GetID();
        bi.AddBody(id,J.EActivation_Activate);
        const owned={id,shape,centerOfMass,disposed:false};bodies.add(owned);return owned;
      }catch(error){
        shape?.Release();
        throw error;
      }finally{
        if(cs)J.destroy(cs);
        if(p)J.destroy(p);
        J.destroy(compound);
      }
    },
    moveCup(body,pose,dt){
      const {x,y,z}=pose.position;
      const p=new J.RVec3(x,y,z);
      const q=new J.Quat(0,0,Math.sin(pose.tilt/2),Math.cos(pose.tilt/2));
      try{
        bi.MoveKinematic(body.id,p,q,dt);
        const v=bi.GetLinearVelocity(body.id),w=bi.GetAngularVelocity(body.id);
        return {v:[v.GetX(),v.GetY(),v.GetZ()],w:[w.GetX(),w.GetY(),w.GetZ()]};
      }finally{J.destroy(q);J.destroy(p);}
    },
    bodyTransform(body){
      const p=bi.GetPosition(body.id),q=bi.GetRotation(body.id);
      return {position:[p.GetX(),p.GetY(),p.GetZ()],rotation:[q.GetX(),q.GetY(),q.GetZ(),q.GetW()]};
    },
    step(dt){if(disposed)throw Error('Jolt cerrado');jolt.Step(dt,1);},
    releaseBody(body){
      if(body.disposed)return;
      bi.RemoveBody(body.id);bi.DestroyBody(body.id);body.shape.Release();body.disposed=true;bodies.delete(body);
    },
    shutdown(){
      if(disposed)return;
      // The fluid bridge must already be released before Jolt body cleanup.
      for(const body of [...bodies])this.releaseBody(body);
      J.destroy(jolt);disposed=true;
    }
  };
}
