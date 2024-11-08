import { StageLayout, BaseStagePoint } from "./StageLayouts";
import { FootPart, Note, NoteType, Row } from "./Stepchart";
import { lerp } from "./maths";

const FOOT_Y_MOD = 0.5;
const FOOT_X_MOD = 0.3;

export interface BodyPosition
{
  left: FootPosition;
  right: FootPosition;
  bodyAngle: number;
}

export interface FootPosition
{
  x: number;
  y: number;
  angle: number;
  moved: boolean;
}


export function calculateFeetPositions(row: Row, layout: StageLayout, previousPosition: BodyPosition)
{
  let lastLeftPosition: FootPosition = { ...previousPosition!.left, moved: false };
  let lastRightPosition: FootPosition = { ...previousPosition!.right, moved: false };

  let lastBodyAngle = previousPosition?.bodyAngle ?? 0;

  let newPosition: BodyPosition = {
    left: lastLeftPosition,
    right: lastRightPosition,
    bodyAngle: lastBodyAngle,
  };

  let footColumns: { [id: string]: number } = {};
  footColumns[FootPart.LeftHeel] = -1;
  footColumns[FootPart.LeftToe] = -1;
  footColumns[FootPart.RightHeel] = -1;
  footColumns[FootPart.RightToe] = -1;

  for (let note of row.notes)
  {
    if (note.footPart != FootPart.None)
    {
      footColumns[note.footPart] = note.column;
    }
  }

  let leftFootPosition = layout.averagePoint(footColumns[FootPart.LeftHeel], footColumns[FootPart.LeftToe]);
  let rightFootPosition = layout.averagePoint(footColumns[FootPart.RightHeel], footColumns[FootPart.RightToe]);

  if (leftFootPosition.x == -1)
  {
    leftFootPosition = lastLeftPosition;
  }
  if (rightFootPosition.x == -1)
  {
    rightFootPosition = lastRightPosition;
  }

  let facingSine = layout.getFacingDirectionSine(leftFootPosition, rightFootPosition);
  let bodyAngle = Math.round(Math.asin(facingSine) * (180 / Math.PI));
  
  bodyAngle = lerp(lastBodyAngle, bodyAngle, 0.5);
  newPosition.left.angle = bodyAngle;
  newPosition.right.angle = bodyAngle;
  newPosition.bodyAngle = bodyAngle;

  newPosition.left = determineNexFootPosition(row, footColumns[FootPart.LeftHeel], footColumns[FootPart.LeftToe], bodyAngle, layout, lastLeftPosition, "left");
  newPosition.right = determineNexFootPosition(row, footColumns[FootPart.RightHeel], footColumns[FootPart.RightToe], bodyAngle, layout, lastRightPosition, "right");
  
  return newPosition;
}

function determineNexFootPosition(row: Row, heelColumn: number, toeColumn: number, bodyAngle: number, layout: StageLayout, previousPosition: FootPosition, whichFoot: string)
{
  if (heelColumn == -1)
  {
    return previousPosition;
  }
  
  let nextPosition: FootPosition = { x: layout.layout[heelColumn].x, y: layout.layout[heelColumn].y, angle: bodyAngle, moved: true };

  const holdTypesToIgnore: NoteType[] = [NoteType.HoldBody, NoteType.RollBody, NoteType.HoldTail];

  if (toeColumn != -1)
  {
    let bracketPosition = layout.averagePoint(heelColumn, toeColumn);
    nextPosition.x = bracketPosition.x;
    nextPosition.y = bracketPosition.y;
    let footAngle = getBracketAngle(layout.layout[heelColumn], layout.layout[toeColumn]);
    console.log(`Previous foot angle: ${nextPosition.angle}, bracket angle: ${footAngle}`);
    nextPosition.angle = footAngle;
  }
  else
  {
    if (whichFoot == "left")
    {
      let leftFootPosition = modifyLeftFootPosition(heelColumn, layout);
      nextPosition.x = leftFootPosition.x;
      nextPosition.y = leftFootPosition.y;
    }
    else if (whichFoot == "right")
    {
      let rightFootPosition = modifyRightFootPosition(heelColumn, layout);
      nextPosition.x = rightFootPosition.x;
      nextPosition.y = rightFootPosition.y;
    }
  }

  if (holdTypesToIgnore.includes(row.notes[heelColumn].type) && isEqual(previousPosition, nextPosition))
  {
    return previousPosition;
  }

  return nextPosition;
}


function modifyLeftFootPosition(column: number, layout: StageLayout)
{
  
  let newPosition = { ...layout.layout[column] };

  if (layout.upArrows.includes(column))
  {
    newPosition.y = newPosition.y - FOOT_Y_MOD;
    newPosition.x = newPosition.x - FOOT_X_MOD;
  }
  else if (layout.downArrows.includes(column))
  {
    newPosition.y = newPosition.y + FOOT_Y_MOD;
    newPosition.x = newPosition.x - FOOT_X_MOD;
  }

  if (newPosition.direction == "left")
  {
    newPosition.x = newPosition.x + FOOT_X_MOD;
  }

  return newPosition;
}

function modifyRightFootPosition(column: number, layout: StageLayout)
{
  let newPosition = { ...layout.layout[column] };

  if (layout.upArrows.includes(column))
  {
    newPosition.y = newPosition.y - FOOT_Y_MOD;
    newPosition.x = newPosition.x + FOOT_X_MOD;
  }
  else if (layout.downArrows.includes(column))
  {
    newPosition.y = newPosition.y + FOOT_Y_MOD;
    newPosition.x = newPosition.x + FOOT_X_MOD;
  }

  if (newPosition.direction == "right")
  {
    newPosition.x = newPosition.x - FOOT_X_MOD;
  }

  return newPosition;
}

// TODO: Check that this gives valid angles for brackets!

function getBracketAngle(p1: BaseStagePoint, p2: BaseStagePoint): number {
  if (p1.y == p2.y) {
    return 0
  }

  const dy = p2.y - p1.y
  const dx = p2.x - p1.x
  let rads = Math.atan2(dy, dx) - Math.PI * 0.5;
  return Math.round(rads * (180 / Math.PI));
} 

function isEqual(p1: BaseStagePoint, p2: BaseStagePoint)
{
  return p1.x == p2.x && p1.y == p2.y;
}