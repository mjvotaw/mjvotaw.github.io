export interface BaseStagePoint
{
  x: number;
  y: number;
}
export interface StagePoint extends BaseStagePoint
{
  direction: string;
}

export class StageLayout {
  name: string
  layout: StagePoint[]
  columnCount: number
  upArrows: number[]
  downArrows: number[]
  sideArrows: number[]
  startingPositions: {
    left: StagePoint,
    right: StagePoint
  }
  constructor(
    name: string,
    layout: StagePoint[],
    upArrows: number[],
    downArrows: number[],
    sideArrows: number[],
    startLeftIndex: number,
    startRightIndex: number
  ) {
    this.name = name
    this.layout = layout
    this.columnCount = layout.length
    this.upArrows = upArrows
    this.downArrows = downArrows
    this.sideArrows = sideArrows
    this.startingPositions = {
      left: layout[startLeftIndex],
      right: layout[startRightIndex]
    }
  }

  // Returns the cosine of the angle made between the player's 
  // left and right feet and the x-axis.
  // This value can inform us on the degree of turning, but 
  // not which way the player is turned
  getFacingDirectionCosine(left: BaseStagePoint, right: BaseStagePoint) {
    if (left.x == right.x && left.y == right.y) return 0;

    let dx = right.x - left.x
    const dy = right.y - left.y

    const distance = Math.sqrt(dx * dx + dy * dy)
    dx /= distance
    return dx
  }

  getFacingDirectionSine(left: BaseStagePoint, right: BaseStagePoint)
  {
    if (left.x == right.x && left.y == right.y) return 0;

    let dx = right.x - left.x
    let dy = right.y - left.y

    const distance = Math.sqrt(dx * dx + dy * dy)
    dy /= distance
    return dy
  }

  calculateAngle(p1: BaseStagePoint, p2: BaseStagePoint)
  {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    let angle = Math.atan2(dx, dy) * (180 / Math.PI);
    
    if (angle < 0)
    {
      angle += 360;
    }

    return angle;

  }

  getYDifference(leftIndex: number, rightIndex: number) {
    if (leftIndex == rightIndex) return 0
    const dx = this.layout[rightIndex].x - this.layout[leftIndex].x
    let dy = this.layout[rightIndex].y - this.layout[leftIndex].y

    const distance = Math.sqrt(dx * dx + dy * dy)
    dy /= distance

    const negative = dy <= 0

    dy = Math.pow(dy, 4)

    if (negative) dy = -dy

    return dy
  }

  averagePoint(leftIndex: number, rightIndex: number): BaseStagePoint {
    if (leftIndex == -1 && rightIndex == -1) return { x: -1, y: -1 }
    if (leftIndex == -1) return { x: this.layout[rightIndex].x, y: this.layout[rightIndex].y };
    if (rightIndex == -1) return { x: this.layout[leftIndex].x, y: this.layout[leftIndex].y };
    return {
      x: (this.layout[leftIndex].x + this.layout[rightIndex].x) / 2,
      y: (this.layout[leftIndex].y + this.layout[rightIndex].y) / 2,
    }
  }

  getDistanceSq(leftIndex: number, rightIndex: number) {
    const p1 = this.layout[leftIndex]
    const p2 = this.layout[rightIndex]
    return (p1.y - p2.y) * (p1.y - p2.y) + (p1.x - p2.x) * (p1.x - p2.x)
  }

  bracketCheck(column1: number, column2: number) {
    return this.getDistanceSq(column1, column2) <= 2
  }

  getPlayerAngle(leftIndex: number, rightIndex: number) {
    const left = this.layout[leftIndex]
    const right = this.layout[rightIndex]
    const x1 = right.x - left.x
    const y1 = right.y - left.y
    const x2 = 1
    const y2 = 0
    const dot = x1 * x2 + y1 * y2
    const det = x1 * y2 - y1 * x2
    return Math.atan2(det, dot)
  }

  arePointsEqual(p1: BaseStagePoint, p2: BaseStagePoint)
  {
    return p1.x == p2.x && p1.y == p2.y;
  }
}

export const LAYOUT: { [id: string]: StageLayout } = {
  "dance-single": new StageLayout(
    "dance-single",
    [
      { x: 0, y: 1, direction: "left" }, // Left
      { x: 1, y: 0, direction: "down"}, // Down
      { x: 1, y: 2, direction: "up"}, // Up
      { x: 2, y: 1, direction: "right"}, // Right
    ],
    [2],
    [1],
    [0, 3],
    0,
    3
  ),
  "dance-double": new StageLayout(
    "dance-double",
    [
      { x: 0, y: 1, direction: "left"}, // P1 Left
      { x: 1, y: 0, direction: "down"}, // P1 Down
      { x: 1, y: 2, direction: "up"}, // P1 Up
      { x: 2, y: 1, direction: "right"}, // P1 Right

      { x: 3, y: 1, direction: "left"}, // P2 Left
      { x: 4, y: 0, direction: "down"}, // P2 Down
      { x: 4, y: 2, direction: "up"}, // P2 Up
      { x: 5, y: 1, direction: "right"}, // P2 Right
    ],
    [2, 6],
    [1, 5],
    [0, 3, 4, 7],
    0,
    3
  ),
}
