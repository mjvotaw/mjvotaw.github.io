import anime from "ts/vendor/anime.es";
import { StageLayout, BaseStagePoint } from "./StageLayouts";
import { FootPart, Note, NoteType, Row } from "./Stepchart";
import { lerp } from "./maths";
import { BodyPosition, FootPosition, calculateFeetPositions, initFootPosition } from "./FootPosition";

const FOOT_LIFT_SCALE = 1.15;


export function buildStepchartAnimation(
  rows: Row[],
  arrowSize: number,
  bpm: number,
  xmod: number,
  chart: HTMLDivElement
)
{

  const bps = bpm / 60;
  const finalBeat = rows[rows.length - 1].beat;
  let songDuration = ((finalBeat) / bps) * 1000;
  let preDelay = (1/bps) * 1000;
  let postDelay = (1/bps) * 1000;
  let durationMs = songDuration + preDelay + postDelay;

  const timeline = anime.timeline({
    autoplay: false,
    loop: true,
    duration: durationMs
  });

  const chartHeight = ((finalBeat) * arrowSize) * xmod;
  timeline.add({ targets: [chart], easing: 'linear', translateY: -1 *chartHeight, duration: songDuration, delay: preDelay });
  buildArrowAnimations(rows, bps, preDelay, timeline, chart);
  timeline.add({ targets: [chart], easing: 'linear', translateY: -1 * chartHeight, duration: postDelay });
  return timeline;
}

//
// Arrow/chart animation
//

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


// 
// Feet animation
//

export function buildFootAnimations(rows: Row[], layout: StageLayout, stageArrowSize: number, bpm: number, timeline: any, leftFoot: HTMLDivElement, rightFoot: HTMLDivElement)
{
  const bps = bpm / 60;
  let preDelay = (1/bps) * 1000;
  let previousTime = preDelay;

  let previousPosition: BodyPosition = {
    left: initFootPosition(layout.startingPositions.left),
    right: initFootPosition(layout.startingPositions.right),
    bodyAngle: 0,
  };

  
  for (let r = 0; r < rows.length; r++)
  {
    let row = rows[r];

    let time = (((row.beat) / bps) * 1000) + preDelay;
    let duration = time - previousTime;
    let delay = previousTime

    let nextPosition = calculateFeetPositions(row, layout, previousPosition);

    if (nextPosition.left.moved)
    {
      setFootPosition(leftFoot, previousPosition.left, nextPosition.left, duration, delay, stageArrowSize, timeline);
    }

    if (nextPosition.right.moved)
    {
      setFootPosition(rightFoot, previousPosition.right, nextPosition.right, duration, delay, stageArrowSize, timeline);
    }
    previousPosition = { ...nextPosition };
    previousTime = time;
  }
}


function setFootPosition(foot: HTMLDivElement, previousPosition: FootPosition, nextPosition: FootPosition, duration: number, delay: number, stageArrowSize: number, timeline: any)
{

  timeline.add({
    targets: [foot],
    easing: 'linear',
    duration: duration,
    left: nextPosition.location.x * stageArrowSize,
    bottom: nextPosition.location.y * stageArrowSize
  }, delay);

  let intermediateAngle = lerp(previousPosition.angle, nextPosition.angle, 0.5);
  timeline.add({
    targets: foot,
    easing: 'easeOutQuad',
    duration: duration / 2,
    scale: FOOT_LIFT_SCALE,
    rotate: intermediateAngle,
  }, delay);

  timeline.add({
    targets: foot,
    easing: 'easeInQuad',
    duration: duration / 2,
    scale: 1,
    rotate: nextPosition.angle
  }, delay + (duration / 2));

}

//
// Stage animation
//

export function buildStageAnimations(rows: Row[], layout: StageLayout, bpm: number, timeline: any, stageArrows: HTMLDivElement[])
{
  let stageArrowFlashes: HTMLDivElement[] = [];
  for (let stageArrow of stageArrows)
  {
    let flash = stageArrow.querySelector(".sc-stage-arrow-flash") as HTMLDivElement;
    if (!flash)
    {
      console.error(`buildStageAnimations:: could not find .sc-stage-arrow-flash for arrow. Can't continue with stage animation`);
      return;
    }
    stageArrowFlashes.push(flash);
  }

  const bps = bpm / 60;
  let preDelay = (1/bps) * 1000;
  let previousTime = preDelay;
  
  for (let r = 0; r < rows.length; r++)
  {
    let row = rows[r];

    let time = (((row.beat) / bps) * 1000) + preDelay;
    let duration = time - previousTime;
    let delay = previousTime;

    for (let c = 0; c < row.notes.length; c++)
    {
      let note = row.notes[c];
      let flash = stageArrowFlashes[c];

      if (note.type == NoteType.Tap)
      {
        let flashStartDuration = Math.min(duration, 40);
        let flashStartDelay = delay + (duration - flashStartDuration);

        timeline.add({
          targets: flash,
          duration: flashStartDuration,
          opacity: 0.5,
        }, flashStartDelay);

        timeline.add({
          targets: flash,
          duration: 2000,
          opacity: 0,
        }, flashStartDelay + 40)
      }
    }
  }

}