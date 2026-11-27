# Contract Amendment vinculante · Cinematics S05-G002

> **NOTA DE SUPREMACÍA CONTRACTUAL:** la obligación de conservar `AnimationPanel.vue`/dock `clips` y su edición desde Assets está **SUPERSEDIDA** por `LF-CINEMATICS-LEGACY-CLEANUP-S05-G003_AMENDMENT.md` (CA-003, decisión del usuario 2026-11-04). Este documento se conserva íntegro como histórico G002; la arquitectura vigente se rige por CA-003.

**Identificador:** `LF-CINEMATICS-OWNERSHIP-CA-002`  
**Estado contractual:** **APROBADO mediante autorización literal** `Listo. LF-CINEMATICS-VIEWER-S05-G002-INTEGRAL autoriza comenzar`, precedida de decisión explícita sobre el alcance.  
**Baseline parent:** `LevelForge_CINEMATICS_OWNERSHIP_CONTRACT_S05_G001_SOURCE_BASELINE.zip`.  
**Precedencia:** sustituye las cláusulas A-01.5, A-02 y el bloqueo de la ruta de acceso del borrador CA-001; mantiene las demás protecciones del contrato parent. Ningún resultado de QA se presume por autorización de implementación.

## 1. Propiedad funcional

- **Nether FilmMaker:** única herramienta de autoría cinematográfica (película `.nfm`, planos, montajes y captura).
- **Cinematics:** visor **solo reproducción/consulta/importación FilmMaker**. Acciones: localizar película con procedencia verificada, abrir, inspeccionar, previsualizar poses/cámara sin scripts, audio o comandos en Edit Mode, reproducir/pausar/seek/stop la vista previa, e importar `.nfm`. Prohibidas crear, grabar, editar pistas, claves, eventos, clips, curvas o montajes. Para la ejecución integral de audio/scripts se usa Play/Player y su runtime `TimelineRunner` existente.
- **Timeline:** editor temporal independiente del motor; conserva toda su autoría aprobada, y no se relabela como FilmMaker por su nombre o ubicación.
- **Clips de gameplay:** `project.animations` y su formato permanecen intactos. El editor histórico `AnimationPanel.vue` queda accesible desde los clips en Assets en un dock técnico separado `clips`, oculto inicialmente. No participa en Cinematics ni constituye otro entorno de montaje cinematográfico.

## 2. Datos e identidad

- Una película importada de FilmMaker sigue almacenada como un timeline dentro de `project.timelines`, sin crear `project.cinematics` ni copiar pistas.
- Nuevos pases y el montaje final reciben `filmMaker: {provider:'nether-film-maker',filmId,filmName,sceneId,kind,sourceId}` mediante el adaptador **existente** `importFilm()`, previa validación real de `.nfm` y escena.
- La normalización preserva exclusivamente metadatos con esquema/identidad válidos; no deriva origen por nombre. La duplicación de un timeline genera recurso manual y **retira** la marca FilmMaker del duplicado.
- Cinematics y `Assets/Cinematics` muestran **solo** timelines que cumplen el marcador de procedencia. Las secuencias antiguas sin origen verificable siguen íntegramente accesibles desde `Assets` y el Timeline anterior; no se borran, convierten ni ocultan de su ruta previa.
- Los clips importados como capturas por FilmMaker se mantienen en `project.animations`, para animación de actores; no se representan como películas.

## 3. Navegación, Inspector y compatibilidad

- Dock `anim`: se conserva ID persistente y layouts; etiqueta visible **Cinematics** y contenido del visor. Se incorpora dock técnico `clips`, oculto por defecto, solo para editar clips desde Assets. Al normalizar layouts antiguos, `clips` permanece oculto salvo apertura expresa.
- Assets presenta carpeta de catálogo `Assets/Cinematics` no editable manualmente: la vía de incorporación de películas es el importador `.nfm`. Los timelines heredados y los clips de gameplay conservan sus flujos de autoría aparte.
- La selección `cinematic` se vincula por ID a `project.timelines` y muestra **Inspector de solo lectura**, sin ParamForm mutador. Los elementos de Timeline y clips conservan su Inspector contextual previo.
- La previsualización en Edit Mode reutiliza evaluación de posiciones de cámara, nodos y física horneada en un módulo compartido con Timeline. Nunca despacha código arbitrario, método de nodo, evento ni audio. Al detener/ocultar/cambiar escena restaura poses del editor.
- El runtime Player, guardado `.lfproj`, `timelines.json`, `animations.json`, `.nfm`, `.lfcap`, Signals, Jolt y First Person conservan sus estructuras; no se introducen gestores paralelos.

## 4. Límites y evidencias

**Gate G002 autorizado:** adaptador de procedencia, catálogo en Assets, visor, Inspector solo lectura, ruta heredada de clips, docking compatible, preview compartido, pruebas, documentación y ledger seis hojas; dos ZIP.  
**No autorizado:** renombrar `project.animations`, eliminar el editor histórico de clips, construir otro NLE, reescribir FilmMaker o Timeline/Player, soporte dinámico de nodo 3D, instalación de VS Code.

**Aceptación:** Node y Electron embebido, builds Editor/Player, QA visual local y verificación exportada son estados distintos. No declarar Electron/Player PASS por pruebas Node. El Gate se considera **IMPLEMENTADO**, no cerrado hasta QA local y aprobación del usuario.
