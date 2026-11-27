# S17-G002 — QA de reconstrucción espacial experimental

**BASELINE:** S17-G001. **CANDIDATO:** S17-G002. **No utilices proyectos reales como datos de prueba.** Mantener una copia y los mismos ajustes de luz, cámara, resolución y escala de render.

## Pruebas Node y build

Desde la raíz con `package.json`:

```bash
npm ci
node --test scripts/test-performance-s17-g002-spatial-reconstruction.mjs
node --test scripts/test-performance-s17-g001-profiler-contract.mjs scripts/test-render-pipe-s01.mjs scripts/test-three-s05.mjs
npm run build
npm run electron
```

Esperado del archivo nuevo: 10 PASS, 0 FAIL, 0 SKIP (prueba de contrato, sin GPU). El comando `npm run build` debe compilar Editor y Player; si no, reporta log literal, no `COMPILADO`. Si falta Vite, instalar dependencias mediante `npm ci` según el lockfile y reportar el problema; no se ha verificado compilación en el contenedor.

## Comparación A/B/C en Editor embebido y NGM Runtime

Abre **Ver ▸ Rendimiento (F3)** en una copia del proyecto. Usa la misma ventana (por ejemplo 1280×720), misma escala de escritorio, mismo hardware y batería/cargador, misma escena y ruta de cámara. Se recomiendan tres escenas: (1) interior con puertas y luces de alto contraste; (2) vegetación/texturas con líneas delgadas; (3) objetos en movimiento + manos/ViewModel en primer plano. Evita modificar postprocesado entre corridas.

**A — referencia nativa:** `Render → Rendimiento → resScale = 1.00` (sin upscaler dividido); captura la imagen de referencia.

**B — control:** `resScale = 0.75` y `Reconstrucción espacial = Catmull-Rom (actual)`.

**C — experimental:** `resScale = 0.75` y `Reconstrucción espacial = Protección de bordes (experimental)`.

Para B y C: 30 segundos de calentamiento y tres corridas de 60 segundos. Captura F3 al segundo 15, 30 y 60. Compara `Reconstrucción` (ms GPU si la extensión está disponible, sino `GPU NO DISPONIBLE`), draw calls, p50/p95 móviles y memoria RSS del proceso. En cada captura analiza halos alrededor de siluetas, pérdida de cables/ramas, gradientes, texto/UI, sombras, bordes y estabilidad al mover la cámara. Conserva originales PNG sin compresión adicional ni reescalado.

Registra por cada toma: escena, hashes o nombre de la copia del proyecto, calidad, FOV, resolución, perfil/escala, p50/p95, `Reconstrucción`, GPU disponible sí/no, draw calls, memoria, temperatura y carga; identifica visualmente A/B/C. No compares un modo con el otro a distintas resoluciones: el costo de 4 lecturas nuevas se mide a la **misma escala**.

Repite B y C con `resScale=0.60` si es estable. Cambia a una escena sin jugador y a estilo PSX para comprobar que el experimento no se ejecuta allí. Ejecuta NGM Runtime independiente con la misma copia de proyecto y verifica que la imagen no presenta errores y se respetan las opciones. QA de móvil queda FUTURO, no evaluado.

## Decisión basada en evidencia

- **MANTENER COMO EXPERIMENTAL:** mejora visual demostrable sin penalización inaceptable de GPU/p95 en UHD 605.
- **AJUSTAR DENTRO DEL GATE AUTORIZADO:** aparecen halos, atenuación excesiva o fallos de render; devolver video/capturas y game.log para diagnóstico antes de cierre.
- **DESCARTAR:** coste real mayor sin ventaja visual verificable.

No declarar «60 FPS», ausencia de artefactos, GPU pass o mejora por resultados Node sintéticos. G002 puede estar implementado pero no cerrarse hasta QA y aceptación del usuario.
