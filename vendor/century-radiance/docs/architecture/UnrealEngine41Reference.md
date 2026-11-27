# Unreal Engine 4.1 technical reference mapping

**Fuente privada de solo lectura:** Unreal Engine 4.1.1  
**ZIP ratificado:** SHA-256 `e0edd4c287d9e9f52f1de85b72a49fa8bbb479e79fbcd0844210678b7e1631df`  
**Regla:** referencia de arquitectura y ejecución. No se copia, traduce ni incorpora código, shaders o activos.

| Fuente UE 4.1 inspeccionada | Flujo observado | Decisión propia para Radiance |
|---|---|---|
| `Runtime/Engine/Private/World.cpp`, `Actor.cpp`, `LightComponent.cpp`, `Classes/Components/LightComponentBase.h` | World y actores registran componentes. LightComponent clasifica iluminación y sombra estática y publica estado al Scene/Renderer. | Century conserva ciclo de escena. Un adaptador futuro entrega descriptores. Radiance clasifica Static, Stationary y Movable y evita doble energía. |
| `Editor/UnrealEd/Private/EditorBuildUtils.cpp`, `StaticLightingSystem/StaticLightingSystem.cpp`, `Lightmass/Lightmass.cpp` | El Editor reúne/exporta escena, inicia trabajo y aplica resultados. | El bake será una acción editorial explícita. Runtime no contendrá autoría ni iniciará bake por movimiento. |
| `Programs/UnrealLightmass/Private/Launch/UnrealLightmass.cpp`, `Private/Lighting/LightingSystem.cpp`, `Engine/Config/BaseLightmass.ini` | Proceso separado ejecuta construcción multihilo y entrega resultados. | Worker tipado, cancelable y limitado. La futura implementación será TypeScript/GLSL/WebGL 2, no una traducción de Lightmass. |
| `Runtime/Engine/Public/PrecomputedLightVolume.h`, `Private/PrecomputedLightVolume.cpp`, `Runtime/Renderer/Private/IndirectLightingCache.cpp` | Datos residentes se registran y el Renderer interpola iluminación por primitivas móviles. | Objetos móviles consultarán datos publicados sin reconstruirlos. SH e interpolación pertenecen a S05. |
| `Runtime/Engine/Private/SkyLightComponent.cpp`, `ReflectionCaptureComponent.cpp`, `Runtime/Renderer/Private/ReflectionEnvironmentCapture.cpp`, `ReflectionEnvironment.cpp` | Capturas se generan por posición, filtran y componen según influencia y roughness. | Radiance centralizará cielo difuso, PMREM/capturas locales, influencia y fallback único en S06. |
| `Runtime/Engine/Classes/Engine/PostProcessVolume.h`, `Private/PostProcessVolume.cpp`, `SceneView.cpp`, `LocalPlayer.cpp` | Propiedades se mezclan por vista usando prioridad, distancia, peso y overrides de cámara. | Radiance evaluará composición óptica determinista por vista en S07. Century conserva cámara y nodos. |

## Adaptación a WebGL 2

UE 4.1 usa un renderer nativo y estructuras que WebGL 2 no replica. Radiance representará las mismas fronteras mediante texturas, framebuffers, uniform buffers, shaders GLSL ES 3.00, pases explícitos y Workers CPU. Cada capacidad tendrá detección, fallback documentado, presupuesto y QA. La equivalencia numérica o visual con UE no es objetivo.

S00 materializa únicamente contexto prestado, recursos propios, diagnóstico, recuperación y Worker. Los algoritmos de S01–S08 permanecen fuera de la API hasta su Gate.
