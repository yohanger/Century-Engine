import {DirectionalLight, HemisphereLight, PMREMGenerator, Scene, Vector3} from 'three';
import {Sky} from 'three/addons/objects/Sky.js';

/** Use one sun direction for the visible sky, direct lighting and sky reflection. */
export function addDaylight(renderer, scene, coastal = false) {
  const sun = (coastal ? new Vector3(-.66, .53, -.52) : new Vector3(-.35, .075, -.93)).normalize();
  const sky = new Sky();
  sky.scale.setScalar(400);
  const atmosphere = sky.material.uniforms;
  atmosphere.sunPosition.value.copy(sun);
  atmosphere.turbidity.value = 1.8;
  atmosphere.rayleigh.value = 1.65;
  atmosphere.cloudCoverage.value = 0;
  if(coastal)sky.material.fragmentShader=sky.material.fragmentShader.replace(
    'vec4( texColor, 1.0 )', 'vec4( texColor * vec3(.25, .32, .44), 1.0 )');

  const environmentScene = new Scene();
  environmentScene.add(sky);
  const generator = new PMREMGenerator(renderer);
  // Filter the atmospheric radiance without baking a high-energy hot pixel.
  // The directional light supplies the corresponding direct reflection.
  atmosphere.showSunDisc.value = 0;
  const reflection = generator.fromScene(environmentScene, 0, .1, 500);
  generator.dispose();
  atmosphere.showSunDisc.value = 1;
  const sunlight = new DirectionalLight(coastal ? 0xfff4df : 0xffe9c8, coastal ? 1.55 : 2.5);
  sunlight.position.copy(sun).multiplyScalar(24);
  const environment = [sky,sunlight,new HemisphereLight(0xb7d9f3, coastal ? 0x8e7d64 : 0x566066, coastal ? .66 : 1.1)];
  const setActive = active => {
    if(active) {
      scene.add(...environment);
      scene.environment=reflection.texture;
    } else scene.remove(...environment);
  };
  return {setActive,dispose:()=>{
    setActive(false);
    sky.geometry.dispose();
    sky.material.dispose();
    reflection.dispose();
  }};
}
