let counter = 0

/** 每個攻擊判定窗啟動時取一個新編號；同一編號對同一名敵人只命中一次。 */
export function nextStamp(): number {
  counter = (counter + 1) >>> 0
  if (counter === 0) counter = 1
  return counter
}
