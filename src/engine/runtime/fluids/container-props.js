export const FLUID_CONTAINER_KINDS={cup:{label:'Recipiente · taza',vessel:'cup',shape:'cylinder',size:[0.08,0.1,0.08],initialM3:0.00025},bottle:{label:'Recipiente · botella',vessel:'bottle',shape:'cylinder',size:[0.075,0.24,0.075],initialM3:0.0005},tank:{label:'Recipiente · depósito',vessel:'tank',shape:'box',size:[1,0.8,1],initialM3:0.4}}
export function fluidContainerDefaults(kind='cup') {
  const preset=FLUID_CONTAINER_KINDS[kind]||FLUID_CONTAINER_KINDS.cup
  return {enabled:true,simulation:'particles',quality:'balanced',liquidId:'water',pourRate:0.5,closed:false,showVessel:true,...preset,size:[...preset.size]}
}
