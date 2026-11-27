// Registro de llamadas tardías entre módulos del estado. Rompe ciclos sin importar al otro lado: quien DEFINE la función la registra
// (`hooks.removeTerrain = removeTerrain`) y quien la NECESITA la llama al usarla (`hooks.removeTerrain()`), nunca al cargarse el módulo.
export const hooks = {}
