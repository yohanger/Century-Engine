# QA — LF-ASSETS-SLOT-DND-S01-G002

**Estado:** implementación entregada; QA local pendiente. **Baseline:** G001 aprobado.

## Automatización ejecutada

- `npm run test:assets-slot-dnd`: 26 G001 + 15 G002 = **41 PASS, 0 FAIL, 0 SKIP**.
- G002 ejecuta directamente handlers `drop`, `dragOver` y `dragLeave` de `ResourceDropSlot.vue` con emisor y resolvedor reales de G001; prueba aceptación, rechazo, tipos, IDs, multiselección, corrupción, no propagación e integración de código con las rutas de actualización y selectores.
- Batería ampliada: **132 PASS / 1 FAIL**, `HC-15`. Comprobada por separado en la carpeta fuente de G001 **sin cambios**, donde también falla (14 PASS / 1 FAIL) por diferencias entre serialización esperada y campos predeterminados. Fuera del Gate; no se cambió el contrato del proyecto para acomodar la prueba.
- `npm run build`: **NO VERIFICADO** (`vite: not found`, falta `node_modules`). `npm ci` requiere entorno con acceso a dependencias.

## QA local a ejecutar por el usuario

1. Con el Inspector abierto, arrastrar una textura desde Assets sobre `Decal → Textura`: se asigna por ID y aparece en el selector. Repetir con otra textura, seleccionar «Sin textura», guardar y reabrir.
2. Arrastrar un audio `.ogg`, `.wav` o `.mp3` desde Assets a `Audio Source → Clip` y repetir para luz con componente audio. Probar el clip, quitarlo con «ninguno», y verificar Undo/Redo para el Drop.
3. Arrastrar un perfil `.post` desde Assets a `Cámara`, `Spawn` y `PostProcessVolume`. Comprobar selección, edición, desasignación y reabrir `.lfproj`.
4. Arrastrar un material al campo Audio o un script al campo Decal: debe mostrar rechazo y no modificar el valor.
5. Arrastrar varios recursos, uno eliminado y otro movido/renombrado: múltiples/eliminados rechazan; renombrados/movidos resuelven por ID.
6. Soltar sobre un slot sin que se cree un nuevo nodo en la escena. Los archivos externos no deben importar automáticamente a ese slot.
7. Regresión: script de nodo por Drop, ImageField, IconField y terreno siguen funcionando. Verificar selección y navegación de teclado.
8. `npm ci`, `npm run test:assets-slot-dnd`, `npm run build`, `npm run electron`; capturar terminal, Inspector y resultado tras guardar/reabrir.

## Cierre

**IMPLEMENTADO** y **TEST AUTOMATIZADO PASS** no equivalen a **COMPILADO** o **QA LOCAL PASS**. Requiere evidencia del usuario antes de declarar **CERRADO**. Los editores especializados de G003 y la integración global G004 permanecen PENDIENTE PLANIFICADO.
