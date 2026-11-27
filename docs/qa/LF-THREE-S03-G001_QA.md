# LF-THREE-S03-G001 · Three.js S03 · SSR opcional

**Estado:** implementación entregada, aceptación y QA visual del usuario pendientes. **Base:** `LevelForge_THREE_S02_G001_SOURCE_BASELINE.zip` (712 entradas). **Versión Three.js:** r170, sin actualizar dependencias.

## Contrato y alcance ejecutado

- **T05:** integrar `SSRPass` oficial (`three/examples/jsm/postprocessing/SSRPass.js`) dentro de `LookPipeline` / `EffectComposer` preexistentes, sin segundo renderizador. Modo **opt-in**, por defecto `ssr: false`. Solo look `realista`, perfiles `medio/alto` y efectos habilitados. Calidad `baja/media/alta`, intensidad y distancia configurables. `reflections` sigue controlando IBL y no activa SSR.
- **Rutas:** `render/config.js` normaliza y persiste; `templates/renderParams.js` muestra controles en Ajustes → Render → Efectos; `render/profiles.js` permite sobrescrituras desde perfiles existentes; `render/look.js` instancia, sincroniza cámaras, dimensiona buffers y destruye pase. Editor y Player consumen el mismo runtime.
- **Compatibilidad r170:** `SSRPass` renderiza su propio *beauty pass* y **no toma los efectos previos del `readBuffer`**. Por eso se intercala tras `CaptureDepthPass` y antes de niebla, DOF, view model, AO, bloom y gradación; ubicarlo al final sobrescribiría esos efectos. La inversión evita esa regresión pero mantiene el coste de los renderizados extra del addon.
- **Calidad:** en r170 no existe `resolutionScale`. Se usa `SSRPass.setSize()` sobre sus propios buffers internos, con factores de 50 %, 75 % y 100 %; el canvas, el compositor principal, el agua y el cielo conservan su tamaño. Se recalcula tras resize o cambio de escala del compositor.
- **Superficies:** `selects` filtra mallas PBR con rugosidad material menor que 0,85 o metalness mayor que 0,03. No se promete que todos los shaders custom, charcos procedurales internos o materiales básicos reflejen igual que materiales PBR. El resultado depende de geometría visible; no captura lo que está fuera de pantalla.
- **Cámara:** refrescar matrices de proyección, near/far y lista de superficies al renderizar para que los cambios FPS/editor no usen el dato anterior.
- **Coste y estabilidad:** recreación por cambios estructurales; `dispose()` de pase integrado en el lifecycle original. Si SSR está apagado o intensidad 0, el pase no se crea. No se activó por defecto para ningún perfil ni proyecto heredado.

## Auditoría T06–T08, únicamente documental

| Técnica | Hallazgo / decisión |
|---|---|
| `Reflector` / `Refractor` | Addons que crean rendertargets/cámaras para superficies específicas; no importados. Requieren contrato de autoría de espejos/cristal y benchmarks propios. |
| `Water` / `Water2` | Superficies renderizadas con óptica y ondas, NO sustituyen `WaterWorld` (única autoridad física de LevelForge). No importados ni activados. |
| `Sky` | Modelo visual de cielo atmosférico. LevelForge ya tiene astronomía, clima, nube, estrellas y PMREM; no crear un segundo sistema de cielo. |

Referencia de API precisa de la versión de origen: https://github.com/mrdoob/three.js/blob/r170/examples/jsm/postprocessing/SSRPass.js
Documentación oficial: https://threejs.org/docs/pages/SSRPass.html (puede describir versiones posteriores a r170).

## Pruebas ejecutables y resultados por completar

```bash
node --test scripts/test-three-s03.mjs
node --test scripts/test-three-s02.mjs scripts/test-render-pipe-s01.mjs scripts/test-db-contract.mjs
npm run build
npm run electron
```

`test-three-s03.mjs` valida valores predeterminados, normalización de contratos, perfiles, selección de material, orden de los pases, conexión al compositor existente, tamaños de render interno y sincronización de cámara. Las comprobaciones con Three.js real están protegidas por `SKIP` si no se instalaron dependencias.

**QA local manual indispensable:**

- [ ] Abrir proyecto anterior, confirmar SSR apagado y ausencia de cambios visuales.
- [ ] Activar Ajustes → Render → Efectos → Reflejos SSR en Forward+ o Mobile (medio/alto). Confirmar reflejo sobre esfera metálica/plano PBR y ausencia de errores de consola.
- [ ] Alternar calidad baja/media/alta; comparar rendimiento GPU y artefactos de bordes. Con SSR apagado, comprobar que vuelve el rendimiento previo.
- [ ] Ajustar intensidad a cero: pase inactivo. Ajustar distancia máxima y confirmar cambio visual coherente.
- [ ] Probar materiales Basic, personalizados, terreno mojado y WaterWorld; registrar superficies compatibles/no compatibles, sin atribuir falsas capacidades.
- [ ] Comprobar GTAO, niebla atmosférica/volumétrica, Bloom, DOF, gradación, view model FPS y cámara móvil con SSR activado. Confirmar orden correcto.
- [ ] Probar modo PSX, perfil bajo y Compatibility: sin forzar SSR. Probar cambio de calidad / escenas y detener Play varias veces, sin fugas.
- [ ] Guardar, cerrar, reabrir proyecto y probar perfil de render (`.profile`) que active/desactive SSR.
- [ ] Compilar `npm run build` (Editor y Player) y verificar juego exportado.
- [ ] Registrar tiempos de fotograma con SSR OFF/LOW/MED/HIGH en GPU Intel UHD 605 y comparar VRAM/RAM; **sin prometer FPS**.

**Limitaciones de evidencia en el entorno de entrega:** si `npm ci`/Three.js/Vite no están disponibles, la compilación y prueba WebGL se etiquetan **NO VERIFICADAS**; no se infiere PASS de comprobar solo código Node. El QA del usuario y la aprobación siguen pendientes.

## Entrega

Dos ZIP exactamente: `LF-THREE-S03-G001_CHANGE.zip` y `LevelForge_THREE_S03_G001_SOURCE_BASELINE.zip`, sin SHA independiente ni scripts de instalación. Comparar con modificaciones locales antes de extraer CHANGE; conservar SOURCE_BASELINE sin extraer encima del proyecto activo.
