import { clamp } from '../util.js'

const neutral = Object.freeze({ temperature: 0, exposure: 1 })
const unit = (value) => clamp(Number.isFinite(value) ? value : 0, 0, 1)

export function environmentLook(frame) {
  if (!frame?.timeOn && !frame?.weatherOn) return neutral
  const night = frame.timeOn ? unit(frame.night) : 0
  const noon = frame.timeOn ? unit(1 - Math.abs(frame.hour - 12) / 6) : 0
  const rain = frame.weatherOn ? unit(frame.precipMm / 16) : 0
  return {
    temperature: 0.12 * noon - 0.58 * night - 0.26 * rain,
    exposure: Math.pow(2, 0.12 * noon - 0.36 * night - 0.25 * rain),
  }
}
