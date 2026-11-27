# LF-SCENE-FADE-TRANSITIONS-S01-G001 — Contrato y cambios

## Alcance autorizado

Fade In/Out por escena con activación independiente, duración, espera inicial, color y ritmo. Reutiliza `play.fade` y la interfaz del sistema `fundido.ui`. No crea un renderer, una cámara, un compositor ni un gestor de escena.

## Modelo persistente

Las opciones se guardan en `project.scenes[].transitions` (metadatos de escena) y se exportan únicamente con las escenas incluidas en el paquete. `normalizeSceneTransitions` conserva escenas antiguas sin el campo como **sin fundidos automáticos**, mientras que los proyectos y escenas nuevos reciben opciones habilitadas por defecto. Duplicar una escena copia los valores, sin compartir el objeto de configuración. Undo/Redo recupera los metadatos de escenas.

Campos: `enter`, `exit`, `inSeconds`, `outSeconds`, `delay`, `color`, `curve`. Las duraciones se limitan a 0–60 segundos, el color tiene formato hexadecimal RGB y el ritmo es `linear`, `ease-in`, `ease-out` o `ease-in-out`.

## Runtime y precedencia

- **Editor Play:** inicia cubierto, si la entrada está habilitada; después de montar la vista y la espera configurada, revela la escena mediante `play.fade`.
- **Player exportado:** el overlay de carga existente pasa a utilizar el color, duración y ritmo inicial de la escena, evitando superponer otro overlay. En escenas antiguas sin configuración sigue el fundido de carga de 0,6 segundos.
- **Cambio de escena:** la escena saliente aporta Fade Out y la entrante aporta Fade In. `game.goScene()` y los comandos siguen pudiendo especificar `fadeOut`, `fadeIn` y `color`; los valores explícitos (incluido cero) prevalecen. Si los dos valores son omitidos, se aplican los ajustes de cada escena. Los pasos entre escenas permanecen cubiertos cuando hay Fade In. El color se mantiene durante toda la transferencia, evitando destellos de dos colores distintos. Ante error de carga se retira la pantalla opaca.
- **Compatibilidad de la UI:** el `fundido.ui` estándar ahora admite `play.fade.curve`; se actualiza automáticamente únicamente si coincidía exactamente con la plantilla antigua. Personalizaciones existentes se preservan, y pueden no disponer del control de easing hasta que el usuario lo incorpore a su `.ui`.
- **FilmMaker:** conserva su propio control de cámara y no ejecuta Fade In automático durante su sesión.

## No incluido

No hay fades automáticos por terminar una escena por tiempo ni salida forzada del Player al cerrar. Fade Out ocurre cuando una transición real de escena se solicita. No se modifican Jolt, editor de mallas, shader atmosférico ni el sistema de cámara. No se declara QA visual ni Player independiente PASS sin evidencia.
