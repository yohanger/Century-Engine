# Manifiesto — LF-S13-S15-S16-INTEGRAL-CLOSURE-G001

**Gate autorizado:** `LF-S13-S15-S16-INTEGRAL-CLOSURE-G001`. **Fecha:** 2026-11-12.

**Fuente:** `LF_FPS_NATIVE_PLAYER_S16_G008_INTEGRAL_LEGACY_REMOVAL_SOURCE_BASELINE.zip` (3271 archivos, CRC PASS).

**Objetivo:** conciliación de evidencia y ledger de cierre S13/S15/S16. **Sin cambios de producción.** El usuario aprobó funcionalmente las tres áreas; el cierre administrativo está bloqueado por evidencia y contratos pendientes según el acta.

## Archivos modificados (2)

- `scripts/test-timeline-universal-animation-s13-g008-g001-corr003-continuation.mjs` — harness original: inyección del contrato vigente `_nodeEnabled` mediante `nodeEffectiveActive`; mantiene 9 pruebas y no cambia runtime.
- `docs/qa/LevelForge_DB_Ledger.xlsx` — 6 hojas sincronizadas, historial preservado, registros de conciliación y bloqueos.

## Archivos añadidos (9)

- `docs/qa/LF-S13-S15-S16-INTEGRAL-CLOSURE-G001_ACTA.md`
- `docs/qa/LF-S13-S15-S16-INTEGRAL-CLOSURE-G001_QA-LOCAL.md`
- `docs/qa/LF-S13-S15-S16-INTEGRAL-CLOSURE-G001_CHANGE-MANIFEST.md`
- `docs/qa/evidence/LF-S13-S15-S16-INTEGRAL-CLOSURE-G001/01-s13-initial.log`
- `docs/qa/evidence/LF-S13-S15-S16-INTEGRAL-CLOSURE-G001/02-s13-after-harness.log`
- `docs/qa/evidence/LF-S13-S15-S16-INTEGRAL-CLOSURE-G001/03-s15-node.log`
- `docs/qa/evidence/LF-S13-S15-S16-INTEGRAL-CLOSURE-G001/04-s16-node.log`
- `docs/qa/evidence/LF-S13-S15-S16-INTEGRAL-CLOSURE-G001/05-build-env.log`
- `docs/qa/evidence/LF-S13-S15-S16-INTEGRAL-CLOSURE-G001/06-types.log` (vacío: salida limpia de `tsc`, estado PASS indicado en acta).

**Eliminados:** ninguno. **Cambios inesperados:** ninguno. **Total SOURCE_BASELINE:** 3280 archivos.

## Aplicación segura

**Recomendado:** descomprimir SOURCE_BASELINE completo en una carpeta nueva, cuyo contenido incluya `package.json`. No mezclar CHANGE con el SOURCE_BASELINE nuevo. Conservar ZIP G008 y los proyectos/saves originales intactos.

**Alternativa CHANGE:** usar **exclusivamente** sobre una copia del baseline G008 original después de comparar cambios locales. Sobrescribir únicamente los dos archivos modificados y agregar los nueve nuevos de la lista. No hay nada que eliminar. Si el usuario ya ha cambiado uno de esos archivos, **no sobrescribir**: comparar primero y resolver las diferencias.

Sin `node_modules`, builds, temporales, cachés, `*.sh`, hashes externos ni dependencias instaladas.

## Prueba y evidencia

```bash
node --test scripts/test-timeline-universal-animation-s13-g008*.mjs
node --test scripts/test-camera-orchestration-s15-g*.mjs
node --test scripts/test-fps-native-player-s16-g*.mjs scripts/test-game-manager-g001.mjs scripts/test-hub-templates-s01-g001.mjs
npm run build
npm run electron
```

En el entorno de auditoría: S13 **288 PASS**, S15 **111 PASS/4 FAIL por dependencias npm faltantes**, S16 **286 PASS**, `npm run build` **exit 127** por Vite ausente. El resultado de S15 con dependencias instaladas será el que efectivamente arroje el equipo local; no se inventa un PASS. Devolver logs Node/build, capturas o vídeo Editor y resultado AppImage externo; los criterios completos están en `..._QA-LOCAL.md`.
