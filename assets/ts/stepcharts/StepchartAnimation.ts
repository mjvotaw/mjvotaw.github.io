import anime from "ts/vendor/anime.es";
import { StageLayout, BaseStagePoint } from "./StageLayouts";
import { FootPart, Note, NoteType, Row } from "./Stepchart";
import { lerp } from "./maths";
import { BodyPosition, FootPosition, calculateFeetPositions } from "./FootPosition";

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


export function buildFootAnimations(rows: Row[], layout: StageLayout, stageArrowSize: number, bpm: number, timeline: any, leftFoot: HTMLDivElement, rightFoot: HTMLDivElement)
{
  const bps = bpm / 60;
  let preDelay = (1/bps) * 1000;
  let previousTime = preDelay;

  let previousPosition: BodyPosition = {
    left: { ...layout.startingPositions.left, angle: 0, moved: false },
    right: { ...layout.startingPositions.right, angle: 0, moved: false },
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
    left: nextPosition.x * stageArrowSize,
    bottom: nextPosition.y * stageArrowSize
  }, delay);

  let intermediateAngle = lerp(previousPosition.angle, nextPosition.angle, 0.5);
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
    rotate: -1 * nextPosition.angle
  }, delay + (duration / 2));

}
