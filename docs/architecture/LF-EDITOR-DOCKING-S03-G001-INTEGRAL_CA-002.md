# LF-EDITOR-DOCKING-CA-002 — Clarificación de acoplamiento por pestañas (S03 CORR-001)

**Autoridad:** Gate integral `LF-EDITOR-DOCKING-S03-G001-INTEGRAL`, autorizado. **Origen:** QA local del usuario de 2026-11-03, NO APROBADO por indicador de destino persistente y acoplamiento que no compartía inequívocamente el mismo espacio. **Estado:** CORRECCIÓN IMPLEMENTADA; QA local de la corrección PENDIENTE.

## Aclaración vinculante de CA-001

1. **Compartir espacio como ventanas con pestañas:** soltar una pestaña sobre el encabezado de cualquier grupo existente agrega ese panel al **mismo contenedor y la misma superficie de contenido**, como una pestaña. No crea un splitter ni una segunda zona. La pestaña soltada queda activa y la anterior sigue recuperable con un clic.
2. **Divisiones explícitas:** siguen disponibles para quien arrastre **sobre los bordes estrechos del cuerpo de un grupo**, y no se activan por pasar simplemente junto al encabezado. El centro del cuerpo conserva el acoplamiento como pestaña.
3. **Acceso desde el viewport:** el viewport no es zona acoplable. Las franjas de sus bordes son accesos para incorporar paneles **como pestañas** en las zonas izquierda/derecha/superior/inferior. Su aviso es pequeño, no un velo ni una región persistente.
4. **Limpieza DnD:** los avisos de destino se limpian ante `drop`, `dragend`, Escape, pérdida de foco y salida real del destino, incluidos eventos que cambian entre elementos hijos. Ningún indicador puede permanecer pegado después de terminar la operación.
5. Se conservan `dockLayout` como única fuente autoritativa, identidad única de los paneles, Vue `Teleport`, `AppWindow`, preferencias antiguas compatibles, Play maximizado, contextos Edit Mesh/Pintura, Shader Graph central y el viewport estructural fijo.

## Límite

El contrato de CA-001 sobre grupos divididos **no se revoca**: se reserva únicamente para gesto explícito sobre borde. No se transforma el viewport en ventana, no se rediseña UI del Player y no se introduce otro gestor de docking. Este documento no crea un segundo Gate; complementa el Gate integral S03 durante su ciclo de QA.

## Evidencia requerida

Node DOCK-C01..C06 y batería S03/WL; Electron con DnD DOM de agrupación, limpieza del destino y ausencia de duplicación; build Editor/Player; QA usuario con drag real dentro de Electron, incluida cancelación, mouse fuera del viewport, reacoplamiento, persistencia y salida de Play.
