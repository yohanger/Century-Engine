# Ratificación CA-001 — Cinematic nativo de LevelForge

**Autoridad:** `LF-FILMMAKER-NATIVE-CINEMATIC-RESOURCE-CA-001`, ratificado por el usuario el 5 de noviembre de 2026 con la declaración exacta «Apruebo LF-FILMMAKER-NATIVE-CINEMATIC-RESOURCE-CA-001 sin modificaciones.»

Este documento registra la ratificación y **no sustituye ni modifica** los 24 apartados de la declaración de CA-001 aprobada en la conversación. En caso de diferencia, prevalece íntegramente aquella declaración.

## Decisiones vinculantes aplicables

- Un Cinematic es un recurso nativo del proyecto LevelForge, con ID estable, propietario y ruta de Assets.
- Nether FilmMaker tiene autoridad exclusiva sobre el contenido de autoría de la película.
- Cinematics puede catalogar, consultar y reproducir, pero no editar películas.
- El Player utiliza la infraestructura TimelineRunner existente; la representación temporal es derivada, nunca otra película de autoría.
- Guardar dentro del mismo proyecto **no exige exportar/importar** `.nfm`. La importación/exportación externa continúa como operación separada.
- El archivo cinematográfico `.nfm` sigue siendo único y sin versionado conforme a CA-002; no se introducen migraciones especulativas.
- El proyecto y las escenas originales deben preservarse. La copia de trabajo aislada de FilmMaker se conserva.
- El guardado debe ser seguro ante fallos, IDs inválidos y modificaciones concurrentes.
- El recurso puede existir vacío; conservará cámara estructural sin pistas, planos, clips ni efectos ficticios.
- Se preservan identidades, referencias, audio, animación, cámaras, física y Player.
- El Gate de implementación requiere prueba local completa, compilación, evidencia y aprobación antes de su cierre.

**Estado documental:** APROBADO. **Estado de la implementación S04:** separado y sujeto a QA.
