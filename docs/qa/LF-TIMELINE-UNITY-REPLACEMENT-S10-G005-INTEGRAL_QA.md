# QA local — LF-TIMELINE-UNITY-REPLACEMENT-S10-G005-INTEGRAL

**No declarar PASS/CERRADO** hasta que el usuario compruebe Editor, Player y persistencia.

## Preparación

1. Trabajar en la raíz del Editor LevelForge que contiene `package.json`. SOURCE_BASELINE: cierre **G004**. Si se compara y respalda la versión local aprobada, aplicar CHANGE respetando rutas. Si existen cambios locales no reconciliados, extraer SOURCE_BASELINE G005 en carpeta nueva para ensayar, sin tocar su proyecto activo.
2. No sobrescribir datos de proyectos, `node_modules`, builds ni escenas.
3. Ejecutar:

```bash
npm ci
node --test scripts/test-timeline-unity-replacement-s10-g005-integral.mjs
npm run electron -- --build
```

**Esperado** con dependencias Vue instaladas: 25 PASS/0 FAIL en G005. Es posible que Vite emita advertencias no bloqueantes de paquetes; anotar errores reales por separado.

## Pruebas visuales y funcionales

1. Abrir Timeline de prueba con pista `node` de posición (X/Y/Z) y tres claves con valores distintos. Seleccionar esa pista, pulsar **Curvas**, comprobar canal X/Y/Z y gráfica original. La gráfica no tapa las cabeceras fijas y puede cerrarse sin cambiar datos.
2. En modo `linear`, mover una clave de X en vertical y tiempo; revisar la posición numérica en Inspector y la previsualización. Probar Snap a 0.1 s. Cambiar zoom horizontal/vertical, arrastrar el fondo para desplazarse y pulsar **Encuadrar**.
3. Cambiar a interpolación **cubic**: seleccionar una clave intermedia, arrastrar las dos asas de tangente. Revisar `tanIn/tanOut` en el Inspector y restaurar **Automático**. Verificar que los extremos del segmento conservan valores y que cambia únicamente la trayectoria intermedia.
4. Repetir con rotación `cubic-angle` cruzando 350° → 10°; confirmar ausencia de salto de 360° y coherencia en el Player.
5. Quitar interpolación explícita, seleccionar clave de salida y usar **Convertir a Bézier**, ajustar ambas asas: verificar que los 4 controles numéricos en Inspector coinciden y que Preview y Player responden a la misma curva temporal.
6. Crear un clip de G003 que utilice dos claves fuente: la gráfica debe permitir editar valor, pero impedir cambiar el tiempo de claves `from/to`. Ejecutar Mix/Ripple/Replace para confirmar que siguen usando el valor editado, sin doblar la animación.
7. Bloquear la pista: la curva queda en solo lectura, sin mutaciones, pero reproduce. Desbloquear; comprobar Undo/Redo tras arrastre y cambios de tangentes. Guardar/cerrar/reabrir y comparar tiempos, `bz`, `tanIn`, `tanOut`, clips y referencia a claves.
8. Repetir seleccionando una cámara libre (posición/rotación/FOV) y otra con modo `node/player`: solo la cámara libre presenta controles numéricos editables. Verificar FOV válido 5–170.
9. Con panel acoplado/desacoplado y ventana estrecha, comprobar que pista/carriles permanecen alineados, cabeceras fijas al scroll horizontal, y Timeline/Player funcionan sin caídas notables de FPS.

## Evidencia que debe devolver el usuario

- Salida completa de test, `npm run electron -- --build` y errores de consola si los hubiera.
- Dos capturas: editor de curva con una tangente, e Inspector con sus pendientes; una captura de Bézier.
- Un vídeo corto de arrastre de clave/tangente y comparación Preview vs Player, o descripción reproducible de resultados.
- Resultado explícito de guardado/reapertura y Undo/Redo. Aprobación o rechazo del Gate.

Estado de esta entrega: **IMPLEMENTADO; QA LOCAL NO VERIFICADO; GATE ABIERTO.**
