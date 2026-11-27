# QA — LF-LIQUID-WATERBODY-COUPLING-S09-G001

**Gate:** autorizado el 2026-10-30. **Amendment:** `LF-WATER-LIQUID-CA-002` formalizado en S09.
**Estado:** IMPLEMENTADO · TEST NODE PASS · BUILD/QA ELECTRON/PLAYER NO VERIFICADOS · NO CERRADO.

## Evidencia automatizada

- `npm run test:liquid-waterbody-coupling`: batería conjunta de puertos, desplazamiento, WATER S01–S08, render y física de nodos. **333 tests declarados: 324 PASS, 0 FAIL, 9 SKIP**. Los SKIP pertenecen a pruebas que necesitan Three.js no instalado en este entorno.
- **Pruebas específicas S09: 37/37 PASS.** ID/validación de puertos, balances, bidirección, caudal limitado, fronteras externas, puertos sin cobertura, snapshots v5, restauración antigua, rollback, ocupación por varias celdas y superficie física alineada al solver.
- Las pruebas de Three/Jolt que requieren dependencias o hardware local pueden omitir; no se cuentan como PASS.
- Validación de sintaxis `node --check` para archivos JS modificados.
- Editor y Player: `npm run build` y `npm run electron` pendientes de ejecución local cuando `npm ci` instale Vite, Three.js y Jolt.

## Escenarios obligatorios del usuario

1. Crea dos regiones físicas no solapadas; conecta desde la región alta a la baja. Comprueba flujo, caudal configurado y la dirección inversa con puerto bidireccional. Revisa balance del mundo sin duplicación.
2. Crea una región compatible con lago o río heredado. En Inspector de Agua selecciona **Dominio físico**; en Terrain añade puerto explícito. Comprueba una sola superficie física y el error controlado cuando un cuerpo no asociado se solapa.
3. Conecta una región a océano heredado configurado. La entrada/salida debe aparecer como flujo externo; no debe reducir inventario finito del océano.
4. Activa desplazamiento Jolt y lanza una esfera y una caja alineada sobre la región. Debe responder el agua y mantenerse el empuje. Repite con cápsula simple. Verifica que cajas inclinadas/compuestas no reciben un desplazamiento falso.
5. Detén Play, reinícialo, cambia de escena, guarda y reabre `.lfproj`. Confirma que configuración y asociaciones se conservan, sin arrastrar agua de otra escena.
6. Prueba versiones de snapshot anteriores, desactiva acoplamiento y comprueba compatibilidad de proyectos antiguos.
7. Prueba PBR y PSX, altura de agua consultada por el jugador, escenas sin Terrain válido, objetos que desaparecen o cambian de posición, Play/Stop y exportación.
8. Registra FPS, memoria y uso CPU en equipo objetivo; compara contra S08 con 0, 2 y 20 cuerpos físicos.

**Evidencia a devolver:** salida de tests, compilación Editor/Player, captura de conexiones e Inspector, video de la respuesta en agua, estado de guardado/reapertura y rendimiento. Compilar no sustituye QA visual.

## Límites planificados

La conexión de puertos no conserva momento entre dominios, solo volumen; la ocupación usa aproximación de fondo efectivo; no hay solver volumétrico 3D ni turbulencia real. S10 recipientes/café y S11–S13 quedan PENDIENTE PLANIFICADO.

## Registro de comandos ejecutados

- `node --test scripts/test-liquid-waterbody-coupling-s09-g001.mjs`: **37 PASS, 0 FAIL**.
- `npm run test:liquid-waterbody-coupling`: **324 PASS, 0 FAIL, 9 SKIP**, 333 pruebas declaradas; incluye WATER S01–S08, render, Audio S01–S02, truenos y NodePhysics.
- `node --check` en 8 módulos JavaScript afectados: **PASS**.
- `npm run build`: **NO VERIFICADO**, la ejecución falla con `vite: not found` por ausencia de `node_modules`.
- `npm run docs:build`: **NO VERIFICADO**, `gen-docs` se ejecuta, pero `gen-docs-web` falla al importar `marked`; manual HTML pendiente de regenerar.
- Electron, Jolt real, exportación y QA visual de Player: **PENDIENTE DE USUARIO**, no confundir pruebas Node con QA local.

**Continuidad:** S08 aprobado por usuario; no convertir sus pruebas auditivas locales pendientes en PASS. La base siguiente es el SOURCE_BASELINE S09 entregado.
