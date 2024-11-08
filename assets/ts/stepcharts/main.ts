import { buildFootAnimations, buildStepchartAnimation } from "./StepchartAnimation";
import { LAYOUT, StageLayout, StagePoint } from "./StageLayouts";
import { parseStepchart, NoteType, FootPart, Note, Row } from "./Stepchart";
import { BodyPosition, calculateFeetPositions, FootPosition } from "./FootPosition";

interface Attributes
{
  stepstype?: string;
  quantization?: number;
  maxvisiblerows?: number;
  size?: number;
  xmod?: number;
  bpm?: number;
  animate?: boolean;
  showstage?: boolean;
  hideleftfoot?: boolean;
  hiderightfoot?: boolean;
}

const MAX_QUANTIZATION = 16;
const DEFAULT_QUANTIZATION = 4;

const SUBDIVISIONS = ["4th", "16th", "8th", "16th"];

export class StepchartDisplay
{

  public id: string;
  public stepsType: string;
  public quantization: number;
  public maxVisibleRows: number;
  public size: number;
  public xmod: number;
  public bpm: number;
  public animate: boolean;
  public showStage: boolean;
  public hideLeftFoot: boolean;
  public hideRightFoot: boolean;

  public stageArrowSize: number;

  public layout: StageLayout;
  public rowSpacing: number;
  public beatSpacing: number;
  public containerHeight: number;
  public rows: Row[] = [];

  public animationTimeline: any; // anime.js timeline
  private wrapper: Element;
  private chartContainer?: HTMLDivElement;
  private chart: HTMLDivElement;
  private stageContainer?: HTMLDivElement;
  private leftFootElem: HTMLDivElement;
  private rightFootElem: HTMLDivElement;

  constructor(
    id: string,
    stepchart: string,
    attributes: Attributes
  )
  {
    console.log(typeof attributes);
    this.id = id;
    this.stepsType = attributes.stepstype ?? "dance-single";
    this.quantization = attributes.quantization ?? 4;
    this.maxVisibleRows = attributes.maxvisiblerows ?? 0;
    this.size = attributes.size ?? 64;
    this.xmod = attributes.xmod ?? 1;
    this.bpm = attributes.bpm ?? 120;
    this.animate = attributes.animate ?? false;
    this.showStage = attributes.showstage ?? false;
    this.hideLeftFoot = attributes.hideleftfoot ?? false;
    this.hideRightFoot = attributes.hiderightfoot ?? false;

    this.stageArrowSize = Math.round(this.size * 0.75);

    this.layout = LAYOUT[this.stepsType];
    this.rowSpacing = this.size * this.xmod * (DEFAULT_QUANTIZATION / this.quantization);
    this.beatSpacing = this.size * this.xmod;

    this.rows = parseStepchart(stepchart, this.quantization, MAX_QUANTIZATION, DEFAULT_QUANTIZATION, this.layout);

    if (this.maxVisibleRows == 0)
    {
      this.maxVisibleRows = this.rows.length;
    }
    this.containerHeight = (3 * this.size) + (this.maxVisibleRows * this.rowSpacing);

    const wrapper = document.querySelector(`#${this.id}`);
    if (!wrapper)
    {
      console.error(`StepchartDisplay:: could not find element with id '${this.id}`);
      return;
    }

    this.wrapper = wrapper;

    this.chartContainer = this.buildChartContainer();

    const header = this.buildHeader();
    this.chartContainer.appendChild(header);

    const body = this.buildChart();
    this.chart = body;
    this.chartContainer.appendChild(body);

    this.wrapper.appendChild(this.chartContainer);



    if (this.animate)
    {
      this.animationTimeline = buildStepchartAnimation(this.rows, this.size, this.bpm, this.xmod, this.chart);
    }

    if (this.showStage)
    {
      console.log('StepchartDisplay:: yeah Im building the stage');
      this.stageContainer = this.buildStage();
      this.wrapper.appendChild(this.stageContainer);
      this.leftFootElem = this.stageContainer.querySelector(".sc-foot.left");
      this.rightFootElem = this.stageContainer.querySelector(".sc-foot.right");
      
      if (this.animate)
      {
        buildFootAnimations(this.rows, this.layout, this.stageArrowSize, this.bpm, this.animationTimeline, this.leftFootElem, this.rightFootElem);
      }
      else
      {
        let initialPosition: BodyPosition = {
          left: { ...this.layout.startingPositions.left, angle: 0, moved: false },
          right: { ...this.layout.startingPositions.right, angle: 0, moved: false },
          bodyAngle: 0,
        };

        let nextPosition = calculateFeetPositions(this.rows[0], this.layout, initialPosition);
        this.setFootPosition(this.leftFootElem, nextPosition.left);
        this.setFootPosition(this.rightFootElem, nextPosition.right);
      }
    }
    
    if (this.animate)
    {
      console.log('build animation: ', this.animationTimeline);
      this.animationTimeline.play();
    }
    
  }




  private buildChartContainer()
  {
    let element = this.createElement("step-chart-container", `steps-type-${this.stepsType}`);

    element.style.setProperty("--arrow-size", `${this.size}px`);
    element.style.setProperty("--column-count", `${this.layout.columnCount}`);
    element.style.setProperty("--row-spacing", `${this.rowSpacing}px`);
    element.style.setProperty("height", `${this.containerHeight}px`);
    
    return element;
  }

  private buildHeader()
  {
    let header = this.createElement("sc-header");

    for (let sp of this.layout.layout)
    {
      let elem = this.createReceptorElem(sp);
      header.appendChild(elem);
    }
    return header;
  }


  private buildChart()
  {
    let body = this.createElement("sc-body", `quantization-${this.quantization}`);

    const sixteenthsPerRow = MAX_QUANTIZATION / this.quantization;

    for (let r = 0; r < this.rows.length; r++)
    {
      let row = this.rows[r];
      let beatIndex = sixteenthsPerRow * r;
      let subdivision = SUBDIVISIONS[beatIndex % SUBDIVISIONS.length];

      for (let c = 0; c < row.notes.length; c++)
      {
        let noteEleme = this.createNoteElem(row.notes[c], row.beat, r, subdivision);
        if (noteEleme)
        {
          body.appendChild(noteEleme);
        }
      }
    }

    return body;
  }

  private createReceptorElem(stagePoint: StagePoint)
  {
    let element = this.createElement("sc-receptor", stagePoint.direction);
    return element;
  }

  private createNoteElem(note: Note, beat: number, rowIndex: number, subdivision: string)
  {
    if (note.type == NoteType.None)
    {
      return undefined;
    }

    let direction = this.layout.layout[note.column].direction;
    let left = this.size * note.column;
    let top = (this.beatSpacing * beat) - (this.size);

    let noteElem = this.createElement("sc-arrow", direction, `beat-subdivision-${subdivision}`, `note-type-${note.type}`);
    noteElem.setAttribute("data-beat", beat.toPrecision(4));
    noteElem.setAttribute("data-foot", note.footPart);
    noteElem.setAttribute("data-note-type", note.type);
    noteElem.setAttribute("data-row", `${rowIndex}`);
    noteElem.setAttribute("data-column", `${note.column}`);
    noteElem.style.setProperty("left", `${left}px`);
    noteElem.style.setProperty("top", `${top}px`);

    switch (note.type)
    {
      case NoteType.Tap:
        noteElem.appendChild(this.createElement("sc-arrow-sprite"));
        break;
      case NoteType.HoldHead:
        noteElem.appendChild(this.createElement("sc-arrow-sprite"));
        noteElem.appendChild(this.createElement("sc-hold-head"));
        break;
      case NoteType.RollHead:
        noteElem.appendChild(this.createElement("sc-arrow-sprite"));
        noteElem.appendChild(this.createElement("sc-roll-head"));
        break;
      case NoteType.HoldBody:
        noteElem.appendChild(this.createElement("sc-hold-body"));
        break;
      case NoteType.RollBody:
        noteElem.appendChild(this.createElement("sc-roll-body"));
        break;
      case NoteType.HoldTail:
        if (note.holdType == NoteType.HoldBody)
        {
          noteElem.appendChild(this.createElement("sc-hold-tail"));
        }
        else if (note.holdType == NoteType.RollBody)
        {
          noteElem.appendChild(this.createElement("sc-roll-tail"));
        }
        break;
      case NoteType.Mine:
        noteElem.appendChild(this.createElement("sc-mine-sprite"));
        break;
    }
    return noteElem;
  }

  private buildStage()
  {
    let stage = this.createElement("sc-stage");

    // figure out the general layout of this stage, get the max x and y
    // This is assuming that the bottom-left corner is 0,0
    let maxX = this.layout.layout.reduce((x, sp) => { return Math.max(x, sp.x);  }, 0);
    let maxY = this.layout.layout.reduce((y, sp) => { return Math.max(y, sp.y); }, 0);
    
    let stageWidth = (maxX + 1) * this.stageArrowSize;
    let stageHeight = (maxY + 1) * this.stageArrowSize;

    stage.style.setProperty("width", `${stageWidth}px`);
    stage.style.setProperty("height", `${stageHeight}px`);
    stage.style.setProperty("--stage-arrow-size", `${this.stageArrowSize}px`);

    for (let c = 0; c < this.layout.layout.length; c++)
    {
        let sp = this.layout.layout[c];
      let arrow = this.createStageArrow(sp, c);
      stage.appendChild(arrow);
    }

    let leftFoot = this.createFoot("left", this.layout.startingPositions.left);
    let rightFoot = this.createFoot("right", this.layout.startingPositions.right);

    
    stage.appendChild(leftFoot);
    stage.appendChild(rightFoot);

    if (this.hideLeftFoot)
    {
      leftFoot.classList.add("hidden-foot"); 
    }
    
    if (this.hideRightFoot)
    {
      rightFoot.classList.add("hidden-foot");
    }
    return stage;
  }

  private createStageArrow(sp: StagePoint, columnIndex: number)
  {
    let arrow = this.createElement("sc-stage-arrow", sp.direction);
    arrow.setAttribute("data-column", `${columnIndex}`);
    let left = sp.x * this.stageArrowSize;
    let bottom = sp.y * this.stageArrowSize;
    arrow.style.setProperty("left", `${left}px`);
    arrow.style.setProperty("bottom", `${bottom}px`);
    return arrow;
  }

  private createFoot(whichFoot: string, startPosition: StagePoint)
  {
    let foot = this.createElement("sc-foot", whichFoot);
    let left = startPosition.x * this.stageArrowSize;
    let bottom = startPosition.y * this.stageArrowSize;
    foot.style.setProperty("left", `${left}px`);
    foot.style.setProperty("bottom", `${bottom}px`);
    return foot;
  }

  private setFootPosition(foot: HTMLDivElement, position: FootPosition)
  {
    let left = position.x * this.stageArrowSize;
    let bottom = position.y * this.stageArrowSize;
    foot.style.setProperty("left", `${left}px`);
    foot.style.setProperty("bottom", `${bottom}px`);
    foot.style.setProperty("transform", `rotate(${position.angle}deg)`);
  }
  

  private createElement(...classes: string[])
  {
    let element = document.createElement("div");
    element.classList.add(...classes);
    return element;
  }
}

globalThis.StepchartDisplay = StepchartDisplay;