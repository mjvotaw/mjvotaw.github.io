import anime from "ts/vendor/anime.es";
import { StageLayout, BaseStagePoint } from "./StageLayouts";
import { FootPart, Note, NoteType, Row } from "./Stepchart";


export function buildStageAnimation(
  rows: Row[],
  layout: StageLayout,
  arrowSize: number,
  stageArrowSize: number,
  bpm: number,
  chart: HTMLDivElement,
  leftFoot: HTMLDivElement,
  rightFoot: HTMLDivElement)
{

  const bps = bpm / 60;
  const lastBeat = rows[rows.length - 1].beat;
  let songDuration = ((lastBeat + 1) / bps) * 1000;
  let preDelay = (1/bps) * 1000;
  let postDelay = 1000;
  let durationMs = songDuration + preDelay + postDelay;

  const timeline = anime.timeline({
    autoplay: false,
    loop: true,
    duration: durationMs
  });

  console.log(`buildStageAnimation:: lastBeat: ${lastBeat}, songDuration: ${songDuration}`);

  const chartHeight = ((lastBeat + 1) * arrowSize);
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

        let timeArrowShouldDisappear = (((row.beat + 1) / bps) * 1000) + preDelay;
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

    let leftFootPosition = layout.averagePoint(footPositions[FootPart.LeftHeel], footPositions[FootPart.LeftToe]);
    let rightFootPosition = layout.averagePoint(footPositions[FootPart.RightHeel], footPositions[FootPart.RightToe]);
    let time = (((row.beat + 1) / bps) * 1000) + preDelay;

    setFootPosition(leftFoot, leftFootPosition, time - lastTime, lastTime, stageArrowSize, timeline);
  }
}

function setFootPosition(foot: HTMLDivElement, position: BaseStagePoint, duration: number, delay: number, stageArrowSize: number, timeline: any)
{
  timeline.add({
    targets: [foot],
    duration: duration,
    left: position.x * stageArrowSize,
    bottom: position.y * stageArrowSize
  }, delay);
}