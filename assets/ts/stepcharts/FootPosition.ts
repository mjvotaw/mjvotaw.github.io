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

  let bodyAngle = layout.calculateAngle(leftFootPosition, rightFootPosition);
  
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
  // The feet are pretty much always going to be perpendicular to the body, so subtract 90 degrees
  let footAngle = bodyAngle - 90;
  
  let nextPosition: FootPosition = { x: layout.layout[heelColumn].x, y: layout.layout[heelColumn].y, angle: footAngle, moved: true };

  // If we're bracketing something, then the foot's position and angle need to change so that it will touch both arrows
  if (toeColumn != -1)
  {
    let bracketPosition = layout.averagePoint(heelColumn, toeColumn);
    nextPosition.x = bracketPosition.x;
    nextPosition.y = bracketPosition.y;
    footAngle = layout.calculateAngle(layout.layout[heelColumn], layout.layout[toeColumn]);
    console.log(`Previous foot angle: ${nextPosition.angle}, bracket angle: ${footAngle}`);
    nextPosition.angle = footAngle;
  }
  // Otherwise, apply some slight modifications to the position to make the placement feel a little more natural
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

  // Once we've calculated the new position, we need to check if this arrow is actually a hold
  // if we haven't actually moved anything, then we want to prevent an animation of the foot moving up and down
  const holdTypesToIgnore: NoteType[] = [NoteType.HoldBody, NoteType.RollBody, NoteType.HoldTail];
  if (holdTypesToIgnore.includes(row.notes[heelColumn].type) && isEqual(previousPosition, nextPosition))
  {
    return previousPosition;
  }

  // In order to make the change in angle look better, we need to figure out the correct direction for the foot to turn
  // Positive numbers will cause things to rotate clockwise, and negative to rotate counter-clockwise
  // So we need to determine which direction results in less movement
  let previousAngle = previousPosition.angle;
  if (footAngle < 0)
  {
    footAngle += 360;
  }
  let distanceToPositive = Math.abs(previousAngle - footAngle);
  footAngle -= 360;
  let distanceToNegative = Math.abs(previousAngle - footAngle);
  
  if (distanceToPositive < distanceToNegative)
  {
    footAngle += 360;
  }

  nextPosition.angle = footAngle;

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

function isEqual(p1: BaseStagePoint, p2: BaseStagePoint)
{
  return p1.x == p2.x && p1.y == p2.y;
}