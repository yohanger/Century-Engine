# S16-G007-G003-G001 — Manifiesto exacto de cambios

**Gate autorizado:** `LF-FPS-NATIVE-PLAYER-S16-G007-G003-G001-INTEGRATION-CONSUMER-AUDIT`.  
**SOURCE_BASELINE de entrada:** ZIP original del usuario `LF_FPS_NATIVE_PLAYER_S16_G007_G002_G003_G002_NATIVE_SPAWN_PLAYER_API_CA001_SOURCE_BASELINE(1).zip` (3.232 archivos, CRC PASS).  
**Alcance implementado:** auditoría contractual y del código, matriz de consumidores, plan de QA, evidencia de pruebas y ledger. **Sin implementación del runtime.**

## Comparación con la base

**Nuevos: 7. Modificados: 1. Eliminados: 0. Sin cambios: 3.231. Inesperados: 0.**

### Nuevos (7)

1. `docs/architecture/LF-FPS-NATIVE-PLAYER-S16-G007-G003-G001-INTEGRATION-CONSUMER-AUDIT.md`.
2. `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G007-G003-G001-CONSUMER-MATRIX.md`.
3. `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G007-G003-G001-QA-AND-GATE-PLAN.md`.
4. `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G007-G003-G001-CHANGE_MANIFEST.md` (este manifiesto).
5. `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G007-G003-G001/isolated-fps-gm-regression.log`.
6. `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G007-G003-G001/selected-node-regression.log`.
7. `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G007-G003-G001/spawn-prefab-focused.log`.

### Modificado (1)

- `docs/qa/LevelForge_DB_Ledger.xlsx`: actualizadas las seis hojas ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE y TRACEABILITY, preservando historial y diferenciando implementado, pruebas, QA y aprobación.

**Eliminados:** ninguno. **Cambios de producción, tests y scripts existentes:** ninguno.

## Evidencia

- Aislado S16 y GameManager: 162 PASS, 0 FAIL, 0 SKIP.
- Spawn Player + Prefabs aislados: 31 PASS, 0 FAIL, 0 SKIP.
- Suite ampliada que incorpora el test DB y dependencias históricas: 570 pruebas, 551 PASS, 19 FAIL, 0 SKIP. Son fallos observados en el mismo baseline, antes de cualquier modificación productiva; no se afirma que estén resueltos.
- Vite, Electron, Jolt WASM real, NGM Runtime y paridad visual: NO VERIFICADOS.

## Entrega y extracción

**A. CHANGE** contiene solo los 7 archivos nuevos y el Excel modificado. Extraerlo **sobre una COPIA intacta** del SOURCE_BASELINE de entrada, comparando antes cualquier modificación local. No borra archivos.

**B. SOURCE_BASELINE** contiene el proyecto completo y acumulativo. Para mayor seguridad, extraerlo en una **carpeta nueva**, cuya raíz contenga `package.json`. No aplicar también A sobre B.

**Conservar:** el ZIP anterior, tus proyectos `.lfproj`, escenas, scripts, ajustes y cambios locales. **No reemplazar:** proyectos abiertos ni archivos del usuario. **No eliminar:** ninguno (no se requiere limpieza de VSIX). Los dos ZIP excluyen builds, cachés, `node_modules` y temporales.

## Comandos y salida esperada

Desde la raíz que contiene `package.json`:

```bash
node --test scripts/test-fps-native-player-s16-g007-g002-g003-g002-native-spawn.mjs scripts/test-fps-native-player-s16-g007-g002-g003-g001-runtime-prefab.mjs
```

**Referencia:** 31 PASS, 0 FAIL, 0 SKIP. Para la regresión S16 completa y el control Database ver `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G007-G003-G001-QA-AND-GATE-PLAN.md`. La ejecución extendida puede reproducir los 19 fallos históricos ya documentados.

**Evidencia a devolver:** lectura/aprobación del informe documental, dudas sobre prioridad de Database frente al Prefab y política de reconstrucción de Spawn Player al cargar; logs locales solo si se ejecuta QA adicional. No interpretar aprobación documental como QA físico o compilación.

**Siguiente acción:** aprobación documental del Gate y, posteriormente, autorización **exacta independiente** para G003-G002. La política de guardado dinámico requiere decisión contractual previa. No hay código por instalar para nuevas funciones en este Gate.
