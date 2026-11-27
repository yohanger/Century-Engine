# QA — LF-WEATHER-TORNADO-WORLD-S12-G001

**Gate autorizado:** LF-WEATHER-TORNADO-WORLD-S12-G001.
**Estado:** IMPLEMENTADO · TEST NODE PASS · QA LOCAL PENDIENTE · NO CERRADO.

## Pruebas automatizadas

- **S12 nuevas:** 44/44 PASS en `scripts/test-weather-tornado-world-s12-g001.mjs`: normalización, campos tangencial/radial/vertical, no singularidad, perfiles de borde, movimiento determinista, cese por duración, `windAt` heredado, contrato VFX3D, advección world-space, independencia de instancias, eventos de Play, fuerzas opcionales, Timeline y restauración de transform.
- **Comando de regresión:** `npm run test:weather-tornado-world` — **460 pruebas declaradas, 451 PASS, 0 FAIL, 9 SKIP**. Incluye S11, rayos/truenos, LIQUID, WATER, AUDIO, física de nodos, WIND y pruebas VFX compatibles con Node.
- **Pruebas extra no verificadas:** tests VFX que requieren `jszip`, Vite y/o Three.js instalado. No alterar ni marcar como PASS dichas pruebas. Reejecutar con `npm ci` local.
- **Compilación:** NO VERIFICADA en esta máquina por `vite` ausente; generar/compilar docs también requiere dependencias instaladas.

## QA local obligatorio (usuario)

1. Comparar CHANGE con la fuente S11 instalada y modificaciones locales; respaldar ledger. `npm ci`, `npm run test:weather-tornado-world`, `npm run docs:build`, `npm run docs:check`, `npm run build`, `npm run electron`.
2. En Escena → Clima activar tornado y seleccionar dimensiones (p. ej. radio 20 m, altura 80 m). Colocar varios `RigidBody3D` con masa distinta; activar **Afectar cuerpos Jolt** y observar rotación, convergencia y ascenso, después desactivar y comprobar cero fuerza adicional. Objetos estáticos deben permanecer estáticos.
3. Crear recurso `.vfx` con **Espacio Mundo** y **Vórtice meteorológico** en sección Movimiento. Asignarlo a un nodo VFX3D existente y seleccionar ese nodo en Clima. Confirmar que la columna sigue al tornado sin cambiar permanentemente el transform de autoría; repetir con un nodo VFX hijo de otro Node3D.
4. Validar caso sin VFX asignado (no aparece preset ficticio) y caso con recurso incompatible (diagnóstico de Play, sin gestor duplicado).
5. Activar **Afectar jugador FPS** y comprobar empuje de cápsula Jolt sin atravesar estructuras ni romper salto, escaleras o teletransporte. Desactivar y comprobar movimiento heredado. El modo sin Jolt, otros Players y natación especial no se reclaman como verificados.
6. Script `game.on('tornadoStart'...)`, `game.on('tornadoEnter'...)`, `game.on('tornadoExit'...)`, `game.on('tornadoEnd'...)`: un evento por transición; verificar identidad y posición. Mover cámara y comprobar que el centro físico no se mueve.
7. Repetir con Film Maker/Timeline y cuerpos horneados; no forzar movimiento sobre propiedad de Timeline. Pausar/reanudar, guardar y restaurar partida, cambiar de escena y Play/Stop; VFX original no debe quedarse desplazado.
8. Repetir pruebas PBR/PSX, audio/viento, rayos S11, lluvia WATER, Player exportado Linux/Windows y memoria/FPS en hardware de 4 GB. Probar con VFX al mínimo, luego con partículas máximas autorizadas (1024 por recurso).

**Evidencia esperada:** log de tests/build, imágenes de Clima/VFX Editor, vídeo de columna+objetos+jugador, eventos emitidos, comparación de transform de nodo tras Stop, métricas FPS/RAM, funcionamiento en Player.

**Límites:** no CFD, no destrucción, no múltiples tornados simultáneos; no hay partículas si el usuario no asigna recurso VFX. S13 QA integral continúa PENDIENTE PLANIFICADO. No declarar CERRADO hasta QA local y aprobación.

## Verificaciones ejecutadas

- `node --test scripts/test-weather-tornado-world-s12-g001.mjs`: **44 PASS, 0 FAIL**.
- `npm run test:weather-tornado-world`: **451 PASS, 0 FAIL, 9 SKIP** sobre 460 declaradas.
- `node --check` de los módulos JavaScript cambiados: PASS.
- `npm run build`: **NO VERIFICADO**, error de dependencias `vite: not found`.
- `npm run docs:build`: **NO VERIFICADO**, `ERR_MODULE_NOT_FOUND` al generar el HTML.
- Electron, Jolt, Player exportado, percepción de viento y rendimiento: **NO VERIFICADOS**, QA local pendiente.
