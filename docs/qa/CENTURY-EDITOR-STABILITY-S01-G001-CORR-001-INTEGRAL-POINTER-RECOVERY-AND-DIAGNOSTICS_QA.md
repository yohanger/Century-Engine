# QA — recuperación de puntero editorial

Base: CENTURY_EDITOR_PLACEMENT_S01_G001_SOURCE_BASELINE.zip, 4252 archivos, CRC válido, SHA256 1a456709311ccf29563df75d93eee044b6c43ddc564bb33cff775f54318eeb3a. Frente a la Biblia anterior: 14 añadidos, 13 modificados, 0 retirados. La copia de trabajo de colocación coincide con el ZIP. Árbol local del usuario no disponible.

## Defectos reproducidos

Con una solicitud que nunca responde, Escape no cancelaba el estado pending; blur cancelaba el gesto pero dejaba la reserva indefinida. También se comprobó el fallo de liberación nativa inyectado y el callback de movimiento con excepción. Las nuevas pruebas confrontan el código original y corregido con reloj virtual y dobles de DOM. No se atribuye el incidente original a estos casos sin su log y reproducción.

## Evidencia

- Focal: 2/16 antes; 16/16 después. Varias pruebas nuevas ejercitan métodos y diagnósticos inexistentes antes; no todos los fallos equivalen a defectos independientes.
- Regresión focal histórica: 53/53 antes y después. Suite conjunta 69/69 PASS. Estrés: 200 ciclos simulados; listeners y estado verificados tras cada ciclo/fin.
- Regresión ampliada: 80/82 antes y después. Mismos fallos históricos `Play editorial sigue simulando sin foco y no entrega sus teclas al jugador` y `un clic en el canvas de Play recupera el foco antes de capturar el puntero`. No se alteran sus expectativas.
- Chromium aislado: 11/11. Se inyecta únicamente la primera solicitud pendiente; el siguiente gesto usa Pointer Lock real y clics CDP confiables. La liberación y el cursor se comprueban en DOM; no se acredita la recuperación del viewport completo. Acceso directo por URL bloqueado por política del entorno; prueba alternativa con HTML y código del componente en memoria. Captura de pantalla posterior en `evidence/integral-pointer-recovery/browser-isolated.png`.
- Electron: cuatro runners preparados/intentados, 0 verificaciones ejecutadas por falta de Vite. Build bloqueado por Vite. No se aprueba ni cierra el Gate.

QA local: `npm run test:suite -- integral-pointer-recovery`, `npm run test:suite -- integral-pointer-recovery-electron`. Probar además movimientos continuos en gizmos/Edit Mesh, pérdida de foco, Escape, cambio de escena y ventana, Edit/Play y reanudación. Cuando persista, conservar el mensaje completo `[Century/Pointer]` y el stack de la excepción. No es suficiente ausencia de errores en consola.

## Documentación y validación adicional

La prueba histórica de arrastre nativo se amplió para verificar que una pérdida de captura ajena no cancela y que la del propietario sí termina el arrastre y solicita devolver la recepción de eventos de ratón a la ventana nativa. Se mantienen los dos fallos previos de la regresión ampliada. La Biblia Técnica del portal se regeneró con Marked 4.0.19 disponible, no la versión 12.0.2 del lockfile. `docs:check` pasó 14/14 con ese entorno; conservar el PDF previo hasta una exportación completa. No se ha ejecutado la exportación PDF en este Gate. Las 213 páginas de uso permanecen iguales. Ledger: seis hojas; comparación de valores y fórmulas históricos sin diferencias.
