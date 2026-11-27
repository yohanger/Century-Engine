import {createWaterWorld, WaterHydrodynamics} from '@century/fluids/water';

export const FLUID_TYPES = Object.freeze([Object.freeze({
  id: 'water',
  label: 'Agua',
  description: 'Transporte de volumen por celdas',
  createWorld: (voxels) => createWaterWorld({voxels}),
  createHydrodynamics: () => new WaterHydrodynamics()
})]);

export function getFluidType(id) {
  const value = FLUID_TYPES.find(f => f.id === id);
  if (!value) throw Error('Especialización no disponible: ' + id);
  return value;
}
