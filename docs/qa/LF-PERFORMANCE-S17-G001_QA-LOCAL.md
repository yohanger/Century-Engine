# S17-G001 — QA LOCAL: línea base de rendimiento reproducible

**Fuente:** SOURCE_BASELINE S17-G001 (procede de cierre S13+S15+S16). **Solo medición**. Los proyectos originales permanecen intactos: trabajar en una copia de QA. No modificar objetos, física o shaders a mitad de serie.

## Prerrequisitos y comandos

Linux/Zorin OS, Electron embebido, alimentación y pantalla constantes. Desde la carpeta raíz con `package.json`:

```bash
npm ci
node --test scripts/test-performance-s17-g001-profiler-contract.mjs
node --test scripts/test-render-pipe-s01.mjs scripts/test-three-s01.mjs
node scripts/bench-vfx-renderer-consolidation-s00-g001.mjs
npm run build
npm run electron
```

Esperado del test nuevo: **9 PASS/0 FAIL**. El bench VFX imprime **ms totales por 600 pasos de CPU** (no FPS). En el entorno de auditoría, Vite faltó; en tu instalación `npm ci` debe resolverlo si el registro/red lo permite. Devuelve las salidas literales, sin deducir PASS si no arrancó.

## Configuración de muestra

Anota fecha/hora local, CPU/GPU, RAM, Zorin/Electron, pantalla y tamaño exacto del viewport, resolución interna, perfil/render, VSync si se conoce, estado cargador y temperatura si está disponible. Activa **Ver ▸ Rendimiento (F3)** en Editor; mantén el panel abierto en baseline y candidato. Con F12 o Ctrl+Shift+I puedes utilizar **Performance** de DevTools **dentro de Electron local**, si necesitamos aislar scripts; nunca un navegador externo. El exportado deshabilita DevTools y requiere otra metodología de captura, que G001 **no inventa**.

Para cada escenario realiza 30 s de calentamiento y tres corridas de 60 s sin cambiar cámara/ruta. Apunta p50/p95 del momento y capturas de F3 al segundo 15, 30 y 60 de cada corrida. Estos son percentiles **móviles de ~120 frames**, no p95 de los 60 s completos. Registra draw calls, triángulos, geometrías, texturas, tiempos CPU render y GPU cuando el dispositivo soporte consulta. Si GPU no aparece: `GPU NO DISPONIBLE`, no 0 ms.

| Escenario | Procedimiento fijo | Criterio instrumental (NO meta de FPS PASS) |
|---|---|---|
| **E0 — Editor vacío** | Proyecto FPS QA nuevo, sin colocar Prefab. Orbita cámara con ruta repetible 60 s; toma capturas F3 y comportamiento interfaz | Registrar costes de viewport y navegación; FPS Editor render-on-demand no comparable directamente a Play |
| **P0 — Player nativo mínimo** | Mismo proyecto, arrastra el Prefab FPS desde Assets, designa su CharacterBody3D y ejecuta Play; ruta fija con teclado/ratón | Registrar p50/p95, draw calls, sombras y si CPU/GPU está disponible |
| **P1 — Escena densa** | Copia de QA con distribución **fija y documentada** de mallas/decoración, sombras y materiales; registrar cantidades exactas | Comparar únicamente P1 consigo misma al cambiar candidato; sin inventar 100/1000 objetos si no existen |
| **P2 — Escena ambiental** | Copia QA con terreno, vegetación y clima/VFX existentes; guardar parámetros y cámara | Verificar fluctuaciones, actualizaciones LOD y coste de pasadas |

**Aislamiento opcional, solo diagnóstico:** repetir P1 con escala de render 75% manteniendo todo lo demás, restaurar 100% después. No cambiar presets a la vez. Batching es opt-in: no activarlo globalmente sin evidencia.

## Memoria y exportación

En Zorin abre monitor del sistema o lee el RSS del proceso Electron/Player; captura memoria residente tras cargar y después de 3 ciclos Play/STOP. Distingue RSS de memoria acumulada por `renderer.info.memory`. Ejecuta la misma copia de proyecto exportado (NGM Runtime/AppImage) y observa FPS visual, errores y log; **no atribuyas p95 medido en Editor al exportado**.

## Evidencia de retorno mínima

1. Logs literales de los comandos anteriores, especialmente build y 9 pruebas.
2. Para E0/P0/P1/P2: identificación del proyecto de prueba, preset, resolución, tamaño de viewport, captura F3 en 15/30/60 s, 3 corridas, parámetros de escena.
3. Captura del monitor de RAM/RSS y resultados Play/STOP repetidos.
4. NGM Runtime: ejecución/errores y diferencias con Editor; `game.log` si hay fallos.
5. Video de la Biblioteca `LevelForge/videoplayback(3).mp4` adjuntado como archivo accesible si debe estudiarse su contenido; la auditoría previa **no pudo leerlo**.

## Decisión posterior

Solo después de la evidencia se elige G002 CPU o G003 GPU. Para cada hallazgo: **OBSERVADO → PERFIL → CAUSA RAÍZ (si demostrada) → PROPUESTA → NUEVO GATE AUTORIZADO**. No tocar Database, Timeline, Camera Orchestration, Player FPS ni Jolt por suposiciones.
