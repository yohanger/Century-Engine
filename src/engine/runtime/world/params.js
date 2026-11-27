// Ajustes de ESCENA declarados: Nivel · Hora · Clima. El inspector genera su formulario a partir de estas listas (ParamForm),
// igual que la Base de datos y los comandos de evento: añadir un ajuste = añadir una línea aquí.
// Se guardan dentro de `environment` de cada escena (environment.level / .time / .weather). Sin DOM ni THREE.
import { WEATHER_LIST } from './weather.js'
import { celestialTime } from './lighting.js'
import { DIRECTOR_DEFAULTS } from './atmosphere.js'
import { ACOUSTIC_LIST } from './thunder.js'
import { normalizeRainProfiles } from './rain-audio-profile.js'
import { SURFACE_LIST } from '../layers.js'

export const SEASONS = [['winter', 'Invierno'], ['spring', 'Primavera'], ['summer', 'Verano'], ['autumn', 'Otoño']]
export const SEASON_DAY = { winter: 355, spring: 80, summer: 172, autumn: 266 } // día del año representativo

export const LEVEL_DEFAULTS = { name: '', canRun: true, canCrouch: true, canJump: true, speedScale: 1, gravityScale: 1, canSwim: true, canDive: true, waterCurrent: 1,
  // rótulo con el nombre del mapa al entrar (interfaz del sistema «Nombre del mapa»)
  showName: false, namePos: 'bottom-right', nameDelay: 0.6, nameIn: 1, nameHold: 2.5, nameOut: 1.4 }
export const NAME_POSITIONS = [['bottom-right', 'Abajo a la derecha'], ['bottom-left', 'Abajo a la izquierda'], ['top-right', 'Arriba a la derecha'], ['top-left', 'Arriba a la izquierda'], ['center', 'Centro']]
export const TIME_DEFAULTS = { on: false, hour: 12, flow: false, dayMinutes: 24, latitude: 20, season: 'summer', moonLight: 0.06, nightAmbient: 0.08, celestialLights: false,
  // astronomía real (FrostEngine): fecha, longitud y huso → sol, luna con fase, planetas y catálogo estelar reales
  astro: false, year: 2026, day: 172, longitude: 0, utcOffset: 0 }
export const LIGHTNING_MODELS = [['simple', 'Sencillos (destello)'], ['physical', 'Físicos (canal visible)']]
export const THUNDER_SOUNDS = [['clips', 'Clips de audio (los de la lista)'], ['procedural', 'Procedural (se sintetiza)']]
export const CLOUD_MODELS = [['classic', 'Clásicas (ruido global)'], ['cells', 'Por celdas (campo de Frost)']]
export const GUST_MODELS = [['sines', 'Suaves (senos)'], ['natural', 'Naturales (estocásticas)']]
export const DIRECTOR_STARTS = [['preset', 'El tiempo elegido'], ['random', 'Uno al azar']]
export const TORNADO_MODES = [['automatic', 'Automático con tormentas'], ['script', 'Solo desde scripting']]
export const WEATHER_DEFAULTS = { on: false, preset: 'clear', intensity: 1, lightning: true, windSpeed: 3, windDir: 45, gusts: 0.35,
  // atmósfera (FrostEngine): temperatura, humedad y niebla que se forma sola, rachas estocásticas
  baseTemp: 24, tempRange: 8, moisture: false, gustModel: 'sines',
  // rayos físicos (FrostEngine): canal visible que crece por ruptura dieléctrica + corriente de Heidler
  lightningModel: 'simple', maxStrikes: 1.2, peakKA: 30,
  lightningImpacts: false, lightningImpulse: false, lightningWaterResponse: false, lightningImpactRadius: 6, lightningImpulseStrength: 5,
  tornadoEnabled: false, tornadoMode: 'automatic', tornadoChance: 0.25, tornadoDevelopmentSeconds: 8, tornadoOrganizationSeconds: 6,
  tornadoFormationSeconds: 5, tornadoWeakeningSeconds: 5, tornadoDissipationSeconds: 5, tornadoX: 0, tornadoY: 0, tornadoZ: 0, tornadoRadius: 18, tornadoHeight: 65, tornadoIntensity: 18,
  tornadoDuration: 50, tornadoHeading: 0, tornadoMoveSpeed: 1, tornadoBodies: false, tornadoPlayer: false,
  tornadoForceScale: 1,
  tornadoDestruction: false, tornadoWaterLift: false, tornadoFire: false,
  tornadoWaterRateM3s: 0.002, tornadoTreeBudget: 24, tornadoWaterVfxNodeId: '', tornadoFireVfxNodeId: '',
  // director de clima: cambia el tiempo solo, con pesos, duraciones y transiciones
  director: false, directorStart: 'preset', directorSeed: 0, followClock: false, weatherScale: 1, transMin: 2, transMax: 8, abruptChance: 0.08, abruptMin: 1, abruptMax: 8,
  profiles: DIRECTOR_DEFAULTS.map((p) => ({ ...p })),
  // sonido del clima (clips de audio del proyecto)
  rainSound: '', rainVolume: 0.7, rainImpacts: false, rainImpactProfiles: [], windSound: '', windVolume: 0.6, thunderVolume: 1, thunderNear: 800, boltSound: '', thunders: [],
  // trueno procedural (C2): se sintetiza del canal del rayo; regiones acústicas y oclusión
  thunderSound: 'clips', thunderRegion: 'open', thunderRegions: [], soundOcclusion: true,
  // nubes por celdas (E): campo determinista de nubes individuales que dan lluvia por zonas, rayos desde cumulonimbos y sol tapado por nubes
  cloudModel: 'cells', cloudSeed: 0, cloudScale: 8, cloudSize: 2 }

const num = (min, max, step) => ({ type: 'number', min, max, step })

export const LEVEL_PARAMS = [
  { key: 'name', label: 'Nombre del nivel', type: 'text', def: '', hint: 'Vacío = nombre de la escena. Disponible en los textos como \\L y en game.level.name' },
  { key: 'canRun', label: 'Se puede correr', type: 'bool', def: true },
  { key: 'canCrouch', label: 'Puede agacharse', type: 'bool', def: true, hint: 'Usa la configuración de altura y velocidad de Base de datos ▸ Jugador.' },
  { key: 'canJump', label: 'Se puede saltar', type: 'bool', def: true },
  { key: 'speedScale', label: 'Velocidad (×)', ...num(0.1, 4, 0.05), def: 1, hint: 'Multiplica caminar y correr solo en este nivel (0,5 = encharcado, 1,5 = rampa…)' },
  { key: 'gravityScale', label: 'Gravedad (×)', ...num(0.1, 3, 0.05), def: 1 },
  { key: 'showName', label: 'Mostrar el nombre al entrar', type: 'bool', def: false },
  { key: 'namePos', label: 'Posición del nombre', type: 'select', def: 'bottom-right', options: NAME_POSITIONS, when: { showName: true } },
  { key: 'nameDelay', label: 'Aparece tras (s)', ...num(0, 30, 0.1), def: 0.6, when: { showName: true } },
  { key: 'nameIn', label: 'Fundido de entrada (s)', ...num(0, 10, 0.1), def: 1, when: { showName: true } },
  { key: 'nameHold', label: 'Se queda (s)', ...num(0, 60, 0.1), def: 2.5, when: { showName: true } },
  { key: 'nameOut', label: 'Fundido de salida (s)', ...num(0, 10, 0.1), def: 1.4, when: { showName: true } },
]

export const TIME_PARAMS = [
  { key: 'on', label: 'Controlar la hora', type: 'bool', def: false, hint: 'Activado: el sol y la luna siguen la hora y el cielo cambia de día a noche. La luz direccional de la escena pasa a ser el sol/luna.' },
  { key: 'hour', label: 'Hora inicial', ...num(0, 24, 0.05), def: 12, when: { on: true }, hint: '0–24 (6 = amanecer, 12 = mediodía, 18 = atardecer, 0 = medianoche)' },
  { key: 'flow', label: 'El tiempo transcurre', type: 'bool', def: false, when: { on: true } },
  { key: 'dayMinutes', label: 'Minutos reales por día', ...num(0.5, 1440, 0.5), def: 24, when: { on: true, flow: true } },
  { key: 'season', label: 'Estación', type: 'select', def: 'summer', options: SEASONS, when: { on: true, astro: false }, hint: 'Cambia la altura del sol y la duración del día' },
  { key: 'latitude', label: 'Latitud (°)', ...num(-90, 90, 0.1), def: 20, when: { on: true }, hint: '0 = ecuador. A más latitud, días más cortos en invierno y largos en verano' },
  { key: 'astro', label: 'Astronomía real', type: 'bool', def: false, when: { on: true }, hint: 'Sol, luna (con sus fases), cinco planetas y ~9 500 estrellas reales (catálogo J2000) según la fecha, la hora y el lugar. Las estrellas quedan fijas: giran con el cielo, no cambian al mover la cámara. Apagado: el modelo sencillo de siempre.' },
  { key: 'year', label: 'Año', ...num(1800, 2050, 1), def: 2026, when: { on: true, astro: true } },
  { key: 'day', label: 'Día del año (1–366)', ...num(1, 366, 1), def: 172, when: { on: true, astro: true }, hint: '1 = 1 de enero · 172 = 21 de junio · 355 = 21 de diciembre. Con «El tiempo transcurre» la fecha avanza sola y la luna recorre sus fases.' },
  { key: 'longitude', label: 'Longitud (°)', ...num(-180, 180, 0.1), def: 0, when: { on: true, astro: true }, hint: 'Este positivo. Con el huso en 0, la hora del reloj es la hora UTC.' },
  { key: 'utcOffset', label: 'Huso horario (UTC ±h)', ...num(-12, 14, 0.5), def: 0, when: { on: true, astro: true }, hint: 'Ej.: −4 para República Dominicana. La hora que pones es la hora local.' },
  { key: 'celestialLights', label: 'Sol y luna independientes (Frost)', type: 'bool', def: false, when: { on: true }, hint: 'Usa la luz direccional de la escena solo para el sol y crea una segunda luz lunar interna, sin sombras. Apagado conserva el comportamiento anterior (una sola luz que cambia de sol a luna). Requiere una luz direccional visible en la escena.' },
  { key: 'moonLight', label: 'Luz de la luna (× sol)', ...num(0, 0.5, 0.01), def: 0.06, when: { on: true }, hint: 'Fuerza de la luz direccional de noche respecto a la del sol. La real es minúscula; en juegos 0,03–0,1 deja ver sin que parezca de día.' },
  { key: 'nightAmbient', label: 'Luz ambiente de noche (×)', ...num(0, 1, 0.01), def: TIME_DEFAULTS.nightAmbient, when: { on: true }, hint: 'Qué fracción de la luz ambiente del día queda de noche (la sombra no es negra del todo).' },
]

const PROFILE_FIELDS = [
  { key: 'preset', label: 'Tiempo', type: 'select', def: 'clear', options: WEATHER_LIST.map(([id, label]) => [id, label]) },
  { key: 'weight', label: 'Peso', type: 'number', min: 0, max: 100, step: 0.1, def: 1 },
  { key: 'minMinutes', label: 'Dura mín. (min)', type: 'number', min: 0.1, max: 600, step: 0.5, def: 15 },
  { key: 'maxMinutes', label: 'Dura máx. (min)', type: 'number', min: 0.1, max: 600, step: 0.5, def: 45 },
]
const THUNDER_FIELDS = [
  { key: 'clip', label: 'Sonido', type: 'audio', def: '' },
  { key: 'kind', label: 'Cuándo', type: 'select', def: 'any', options: [['any', 'Cualquier distancia'], ['near', 'Rayo cercano'], ['far', 'Rayo lejano']] },
  { key: 'volume', label: 'Volumen', type: 'number', min: 0, max: 2, step: 0.05, def: 1 },
]
const RAIN_IMPACT_FIELDS = [
  { key: 'enabled', label: 'Habilitado', type: 'bool', def: true },
  { key: 'surface', label: 'Superficie', type: 'select', def: 'stone', options: SURFACE_LIST },
  { key: 'clip1', label: 'Clip 1', type: 'audio', def: '' },
  { key: 'clip2', label: 'Clip 2', type: 'audio', def: '' },
  { key: 'clip3', label: 'Clip 3', type: 'audio', def: '' },
  { key: 'clip4', label: 'Clip 4', type: 'audio', def: '' },
  { key: 'volume', label: 'Volumen', type: 'number', min: 0, max: 2, step: 0.05, def: 0.7 },
  { key: 'pitch', label: 'Variación de tono', type: 'number', min: 0, max: 0.3, step: 0.01, def: 0.07 },
  { key: 'maxRate', label: 'Impactos / segundo', type: 'number', min: 0, max: 15, step: 1, def: 5 },
]
const REGION_FIELDS = [
  { key: 'preset', label: 'Acústica', type: 'select', def: 'open', options: ACOUSTIC_LIST },
  { key: 'cx', label: 'Centro X', type: 'number', min: -100000, max: 100000, step: 1, def: 0 },
  { key: 'cy', label: 'Centro Y', type: 'number', min: -10000, max: 100000, step: 1, def: 0 },
  { key: 'cz', label: 'Centro Z', type: 'number', min: -100000, max: 100000, step: 1, def: 0 },
  { key: 'sx', label: 'Ancho X', type: 'number', min: 1, max: 100000, step: 1, def: 50 },
  { key: 'sy', label: 'Alto Y', type: 'number', min: 1, max: 100000, step: 1, def: 30 },
  { key: 'sz', label: 'Largo Z', type: 'number', min: 1, max: 100000, step: 1, def: 50 },
]
export const WEATHER_PARAMS = [
  { key: 'on', label: 'Controlar el clima', type: 'bool', def: false, hint: 'Activado: las nubes, la niebla, la lluvia o nieve y la luz salen del tiempo elegido.' },
  { key: 'preset', label: 'Tiempo', type: 'select', def: 'clear', options: WEATHER_LIST.map(([id, label]) => [id, label]), when: { on: true } },
  { key: 'intensity', label: 'Intensidad', ...num(0, 1, 0.05), def: 1, when: { on: true }, hint: '0 = cielo despejado · 1 = el tiempo elegido a pleno' },
  { key: 'lightning', label: 'Relámpagos', type: 'bool', def: true, when: { on: true, preset: ['storm'] } },
  { key: '_hAtm', type: 'header', label: 'Atmósfera' },
  { key: 'baseTemp', label: 'Temperatura base (°C)', ...num(-40, 50, 0.5), def: 24, when: { on: true }, hint: 'Cada tiempo la desvía (lluvia −3 °, niebla −2 °, nieve −26 °…) y el día añade un ciclo: máxima a las 15 h, mínima a las 3 h. game.weather.temperature la lee.' },
  { key: 'tempRange', label: 'Oscilación diaria (°C)', ...num(0, 40, 0.5), def: 8, when: { on: true } },
  { key: 'moisture', label: 'Humedad y niebla realistas', type: 'bool', def: false, when: { on: true }, hint: 'La niebla ya no es un interruptor: se forma de madrugada, cuando el aire frío se acerca al punto de rocío, y se disipa con el sol y el viento (tarda 5–20 min). Necesita «Controlar la hora» para el ciclo de temperatura.' },
  { key: '_hCloud', type: 'header', label: 'Nubes' },
  { key: 'cloudSeed', label: 'Semilla de las nubes (0 = distinta cada partida)', ...num(0, 999999, 1), def: 0, when: { on: true, cloudModel: 'cells' }, hint: 'Con la misma semilla el mismo punto del mundo tiene siempre la misma nube.' },
  { key: 'cloudScale', label: 'Escala del campo (×)', ...num(1, 30, 0.5), def: 8, when: { on: true, cloudModel: 'cells' }, hint: 'Metros por unidad de FrostEngine: 8 = chunks de 2 km y nubes de 0,3–1,5 km (cielos de kilómetros). 1 = las nubes de juego de Frost (260 m de chunk). Cambiarla cambia dónde está cada nube.' },
  { key: 'cloudSize', label: 'Tamaño de las nubes (×)', ...num(0.5, 4, 0.1), def: 2, when: { on: true, cloudModel: 'cells' }, hint: 'Multiplica el tamaño de cada celda sin cambiar cuántas hay: 1 = proporciones de FrostEngine (cielo muy abierto, huecos grandes); 2 = por defecto; 3–4 = bancos extensos y cielos más cubiertos.' },
  { key: '_hDir', type: 'header', label: 'Director de clima' },
  { key: 'director', label: 'Cambiar el tiempo solo', type: 'bool', def: false, when: { on: true }, hint: 'Elige al azar el siguiente tiempo según los pesos de la lista, espera lo que dure el actual y cambia de forma gradual (o, a veces, brusca).' },
  { key: 'directorStart', label: 'Empieza con', type: 'select', def: 'preset', options: DIRECTOR_STARTS, when: { on: true, director: true } },
  { key: 'directorSeed', label: 'Semilla del azar (0 = distinta cada partida)', ...num(0, 999999, 1), def: 0, when: { on: true, director: true }, hint: 'Con la misma semilla el clima de la partida se repite igual.' },
  { key: 'profiles', label: 'Tiempos posibles', type: 'list', def: DIRECTOR_DEFAULTS, when: { on: true, director: true }, item: PROFILE_FIELDS, summary: (t) => `${t.preset} · peso ${t.weight} · ${t.minMinutes}–${t.maxMinutes} min`, hint: 'Peso = probabilidad relativa. Los minutos son de reloj del mundo (ver «Sigue al reloj»).' },
  { key: 'followClock', label: 'Sigue al reloj del mundo', type: 'bool', def: false, when: { on: true, director: true }, hint: 'Activado: los minutos del clima son minutos del juego (con 24 min reales por día, 20 min de clima = 20 s reales). Apagado: minutos reales × la escala.' },
  { key: 'weatherScale', label: 'Escala del tiempo (×)', ...num(0, 100, 0.1), def: 1, when: { on: true, director: true, followClock: false }, hint: '1 = tiempo real. 10 = el clima va 10 veces más rápido.' },
  { key: 'transMin', label: 'Transición mín. (min)', ...num(0, 120, 0.5), def: 2, when: { on: true, director: true } },
  { key: 'transMax', label: 'Transición máx. (min)', ...num(0, 120, 0.5), def: 8, when: { on: true, director: true } },
  { key: 'abruptChance', label: 'Cambio brusco (prob.)', ...num(0, 1, 0.01), def: 0.08, when: { on: true, director: true }, hint: 'Probabilidad de que el cambio dure solo unos segundos (un frente que llega de golpe).' },
  { key: 'abruptMin', label: 'Brusco mín. (s)', ...num(0, 120, 0.5), def: 1, when: { on: true, director: true } },
  { key: 'abruptMax', label: 'Brusco máx. (s)', ...num(0, 120, 0.5), def: 8, when: { on: true, director: true } },
  { key: '_hSnd', type: 'header', label: 'Sonido del clima' },
  { key: 'rainSound', label: 'Lluvia (bucle)', type: 'audio', def: '', when: { on: true }, hint: 'Se oye en bucle y sube o baja con la intensidad de la lluvia; también al cambiar de tiempo con game.weather.set.' },
  { key: 'rainVolume', label: 'Volumen de la lluvia', ...num(0, 1, 0.05), def: 0.7, when: { on: true } },
  { key: 'rainImpacts', label: 'Impactos por superficie', type: 'bool', def: false, when: { on: true }, hint: 'Reproduce clips asignados en materiales o perfiles por superficie; sin clips, permanece en silencio.' },
  { key: 'rainImpactProfiles', label: 'Perfiles de impactos', type: 'list', max: 16, def: [], when: { on: true, rainImpacts: true }, item: RAIN_IMPACT_FIELDS, summary: (r) => SURFACE_LIST.find(([k]) => k === r.surface)?.[1] || r.surface || 'Sin superficie' },
  { key: 'windSound', label: 'Viento (bucle)', type: 'audio', def: '', when: { on: true }, hint: 'Sube con la velocidad del viento.' },
  { key: 'windVolume', label: 'Volumen del viento', ...num(0, 1, 0.05), def: 0.6, when: { on: true } },
  { key: 'lightningModel', label: 'Tipo de rayos', type: 'select', def: 'simple', options: LIGHTNING_MODELS, when: { on: true, preset: ['storm'], lightning: true }, hint: 'Sencillos: un destello en el cielo. Físicos: se ve el canal ramificado que baja de la nube al suelo (simulado con un campo eléctrico 3D) y la luz parpadea con la forma de onda real (2–3 golpes).' },
  { key: 'maxStrikes', label: 'Rayos por minuto (máx.)', ...num(0, 30, 0.1), def: 1.2, when: { on: true, preset: ['storm'], lightning: true, lightningModel: 'physical' }, hint: 'Con tormenta a pleno; baja con la intensidad del tiempo.' },
  { key: 'peakKA', label: 'Corriente de pico (kA)', ...num(1, 200, 1), def: 30, when: { on: true, preset: ['storm'], lightning: true, lightningModel: 'physical' }, hint: 'Un rayo típico: 30 kA (varía ±28 % de un rayo a otro).' },
  { key: 'lightningImpacts', label: 'Impactos físicos sobre el mundo', type: 'bool', def: false, when: { on:true, lightning:true, lightningModel:'physical' }, hint: 'La descarga conserva su trayectoria y resuelve el primer contacto con geometría o Terrain. No crea daño automático.' },
  { key: 'lightningImpulse', label: 'Impulsos Jolt', type: 'bool', def: false, when: { on:true, lightning:true, lightningModel:'physical', lightningImpacts:true } },
  { key: 'lightningImpactRadius', label: 'Radio físico (m)', ...num(0.5, 30, 0.5), def:6, when: { on:true, lightning:true, lightningModel:'physical', lightningImpacts:true, lightningImpulse:true } },
  { key: 'lightningImpulseStrength', label: 'Impulso máx. (m/s)', ...num(0, 15, 0.5), def:5, when: { on:true, lightning:true, lightningModel:'physical', lightningImpacts:true, lightningImpulse:true } },
  { key: 'boltSound', label: 'Chasquido del rayo (cercano)', type: 'audio', def: '', when: { on: true, preset: ['storm'] }, hint: 'Suena al instante cuando el rayo cae cerca (sin el retardo del trueno).' },
  { key: 'thunders', label: 'Truenos', type: 'list', def: [], when: { on: true, preset: ['storm'] }, item: THUNDER_FIELDS, summary: (t) => `${t.kind === 'near' ? 'cerca' : t.kind === 'far' ? 'lejos' : 'cualquiera'}`, hint: 'Elige uno al azar de los que valgan para la distancia del rayo. Llegan con el retardo real (distancia ÷ 343 m/s).' },
  { key: 'thunderSound', label: 'Sonido del trueno', type: 'select', def: 'clips', options: THUNDER_SOUNDS, when: { on: true, preset: ['storm'] }, hint: 'Procedural: el trueno se sintetiza del canal del rayo (cada tramo llega con su retardo r ÷ 343: crujido cercano + estruendo grave) y no usa los clips de la lista. El chasquido del rayo cercano sigue siendo el clip.' },
  { key: 'thunderRegion', label: 'Acústica por defecto', type: 'select', def: 'open', options: ACOUSTIC_LIST, when: { on: true, preset: ['storm'], thunderSound: 'procedural' }, hint: 'Cómo suena el trueno donde no hay una región: reverberación, ecos y agudos que absorbe el lugar.' },
  { key: 'thunderRegions', label: 'Regiones acústicas', type: 'list', def: [], when: { on: true, preset: ['storm'], thunderSound: 'procedural' }, item: REGION_FIELDS, summary: (r) => `${r.preset} · ${r.sx}×${r.sy}×${r.sz} en (${r.cx}, ${r.cy}, ${r.cz})`, hint: 'Cajas en el mundo (centro y tamaño en metros). Vale la primera que contiene al oyente; el Interior ya amortigua el sonido por sí mismo.' },
  { key: 'soundOcclusion', label: 'Oclusión por techos y paredes', type: 'bool', def: true, when: { on: true }, hint: 'Oclusión de lluvia, viento e impactos; en el trueno procedural también atenúa los agudos. game.weather.setOcclusion permite forzarla.' },
  { key: 'thunderNear', label: '«Cerca» hasta (m)', ...num(100, 4000, 50), def: 800, when: { on: true, preset: ['storm'] } },
  { key: 'thunderVolume', label: 'Volumen de los truenos', ...num(0, 1, 0.05), def: 1, when: { on: true, preset: ['storm'] } },
  { key: '_hTornado', type:'header', label:'Tornado 3D' },
  { key:'tornadoEnabled', label:'Permitir tornados', type:'bool', def:false, when:{ on:true }, hint:'Se puede formar automáticamente o activarlo desde game.weather. No requiere un emisor manual.' },
  { key:'tornadoMode', label:'Activación', type:'select', def:'automatic', options:TORNADO_MODES, when:{on:true,tornadoEnabled:true} },
  { key:'tornadoChance', label:'Probabilidad por tormenta', ...num(0,1,0.05), def:0.25, when:{on:true,tornadoEnabled:true,tornadoMode:'automatic'},hint:'Cada episodio de tormenta se evalúa una vez con la semilla del director; nunca es obligatorio.' },
  { key:'tornadoDevelopmentSeconds', label:'Desarrollo de tormenta (s)', ...num(1,180,1), def:8, when:{on:true,tornadoEnabled:true} },
  { key:'tornadoOrganizationSeconds', label:'Organización (s)', ...num(1,180,1), def:6, when:{on:true,tornadoEnabled:true} },
  { key:'tornadoFormationSeconds', label:'Formación (s)', ...num(1,180,1), def:5, when:{on:true,tornadoEnabled:true} },
  { key:'tornadoWeakeningSeconds', label:'Debilitamiento (s)', ...num(1,180,1), def:5, when:{on:true,tornadoEnabled:true} },
  { key:'tornadoDissipationSeconds', label:'Disipación (s)', ...num(1,180,1), def:5, when:{on:true,tornadoEnabled:true} },
  { key:'tornadoX', label:'Centro X (m)', ...num(-100000,100000,1), def:0, when:{ on:true,tornadoEnabled:true } },
  { key:'tornadoY', label:'Base Y (m)', ...num(-10000,10000,1), def:0, when:{ on:true,tornadoEnabled:true } },
  { key:'tornadoZ', label:'Centro Z (m)', ...num(-100000,100000,1), def:0, when:{ on:true,tornadoEnabled:true } },
  { key:'tornadoRadius', label:'Radio (m)', ...num(2,200,1), def:18, when:{ on:true,tornadoEnabled:true } },
  { key:'tornadoHeight', label:'Alcance del viento (m)', ...num(5,1000,5), def:65, when:{ on:true,tornadoEnabled:true }, hint:'Límite vertical de la fuerza física del tornado; no controla la longitud visible del embudo, que desciende desde la base de las nubes.' },
  { key:'tornadoIntensity', label:'Velocidad tangencial máxima (m/s)', ...num(0,75,1), def:18, when:{ on:true,tornadoEnabled:true } },
  { key:'tornadoDuration', label:'Duración (s)', ...num(1,1800,5), def:50, when:{ on:true,tornadoEnabled:true } },
  { key:'tornadoHeading', label:'Dirección de avance (°)', ...num(-360,360,5), def:0, when:{ on:true,tornadoEnabled:true } },
  { key:'tornadoMoveSpeed', label:'Avance (m/s)', ...num(0,20,0.5), def:1, when:{ on:true,tornadoEnabled:true } },
  { key:'tornadoBodies', label:'Afectar cuerpos Jolt', type:'bool', def:false, when:{ on:true,tornadoEnabled:true } },
  { key:'tornadoPlayer', label:'Afectar jugador FPS', type:'bool', def:false, when:{ on:true,tornadoEnabled:true } },
  { key:'tornadoForceScale', label:'Escala fuerza física', ...num(0,2,0.1), def:1, when:{ on:true,tornadoEnabled:true } },
  { key:'tornadoDestruction', label:'Desprender vegetación resistente',type:'bool',def:false,when:{on:true,tornadoEnabled:true} },
  { key:'tornadoTreeBudget',label:'Árboles desprendidos (máximo)',...num(1,64,1),def:24,when:{on:true,tornadoEnabled:true,tornadoDestruction:true} },
  { key:'tornadoFire',label:'Transportar brasas y combustión compatible',type:'bool',def:false,when:{on:true,tornadoEnabled:true} },
  { key:'tornadoFireVfxNodeId',label:'Emisor VFX3D de fuego/brasas',type:'node',only:['vfx'],optional:true,def:'',when:{on:true,tornadoEnabled:true,tornadoFire:true} },
  { key: '_hWind', type: 'header', label: 'Viento' },
  { key: 'windSpeed', label: 'Velocidad (m/s)', ...num(0, 40, 0.5), def: 3, hint: '0–1 calma · 5 brisa · 12 fuerte · 25 temporal' },
  { key: 'windDir', label: 'Dirección (°)', ...num(-360, 360, 5), def: 45, hint: 'Hacia dónde sopla: 0 = norte (−Z), 90 = este (+X)' },
  { key: 'gusts', label: 'Rachas', ...num(0, 1, 0.05), def: 0.35, hint: 'Cuánto varían la fuerza y la dirección del viento' },
  { key: 'gustModel', label: 'Tipo de rachas', type: 'select', def: 'sines', options: GUST_MODELS, hint: 'Suaves: ondas fijas, siempre iguales. Naturales: proceso estocástico (Ornstein-Uhlenbeck) con memoria; con «Rachas» 0,35 son las de FrostEngine.' },
]

const fin = (v, d, a, b) => (v !== '' && v !== null && v !== undefined && Number.isFinite(+v) ? Math.min(b, Math.max(a, +v)) : d)
const lim = (params) => Object.fromEntries(params.filter((p) => p.type === 'number').map((p) => [p.key, p]))
const LL = lim(LEVEL_PARAMS), TL = lim(TIME_PARAMS), WL = lim(WEATHER_PARAMS)

/** Nivel válido a partir de lo guardado (los proyectos antiguos no lo tienen: valores por defecto). */
export function normalizeLevel(v = {}) {
  const o = { ...LEVEL_DEFAULTS }
  o.name = typeof v?.name === 'string' ? v.name : ''
  o.canCrouch = v?.canCrouch !== false
  o.canRun = v?.canRun !== false; o.canJump = v?.canJump !== false; o.canSwim = v?.canSwim !== false; o.canDive = v?.canDive !== false
  for (const k of ['speedScale', 'gravityScale', 'nameDelay', 'nameIn', 'nameHold', 'nameOut']) o[k] = fin(v?.[k], LEVEL_DEFAULTS[k], LL[k].min, LL[k].max)
  o.waterCurrent = fin(v?.waterCurrent, LEVEL_DEFAULTS.waterCurrent, 0, 3) // campo legado conservado, no expuesto
  o.showName = !!v?.showName
  o.namePos = NAME_POSITIONS.some(([k]) => k === v?.namePos) ? v.namePos : LEVEL_DEFAULTS.namePos
  return o
}
export function normalizeTime(v = {}) {
  const o = { ...TIME_DEFAULTS }
  o.on = !!v?.on; o.flow = !!v?.flow
  o.hour = ((fin(v?.hour, 12, -1e6, 1e6) % 24) + 24) % 24
  o.dayMinutes = fin(v?.dayMinutes, o.dayMinutes, TL.dayMinutes.min, TL.dayMinutes.max)
  o.latitude = fin(v?.latitude, o.latitude, TL.latitude.min, TL.latitude.max)
  o.moonLight = fin(v?.moonLight, o.moonLight, TL.moonLight.min, TL.moonLight.max)
  o.nightAmbient = fin(v?.nightAmbient, o.nightAmbient, TL.nightAmbient.min, TL.nightAmbient.max)
  o.season = SEASON_DAY[v?.season] ? v.season : o.season
  o.astro = !!v?.astro
  o.celestialLights = v?.celestialLights === true
  o.year = Math.round(fin(v?.year, o.year, TL.year.min, TL.year.max))
  o.day = Math.round(fin(v?.day, SEASON_DAY[o.season], TL.day.min, TL.day.max)) // sin «day» guardado: el día representativo de la estación
  o.longitude = fin(v?.longitude, o.longitude, TL.longitude.min, TL.longitude.max)
  o.utcOffset = fin(v?.utcOffset, o.utcOffset, TL.utcOffset.min, TL.utcOffset.max)
  return o
}
/** Migración puntual: el enlace visual heredado dejó de ser parte del contrato Weather.
 * No toca los nodos VFX ni sus recursos, que continúan siendo del proyecto. */
export function migrateLegacyTornadoVisual(weather = {}) {
  const raw = weather && typeof weather === 'object' ? weather : {}
  const migrated = Object.hasOwn(raw, 'tornadoVfxNodeId')
  if (!migrated) return { weather: raw, migrated: false }
  const { tornadoVfxNodeId: _unused, ...rest } = raw
  return { weather: rest, migrated: true }
}
export function normalizeWeather(v = {}) {
  v = migrateLegacyTornadoVisual(v).weather
  const o = { ...WEATHER_DEFAULTS }
  o.on = !!v?.on; o.lightning = v?.lightning !== false
  o.preset = WEATHER_LIST.some(([id]) => id === v?.preset) ? v.preset : o.preset
  for (const k of ['intensity', 'windSpeed', 'windDir', 'gusts', 'rainVolume', 'windVolume', 'thunderVolume', 'thunderNear', 'baseTemp', 'tempRange', 'maxStrikes', 'peakKA', 'directorSeed', 'weatherScale', 'transMin', 'transMax', 'abruptChance', 'abruptMin', 'abruptMax']) o[k] = fin(v?.[k], WEATHER_DEFAULTS[k], WL[k].min, WL[k].max)
  for (const key of ['tornadoChance','tornadoDevelopmentSeconds','tornadoOrganizationSeconds','tornadoFormationSeconds','tornadoWeakeningSeconds','tornadoDissipationSeconds','tornadoX','tornadoY','tornadoZ','tornadoRadius','tornadoHeight','tornadoIntensity','tornadoDuration','tornadoHeading','tornadoMoveSpeed','tornadoForceScale','tornadoTreeBudget']) o[key] = fin(v?.[key], WEATHER_DEFAULTS[key], WL[key].min, WL[key].max)
  o.tornadoWaterRateM3s = fin(v?.tornadoWaterRateM3s, WEATHER_DEFAULTS.tornadoWaterRateM3s, 0, 0.1) // dato legado inerte
  o.tornadoEnabled = v?.tornadoEnabled === true
  o.tornadoMode = TORNADO_MODES.some(([id])=>id===v?.tornadoMode) ? v.tornadoMode : 'automatic'
  o.tornadoDestruction=v?.tornadoDestruction===true
  o.tornadoWaterLift=v?.tornadoWaterLift===true
  o.tornadoFire=v?.tornadoFire===true
  o.tornadoWaterVfxNodeId=typeof v?.tornadoWaterVfxNodeId==='string' && v.tornadoWaterVfxNodeId.length<=128 ? v.tornadoWaterVfxNodeId : ''
  o.tornadoFireVfxNodeId=typeof v?.tornadoFireVfxNodeId==='string' && v.tornadoFireVfxNodeId.length<=128 ? v.tornadoFireVfxNodeId : ''
  o.tornadoTreeBudget=Math.round(o.tornadoTreeBudget)
  o.tornadoBodies = v?.tornadoBodies === true
  o.tornadoPlayer = v?.tornadoPlayer === true
  o.lightningImpacts = v?.lightningImpacts === true
  o.lightningImpulse = v?.lightningImpulse === true
  o.lightningWaterResponse = v?.lightningWaterResponse === true
  o.lightningImpactRadius = fin(v?.lightningImpactRadius, 6, 0.5, 30)
  o.lightningImpulseStrength = fin(v?.lightningImpulseStrength, 5, 0, 15)
  o.rainImpacts = v?.rainImpacts === true
  o.rainImpactProfiles = normalizeRainProfiles(v?.rainImpactProfiles)
  o.moisture = !!v?.moisture; o.director = !!v?.director; o.followClock = !!v?.followClock
  o.lightningModel = LIGHTNING_MODELS.some(([k]) => k === v?.lightningModel) ? v.lightningModel : 'simple'
  o.gustModel = GUST_MODELS.some(([k]) => k === v?.gustModel) ? v.gustModel : 'sines'
  o.cloudModel = CLOUD_MODELS.some(([k]) => k === v?.cloudModel) ? v.cloudModel : 'cells'
  o.cloudSeed = Math.round(fin(v?.cloudSeed, WEATHER_DEFAULTS.cloudSeed, WL.cloudSeed.min, WL.cloudSeed.max))
  o.cloudScale = fin(v?.cloudScale, WEATHER_DEFAULTS.cloudScale, WL.cloudScale.min, WL.cloudScale.max)
  o.cloudSize = fin(v?.cloudSize, WEATHER_DEFAULTS.cloudSize, WL.cloudSize.min, WL.cloudSize.max)
  o.directorStart = DIRECTOR_STARTS.some(([k]) => k === v?.directorStart) ? v.directorStart : 'preset'
  o.directorSeed = Math.round(o.directorSeed)
  o.profiles = (Array.isArray(v?.profiles) ? v.profiles : DIRECTOR_DEFAULTS).slice(0, 24).filter((t) => t && typeof t === 'object' && WEATHER_LIST.some(([id]) => id === t.preset))
    .map((t) => { const mn = fin(t.minMinutes, 15, 0.1, 600); return { preset: t.preset, weight: fin(t.weight, 1, 0, 100), minMinutes: mn, maxMinutes: Math.max(mn, fin(t.maxMinutes, 45, 0.1, 600)) } })
  for (const k of ['rainSound', 'windSound', 'boltSound']) o[k] = typeof v?.[k] === 'string' ? v[k] : ''
  o.thunderSound = THUNDER_SOUNDS.some(([k]) => k === v?.thunderSound) ? v.thunderSound : 'clips'
  o.thunderRegion = ACOUSTIC_LIST.some(([k]) => k === v?.thunderRegion) ? v.thunderRegion : 'open'
  o.soundOcclusion = v?.soundOcclusion !== false
  o.thunderRegions = (Array.isArray(v?.thunderRegions) ? v.thunderRegions : []).filter((r) => r && typeof r === 'object').slice(0, 16).map((r) => ({ preset: ACOUSTIC_LIST.some(([k]) => k === r.preset) ? r.preset : 'open',
    cx: fin(r.cx, 0, -100000, 100000), cy: fin(r.cy, 0, -10000, 100000), cz: fin(r.cz, 0, -100000, 100000), sx: fin(r.sx, 50, 1, 100000), sy: fin(r.sy, 30, 1, 100000), sz: fin(r.sz, 50, 1, 100000) }))
  o.thunders = (Array.isArray(v?.thunders) ? v.thunders : []).slice(0, 12).filter((t) => t && typeof t === 'object').map((t) => ({ clip: typeof t.clip === 'string' ? t.clip : '', kind: ['near', 'far'].includes(t.kind) ? t.kind : 'any', volume: fin(t.volume, 1, 0, 2) }))
  return o
}
/** { level, time, weather } normalizados de un `environment`. */
export const normalizeWorld = (env = {}) => ({ level: normalizeLevel(env?.level), time: normalizeTime(celestialTime(env)), weather: normalizeWeather(env?.weather) })

/**
 * Rótulo con el nombre del mapa: transparencia en el segundo `t` (retraso → entrada → se queda → salida), con curva suave.
 * Devuelve -1 cuando ya terminó. `o` = { delay, in, hold, out } en segundos.
 */
export function titleAlpha(t, o) {
  const d = +o.delay || 0, a = +o.in || 0, hd = +o.hold || 0, z = +o.out || 0
  const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x) }
  if (t < d) return 0
  if (t < d + a) return ease((t - d) / a)
  if (t < d + a + hd) return 1
  if (t < d + a + hd + z) return 1 - ease((t - d - a - hd) / z)
  return -1
}

/** Nombre del nivel que ve el jugador: el escrito en el inspector o, si está vacío, el de la escena. */
export const levelName = (env, sceneName = '') => (normalizeLevel(env?.level).name.trim() || sceneName || '')
