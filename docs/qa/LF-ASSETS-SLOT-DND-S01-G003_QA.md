# QA — LF-ASSETS-SLOT-DND-S01-G003

**Estado:** código integrado; TEST AUTOMATIZADO PASS; **COMPILADO NO VERIFICADO; QA LOCAL PENDIENTE; NO CERRADO**.

## Evidencia automatizada

- `npm run test:assets-slot-dnd`: **62 PASS, 0 FAIL, 0 SKIP** (26 G001 + 15 G002 + 21 G003).
- Regresión especializada seleccionada: **86 PASS, 0 FAIL**, excluyendo una batería opcional de VFX que no pudo iniciarse por falta de `jszip` instalado. No se presenta esa dependencia como fallo del nuevo código ni como test ejecutado.
- Los tests G003 verifican compatibilidad de tipos, validación por ID, rechazo, detención de propagación, mapeo de nombres del UI Designer (mediante funciones del componente ejecutadas en VM), y rutas de asignación existentes de Material/Shader/VFX/Inspector/ParamForm.
- `npm run build`: **NO VERIFICADO** en este entorno (`vite` no instalado, sin `node_modules`). `npm run docs:build/docs:check` también requieren `marked` instalado. La fuente del manual está actualizada; el HTML generado deberá regenerarse.

## QA local obligatorio

1. Assets → Materiales: arrastrar `.material` a una primitiva/malla. Comprobar nombre, edición compartida, material local, reemplazo, Undo/Redo y reapertura.
2. Material → Shader: arrastrar shader de superficie; arrastrar shader post (debe rechazarse). Textura normal/altura acepta solo imágenes válidas.
3. VFX Editor → Textura: asignar imagen desde Assets, guardar/reabrir el `.vfx` y comprobar vista previa.
4. VFX3D → Recurso: arrastrar `.vfx`; verificar que el efecto pertenece al nodo y cada instancia mantiene simulación independiente.
5. UI Designer: arrastrar audio a la propiedad de sonido y una textura a imagen/retrato; guardar/reabrir la `.ui`. Comprobar que las propiedades siguen usando nombres como el selector existente.
6. ParamForm en comandos/eventos: probar audio, textura, perfil, modelo y prefab; comprobar que audio se conserva por nombre e ID se usa donde ya estaba contratado.
7. Arrastres incompatibles, recursos eliminados y multiselección sobre un slot único: sin cambios ni creación de escena. Repetir selección por teclado y desasignación por selector.
8. Guardar/reabrir `.lfproj`, probar Undo/Redo y Player. Verificar también arrastres G001 y G002.
9. Ejecutar `npm ci`, `npm run test:assets-slot-dnd`, `npm run build`, `npm run electron`, `npm run docs:build`, `npm run docs:check`.

Devuelve la salida completa de las pruebas, el build y capturas de los destinos. **No declarar QA LOCAL PASS hasta recibir evidencia.**
