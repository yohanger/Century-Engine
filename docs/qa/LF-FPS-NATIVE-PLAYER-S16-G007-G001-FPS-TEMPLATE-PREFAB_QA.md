# S16-G007-G001 — QA local del Prefab First Person

**Estado:** IMPLEMENTADO; TEST AUTOMATIZADO PASS; COMPILACIÓN NO VERIFICADA; QA LOCAL PENDIENTE; NO CERRADO.

## Instalación

Extraer exclusivamente el SOURCE_BASELINE de G007-G001 en una **carpeta nueva**, sin sobrescribir proyectos `.lfproj` ni modificaciones locales. Alternativamente, aplicar CHANGE a una copia intacta del SOURCE_BASELINE G006, después de comparar los archivos. No instalar ambos ZIP sobre la misma carpeta.

Desde la raíz que contiene `package.json`:

```bash
npm ci
node --test scripts/test-fps-native-player-s16-g007-g001-template-prefab.mjs scripts/test-hub-templates-s01-g001.mjs
npm run build
npm run electron
```

Referencia de los dos tests: **37 PASS, 0 FAIL**; regresión más amplia G003–G007: **95 PASS, 0 FAIL**. La compilación solo podrá considerarse PASS si finaliza correctamente en el equipo local.

## Comprobaciones manuales en LevelForge Editor

1. Crear un **proyecto nuevo** eligiendo **First Person**. No reutilizar un `.lfproj` antiguo para esta prueba de creación.
2. En Assets, abrir `Prefabs`: debe existir **Personaje FPS** una sola vez.
3. En `Assets/Scripts` deben figurar `FPS-Locomocion.js`, `FPS-Camara.js` y `FPS-Interaccion.js`, editables. No se requieren archivos externos.
4. Arrastrar **Personaje FPS** al viewport sobre una superficie con colisión. Comprobar que aparece una instancia vinculada con Node3D, CharacterBody3D, cápsula y VistaFPS. La cámara debe ser hija del CharacterBody3D.
5. Duplicar la instancia: los nodos de cada instancia deben conservar identificadores distintos. Editar un recurso de script no debe duplicar los cuerpos físicos.
6. Guardar, cerrar y reabrir: el Prefab, sus scripts y sus asociaciones deben permanecer.
7. Crear un proyecto Empty y otro Vacío clásico: ninguno debe recibir el Prefab FPS.
8. Verificar que el FPS heredado continúa disponible mientras G007-G002 resuelve identidad y Spawn. Evitar interpretar como error que **la instancia nueva no sea todavía `game.player`**.

### Evidencia que debe devolver el usuario

Resultado de los comandos; capturas de Assets y Jerarquía con el Prefab instanciado; resultado de guardar/reabrir; `game.log` o consola si aparece un defecto. NGM Runtime no es criterio de cierre funcional de G001 antes de G007-G002, pero no declarar su paridad como PASS.

## Referencias de auditoría

- `docs/architecture/LF-FPS-NATIVE-PLAYER-S16-G007-G001-FPS-TEMPLATE-PREFAB_IMPLEMENTATION.md`.
- `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G007-G001/node-tests.log`.
- `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G007-G001/build.log`.
