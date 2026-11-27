# S03 CORR-001 — QA de indicador y acoplamiento como pestañas

**Estado:** implementado para revalidación; **S03 NO APROBADO**. Baseline de entrada: S03 G001 INTEGRAL. CA-002 complementa CA-001. No se autoriza ninguna modificación de Player ni de escenas.

## Evidencia histórica que motivó el rechazo

- Usuario: «Dos cosas, se quedo eso ahi pegado creo que se bugio y ademas, no se acopla como apartado ... ocupar el mismo espacio pero como si fuera ventanas» (captura de 2026-11-03).
- Node S03 previo: 76/76 PASS; Electron DOM: 28/28 PASS; build Editor: 826 módulos PASS, Player: 414 módulos PASS, según log aportado por el usuario. **QA visual local: NO APROBADO**.
- Causa verificada por lectura del código: `App.vue` limpiaba la previsualización solo en `drop` del centro o `dragleave.self`; `DockTree.vue` elegía división cerca del borde incluso al soltar sobre su encabezado. Tests anteriores no probaban cancelación DnD ni agrupación explícita por encabezado.

## Corrección

- `src/App.vue`: limpieza global de indicador de viewport al finalizar/cancelar arrastre, perder foco o pulsar Escape; abandono por descendientes con verificación de límites. Aviso compacto en lugar de rectángulo grande.
- `src/components/DockTree.vue`: drop en encabezado siempre une pestañas; drop en centro del cuerpo también. Solo bordes precisos dividen; limpieza global de estado y limpieza al dejar el destino.
- `src/core/editor/docking.js`: función pura `dockDropEdge` para la decisión de destino, sin crear estados paralelos ni modificar serialización.
- Regresiones Node DOCK-C01..C06 añadidas a la suite existente. Fixture Electron ampliado a **35 comprobaciones** con `DataTransfer` y eventos DOM sintéticos. Electron no sustituye la prueba manual de arrastre real.

## Ejecución en Linux

Desde la raíz de SOURCE_BASELINE S03 CORR-001, con `npm ci` ejecutado si hacen falta dependencias:

```bash
node --test scripts/test-editor-docking-s03-g001-integral.mjs scripts/test-editor-windows-layout-corr-g001.mjs
node --test scripts/test-editor-docking-s03-g001-integral-electron.mjs
npm run build
npm run electron
```

**Esperado:** Node 82 PASS; Electron una prueba PASS con **35 verificaciones**, build Editor/Player sin errores fatales; Electron abre el editor. Electron/build **NO VERIFICADOS en el entorno de entrega**, porque no hay dependencias instaladas. No confundirlos con QA visual.

## QA manual obligatorio

1. Arrastra Jerarquía al **encabezado** del dock Proyecto. Deben aparecer **Jerarquía | Proyecto** en la misma barra, ocupando **exactamente la misma superficie**; no aparecen dos divisiones.
2. Alterna las pestañas: la Jerarquía conserva selección, Proyecto conserva su contenido. Repite con Señales e Inspector.
3. Arrastra una pestaña sobre el **centro** del cuerpo de otro grupo: debe incorporarse como pestaña.
4. Arrástrala sobre el **borde exacto** del cuerpo: la división debe ser intencional y redimensionable. Arrastrar sobre barra de pestañas nunca divide.
5. Lleva una pestaña hacia el borde izquierdo del viewport y luego presiona **Escape**, suelta fuera o vuelve al origen: el aviso «Como pestaña · izquierda» debe desaparecer inmediatamente. Repite a derecha, arriba, abajo y al cambiar entre hijos del viewport.
6. Suelta una pestaña en un borde del viewport y comprueba que termina como pestaña en el grupo de esa zona; el viewport sigue fijo y no se duplica ningún panel.
7. Desacopla una pestaña, acóplala de nuevo sobre un encabezado; cierra/reabre Electron y verifica que se restaura la disposición.
8. Activa Play maximizado, vuelve a Editar, prueba Shader Graph central y controles del Inspector, sin pérdidas ni avisos persistentes.

**Estado posterior:** usuario devuelve capturas/incidencias y aprobación. Sin aprobación no se cierra S03 ni se registra QA LOCAL PASS. `SCENE-09` y nueve fallos de suites ajenas siguen documentados como históricos; no se corrigen en este Gate.
