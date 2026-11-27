# LF-MESH-EDIT-NUMERIC-SIGN-CORR-G001 — Contrato autorizado

Autorización exacta recibida: «Listo. LF-MESH-EDIT-NUMERIC-SIGN-CORR-G001 autoriza comenzar».
Base vinculante: LevelForge_MESH_EDIT_INTEGRATION_CORR_G001_SOURCE_BASELINE.zip, 1.700 archivos íntegros. Copia previa comparada sin diferencias. El adjunto del usuario acredita 11 Node PASS, Electron 1/1 con 29 checks y builds Editor/Player del Gate anterior. No atribuirle una aprobación manual explícita que no contiene.

## Objetivo y comportamiento

Durante G/R/S de Edit Mesh, la entrada numérica del teclado principal y numérico debe llegar al gesto existente: `G X 10 -` produce desplazamiento X -10; otro `-` devuelve +10; `+` fuerza el signo positivo. Son deltas del gesto, no coordenadas absolutas del objeto. El signo se puede introducir antes o después del número. Sin expresión matemática avanzada ni escala negativa nueva.

Reutilizar el cambio de signo existente. Dar prioridad al modal activo de Edit Mesh frente a navegación Numpad. Conservar navegación fuera del gesto, campos de texto, Snap/Shift, restricciones de eje, confirmar/cancelar e historial. El `+` de bisel continúa aumentando segmentos; no se extiende el nuevo significado a herramientas con atajos propios. Los límites aprobados de escala positiva permanecen vinculantes.

## Alcance permitido y medios

Producción exclusivamente src/core/editor/keys.js y src/core/mesh/session-modal.js. Tests y fixtures Node/Electron sobre módulos reales; extender la fixture común de integración sin duplicar motor, historial ni sesión. Ampliación acotada del runner Electron existente para teclas nativas, solo solicitadas por la fixture. Sin navegador externo. Builds Editor/Player, documentación, evidencia y seis hojas del ledger; registrar la evidencia local previa recibida sin cerrar por inferencia.

No incluye menús, fondos, logo, pestañas Escena/Juego, geometría visual de gizmos, docking, captura de puntero ni cambios de dependencias. Si se necesita otra corrección productiva, detener su implementación y delimitar otro alcance. No resolver los fallos históricos ajenos.

## Evidencia y cierre

Reproducir sobre baseline antes del cambio. Verificar teclado principal/Numpad, signos antes/después, cero/decimales, ejes, giro, escala rechazada y recuperación positiva, Enter/Escape, Undo/Redo, UV/materiales y recursos vinculados. Electron debe comprobar eventos confiables en el dispatcher real; Node usa colaboradores de plataforma explícitos y no acredita entrada nativa.

Separar IMPLEMENTADO, TEST NODE PASS, COMPILADO, ELECTRON PASS, QA LOCAL y APROBADO. Electron no disponible aquí se registra NO VERIFICADO. El usuario ejecuta QA local; no cerrar sin evidencia y aceptación.

Entrega exactamente CHANGE y SOURCE_BASELINE acumulado, con inventario contra esta base, nuevos/modificados/eliminados e inesperados. Sin node_modules/builds/cachés, sin SHA separado ni scripts .sh nuevos. Preservar proyectos y cambios locales.
