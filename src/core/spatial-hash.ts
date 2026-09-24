/** 水平面均勻格網：每格存放實體編號，用來快速找出附近的士兵。 */
export class SpatialHash {
  readonly cellSize: number
  private readonly cells = new Map<number, number[]>()
  private readonly pool: number[][] = []

  constructor(cellSize: number) {
    this.cellSize = cellSize
  }

  clear(): void {
    for (const list of this.cells.values()) {
      list.length = 0
      this.pool.push(list)
    }
    this.cells.clear()
  }

  insert(id: number, x: number, z: number): void {
    const key = cellKey(Math.floor(x / this.cellSize), Math.floor(z / this.cellSize))
    let list = this.cells.get(key)
    if (list === undefined) {
      list = this.pool.pop() ?? []
      this.cells.set(key, list)
    }
    list.push(id)
  }

  /** 把半徑 r 內「可能」相交的格子中的編號寫進 out；精確距離由呼叫端判斷。 */
  query(x: number, z: number, r: number, out: number[]): number[] {
    out.length = 0
    const size = this.cellSize
    const x0 = Math.floor((x - r) / size)
    const x1 = Math.floor((x + r) / size)
    const z0 = Math.floor((z - r) / size)
    const z1 = Math.floor((z + r) / size)
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const list = this.cells.get(cellKey(cx, cz))
        if (list !== undefined) for (const id of list) out.push(id)
      }
    }
    return out
  }
}

// 格座標在 ±32768 內保證唯一
function cellKey(cx: number, cz: number): number {
  return (cx + 32768) * 65536 + (cz + 32768)
}
