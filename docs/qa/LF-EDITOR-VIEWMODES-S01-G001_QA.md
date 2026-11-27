# LF-EDITOR-VIEWMODES-S01-G001 — Evidencia QA y continuidad

## Línea de base

- ZIP fuente: `LF_CLOUD_EVOLUTION_S01_G001_CORR001_NATURAL_3D_CLOUD_MORPHOLOGY_SOURCE_BASELINE.zip`.
- Scope: Editor, Viewport, Performance, LOD, indicadores. No hay cambios del proyecto del usuario ni en GitHub.
- Datos de referencia de usuario: 24 FPS, GPU pasadas 37,9 ms; escena dibujo 29,6–34,6 ms, 66.498 triángulos y 5 draw calls. Estas observaciones no prueban causa raíz del coste; medir cielo mediante GPU queries antes de atribuir gasto.

## Runners

```bash
node --test scripts/test-editor-viewmodes-s01-g001.mjs
node --test scripts/test-editor-viewmodes-electron-s01-g001.mjs
npm run electron
```

El primero comprueba 14 contratos Node/estáticos y cuentas de geometría efectivas. El segundo usa la infraestructura **ya existente** `qa-electron-webgl-runner.mjs`, realiza 16 checks con shaders WebGL2 y muestra resultados individuales. `npm run electron` compila la interfaz y permite QA visual manual. Pruebas estáticas no validan apariencia ni GLSL.

## QA manual requerido (Editor)

1. Mismo proyecto/cámara y mismo perfil: comparar Lit y Unlit; el segundo debe excluir luces pero conservar colores y texturas estándar (registrar excepciones de shader custom).
2. Lighting Only: cambiar luz y verificar que el albedo permanece neutro y la luminancia cambia. Cambiar de modo no debe editar assets.
3. Wireframe: seleccionar malla, acercarse/alejarse; si el LOD está habilitado, contrastar los triángulos mostrados con `renderer.info` y LOD Inspector.
4. LOD: activar LOD en Ajustes ▸ Render, escoger LOD; verificar malla/terreno cambian realmente al desplazarse; salir a Lit restaura el estado de autoría. Probar también LOD deshabilitado (NO DISPONIBLE).
5. Cluster: solo si existen instancias reales y extensión compatible, comparar selección y residencia; en Compatibility o escena sin candidatos, debe mostrar NO DISPONIBLE.
6. Profiler F3: tras habilitar Stats, comprobar `Cielo atmosférico`, `Escena · dibujo` y las demás pasadas en GPU si la extensión existe; no sumar dos veces subfases.
7. Shader Complexity e Indirect Lighting: deben figurar como NO DISPONIBLES, nunca un heatmap simulado.
8. Edit→Play→Stop, carga de escena, desconexión WebGL y cambio rápido entre modos: sin contaminar materiales, geometrías o juego.
9. Repetir en Forward+, Mobile, Compatibility y Player exportado donde la ruta compartida se vea afectada; medir p50/p95 y coste adicional con Stats apagado.

## Condiciones de aprobación

| Resultado | Estado |
|---|---|
| Modo Lit base | Preservado en código; QA visual pendiente |
| Auditoría UE4.0.1 / UE5.1 | Rutas verificadas; principios adoptados sin copiar código |
| Node contrato | Ejecutar y registrar resultado en EVIDENCE |
| Electron WebGL2 | PENDIENTE de dependencias y ejecución en hardware local |
| Compilación Vite | PENDIENTE |
| Player/Compatibilidad | NO VERIFICADO |
| Rendimiento | NO VERIFICADO; valores de captura son baseline usuario |
| Shader Complexity / Indirect | BLOQUEADOS: falta dato auténtico para modo completo |

No homologar este Gate como integralmente aprobado o cerrado hasta demostrar las salidas reales pendientes o ratificar expresamente una reducción de alcance.
