# QA — LF-NODE-AREA-SIGNAL-BRIDGE-S05-G001

**Estado:** NODE PASS focal; Electron y compilación NO VERIFICADOS; QA LOCAL PASS DECLARADO POR USUARIO · APROBADO; cierre administrativo técnico separado.

## Baterías ejecutadas en el entorno de implementación

| Batería | Resultado | Evidencia |
|---|---|---|
| S05 Node (18 casos) | 18 PASS, 0 FAIL | `scripts/test-node-area-signal-bridge-s05-g001.mjs` |
| Regresiones S01–S04, Area3D, Lifecycle, Physics Runtime y Scene Fade | 236 PASS, 0 FAIL | Salida `node --test` de 12 archivos |
| Barrido ampliado con Physics S02 | 277 PASS, 1 FAIL, 1 SKIP | `NP-29` falla también en S04 baseline: `migrateObjectGroups is not defined` |
| Sincronización referencia API | PASS | `node scripts/gen-docs.mjs --check` |
| Electron WebGL + Jolt WASM real | NO VERIFICADO | Runner bloqueado antes de iniciar Vite por dependencias ausentes |
| Compilación de Editor y Player | NO VERIFICADA | `vite: not found` |
| QA local Editor/Player | QA LOCAL PASS DECLARADO POR USUARIO · APROBADO | Aprobación expresada tras la entrega S05; sin atribuir logs Electron o compilación |

## Pruebas funcionales

Los 18 casos S05 incluyen señales físicas del emisor sin script, los cuatro tipos de señal, despacho multi-receptor, duplicados, desconexión, validación del sensor y método, nombres reservados, limpieza de emisor/receptor, reutilización de IDs, cambio de escena, Stop/Play, modificación durante la emisión, errores síncronos/Promise y ausencia de callbacks periódicos adicionales. Los casos originales Area3D conservan su comprobación de monitoring, monitorable y eventos de contacto.

## Instrucciones para QA local

En la carpeta nueva extraída del SOURCE_BASELINE S05:

```bash
npm ci
node --test scripts/test-node-area-signal-bridge-s05-g001.mjs
node --test scripts/test-node-area-signal-bridge-electron-s05-g001.mjs
node scripts/gen-docs.mjs --check
npm run build
npm run electron
```

El runner Electron debe abrir el Vite local y cargar Jolt WASM real, detectar sensores y cuerpo sólido, recibir los cuatro eventos y confirmar limpieza. Si falla, devolver la salida completa y el caso de reproducción; no declarar PASS.

En Play local, crear Area3D con CollisionShape3D y otro cuerpo/Area3D con forma, y conectar el método publicado de un Script de Nodo receptor. Comprobar entrada, salida, `monitoring`/`monitorable`, desconexión, eliminación y Stop/Play. Repetir en el Player si procede. La respuesta «Aprobado» del usuario implica QA LOCAL PASS declarado por él y será registrada sin exigir que repita las mismas pruebas.

## Incidencia fuera de alcance

`NP-29` falla en el baseline S04 original y no fue corregido en este Gate. No se interpreta como regresión introducida por S05.

## Actualización de continuidad — 2026-11-01

El usuario respondió «Aprobado. Sigamos.» a la entrega S05, bajo su criterio explícito de que «Aprobado» acredita QA local exhaustivo. Se registra **QA LOCAL PASS DECLARADO POR USUARIO · APROBADO** sin inventar capturas ni logs. El runner Electron/Jolt WASM y la compilación permanecen **NO VERIFICADOS en el entorno de implementación**; NP-29 permanece fuera de alcance. Esta nota no autoriza el código de S06.
