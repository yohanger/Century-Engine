export class EventError extends Error {
  constructor(msg, where) { super(msg); this.where = where }
}
