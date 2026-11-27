/** View-only Three.js adapter. Never advances FluidWorld or Jolt. */
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import shoreSandUrl from './assets/shore-sand.webp';
import shoreRockUrl from './assets/shore-rock.webp';
import {addDaylight} from './water-appearance.mjs';
import {makeShoreTerrain} from './shore-visual.mjs';
import {addWaterOpticsAttributes,installWaterOptics} from './water-optics.mjs';

function surfaceGeometry(mesh,verticalScale=1) {
  const geometry = new THREE.BufferGeometry();
  const positions=verticalScale===1?mesh.positionsXYZ:mesh.positionsXYZ.slice();
  const normals=verticalScale===1?mesh.normalsXYZ:mesh.normalsXYZ.slice();
  if(verticalScale!==1)for(let i=0;i<positions.length;i+=3){
    positions[i+1]/=verticalScale;
    const x=normals[i],y=normals[i+1]*verticalScale,z=normals[i+2];
    const length=Math.hypot(x,y,z);
    if(length>0){normals[i]=x/length;normals[i+1]=y/length;normals[i+2]=z/length;}
  }
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  return geometry;
}
export class PlaygroundRenderer {
  #renderer;#scene;#camera;#controls;#mesh;#chunkMeshes=new Map();#environment;#chunkGroup;#points;#props;#bodyMesh=null;#resize;#width=0;#height=0;
  #raycaster=new THREE.Raycaster();
  #surfaceTransitions=new Map();
  #cupMesh=null;
  #shore=null;#verticalScale=1;#coastalEnvironment;#shoreMaterial;#shoreAppearance;#waterSeconds;#floor;#grid;#textures;#shoreTerrain;
  constructor(container){
    this.#renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    this.#renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.#renderer.toneMapping=THREE.NeutralToneMapping;
    this.#renderer.localClippingEnabled=true;
    this.#renderer.transmissionResolutionScale=.5;
    this.#renderer.setClearColor(0x0b1525);
    this.#scene=new THREE.Scene();this.#scene.fog=new THREE.FogExp2(0x9ab6c7,.032);
    this.#environment=addDaylight(this.#renderer,this.#scene);
    this.#environment.setActive(true);
    this.#camera=new THREE.PerspectiveCamera(50,1,.05,90);
    this.#camera.position.set(1.65,1.17,2.0);
    this.#controls=new OrbitControls(this.#camera,this.#renderer.domElement);
    this.#controls.target.set(0,.33,0);this.#controls.enableDamping=true;this.#controls.dampingFactor=.08;
    this.#controls.minDistance=1.2;this.#controls.maxDistance=12;
    const grid=new THREE.GridHelper(22,44,0x2d3b53,0x1d2c43);grid.position.y=-.015;this.#scene.add(grid);this.#grid=grid;
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(24,24),new THREE.MeshStandardMaterial({color:0x142333,roughness:.88,envMapIntensity:.2}));
    floor.rotation.x=-Math.PI/2;floor.position.y=-.035;this.#scene.add(floor);this.#floor=floor;
    this.#mesh=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshPhysicalMaterial({
      color:0xe3f7ff, metalness:0, roughness:.11,
      transmission:.96, ior:1.333, thickness:.22,
      attenuationColor:0x67bbc4, attenuationDistance:.65,
      envMapIntensity:1, side:THREE.FrontSide
    }));
    this.#waterSeconds=installWaterOptics(this.#mesh.material);
    this.#shoreMaterial=new THREE.MeshPhysicalMaterial({
      color:0xf4fff9,metalness:0,roughness:.075,transmission:.98,
      ior:1.333,thickness:.12,attenuationColor:0x43c5bf,attenuationDistance:.48,envMapIntensity:.54,specularIntensity:.68,
    });
    this.#shoreAppearance=installWaterOptics(this.#shoreMaterial,true);
    this.#mesh.renderOrder=2;this.#scene.add(this.#mesh);
    this.#chunkGroup=new THREE.Group();this.#chunkGroup.renderOrder=2;this.#scene.add(this.#chunkGroup);
    this.#mesh.visible=false;
    this.#points=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({color:0x64d9ff,size:.055,transparent:true,opacity:.82,depthWrite:false}));
    this.#points.renderOrder=3;this.#scene.add(this.#points);
    this.#props=new THREE.Group();this.#scene.add(this.#props);
    container.append(this.#renderer.domElement);
    this.#resize=new ResizeObserver(()=>this.resize(container));this.#resize.observe(container);this.resize(container);
  }
  resize(container){const w=Math.max(1,container.clientWidth),h=Math.max(1,container.clientHeight);if(w===this.#width&&h===this.#height)return;this.#width=w;this.#height=h;this.#camera.aspect=w/h;this.#camera.updateProjectionMatrix();this.#renderer.setSize(w,h,false);}
  setView(mode){this.#mesh.visible=false;this.#chunkGroup.visible=mode!=='particles';this.#points.visible=mode!=='surface';}
  setWaterAppearance({tint, transmission}) {
    const material = this.#mesh.material;
    material.attenuationColor.set(tint);
    material.color.copy(material.attenuationColor).lerp(new THREE.Color(0xffffff), .28);
    material.transmission = transmission;
    const shore=this.#shoreMaterial;
    shore.attenuationColor.set(tint);
    shore.transmission=transmission;
  }
  #cursorRay(clientX,clientY){
    const {left,top,width,height}=this.#renderer.domElement.getBoundingClientRect();
    const x=2*(clientX-left)/width-1,y=1-2*(clientY-top)/height;
    this.#camera.updateMatrixWorld();
    this.#raycaster.setFromCamera({x,y},this.#camera);
    return this.#raycaster;
  }
  setOrbitEnabled(enabled){this.#controls.enabled=enabled;}
  startCupDrag(x,y){
    if(!this.#cupMesh)return null;
    const caster=this.#cursorRay(x,y);
    if(!caster.intersectObject(this.#cupMesh,true).some(hit=>hit.object.isMesh))return null;
    const normal=this.#camera.getWorldDirection(new THREE.Vector3());
    normal.y=0;
    if(normal.lengthSq()<1e-8)return null;
    const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal.normalize(),this.#cupMesh.position);
    const anchor=caster.ray.intersectPlane(plane,new THREE.Vector3());
    if(!anchor)return null;
    return {plane,offset:this.#cupMesh.position.clone().sub(anchor)};
  }
  moveCupDrag(drag,x,y,depth=0){
    drag.plane.constant-=depth;
    const target=this.#cursorRay(x,y).ray.intersectPlane(drag.plane,new THREE.Vector3());
    return target?.add(drag.offset)??null;
  }
  pickWater(clientX, clientY) {
    if (!this.#chunkGroup.visible) return null;
    this.#cursorRay(clientX,clientY);
    const hit = this.#raycaster.intersectObjects(this.#chunkGroup.children, false)
      .find(entry => this.#mesh.material.clippingPlanes.every(plane => plane.distanceToPoint(entry.point) >= 0));
    if (!hit) return null;
    const solid = this.#raycaster.intersectObjects(this.#props.children, true).find(hit=>hit.object.isMesh);
    return solid && solid.distance < hit.distance ? null : hit.point;
  }
  updateSurface(mesh){
    const prev=this.#mesh.geometry,geometry=surfaceGeometry(mesh,this.#verticalScale);
    addWaterOpticsAttributes(geometry,this.#shore);
    this.#mesh.geometry=geometry;prev.dispose();
  }
  clearChunkSurfaces(){
    for(const mesh of this.#chunkMeshes.values()){
      this.#chunkGroup.remove(mesh);mesh.geometry.dispose();
    }
    this.#chunkMeshes.clear();
    this.#surfaceTransitions.clear();
  }
  updateChunkSurfaces(changes,duration=0){
    const previous=new Map();
    if(duration>0){
      for(const {key} of changes){
        const tile=this.#chunkMeshes.get(key);
        if(!tile)continue;
        const geometry=tile.geometry;
        const influence=tile.morphTargetInfluences?.[0]??0;
        const position=geometry.getAttribute('position').array;
        const normal=geometry.getAttribute('normal').array;
        const oldPosition=geometry.morphAttributes.position?.[0]?.array;
        const oldNormal=geometry.morphAttributes.normal?.[0]?.array;
        const keys=tile.userData.vertexKeys;
        for(let i=0;i<keys.length;i++){
          if(!previous.has(keys[i]))previous.set(keys[i],{offset:3*i,position,normal,oldPosition,oldNormal,influence});
        }
      }
    }else{
      for(const tile of this.#surfaceTransitions.keys())tile.morphTargetInfluences[0]=0;
      this.#surfaceTransitions.clear();
    }
    const start=performance.now();
    for(const {key,mesh} of changes){
      const old=this.#chunkMeshes.get(key);
      if(old){
        this.#surfaceTransitions.delete(old);
        this.#chunkGroup.remove(old);
        old.geometry.dispose();
        this.#chunkMeshes.delete(key);
      }
      if(!mesh)continue;
      const geometry=surfaceGeometry(mesh,this.#verticalScale);
      addWaterOpticsAttributes(geometry,this.#shore,mesh);
      if(previous.size){
        const positions=geometry.getAttribute('position').array.slice();
        const normals=geometry.getAttribute('normal').array.slice();
        let matched=false;
        for(let i=0;i<mesh.vertexKeys.length;i++){
          const prior=previous.get(mesh.vertexKeys[i]);
          if(!prior)continue;
          matched=true;
          const {offset,position,normal,oldPosition,oldNormal,influence}=prior;
          for(let j=0;j<3;j++){
            const k=offset+j;
            positions[3*i+j]=position[k]+((oldPosition?.[k]??position[k])-position[k])*influence;
            normals[3*i+j]=normal[k]+((oldNormal?.[k]??normal[k])-normal[k])*influence;
          }
        }
        if(matched){
          geometry.morphAttributes.position=[new THREE.BufferAttribute(positions,3)];
          geometry.morphAttributes.normal=[new THREE.BufferAttribute(normals,3)];
        }
      }
      const tile=new THREE.Mesh(geometry,this.#shore?this.#shoreMaterial:this.#mesh.material);
      tile.userData.vertexKeys=mesh.vertexKeys;
      if(tile.morphTargetInfluences){
        tile.morphTargetInfluences[0]=1;
        this.#surfaceTransitions.set(tile,{start,duration});
      }
      tile.renderOrder=2;
      this.#chunkGroup.add(tile);this.#chunkMeshes.set(key,tile);
    }
  }
  updateParticles(snapshot){
    const newPositions=new Float32Array(snapshot.positionsXYZ);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(newPositions,3));
    const prev=this.#points.geometry;this.#points.geometry=g;prev.dispose();
  }
  setWaterClock(seconds,foam){
    this.#waterSeconds.seconds.value=this.#shoreAppearance.seconds.value=seconds;
    this.#waterSeconds.foam.value=this.#shoreAppearance.foam.value=Number(foam);
  }
  updateWetness(snapshot,seconds){
    if(this.#shoreTerrain&&snapshot)this.#shoreTerrain.updateWetness(snapshot,seconds);
  }
  showScenario(spec){
    this.#props.traverse(o=>{if(o.isMesh||o.isLineSegments){o.geometry.dispose();o.material.dispose();}});
    this.#props.clear();this.#shoreTerrain?.dispose();this.#shoreTerrain=null;this.#bodyMesh=null;this.#cupMesh=null;
    // Clip the reconstructed liquid surface at the tank planes.
    // This affects display only; the chunk meshes retain their original geometry.
    this.#mesh.material.clippingPlanes=spec.boundaries.filter(b=>b.kind==='plane').map(b=>{
      const normal=new THREE.Vector3(b.normal.x,b.normal.y,b.normal.z);
      return new THREE.Plane().setFromNormalAndCoplanarPoint(normal,
        new THREE.Vector3(b.point.x,b.point.y,b.point.z));
    });
    this.#shoreMaterial.clippingPlanes=this.#mesh.material.clippingPlanes;
    const wasShore=!!this.#shore;
    this.#shore=spec.terrain??null;
    this.#verticalScale=1;
    if(this.#shore){
      this.#textures??=[shoreSandUrl,shoreRockUrl].map(url=>{
        const texture=new THREE.TextureLoader().load(url);
        texture.colorSpace=THREE.SRGBColorSpace;
        texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
        texture.anisotropy=Math.min(8,this.#renderer.capabilities.getMaxAnisotropy());
        return texture;
      });
      const {origin,columns,rows,cellSizeXMeters,cellSizeZMeters}=this.#shore;
      const {bed}=this.#shoreAppearance;
      bed.sand.value=this.#textures[0];
      bed.uv.value.set(origin.x,origin.z,1/((columns-1)*cellSizeXMeters),1/((rows-1)*cellSizeZMeters));
      this.#shoreTerrain=makeShoreTerrain(this.#shore,...this.#textures);
      this.#props.add(this.#shoreTerrain.mesh);
      this.#coastalEnvironment??=addDaylight(this.#renderer,this.#scene,true);
    }
    if(wasShore!==!!this.#shore){
      this.#coastalEnvironment?.setActive(!!this.#shore);
      this.#environment.setActive(!this.#shore);
      if(this.#shore){
        this.#camera.position.set(.26,.78,.94);
        this.#controls.target.set(-.04,.115,-.48);
      }else{
        this.#camera.position.set(1.65,1.17,2);
        this.#controls.target.set(0,.33,0);
      }
      this.#controls.update();
    }
    this.#grid.visible=this.#floor.visible=!this.#shore;
    if(spec.cup){
      this.#cupMesh=new THREE.Group();
      for(const box of spec.cup.boxes){
        const h=box.halfExtents,c=box.center;
        const geometry=new THREE.BoxGeometry(2*h.x,2*h.y,2*h.z);
        const wall=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({
          color:0xbde3f0,roughness:.21,transparent:true,opacity:.22,depthWrite:false,
        }));
        wall.position.set(c.x,c.y,c.z);wall.renderOrder=4;
        const outline=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),
          new THREE.LineBasicMaterial({color:0xaeeaff,transparent:true,opacity:.83}));
        wall.add(outline);this.#cupMesh.add(wall);
      }
      this.#props.add(this.#cupMesh);
    }
    if(!this.#shore){
      const tank=new THREE.BoxGeometry(spec.tank.width,spec.tank.height,spec.tank.depth);
      const edges=new THREE.LineSegments(new THREE.EdgesGeometry(tank),new THREE.LineBasicMaterial({color:0x55738c,transparent:true,opacity:.35}));
      edges.position.y=spec.tank.height/2;tank.dispose();this.#props.add(edges);
    }
    for(const o of spec.boundaries.filter(b=>b.kind==='sphere')){
      const obj=new THREE.Mesh(new THREE.SphereGeometry(o.radiusMeters,24,16),new THREE.MeshStandardMaterial({color:0x8995aa,metalness:.48,roughness:.45}));
      obj.position.set(o.center.x,o.center.y,o.center.z);this.#props.add(obj);
    }
    if(spec.floatSphere){this.#bodyMesh=new THREE.Mesh(new THREE.SphereGeometry(spec.floatSphere.radiusMeters,28,20),new THREE.MeshStandardMaterial({color:0xffaf60,metalness:.5,roughness:.28}));this.#props.add(this.#bodyMesh);this.#bodyMesh.position.set(spec.floatSphere.position.x,spec.floatSphere.position.y,spec.floatSphere.position.z);}
  }
  updateBody(pose){if(this.#bodyMesh&&pose){this.#bodyMesh.position.fromArray(pose.position);this.#bodyMesh.quaternion.fromArray(pose.rotation);}}
  updateCup(pose){if(this.#cupMesh&&pose){
    this.#cupMesh.position.fromArray(pose.position);this.#cupMesh.quaternion.fromArray(pose.rotation);
  }}
  render(){
    const now=performance.now();
    for(const [tile,{start,duration}] of this.#surfaceTransitions){
      const remaining=Math.max(0,1-(now-start)/duration);
      tile.morphTargetInfluences[0]=remaining;
      if(remaining===0)this.#surfaceTransitions.delete(tile);
    }
    this.#controls.update();
    this.#renderer.render(this.#scene,this.#camera);
  }
  dispose(){
    this.clearChunkSurfaces();this.#resize.disconnect();this.#controls.dispose();
    this.#scene.traverse(obj=>{if(obj.isMesh||obj.isPoints||obj.isLineSegments){obj.geometry?.dispose();if(Array.isArray(obj.material))obj.material.forEach(m=>m.dispose());else obj.material?.dispose();}});
    this.#shoreTerrain?.dispose();this.#textures?.forEach(texture=>texture.dispose());this.#shoreMaterial.dispose();this.#coastalEnvironment?.dispose();this.#environment.dispose();this.#renderer.dispose();this.#renderer.domElement.remove();
  }
}
