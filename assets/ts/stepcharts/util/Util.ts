
const QUANTS = [
  1,
  1 / 2,
  1 / 3,
  1 / 4,
  1 / 6,
  1 / 8,
  1 / 12,
  1 / 16,
  1 / 24,
  1 / 48,
]
export function getQuantIndex(beat: number) {
  for (let i = 0; i < QUANTS.length; i++) {
    if (Math.abs(beat - Math.round(beat / QUANTS[i]) * QUANTS[i]) < 0.01) {
      return i
    }
  }
  return 9
}

export function getDivision(beat: number) {
  return 4 / QUANTS[getQuantIndex(beat)]
}

export function bsearch<T>(
  arr: T[],
  value: number,
  property?: (a: T) => number
): number {
  property = property ?? (a => a as number)
  if (arr.length == 0) return -1
  if (value >= property(arr[arr.length - 1])) {
    let mid = arr.length - 1
    while (mid > 0 && property(arr[mid - 1]) == value) mid--
    return mid
  }
  let low = 0,
    high = arr.length
  while (low <= high && low < arr.length) {
    let mid = (low + high) >>> 1
    if (property(arr[mid]) == value) {
      while (mid > 0 && property(arr[mid - 1]) == value) mid--
      return mid
    }
    if (property(arr[mid]) < value) low = mid + 1
    if (property(arr[mid]) > value) high = mid - 1
  }
  return Math.max(0, high)
}

export function bsearchEarliest<T>(
  arr: T[],
  value: number,
  property?: (a: T) => number
) {
  property = property ?? (a => a as number)
  if (arr.length == 0) return -1
  let idx = bsearch(arr, value, property)
  while (arr[idx - 1] && property(arr[idx - 1]) == value) {
    idx--
  }
  return idx
}

export function compareObjects(a: any, b: any) {
  if (Object.keys(a).some(key => a[key] != b[key])) return false
  if (Object.keys(b).some(key => a[key] != b[key])) return false
  return true
}

export function capitalize(str: string): string {
  if (str == "") return ""
  return str.slice(0, 1).toUpperCase() + str.slice(1).toLowerCase()
}