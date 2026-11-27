// Importar una especie aquí la registra. Para añadir un animal nuevo: crear critters/<especie>.js (ver species.js) e importarlo.
import './firefly.js'
export { registerSpecies, getSpecies, allSpecies, SPECIES_LIST, normalizeCritter } from './species.js'
export { StateMachine } from './fsm.js'
