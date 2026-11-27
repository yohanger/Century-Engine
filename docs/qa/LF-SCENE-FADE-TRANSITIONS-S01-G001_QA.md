# QA — LF-SCENE-FADE-TRANSITIONS-S01-G001

## Evidencia automatizada disponible

- `node --test scripts/test-scene-fade-transitions-s01-g001.mjs`: 18 pruebas, PASS.
- Regresión focal de escena, GameManager, persistencia y modelado: 146/146 Node PASS.
- Suite histórica `test-editor-ux-s01-g004.mjs`: 2 fallos de aserciones preexistentes en el baseline anterior, relativos a pilotaje y etiqueta de ViewBar; fuera de alcance. No imputarlos a este Gate.
- Electron/WebGL: NO VERIFICADO; dependencias Vite/Electron ausentes.
- Build Editor/Player: NO VERIFICADO; `vite: not found` en el entorno de generación.

## Pruebas locales obligatorias

1. En Escena → Transiciones de pantalla, cambiar Fade In, Fade Out, tiempos, espera, color y ritmo; guardar, cerrar y volver a abrir el proyecto. Comprobar también Undo/Redo.
2. En una escena con cámara principal o Spawn, iniciar Editor Play: la primera imagen debe estar cubierta y revelar progresivamente desde el color elegido, sin mostrar previamente un fotograma de la escena.
3. Exportar el Player y ejecutar de forma independiente: esperar al fin de carga, después revelar la escena en el tiempo/color configurado. No deben verse dos overlays de entrada.
4. Configurar escena A con Fade Out y escena B con Fade In: ejecutar una transición `game.goScene()` sin opciones; la salida usa A, la entrada B, no aparece un fotograma de escena incorrecta.
5. Repetir con `game.goScene(..., {fadeOut:0, fadeIn:0})`: corte directo. Probar también valores explícitos no cero y `color` explícito.
6. Verificar duraciones 0, colores claros/oscuros, curvas, cambio de cámara, error de carga, Stop en Editor y compatibilidad con `game.fade()`.
7. Abrir un proyecto creado antes del Gate: no debe adquirir fundidos automáticos inesperados. Si el `.ui` de fundido fue personalizado, preservar su contenido.
8. Aportar salida Node, Electron, build, vídeo de entrada y transición A→B en Player exportado.

## Estados

IMPLEMENTADO; Node PASS; Electron NO VERIFICADO; Build NO VERIFICADO; QA LOCAL PENDIENTE; APROBACIÓN PENDIENTE; NO CERRADO.
