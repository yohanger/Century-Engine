# S17-G003-AO-G001 — QA local: coste por fase GTAO

**Objetivo:** aislar el coste de GPU del Ambient Occlusion sin alterar la imagen, incluyendo inspección en NGM Runtime exportado con NGME-STATS habilitado desde Build.

## Instalación y verificación de código

Extraer SOURCE_BASELINE G001 en una carpeta **nueva**. Conservar el baseline G003 previo, los proyectos del usuario y las exportaciones anteriores. No superponer CHANGE sobre SOURCE_BASELINE ya actualizado. Desde la carpeta raíz que contiene `package.json`:

```bash
npm ci
node --test scripts/test-performance-s17-g003-ao-g001-cost-diagnosis.mjs
node --test scripts/test-performance-s17-g001-profiler-contract.mjs scripts/test-performance-s17-g003-diagnostics.mjs
npm run build
npm run electron
```

**Esperado del test nuevo:** 12 PASS / 0 FAIL / 0 SKIP. El test mide la lógica de instrumentación con mocks; **no prueba que GLSL/WebGL compile o que la GPU UHD 605 retorne tiempos válidos**.

## Confirmar instrumentación real (Editor)

1. Abrir F3 con Play en un proyecto de QA con **Render Realista / perfil Alto**, AO activo, misma cámara y escala. Revisar nuevas filas `AO · total`, `AO · G-buffer`, `AO · oclusión`, `AO · denoise`, `AO · composición` y posible `AO · resto`.
2. `G-buffer` solo aparece si el addon genera sus propias normales/profundidad; si no aparece, anotarlo y revisar los demás tiempos. La GPU sin extensión debe mostrar **CPU por pasada**, nunca milisegundos GPU inventados.
3. Mantener abierta la escena sin mover la cámara; observar comportamiento de imagen y FPS; abrir/cerrar Stats y comprobar que el juego sigue igual. El perfil de instrumentación introduce queries GPU y puede alterar algo el rendimiento del monitor abierto.
4. Si no aparece ninguna etapa, devolver la consola/log: puede significar versión de GTAOPass incompatible o perfil/efecto no habilitado. No asumir defecto del shader.

## Mediciones controladas (misma escena y cámara)

Usar **1280 × 720** como punto de comparación, misma calidad y sombras, energía conectada, sin procesos pesados adicionales. Registrar GPU driver, escala del SO, resScale, pixel ratio y AO configurado; esperar 20 segundos antes de medir. Por condición hacer **tres corridas de 60 segundos** y pulsar reiniciar medias de F3 al comienzo de cada corrida.

| Variante | Cámara | AO | Lo que se observa |
|---|---|---|---|
| A1 | Terrestre fija con geometría dominante | 0,9, 16/16 | Total y cuatro fases GPU; FPS, p50, p95 |
| A2 | Misma posición mirando cielo | 0,9, 16/16 | Contraste de cobertura de profundidad |
| B | Misma cámara de A1 | 0 | Medida sin AO. No es configuración final; verificar desaparición de fases |
| C | Misma cámara de A1 | Restaurar 0,9 | Recuperar tiempos e imagen sin fugas |

**No atribuir a cada etapa una causa raíz** si el GPU timer informa GPU disjoint, resultados inconsistentes, o si solo hay CPU timers. Al cambiar AO ON/OFF, esperar reinicialización del composer; las medias históricas pueden necesitar un nuevo reinicio manual.

Recoger: FPS medio, p50/p95 del fotograma, `GPU · pasadas`, `AO · total`, `AO · G-buffer`, `AO · oclusión`, `AO · denoise`, `AO · composición`, `AO · resto` (si existe), draw calls, resolución efectiva, capturas idénticas. No sumar `AO · total` a sus fases: **es su suma derivada**.

## AppImage / permisos

Crear un AppImage nuevo con **solo NGME-STATS** marcado en Build. Comprueba `Ctrl+Shift+F3`, apertura del profiler, fases AO y que `Ctrl+Shift+F12` no abre DevTools. Exportar otro AppImage normal sin diagnóstico; no debe permitir Stats ni DevTools. Estas verificaciones siguen siendo obligatorias para G003 original y no se suponen PASS por Node.

## Evidencia a devolver

- Salida literal de los comandos Node/build y confirmación Electron/NGM Runtime.
- Capturas por variante A1/A2/B/C, tres corridas cada una, con notas de FPS y GPU por etapa. Reportar explícitamente GPU NO DISPONIBLE si corresponde.
- Captura AO normal + AO restaurado con la misma cámara para verificar que no cambiamos su calidad.
- `game.log` y mensajes de consola si hay fallos; registrar si el monitor se encuentra abierto o cerrado.

**Cierre:** se exige evidencia local para poder decidir una optimización futura, sin usar el coste del benchmark sintético como sustituto del hardware real. G001 no modifica shader GTAO ni certifica mejora de FPS.
