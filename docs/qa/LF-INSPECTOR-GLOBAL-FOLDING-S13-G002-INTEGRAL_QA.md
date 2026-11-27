# QA LF-INSPECTOR-GLOBAL-FOLDING-S13-G002-INTEGRAL

**NO APROBADO / NO CERRADO.** Autoría implementada y test Node focal PASS, pero no hay Electron ni compilación ejecutados en entorno de preparación.

## Ejecución de pruebas

Desde la raíz de LevelForge con `package.json`:

```bash
node --test scripts/test-inspector-global-folding-s13-g002.mjs scripts/test-inspector-primitives-ux-s01-g001.mjs
node --test scripts/test-inspector-global-folding-s13-g002-electron.mjs
npm run build
npm run electron
```

**Esperado Node:** 41 PASS, 0 FAIL. **Electron:** 1 suite PASS y **23 checks** internos, con WebGL real y `InspectorDock.vue` montado. **Build:** Editor y Player completan sin fallos.

## QA manual del usuario

1. Abrir una primitiva con Transformación históricamente plegada; comprobar que continúa plegada y la preferencia vieja no desaparece.
2. Click en título y en icono para alternar. El triángulo, cuerpo y `aria-expanded` son coherentes.
3. Enter/Espacio pliegan con foco en encabezado; navegar con Tab hasta campos y botones internos sin cierres accidentales.
4. Restablecer transformación mediante el botón del encabezado, sin disparar plegado.
5. Cambiar a otra primitiva: mismo estado de tipo; cambiar a cámara/u otro tipo: estado independiente; volver.
6. Comprobar Material, Perfiles, Timeline, Audio Mixer y Malla/Pintura: no se contaminan preferencias. Sus plegados particulares quedan para Gate futuro.
7. Desacoplar/estrechar Inspector, confirmar que sigue siendo navegable por teclado/ratón y sin pérdida de estado.
8. Al plegar no se altera ninguna propiedad de escena, selección, historial Undo/Redo ni la ejecución del Player.
9. Cerrar y abrir el Editor, comprobar persistencia de prefs.

**Evidencia requerida:** salidas completas de Node, Electron y build; capturas o descripción de las pruebas manuales; aprobación o fallos concretos del usuario. El PASS Node no implica PASS Electron/visual.

## Deuda QA preexistente confirmada

El conjunto amplio ha reproducido cuatro fallos históricos en SOURCE_BASELINE S13-G001: `RI-01`, `RI2-20`, `S02-16` y la aserción de integración de Temporal Inspector. Otra selección histórica, `test-editor-inspector-integration-corr-g001.mjs` + `test-node-editor-s06-g001.mjs`, reproduce diez fallos en ambos baselines. Estos resultados NO se atribuyen al Gate G002 ni se ocultan modificando sus pruebas.

**Límites:** tooltips pospuestos; UX-02 limpieza de textos en Gates posteriores; no nueva arquitectura paralela.
