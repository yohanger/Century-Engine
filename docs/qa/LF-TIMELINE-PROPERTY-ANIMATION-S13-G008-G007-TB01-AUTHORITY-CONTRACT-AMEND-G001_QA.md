# S13-G008-G007 TB-01 — Plan QA contractual y criterios futuros

**Gate:** `LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G007-TB01-AUTHORITY-CONTRACT-AMEND-G001`  
**Estado:** QA DOCUMENTAL · NO HAY EJECUCIÓN DE LAS PRUEBAS FUTURAS.  
**Contrato de aceptación:** `docs/architecture/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G007-TB01-CA-001_AMENDMENT.md` (pendiente ratificación).

## 1. Matriz de escenarios que deberá cubrir G007 técnico

| ID | Escenario futuro | Medio indispensable | Aceptación mínima | Estado actual |
|---|---|---|---|---|
| TBQA-01 | Misma escena/nodo/propiedad identifica un solo canal | Node | Sin colisiones por nombre ni escena | PENDIENTE |
| TBQA-02 | Dos Timeline solicitan el mismo canal | Node + PlayMode | Rechazo determinista de segundo sin mutar valor | PENDIENTE |
| TBQA-03 | Dos Timeline animan canales distintos del mismo nodo | Node + Player | Ambas propiedades conviven | PENDIENTE |
| TBQA-04 | Script escribe en canal con propiedad Timeline activa | Node + Electron | Rechazo observable; no último escritor gana | PENDIENTE |
| TBQA-05 | Animation Clip escribe mismo canal que Timeline | Node + Electron | Solo canal competidor suspendido; Clip continúa otros | PENDIENTE |
| TBQA-06 | Script/Clip sin Timeline activo | Node | Semántica actual conservada | PENDIENTE |
| TBQA-07 | RigidBody dinámico sin bake y pista de pose ordinaria | Electron + Jolt WASM | Sin teletransporte oculto ni mutación física contradictoria | PENDIENTE |
| TBQA-08 | Bake con reserva de RigidBody | Electron + Jolt WASM | Reserva, cinemático, sync, restauración de velocidades | PENDIENTE |
| TBQA-09 | StaticBody/kinematic, transformación + jerarquía | Electron + Jolt WASM | Sin discrepancia local/mundo ni cuerpos duplicados | PENDIENTE |
| TBQA-10 | Read/apply/restore de number y color soportados | Node + Electron | Valor efectivo reversible, proyecto intacto | PENDIENTE |
| TBQA-11 | Pause/Resume en Play Mode | Node + Electron | Valor congelado, dueño preservado, sin callbacks repetidos | PENDIENTE |
| TBQA-12 | Seek/scrub editorial a tiempos no secuenciales | Node + Electron | Misma entrada → misma salida; sin scripts ni comandos | PENDIENTE |
| TBQA-13 | Loop continuo y reentrada | Node + Electron | Sin acumulación ni snapshots duplicados | PENDIENTE |
| TBQA-14 | Stop al medio y fin natural | Node + Electron | Política de salida por canal; restauración nuevo, legado preservado | PENDIENTE |
| TBQA-15 | Skip con comandos esenciales | Node + Electron | No comandos intermedios; salida por canal correcta | PENDIENTE |
| TBQA-16 | Inspector edita pose durante Preview | Electron embebido | No revierte cambio de autoría; Undo/Redo intacto | PENDIENTE |
| TBQA-17 | Nodo ausente/inactivo y cambio de escena | Node + Electron | Limpieza idempotente, sin restaurar otra escena | PENDIENTE |
| TBQA-18 | Recurso actual con pista node antigua | Node + Electron | Sin migración retrospectiva ni cambio silencioso al terminar | PENDIENTE |
| TBQA-19 | Camera3D animada con cámara de render controlada por otro | Electron + Player | Pose y autoridad S15 separadas | PENDIENTE |
| TBQA-20 | Clips, FilmMaker, audio y Canvas no objetivo | Regresión Node + Electron | Sin duplicación ni efectos laterales | PENDIENTE |
| TBQA-21 | Build Editor y Player | npm run build | Compila ambos; warnings documentados por separado | PENDIENTE |
| TBQA-22 | Juego independiente exportado | Exportador actual + AppImage local | Mismo valor efectivo y lifecycle que Play Mode | NO VERIFICADO |

## 2. Bloqueos de aceptación

- Las rutas que escriban sin pasar por los puntos auditados impiden declarar arbitraje PASS para ese canal.
- Jolt físico real no puede sustituirse con mocks para aprobar TBQA-07..09.
- El Player independiente requiere ejecución real del usuario, no Vite/Node solamente.
- Color y curvas deben tener una decisión técnica respaldada por código/QA antes de habilitar el canal.
- TB-03 Canvas alfa/input, TB-04 modos CAM-05, TB-05 aspecto/Letterbox/HUD, TB-06 tercios y TB-07 FilmMaker siguen con sus propios contratos y Gates.

## 3. Evidencia disponible de G006 anterior

El usuario aportó ejecución `26 PASS` del test específico, `50 PASS` de regresión directa, build Vite Editor `849 módulos` y Player `415 módulos`; posteriormente confirmó **QA LOCAL PASS y APROBADO**. La línea `Downloading Electron binary...` en el log no constituye por sí sola un test WebGL nuevo. No hay evidencia de AppImage independiente. Estos hechos **no** se registran como pruebas ejecutadas de TBQA-01..22.

## 4. Criterio documental de este Gate

Entregar auditoría, Amendment propuesto, matriz TBQA y reconciliación de seis hojas. La ratificación futura debe ser explícita, distinta de la autorización de elaboración. Sin modificar código, no se declara ninguna funcionalidad adicional TEST AUTOMATIZADO PASS.
