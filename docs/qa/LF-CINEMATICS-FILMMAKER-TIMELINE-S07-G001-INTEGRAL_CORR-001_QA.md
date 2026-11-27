# QA — S07-G001-INTEGRAL CORR-001

**Estado:** implementación en fuentes. No corresponde declarar compilado ni QA local PASS sin evidencia del usuario.

Desde la carpeta original de LevelForge actualizada mediante CHANGE, con `package.json`:

```bash
node --test scripts/test-cinematics-filmmaker-timeline-s07-g001-integral.mjs scripts/test-cinematics-filmmaker-timeline-s07-g001-corr001.mjs
node --test scripts/test-cinematics-viewer-s05-g002.mjs scripts/test-cinematics-player-integration-s05-g004.mjs scripts/test-cinematics-legacy-cleanup-s05-g003.mjs
npm run electron
```

Si el usuario usa el comando de compilación de FilmMaker, `npm run filmmaker -- --build` comprueba la interfaz de FilmMaker y el proyecto, pero el QA visual de **Cinematics se realiza en el Editor de LevelForge**, no en la ventana independiente de FilmMaker.

## Escenarios locales obligatorios

1. Hacer copia de seguridad del proyecto y del `.nfm` antes de las pruebas.
2. Abrir **Cinematics** (no la pestaña Timeline de gameplay). Comprobar jerarquía visual, espacio de edición, escalado y ausencia de botones de autoría.
3. Importar un `.nfm` con al menos un plano/pase reproducible y, si se dispone, actor, audio y una capa de texto o fundido. Si el archivo dice «no contiene tomas ni montaje reproducible», ese rechazo sigue siendo correcto: no puede considerarse QA de pistas.
4. Seleccionar el montaje y comprobar carriles con nombres reales, duración, cámara, actor y capas presentes. Ningún carril vacío inventado. Reimportar **el mismo archivo** debe enriquecer la ficha existente, no duplicar películas.
5. Probar zoom +/−, ajuste a ventana, scroll y teclado (flechas, Inicio, Fin, Espacio), cabezal, pausa, reanudar y detener.
6. Buscar un tiempo arbitrario y observar pose/cámara coherentes en el viewport. En Edit Mode no se deben ejecutar comandos/audio/scripts.
7. Usar «Reproducir en Juego» y comprobar audio, cambios de cámara y actor donde existan datos reales.
8. Guardar, cerrar y reabrir el proyecto: catálogo, rangos y nombres deben persistir.
9. Verificar una película sin montaje: debe rechazarse sin crear entrada falsa ni alterar la escena.
10. Probar dimensiones estrechas del dock y que la Timeline siga legible, sin superposición.

**Entregar:** captura del panel Cinematics poblado, registro de pruebas, resultado de compilación, observaciones del Player y, si algún carril está ausente, el archivo `.nfm` de prueba o evidencia de su contenido.

**NO VERIFICADO EN ESTA ENTREGA:** compilación Vue/Electron, importación real JSZip, `.nfm` del usuario, Play/Player visual y rendimiento local.
