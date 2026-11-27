# Matriz QA — Docking S03 integral

**Gate:** `LF-EDITOR-DOCKING-S03-G001-INTEGRAL`. **Estado:** IMPLEMENTADO / NO APROBADO TODAVÍA. Ejecuta QA sobre el nuevo SOURCE_BASELINE o CHANGE aplicado exactamente al baseline S02 CORR-002.

## Pruebas automatizadas

Desde raíz con `npm ci` instalado:

```
node --test scripts/test-editor-docking-s03-g001-integral.mjs scripts/test-editor-windows-layout-corr-g001.mjs
node --test scripts/test-editor-docking-s03-g001-integral-electron.mjs
npm run build
npm run electron
```

- Node focal: 76/76 PASS (40 pruebas S03 y 36 heredadas WL); regresión focal ampliada S01+S02+S03+Shader Graph: **194/194 PASS**. Todas son Node, no QA visual.
- Electron S03: **NO VERIFICADO** en entorno de entrega; el fixture ejecuta 28 verificaciones DOM Vue. No es QA GPU.
- Build Editor/Player: **NO VERIFICADO** en entorno de entrega por dependencias Vite/Electron ausentes (`npm ci` no completó). No confundir con fallo de compilación.
- Regresión ampliada: 218/228 PASS antes de actualizar aserción del Graph; de los 10 FAIL: 8 provienen del test EI y código `objects.js` sin cambios respecto al baseline; 1 `S02-16` por aserción histórica de `SCENE_KEYS`; 1 Graph era comprobación de orden de atributos, corregida bajo CA-001. Las incidencias heredadas no se cambian fuera de alcance.

## QA visual del usuario (PENDIENTE)

| Caso | Prueba | Resultado |
|---|---|---|
| D01 | Drag Jerarquía entre izquierda/derecha y vuelta | PENDIENTE |
| D02 | Mover Inspector y Señales a zonas y pestañas distintas sin perder selección | PENDIENTE |
| D03 | Arrastrar Proyecto/Consola/Audio/Timeline/Animación/Versiones a los cuatro lados | PENDIENTE |
| D04 | Dividir grupos por cada borde; redimensionar divisores y bordes exteriores | PENDIENTE |
| D05 | Desacoplar panel, mover/redimensionar y devolver mediante arrastre/botón | PENDIENTE |
| D06 | Ocultar panel y recuperarlo desde Distribución de paneles | PENDIENTE |
| D07 | Cerrar/reabrir Electron; comprobar misma distribución y tamaños | PENDIENTE |
| D08 | Abrir Event/Script/Shader Editor, Shader Graph y UI Designer; probar float y docking sin perder edición | PENDIENTE |
| D09 | Shader Graph central heredado, alternar a zona y volver sin mover viewport | PENDIENTE |
| D10 | Activar Play maximizado y salir; los paneles reaparecen con contenido intacto | PENDIENTE |
| D11 | Abrir modo Edit Mesh y Pintura; sus pestañas solo aparecen en su contexto | PENDIENTE |
| D12 | Layout con espacio limitado y monitor distinto; recuperar floats fuera de pantalla | PENDIENTE |
| D13 | ViewBar/menús S01, gizmos S02, Snap, Inspector, Scripts y señales siguen funcionando | PENDIENTE |
| D14 | Restaurar disposición predeterminada sin borrar proyecto o modificar escenas | PENDIENTE |
| D15 | Pantalla responsive no-Electron y drawers de tableta/móvil | PENDIENTE |

## Evidencia a devolver

Salida completa de Node S03, Electron S03, `npm run build`; captura o video de paneles movidos y redimensionados, acceso a editores especializados, Play maximizado y persistencia tras reinicio; cualquier error de consola de Electron. Los PASS automatizados y una compilación no equivalen a QA local.

No marcar APROBADO o CERRADO hasta recibir confirmación del usuario después de las pruebas.

## QA posterior: CORR-001 — rechazo visual y revalidación

El 2026-11-03 el usuario **NO APROBÓ S03** por indicador de destino persistente en viewport y falta de agrupación clara como pestañas del mismo espacio. Node 76/76, Electron 28 checks y compilación Editor (826 módulos)/Player (414 módulos) habían pasado, pero no esas acciones manuales.

Véase `LF-EDITOR-DOCKING-S03-G001-INTEGRAL_CORR-001_QA.md` y CA-002. Node focal esperado ahora **82/82 PASS**, Electron nuevo fixture **35 checks** preparado, QA Electron/build de CORR-001 NO VERIFICADOS en entorno de entrega, QA visual PENDIENTE. El Gate sigue abierto.
