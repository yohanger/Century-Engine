# QA · S13-G002 CORR-001

**Estado:** IMPLEMENTADO; Node PASS; Electron/compilación/QA LOCAL pendientes; NO APROBADO NI CERRADO.

## Ejecución en entorno de preparación

| Evidencia | Resultado | Interpretación |
|---|---|---|
| `LF_S13_G002_CORR001_NODE_FOCAL.log` | **48 PASS, 0 FAIL, 0 SKIP** | 17 FOLD existentes + 24 Inspector Primitivas + 7 pruebas CORR-001 |
| `LF_S13_G002_CORR001_NODE_REGRESSION.log` | **151 PASS, 0 FAIL, 0 SKIP** | Selección compatible de Inspector, Audio, Timeline y FX |
| `LF_S13_G002_CORR001_ELECTRON_ENV.log` | **NO VERIFICADO** | Runner no monta: Vite ausente en preparación |
| `LF_S13_G002_CORR001_BUILD_ENV.log` | **NO VERIFICADO** | `vite: not found`; no equivale a build fallido del código |
| Log Electron original aportado por usuario | **FAIL en fixture pre-CORR-001** | 11 checks PASS + error `store.editor` null al ejecutar Restablecer |

## Comandos en la raíz de LevelForge

```bash
node --test scripts/test-inspector-global-folding-s13-g002.mjs scripts/test-inspector-global-folding-s13-g002-corr001.mjs scripts/test-inspector-primitives-ux-s01-g001.mjs
node --test scripts/test-inspector-global-folding-s13-g002-electron.mjs
npm run build
npm run electron
```

Esperado: **48 PASS** en Node, **1 PASS / 23 comprobaciones** Electron, compilación Editor y Player satisfactoria.

## Revisión manual

1. Seleccionar una primitiva; plegar/desplegar Transformación con ratón, Enter y Espacio.
2. Comprobar que Restablecer modifica posición/rotación/escala, no pliega el encabezado y permite Undo.
3. Confirmar migración `inspFold` antigua sin pérdida, claves estables por tipo y sin contaminación entre cámara y primitivas.
4. Verificar persistencia de preferencias al cambiar selección y reiniciar Editor, panel estrecho/desacoplado.
5. Confirmar que el plegado por sí solo no modifica el proyecto ni crea Undo; la acción Restablecer sí debe crear historial.

Devolver salidas completas, fallos/capturas y aprobación explícita. La lectura aislada de Node no constituye QA visual ni Electron PASS.
