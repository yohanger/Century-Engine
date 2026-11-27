# Gate LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL — informe de ejecución

**2026-11-10 · ESTADO: IMPLEMENTADO PARCIAL / BLOQUEADO PARA CIERRE · QA LOCAL PENDIENTE.**

## Autoridad

- El usuario ratificó `LF-TIMELINE-UNIVERSAL-PROPERTY-SCOPE-AUTHORITY-S13-G008-UPA-CA-001` el 2026-11-10.
- Autorizó literalmente `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL` en el mismo mensaje.
- Base: SOURCE_BASELINE documental UPA-CA-G001, derivado de `lf(10).zip` (Codex); el diseño se conserva, sin reescribir el editor. Su procedencia histórica CORR-005/CORR-006 no es aprobación independiente demostrada; no se modifica el historial.
- UA-CA-001 y UPA-CA-001 siguen vigentes, TB01/Jolt y Camera Orchestration S15 no se relajan. NO se cierra G007.

## Observado en código antes de cambios

- `registerNodeAnimationProperties` ya existía y el registro de tipos lo consumía; ningún nodo productivo aportaba descriptores específicos.
- `PROPS` solo exponía seis canales base. `Inspector.vue` ya no montaba `PropertyKey.vue`, pero `TimelinePanel.vue` sí ofrecía autoría de pistas de propiedades.
- Timeline conservaba audio, métodos y comandos; creación de clips redundantes y reproducción histórica compartían modelo.
- 233 contenedores UI declarados en auditoría previa no equivalen a propiedades. La presente matriz indexa 259 apariciones en once componentes, sin confundir UI con propiedades de nodo certificadas.

## Implementación alcanzada

1. **Inspector** — `PropertyKey.vue` insertado en 17 campos identificados, reutiliza el recurso abierto, el cabezal y `upsertTimelineNodePropertyKey()` existente. Solo visible durante edición activa de Timeline y para descriptor elegible; no hay Auto-Key ni segunda sesión de transporte. Undo/Redo se registra mediante `commit` común.
2. **Cámara** — descriptor propietario `camera.fov`; lectura autoral, aplicación temporal en `root.userData.timelineFov`, captura y restauración. `resolveCamera3D()` lee ese valor y el helper del editor no lo pisa en `update`.
3. **Luz** — diez propiedades numéricas adicionales declaradas en su definición original con lectura autoral, aplicación en emisor/FX, captura, restauración y disponibilidad por tipo. Los dos canales legados de luz se mantienen.
4. **Modelo y evaluación** — validación tipada de `string` y `enum`, sin permitir valores fuera del catálogo; interpolación continua para números/colores, discreta para texto/enum/booleanos. Mezcla de clips históricos sin asumir que cualquier canal es `vec3`.
5. **Autoría** — eliminada la creación de clips Nodo/Cámara en Timeline (barra, menú y función huérfana); se mantienen edición y reproducción de clips históricos en modelo/Player. Audio, method, commands, bake y tomas explícitas por Jerarquía permanecen.
6. **QA** — pruebas específicas nuevas 17/17 PASS; fixture real de métodos reparado para depender de imports actuales y `_nodeEnabled` del contexto. No se modificó implementación productiva de `NodeScriptRuntime`.

## No completado: criterio universal NO cumplido

La arquitectura actual carece aún de descriptores y propietarios runtime válidos para la totalidad de campos de Jolt, Canvas `.ui`, materiales, audio de nodo, VFX, Terrain, partículas, físicas y controles especializados. Añadir llaves basadas solamente en `obj.props`, sin aplicar/validar/restaurar vía propietarios, violaría UPA-02, UPA-06 y TB01. Estas familias **siguen BLOQUEADAS para certificación** y requieren implementación real bajo la autoridad existente; ninguna se declara funcional.

- G007: rutas `object3D` directas NO CERTIFICADAS; no deben saltarse con setters locales.
- Jolt: no se añadió writer físico sin política de autoridad.
- Camera Orchestration S15: el FOV temporal no equivale al cambio de cámara activa; las tomas explícitas no se alteraron.
- `lf(10).zip`/Codex: se conserva el diseño sin inventar aprobación histórica de sus Gates.
- G009–G014: funcionalidades nuevas aún planificadas; no se declaran cerradas.

**Dictamen: la autorización integral permitió intervenir, pero la evidencia no permite cerrar un objetivo de 100 % de cobertura. NO DECLARAR APROBADO/CERRADO ni pasar a G009 por esta entrega.**

## QA local obligatorio pendiente

Abrir Timeline, seleccionar Camera3D y Light, comprobar llaves en Inspector y en pistas; crear clave FOV y luz en dos tiempos; reproducir/seek y detener, verificar restauración; guardar/reabrir; verificar tomas Camera3D, scripts/eventos con argumentos, audio y clips históricos; comprobar PlayMode y Player exportado. Ver `docs/qa/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL_QA.md`.
