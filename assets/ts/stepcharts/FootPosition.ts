import { StageLayout, BaseStagePoint } from "./StageLayouts";
import { FootPart, Note, NoteType, Row } from "./Stepchart";
import { lerp } from "./maths";

const FOOT_Y_MOD = 0.3;
const FOOT_X_MOD = 0.3;

export interface BodyPosition
{
  left: FootPosition;
  right: FootPosition;
  bodyAngle: number;
}

export interface FootPosition
{
  location: BaseStagePoint;
  heel: BaseStagePoint;
  toe?: BaseStagePoint;
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

  let leftFootLocation = layout.averagePoint(footColumns[FootPart.LeftHeel], footColumns[FootPart.LeftToe]);
  let rightFootLocation = layout.averagePoint(footColumns[FootPart.RightHeel], footColumns[FootPart.RightToe]);

  if (leftFootLocation.x == -1)
  {
    leftFootLocation = lastLeftPosition.location;
  }
  if (rightFootLocation.x == -1)
  {
    rightFootLocation = lastRightPosition.location;
  }

  let bodyAngle = layout.calculateAngle(leftFootLocation, rightFootLocation);
  
  newPosition.bodyAngle = bodyAngle;

  newPosition.left = determineNexFootPosition(row, footColumns[FootPart.LeftHeel], footColumns[FootPart.LeftToe], bodyAngle, layout, lastLeftPosition, "left");
  newPosition.right = determineNexFootPosition(row, footColumns[FootPart.RightHeel], footColumns[FootPart.RightToe], bodyAngle, layout, lastRightPosition, "right");
  
  return newPosition;
}

export function initFootPosition(location: BaseStagePoint)
{
  let footPosition: FootPosition = {
    location: { x: location.x, y: location.y },
    heel: { x: location.x, y: location.y },
    angle: 0,
    moved: false
  };
  return footPosition;
}


function determineNexFootPosition(row: Row, heelColumn: number, toeColumn: number, bodyAngle: number, layout: StageLayout, previousPosition: FootPosition, whichFoot: string)
{
  if (heelColumn == -1)
  {
    return { ...previousPosition };
  }

  let heelLocation = layout.layout[heelColumn];
  let toeLocation = toeColumn > -1 ? layout.layout[toeColumn] : undefined;
  
  let nextLocation = determineNextFootLocation(row, previousPosition.location, heelColumn, toeColumn, layout, whichFoot);
  let nextAngle = deterimineFootAngle(previousPosition, nextLocation, heelLocation, toeLocation, bodyAngle, layout);
  let nextPosition: FootPosition = { location: nextLocation, heel: heelLocation, toe: toeLocation, angle: nextAngle, moved: true };

    // Once we've calculated the new location, we need to check if this arrow is actually a hold
  // if we haven't actually moved anything, then we want to prevent an animation of the foot moving up and down
  const holdTypesToIgnore: NoteType[] = [NoteType.HoldBody, NoteType.RollBody, NoteType.HoldTail];
  if (holdTypesToIgnore.includes(row.notes[heelColumn].type) && layout.arePointsEqual(previousPosition.location, nextLocation))
  {
    nextPosition.moved = false;
  }
  
  return nextPosition;
}

function determineNextFootLocation(row: Row, previousLocation: BaseStagePoint, heelColumn: number, toeColumn: number, layout: StageLayout, whichFoot: string)
{
  let nextLocation = { ...previousLocation };
  // If we're bracketing something, then the foot's position and angle need to change so that it will touch both arrows
  if (toeColumn != -1)
    {
      let bracketLocation = layout.averagePoint(heelColumn, toeColumn);
      nextLocation = bracketLocation;
    }
    // Otherwise, apply some slight modifications to the location to make the placement feel a little more natural
    else
    {
      if (whichFoot == "left")
      {
        let leftFootLocation = modifyLeftFootLocation(heelColumn, layout);
        nextLocation = leftFootLocation
      }
      else if (whichFoot == "right")
      {
        let rightFootLocation = modifyRightFootLocation(heelColumn, layout);
        nextLocation = rightFootLocation;
      }
  }

  return nextLocation;
}

function deterimineFootAngle(previousPosition: FootPosition, nextLocation: BaseStagePoint, heel: BaseStagePoint, toe: BaseStagePoint | undefined, bodyAngle: number, layout: StageLayout)
{
  // If the foot isn't moving to a new arrow, just return the same angle.
  // It looks weird when it moves around a bunch
  if (layout.arePointsEqual(previousPosition.location, nextLocation))
  {
    return previousPosition.angle;
  }

  // The feet are pretty much always going to be perpendicular to the body, so subtract 90 degrees
  let footAngle = bodyAngle - 90;

  if (toe != undefined)
  {
    footAngle = layout.calculateAngle(heel, toe);
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

  return footAngle;
}

function modifyLeftFootLocation(column: number, layout: StageLayout): BaseStagePoint
{
  let stagePoint = layout.layout[column];
  let newLocation = { x: stagePoint.x, y: stagePoint.y };

  if (layout.upArrows.includes(column))
  {
    newLocation.y = newLocation.y - FOOT_Y_MOD;
    newLocation.x = newLocation.x - FOOT_X_MOD;
  }
  else if (layout.downArrows.includes(column))
  {
    newLocation.y = newLocation.y + FOOT_Y_MOD;
    newLocation.x = newLocation.x - FOOT_X_MOD;
  }

  if (stagePoint.direction == "left")
  {
    newLocation.x = newLocation.x + FOOT_X_MOD;
  }

  return newLocation;
}

function modifyRightFootLocation(column: number, layout: StageLayout): BaseStagePoint
{
  let stagePoint = layout.layout[column];
  let newLocation = { x: stagePoint.x, y: stagePoint.y };

  if (layout.upArrows.includes(column))
  {
    newLocation.y = newLocation.y - FOOT_Y_MOD;
    newLocation.x = newLocation.x + FOOT_X_MOD;
  }
  else if (layout.downArrows.includes(column))
  {
    newLocation.y = newLocation.y + FOOT_Y_MOD;
    newLocation.x = newLocation.x + FOOT_X_MOD;
  }


  if (stagePoint.direction == "right")
  {
    newLocation.x = newLocation.x - FOOT_X_MOD;
  }

  return newLocation;
}
