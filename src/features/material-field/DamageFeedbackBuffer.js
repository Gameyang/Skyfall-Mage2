const DEFAULT_MAX_RECORDS = 128;

export class DamageFeedbackBuffer {
  constructor({ maxRecords = DEFAULT_MAX_RECORDS } = {}) {
    this.maxRecords = Math.max(1, Math.floor(maxRecords));
    this.records = [];
    this.droppedRecords = 0;
  }

  get length() {
    return this.records.length;
  }

  push(record) {
    if (this.records.length >= this.maxRecords) {
      this.droppedRecords += 1;
      return null;
    }

    const normalized = normalizeDamageFeedbackRecord(record);
    if (!normalized) return null;

    this.records.push(normalized);
    return normalized;
  }

  pushFromRule(rule, position, intensity = 1) {
    if (!rule?.feedback?.enabled) return null;

    const feedback = rule.feedback;
    return this.push({
      type: feedback.damageType || rule.output,
      x: position?.x,
      y: position?.y,
      radius: feedback.radius,
      damage: (feedback.damage ?? 0) + Math.max(0, intensity) * (feedback.intensityScale ?? 0),
      sourceMaterial: rule.output,
    });
  }

  read() {
    return this.records.map((record) => ({ ...record }));
  }

  drain() {
    const next = this.read();
    this.clear();
    return next;
  }

  clear() {
    this.records = [];
    this.droppedRecords = 0;
  }
}

export function normalizeDamageFeedbackRecord(record) {
  if (!record || !Number.isFinite(record.x) || !Number.isFinite(record.y)) {
    return null;
  }

  const radius = Math.max(0, Number(record.radius) || 0);
  const damage = Math.max(0, Number(record.damage) || 0);
  if (radius <= 0 || damage <= 0) return null;

  return Object.freeze({
    type: String(record.type || record.damageType || 'gpuReaction'),
    x: record.x,
    y: record.y,
    radius,
    damage,
    sourceMaterial: record.sourceMaterial || null,
  });
}
