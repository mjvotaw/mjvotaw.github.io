import anime from "ts/vendor/anime.es";
import { StageLayout, BaseStagePoint } from "./StageLayouts";
import { FootPart, Note, NoteType, Row } from "./Stepchart";


const FOOT_LIFT_SCALE = 1.15;
const FOOT_DURATION_SCALE = 0.7;
const FOOT_Y_MOD = 0.5;
const FOOT_X_MOD = 0.3;

export function buildStageAnimation(
  rows: Row[],
  layout: StageLayout,
  arrowSize: number,
  stageArrowSize: number,
  bpm: number,
  xmod: number,
  chart: HTMLDivElement,
  leftFoot: HTMLDivElement,
  rightFoot: HTMLDivElement)
{

  const bps = bpm / 60;
  const finalBeat = rows[rows.length - 1].beat;
  let songDuration = ((finalBeat) / bps) * 1000;
  let preDelay = (1/bps) * 1000;
  let postDelay = 1000;
  let durationMs = songDuration + preDelay + postDelay;

  const timeline = anime.timeline({
    autoplay: false,
    loop: true,
    duration: durationMs
  });

  console.log(`buildStageAnimation:: lastBeat: ${finalBeat}, songDuration: ${songDuration}`);

  const chartHeight = ((finalBeat) * arrowSize) * xmod;
  timeline.add({ targets: [chart], easing: 'linear', translateY: -1 *chartHeight, duration: songDuration, delay: preDelay });
  buildArrowAnimations(rows, bps, preDelay, timeline, chart);
  buildFootAnimations(rows, layout, stageArrowSize, bps, preDelay, timeline, leftFoot, rightFoot);
  timeline.add({ targets: [chart], easing: 'linear', translateY: -1 * chartHeight, duration: postDelay });
  return timeline;
}

function buildArrowAnimations(rows: Row[], bps: number, preDelay: number, timeline: any, chart: HTMLDivElement)
{
  for (let r = 0; r < rows.length;  r++)
  {
    let row = rows[r];

    for (let note of row.notes)
    {
      if (note.type == NoteType.Tap || note.type == NoteType.Mine)
      {
        let arrowElem = chart.querySelector(`.sc-arrow[data-row='${r}'][data-column='${note.column}']`);
        if (!arrowElem)
        {
          console.warn(`buildArrowAnimations:: couldn't find arrow element with row=${r} and column=${note.column}`);
          continue;
        }

        let timeArrowShouldDisappear = (((row.beat) / bps) * 1000) + preDelay;
        console.log(`buildArrowAnimations:: beat: ${row.beat} timeArrowShouldDisappear: ${timeArrowShouldDisappear}`);
        timeline.add({
          targets: [arrowElem],
          easing: 'linear',
          opacity: 0,
          duration: 1,
          delay: timeArrowShouldDisappear
        }, 0);
      }
    }
  }
}


function buildFootAnimations(rows: Row[], layout: StageLayout, stageArrowSize: number, bps: number, preDelay: number, timeline: any, leftFoot: HTMLDivElement, rightFoot: HTMLDivElement)
{
  
  let lastTime = preDelay;
  let lastLeftPosition: BaseStagePoint = { ...layout.startingPositions.left };
  let lastRightPosition: BaseStagePoint = { ...layout.startingPositions.right };
  let lastLeftAngle = 0;
  let lastRightAngle = 0;

  
  for (let r = 0; r < rows.length; r++)
  {
    let row = rows[r];

    let footPositions: { [id: string]: number } = {};
    footPositions[FootPart.LeftHeel] = -1;
    footPositions[FootPart.LeftToe] = -1;
    footPositions[FootPart.RightHeel] = -1;
    footPositions[FootPart.RightToe] = -1;

    for (let note of row.notes)
    {
      if (note.footPart != FootPart.None)
      {
        footPositions[note.footPart] = note.column;
      }
    }

    let time = (((row.beat) / bps) * 1000) + preDelay;
    let duration = time - lastTime;
    let delay = lastTime

    let leftFootPosition = layout.averagePoint(footPositions[FootPart.LeftHeel], footPositions[FootPart.LeftToe]);
    let rightFootPosition = layout.averagePoint(footPositions[FootPart.RightHeel], footPositions[FootPart.RightToe]);

    if (leftFootPosition.x == -1)
    {
      leftFootPosition = lastLeftPosition;
    }
    if (rightFootPosition.x == -1)
    {
      rightFootPosition = lastRightPosition;
    }


    let facingSine = layout.getFacingDirectionSine(leftFootPosition, rightFootPosition);
    let bodyAngle = 0;  //Math.round(Math.asin(facingSine) * (180 / Math.PI));
    
    // For each foot,  we need to make some adjustments, to make the movement and position seem more natural
    // - First, if either part of the foot is holding a note, we need to check if the position has changed from the
    // previous row. If not, then we don't want to animate things
    // - Then, check if the foot is bracketing, if so, we need to update the foot's angle
    // - And then, make some adjustments to the position:
    //  - each foot should hit up/down arrows closer to the inner edge
    //  - the left foot should hit up/down arrows closer to the left side
    //  - the left foto should hit left arrows closer to the center
    //  - the right foot should hit up/down arrows clower to the right side
    //  - the right foot should hit right arrows closer to the center

    if (footPositions[FootPart.LeftHeel] != -1)
    {
      if ((row.notes[footPositions[FootPart.LeftHeel]].type == NoteType.HoldBody || row.notes[footPositions[FootPart.LeftHeel]].type == NoteType.RollBody) && isEqual(lastLeftPosition, leftFootPosition))
      {
        // Skip all of this
      }

      let leftAngle = bodyAngle;
      let realLeftPosition = { ...leftFootPosition };
      if (footPositions[FootPart.LeftToe] != -1)
      {
        leftAngle = getBracketAngle(layout.layout[footPositions[FootPart.LeftHeel]], layout.layout[footPositions[FootPart.LeftToe]]);
        leftAngle = Math.round(leftAngle * (180 / Math.PI))
      }
      else
      {
        realLeftPosition = modifyLeftFootPosition(footPositions[FootPart.LeftHeel], layout);
      }
      setFootPosition(leftFoot, realLeftPosition, leftAngle, lastLeftAngle, duration, delay, stageArrowSize, timeline);
      lastLeftPosition = { ...leftFootPosition };
      lastLeftAngle = leftAngle;
    }

    if (footPositions[FootPart.RightHeel] != -1)
    {
      let rightAngle = bodyAngle;
      let realRightPosition = { ...rightFootPosition };

      if (footPositions[FootPart.RightToe] != -1)
      {
      rightAngle = getBracketAngle(layout.layout[footPositions[FootPart.RightHeel]], layout.layout[footPositions[FootPart.RightToe]]);
      rightAngle = Math.round(rightAngle * (180 / Math.PI))
      console.log(`row ${r}: right foot bracket angle = ${rightAngle}`);
      }
      else
      {
        realRightPosition = modifyRightFootPosition(footPositions[FootPart.RightHeel], layout);  
      }
      setFootPosition(rightFoot, realRightPosition, rightAngle, lastRightAngle, duration, delay, stageArrowSize, timeline);
      lastRightPosition = { ...rightFootPosition };
      lastRightAngle = rightAngle;
    }
    lastTime = time;
  }
}


function setFootPosition(foot: HTMLDivElement, position: BaseStagePoint, angle: number, previousAngle: number, duration: number, delay: number, stageArrowSize: number, timeline: any)
{
  timeline.add({
    targets: [foot],
    easing: 'linear',
    duration: duration,
    left: position.x * stageArrowSize,
    bottom: position.y * stageArrowSize
  }, delay);

  let intermediateAngle = lerp(previousAngle, angle, 0.5);
  timeline.add({
    targets: foot,
    easing: 'easeOutQuad',
    duration: duration / 2,
    scale: FOOT_LIFT_SCALE,
    rotate: -1 * intermediateAngle,
  }, delay);

  timeline.add({
    targets: foot,
    easing: 'easeInQuad',
    duration: duration / 2,
    scale: 1,
    rotate: -1 * angle
  }, delay + (duration / 2));

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

function lerp(a: number, b: number, t: number)
{
  return a + t * (b - a);
}

function getBracketAngle(p1: BaseStagePoint, p2: BaseStagePoint): number {
  if (p1.y == p2.y) {
    return 0
  }

  const dy = p2.y - p1.y
  const dx = p2.x - p1.x
  return Math.atan2(dy, dx) - Math.PI * 0.5
} 


function isEqual(p1: BaseStagePoint, p2: BaseStagePoint)
{
  return p1.x == p2.x && p1.y == p2.y;
}