/**
 * A tiny spatial index used by AI perception and unit separation.
 * Units are stored in map-sized buckets, so an agent only checks nearby buckets
 * instead of comparing itself with every character on the battlefield.
 */
export class SpatialHash {
  constructor(cellSize = 180) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  clear() {
    this.cells.clear();
  }

  key(column, row) {
    return `${column},${row}`;
  }

  insert(unit) {
    if (!unit?.active) return;
    const column = Math.floor(unit.x / this.cellSize);
    const row = Math.floor(unit.y / this.cellSize);
    const key = this.key(column, row);
    if (!this.cells.has(key)) this.cells.set(key, []);
    this.cells.get(key).push(unit);
  }

  rebuild(collections) {
    this.clear();
    for (const collection of collections) {
      for (const unit of collection) this.insert(unit);
    }
  }

  queryRadius(x, y, radius, predicate = null) {
    const results = [];
    const minColumn = Math.floor((x - radius) / this.cellSize);
    const maxColumn = Math.floor((x + radius) / this.cellSize);
    const minRow = Math.floor((y - radius) / this.cellSize);
    const maxRow = Math.floor((y + radius) / this.cellSize);
    const radiusSquared = radius * radius;

    for (let column = minColumn; column <= maxColumn; column += 1) {
      for (let row = minRow; row <= maxRow; row += 1) {
        const bucket = this.cells.get(this.key(column, row));
        if (!bucket) continue;

        for (const unit of bucket) {
          if (!unit.active || (predicate && !predicate(unit))) continue;
          const dx = unit.x - x;
          const dy = unit.y - y;
          if (dx * dx + dy * dy <= radiusSquared) results.push(unit);
        }
      }
    }
    return results;
  }

  nearest(x, y, radius, predicate = null) {
    let nearestUnit = null;
    let nearestDistanceSquared = radius * radius;
    for (const unit of this.queryRadius(x, y, radius, predicate)) {
      const dx = unit.x - x;
      const dy = unit.y - y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared < nearestDistanceSquared) {
        nearestDistanceSquared = distanceSquared;
        nearestUnit = unit;
      }
    }
    return nearestUnit;
  }
}
