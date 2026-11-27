# LevelForge — LF-FILMMAKER-ANIM-S00-G001 · Contrato de arquitectura

**Gate:** `LF-FILMMAKER-ANIM-S00-G001`  
**Naturaleza:** contrato y planificación; **no autoriza implementar** S01 ni S02.  
**Estado:** AUDITADO, DOCUMENTADO y **APROBADO POR EL USUARIO el 2026-10-29**. S01-G001 fue autorizado separadamente; los demás Gates siguen sin autorización.  
**Fuente:** `LF-FILMMAKER-ANIM-S00-G001_AUDIT.md`.

## 1. Decisión arquitectónica

**Extender el montaje existente para admitir pistas dinámicas de nodos, reutilizando el evaluador de animaciones y las cinemáticas de LevelForge.** No se creará un segundo motor de interpolación, ni otro renderer, ni un nuevo ECS. LevelForge es un **editor de jerarquía de nodos**.

### Responsabilidades

| Módulo | Se conserva | Ampliación futura sujeta a su Gate |
|---|---|---|
| `NleTimeline.vue` | Planos, actor, texto, efectos y audio existentes | Pistas de nodos agregables al seleccionar un nodo, agrupación de propiedades, claves y selección contextual. |
| `montage.js` | Secuencia de planos, capas, audio y conversión a Timeline | Modelo `nodeTracks`, normalización, duración y adaptación de pistas al timeline exportable. |
| `film.js` | `.nfm` y `overrides` estáticos | Evolución compatible de esquema y validación de pistas animadas; mantener `overrides` separado. |
| `session.js` | Captura, cámara, reproducción, audio y `mount()` | Evaluación en tiempo absoluto, captura/restauración de bases, no contaminar overrides. |
| `anim/model.js` y `anim/eval.js` | Claves, propiedades, curvas e interpolación | Reutilizar **`sampleTrack()`** y datos de claves, sin copiar funciones de easing. |
| `timeline/model.js`, `eval.js`, `player.js` | Cinemáticas del Editor/runtime | Adaptar/exportar las nuevas pistas; conservar compatibilidad con timelines por nombre ya existentes. |
| `AnimationPanel.vue` | Captura de valores con gizmo y restauración | Reutilizar patrón de auto-key, no copiar su implementación a ciegas. |
| `NodeSpatialRuntime` / Jolt | Física del Player | Fase futura de bake con snapshots; sin cambios de física en S01. |

## 2. Contrato de datos propuesto (NO implementado)

La colección pertenecerá al **montaje de la película**, no a un objeto sobreescrito ni a la escena base. Nombre contractual propuesto: `film.edit.nodeTracks`. Se reservará un `schemaVersion` interno si se necesita para migraciones futuras. `film.version` se incrementará desde 2 **solo en el Gate que implemente efectivamente esa estructura**, con migración de películas existentes.

```json
{
  "edit": {
    "nodeTracks": [
      {
        "id": "track-id",
        "nodeId": "persistent-node-id",
        "name": "Vaso · Transform",
        "muted": false,
        "properties": [
          {
            "id": "property-track-id",
            "prop": "position",
            "keys": [
              { "id": "key-1", "t": 0, "v": [0, 1, 0], "ease": "inOut" },
              { "id": "key-2", "t": 0.6, "v": [0.2, 0.1, 0], "ease": "out" }
            ]
          }
        ]
      }
    ]
  }
}
```

El JSON anterior es una **ilustración del contrato**, no un fixture ni un preset para incluir en LevelForge. No define un modelo físico ni agrega el vaso a Assets.

**Identidad:** ID persistente del nodo (`nodeId`) como referencia canónica. El nombre es solo etiqueta de presentación. Si el nodo se renombra, su pista permanece vinculada. Si desaparece, mostrar pista huérfana con opción explícita de reasignar, deshabilitar o eliminar; no volver a vincular por coincidencia de nombre.

**Referencia temporal:** `t` representa segundos **absolutos del montaje**. Una animación global puede atravesar los cortes entre planos. En fases posteriores se evaluarán animaciones ligadas a un plano específico; no mezclarlas silenciosamente con el eje global.

**Transform:** valores en espacio **local del nodo con respecto a su padre**; posición/rotación/escala separados y agrupados visualmente. Rotación usa los grados que ya maneja el modelo de animaciones; conversiones a Three.js deben ser consistentes. `visible` puede habilitarse si el adaptador mantiene un manejo inequívoco. Los atributos de iluminación y otras propiedades no entran en el primer Gate de implementación salvo autorización específica.

**Claves:** ID único, tiempos no negativos y ordenados, validación de vec3 y ease compatible con `anim/model.js`. No crear claves implícitas duplicadas en un mismo instante: reemplazar por ID/tiempo con tolerancia definida. Prohibido perderlas al normalizar `.nfm`.

## 3. Política de evaluación reversible

Pipeline propuesto por fotograma:

1. Leer proyecto `scene.lfproj` y snapshot base de objetos con IDs.
2. Aplicar overrides estáticos de Filmmaker a una pose de referencia estable.
3. Para cada nodo animado, obtener `sampleTrack(track, T)` **a partir del tiempo absoluto** y aplicarlo a una representación temporal, no a la definición serializada de la escena.
4. Evaluar cámara, actor, color, subtítulos y audio existentes, con precedencia explícita frente a cualquier pista que afecte el mismo nodo. Reservar el control de actor/rig para su sistema de captura actual durante la primera fase.
5. Al pausar o mover el cabezal, recomputar desde la referencia estable (sin acumulación ni disparos retroactivos de eventos).
6. Al detener, cambiar proyecto, cerrar Filmmaker o reemplazar escena, restablecer la referencia previa de cada nodo, respetando jerarquía y posición local.

**Diferencia de evaluadores:** `AnimRunner` dispara eventos al avanzar, y `TimelineRunner` también dispara comandos/audio. Para la previsualización editorial no se deben ejecutar efectos secundarios al arrastrar: reutilizar su **evaluación pura** (`sampleTrack` / `evalNode` según corresponda), sin llamar `update()` de runners de gameplay para cada posición del cabezal. Si se desea ejecutar eventos mientras se reproduce, eso requerirá una política separada.

**Seek:** obtener la misma pose cuando se pide `T=0.6` directamente o después de reproducir y retroceder. Evitar que `seekMontage()` destruya/restaure la base de animaciones de forma inconsistente; definir una capa de preview desacoplada del ciclo de reinicio del Player.

**Conflictos:** una propiedad solo puede tener **un escritor efectivo** por instante. En caso de pista duplicada, resolver antes de guardar o aplicar una precedencia documentada; no dejar comportamiento según orden de DOM. No permitir grabación mientras se reproduce o mientras un cuerpo físico dinámico está controlando el mismo Transform.

## 4. Autoría y UX contractual

- Seleccionar un nodo real en Jerarquía.
- **Animar**: crear una sola pista de nodo vinculada a `nodeId`, con subpistas bajo demanda: Posición, Rotación, Escala (Visible opcional).
- Modo **Auto-key** explícito, desactivado al inicio; cabezal en segundos de montaje.
- Al manipular con gizmo o Inspector en modo Auto-key, guardar una operación de clave y **restaurar la pose base serializada**; la vista animada puede continuar mostrando el resultado como overlay temporal.
- Previsualización editable con reproducción, pausa, seek y tecla de navegación ya existente; evitar conflictos con drag/resize del NLE.
- Selección y propiedades contextuales, zoom/snap existentes, pistas reordenables y colapsables según el layout real; accesibilidad en 1024×768.
- Undo/Redo de película propio o integración explícita con historial que incluya `film.edit`: restaurar claves y pistas, no modificar la escena al deshacer. No reutilizar `commit()` del proyecto si no almacena esos datos.
- Nunca introducir un objeto Vaso, preset `.vfx` o escena de demostración dentro del producto. El vaso se usará solo en QA/tutorial de usuario.

## 5. Física: fases separadas y propiedad de Transform

**Fase de keyframes (primera):** animación manual de cualquier nodo compatible sin simulación física. Los nodos con `RigidBody3D` dinámico activo deben rechazarse o mantenerlo desactivado mediante un estado editorial explícito; no forzar su Transform y simular Jolt simultáneamente.

**Fase física posterior:** grabar el resultado de Jolt en una curva inmutable y reproducible (*bake*), no intentar resolver marcha atrás directamente con la integración dinámica. Requisitos mínimos antes de implementar:

- Snapshot de proyecto, semilla y configuración de mundo, transform local/mundo y velocidad inicial.
- CollisionShape3D válida, gravedad, masa, restitución, fricción y pasos de simulación fijos.
- Inicio/fin del segmento horneado en tiempo absoluto, tolerancia y frecuencia de muestreo.
- Validación de integridad/versiones del bake, invalidación ante cambios de geometría, física o jerarquía.
- Reproducción sin Jolt cuando se arrastra el cabezal; resultados idénticos para seek hacia delante/atrás.
- Prioridad clara entre preview de bake, keyframes manuales y cuerpo dinámico en reproducción real.
- Guardado/export de curvas con diagnóstico de incompatibilidades y memoria acotada.

La primera fase NO promete físicas dinámicas ni rebotes: su objetivo es permitir **animar manualmente la caída del vaso** mediante Transform.

## 6. Persistencia, continuidad y exportación

- Migrar `.nfm` v2 sin `nodeTracks` a una colección vacía, sin mutar el archivo de origen ni alterar `frame`, `passes`, `takes`, `overrides` o `edit` anterior.
- Rechazar versiones futuras incompatibles; preservar IDs, claves, easing y referencias en round-trip `packNfm`/`unpackNfm` (JSZip real).
- Al importar a LevelForge, distinguir animaciones **de película** de animaciones del juego; conversión reutilizando `montageTimeline()` y `TimelineRunner` con política para pistas de nodos. No incrustar claves temporales como transform estático en `scene.lfproj`.
- Si se sustituye una escena base, remap explícito de IDs faltantes; nunca reasignación silenciosa por nombre. Modo de lectura/consulta de pistas huérfanas.
- No hay en este contrato una promesa de exportación de vídeo MP4/WebM ni integración nativa automática con Godot; se comprobarán en su propio alcance.

## 7. Gates posteriores propuestos — NO AUTORIZADOS

| Gate | Alcance de implementación | Dependencias | Condición de aceptación |
|---|---|---|---|
| `LF-FILMMAKER-ANIM-S01-G001` | Datos `nodeTracks`, migración `.nfm`, evaluación reversible de Transform por ID, integración de reproducción con tiempo global | S00 aprobado; auditoría de consumidores `.nfm`; tests unitarios y JSZip | Seek determinista, ningún override serializado accidental, 0 regresiones. |
| `LF-FILMMAKER-ANIM-S01-G002` | UI NLE dinámica para pistas de nodos, Auto-key por gizmo, Undo/Redo de película, controles de edición | S01-G001 aprobado | Usuario anima manualmente el vaso sin scripts, el estado se conserva al reabrir. |
| `LF-FILMMAKER-ANIM-S02-G001` | Diseño e implementación independiente del bake físico Jolt | S01 funcional y QA; contrato físico detallado | Caída/rebote reproducible y reversible sin simular retroceso. |
| `LF-FILMMAKER-ANIM-S02-G002` | Integración de pistas animadas/bake con export a cinemática LevelForge y QA de Player | Sistema de autoría y persistencia aprobado | Referencias de nodo válidas, export/import estables y comportamiento consistente. |

Cada Gate requiere autorización literal propia. **No se implementarán Gates futuros por la aprobación de S00.**

## 8. Reglas de seguridad y exclusiones

- No migrar a ECS: el editor sigue basado en **nodos de escena**.
- No reemplazar `AnimationPanel.vue`, `TimelinePanel.vue`, `NleTimeline.vue` ni `montage.js` por módulos paralelos completos.
- No alterar ni sustituir Event Order Flow.
- VFX3D conserva el recurso `.vfx` y su simulación independiente.
- Rendimiento: una sola representación temporal por nodo y cachés con vida acotada, sin recalcular todo el proyecto ni hornear física en cada tick del mouse.
- Antes de modificar esquema o puentes, hacer pruebas con escenas heredadas, nodos renombrados, IDs duplicados y project replacements.

**Resultado del presente Gate:** contrato listo para revisión y aprobación. **Código y runtime sin cambios.**
