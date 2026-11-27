# QA — S11-G007-G001 · Fundidos editables sobre Audio

## Evidencia obtenida (entorno de preparación)

| Verificación | Estado respaldado |
|---|---|
| Node focal `test-timeline-audio-fade-handles-s11-g007-g001.mjs` | **17 PASS / 0 FAIL** |
| Node compatible con S12-G002/G003/G004/G005 | **88 PASS / 1 SKIP / 0 FAIL** |
| Regresión ampliada incluyendo suite histórica S11-G003 | **154 PASS / 3 SKIP / 1 FAIL infraestructura** (falta `@vue/compiler-sfc`) |
| Sintaxis de fixture y módulo JS | **5 PASS**; no equivale a compilación Vue |
| Electron embebido | **NO VERIFICADO**: no existe `node_modules/vite/bin/vite.js` aquí |
| `npm run build` Editor/Player | **NO VERIFICADO**: `vite: not found` |
| QA visual/auditivo usuario | **PENDIENTE** |
| Gate | **IMPLEMENTADO, NO APROBADO, NO CERRADO** |

## Instrucciones desde raíz existente (`package.json`)

```bash
node --test scripts/test-timeline-audio-fade-handles-s11-g007-g001.mjs
node --test scripts/test-timeline-audio-fade-handles-s11-g007-g001-electron.mjs
npm run build
npm run electron
```

El test Electron espera 1 PASS y 27 comprobaciones internas (mínimo 25). La fixture se ejecuta con el `TimelinePanel.vue` real, estado `store.project.timelines`, renderizado SVG, eventos PointerEvent, teclado y serialización; los eventos PointerEvent son **simulados**, no equivalen al movimiento físico del ratón. Registra `stage`, `checks`, errores y watchdog aun cuando un módulo no se importe. No modifica el runner compartido.

### QA de usuario (indispensable)

1. En una clave Audio con duración explícita, comprobar que los triángulos Fade In / Fade Out aparecen en la parte superior y la línea recorre la forma de onda.
2. Arrastrar el triángulo izquierdo a la derecha: se amplía Fade In; a la izquierda lo reduce. La posición inicial y duración no cambian.
3. Arrastrar el triángulo derecho a la izquierda: se amplía Fade Out; a la derecha lo reduce. Verificar que no se confunde con el recorte de borde derecho.
4. Confirmar que el Inspector refleja exactamente `fadeIn`/`fadeOut`, y viceversa, con teclado (flechas/Home) y Snap.
5. Probar la cancelación de arrastre, bloqueo de pista, duración mínima, zoom y arrastre del cuerpo del clip.
6. Deshacer y rehacer ambas ediciones; guardar y volver a abrir comprobando claves, IDs, valores y recursos intactos.
7. Escuchar entrada, salida y Stop en Preview y Player. Un clip con `duration=0` no debe mostrar control de Fade Out; cuando se conozca la duración PCM sí debe poder editarse Fade In.
8. Verificar que no cambia la onda, FX, Mixer, transporte ni Cinematics.

Si falla cualquier comprobación, devolver log completo y captura. Compilar no significa QA visual PASS. El usuario es responsable de ejecutar el QA local.

## Evidencias incluidas

- `docs/qa/evidence/LF_S11_G007_G001_NODE_FOCAL.log`
- `docs/qa/evidence/LF_S11_G007_G001_NODE_COMPATIBLE.log`
- `docs/qa/evidence/LF_S11_G007_G001_NODE_EXTENDED.log`
- `docs/qa/evidence/LF_S11_G007_G001_ELECTRON_ENV.log`
- `docs/qa/evidence/LF_S11_G007_G001_BUILD_ENV.log`
- `docs/qa/evidence/LF_S11_G007_G001_SYNTAX.log`
- `docs/qa/evidence/LF_S11_G007_G001_G005_USER_APPROVAL.md`
