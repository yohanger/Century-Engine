# QA local — S16-G007-G002-G001 · Identidad del personaje por escena

**Estado previo:** 15/15 pruebas nuevas PASS; 52/52 regresión focal PASS. No se dispone de evidencia de Electron ni NGM Runtime.

## Instalación segura

Extraer **solo el SOURCE_BASELINE** en una carpeta nueva con `package.json` como raíz. Guardar G007-G001 como respaldo. No aplicar simultáneamente CHANGE y SOURCE_BASELINE, ni reemplazar proyectos de usuario. Alternativamente, CHANGE se extrae sobre una copia **intacta** de G007-G001, tras comparar cualquier modificación local.

Desde la raíz de LevelForge:

```bash
npm ci
node --test scripts/test-fps-native-player-s16-g007-g002-g001-scene-player-identity.mjs scripts/test-fps-native-player-s16-g007-g001-template-prefab.mjs scripts/test-hub-templates-s01-g001.mjs
npm run build
npm run electron
```

**Referencia automatizada:** 52 PASS / 0 FAIL. `npm ci` requiere red y dependencias; en el entorno de autoría Vite no estaba disponible, de modo que la compilación **no quedó verificada**.

## Matriz de aceptación en Editor

1. Crear un proyecto First Person; confirmar `Personaje FPS` en `Assets/Prefabs` y sus tres Scripts de Nodo.
2. Arrastrar **una** instancia del Prefab a la escena. Abrir el panel de propiedades de **Escena** y localizar «Personaje controlado».
3. Asignar el `CharacterBody3D` hijo de la instancia. Seleccionar otros nodos y cambiar de panel; la referencia debe seguir siendo la misma.
4. Duplicar el Prefab instanciado. La identidad debe seguir apuntando al primer cuerpo, sin saltar al duplicado.
5. Guardar, cerrar y reabrir el proyecto `.lfproj`: la identidad debe conservarse. Crear otra escena, asignar un personaje distinto y volver a la primera; cada escena conserva su elección.
6. Duplicar una escena y verificar su referencia local. No debe compartir estado editable con la escena de origen.
7. Desactivar el cuerpo o su padre: la UI informa de inactividad sin seleccionar otro cuerpo automáticamente. Volver a activarlo debe recuperar el estado válido.
8. Borrar el cuerpo asignado (o actualizar un Prefab que regenere sus IDs internos): la UI advierte referencia inexistente; no cambia automáticamente a otro personaje. Permite elegir uno válido o «Sin asignar».
9. Ejecutar Play y verificar que la asignación no puede modificarse durante la sesión. **En este G001 la identidad aún no cambia `game.player` ni reemplaza Spawn/FpsPlayer.**
10. Confirmar que las escenas antiguas sin `playerNodeId` siguen abriendo y reproduciendo con su mecanismo heredado.

**NGM Runtime:** el descriptor del paquete puede transportar `playerNodeId` pero **no lo consume aún**; no se exige que controle al personaje hasta G007-G002-G002. La exportación completa y la carga del descriptor siguen pendientes de evidencia local.

## Evidencia a devolver

- Salida de `node --test` y `npm run build`.
- Captura del panel Escena antes/después de elegir el personaje y, si procede, del aviso de referencia inválida.
- Resultado de guardar, reabrir, duplicar escena e instancia; errores relevantes de Consola o `game.log`.
- Indicar explícitamente si se probó Electron y/o NGM Runtime. No convertir pruebas omitidas en PASS.

## Incidencias externas a G001

La batería histórica de transiciones tiene tres fallos preexistentes (`SFT-14/15/16`: `_cameraReset is not a function`) en el SOURCE_BASELINE G007-G001 y en la intervención. No se modificaron sus harnesses ni los eventos de transiciones fuera del alcance autorizado.
