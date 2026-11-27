# G007-G001 — Manifiesto de cambios frente a SOURCE_BASELINE G006

**Referencia:** `LF_FPS_NATIVE_PLAYER_S16_G006_G001_NATIVE_INTERACTION_SOURCE_BASELINE.zip` (3.195 archivos). 

## Nuevos (7)

1. `src/core/templates/fps-player.js`: recursos de autoría del Prefab nativo y textos editables de los scripts G004–G006.
2. `scripts/test-fps-native-player-s16-g007-g001-template-prefab.mjs`: pruebas de creación, física, instanciación y persistencia de recursos.
3. `docs/architecture/LF-FPS-NATIVE-PLAYER-S16-G007-G001-FPS-TEMPLATE-PREFAB_IMPLEMENTATION.md`: contrato implementado y límites de transición.
4. `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G007-G001-FPS-TEMPLATE-PREFAB_QA.md`: matriz para QA del usuario.
5. `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G007-G001-FPS-TEMPLATE-PREFAB_CHANGE_MANIFEST.md`: este manifiesto.
6. `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G007-G001/node-tests.log`: evidencia automatizada.
7. `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G007-G001/build.log`: bloqueo de compilación reproducido.

## Modificados (4)

1. `src/core/templates/index.js`: declaración de recursos propios de First Person mediante `createResources`.
2. `src/core/project.js`: incorporación de carpetas, Prefabs y scripts declarados por el template durante `createProjectData`.
3. `scripts/test-hub-templates-s01-g001.mjs`: el harness extraído de `createProjectData` recibe `SCENE_FADE_DEFAULTS` (preexistía en producción y faltaba en el doble de prueba); el historial de 27 pruebas continúa intacto.
4. `docs/qa/LevelForge_DB_Ledger.xlsx`: G007-G001, evidencia, dependencias, trazabilidad y aprobación de G006 en seis hojas.

## Eliminados (0)

Ninguno. **Cambios inesperados: 0**. Se preservaron íntegramente los restantes 3.191 archivos del SOURCE_BASELINE de entrada.

## Verificación

- 10/10 pruebas G007-G001 PASS; 95/95 regresión seleccionada PASS.
- JavaScript: sintaxis PASS.
- `npm run build`: **NO COMPILADO** (`vite: not found`, código de salida 127).
- Editor/NGM Runtime: **NO VERIFICADOS**.
- La presencia del Prefab en Assets y su arrastre requieren QA local; la identidad/Spawn API permanece para G007-G002.
