import { LAYOUT, StageLayout, StagePoint } from "./StageLayouts";
import { parseStepchart, NoteType, FootPart, Note, Row } from "./Stepchart";

interface Attributes
{
  stepstype?: string;
  quantization?: number;
  maxvisiblerows?: number;
  size?: number;
  xmod?: number;
  animate?: boolean;
  showstage?: boolean;
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
  public animate: boolean;
  public showStage: boolean;

  public layout: StageLayout;
  public rowSpacing: number;
  public containerHeight: number;
  public rows: Row[] = [];

  private chartContainer: HTMLDivElement;

  constructor(
    id: string,
    stepchart: string,
    attributes: Attributes
  )
  {
    this.id = id;
    this.stepsType = attributes.stepstype ?? "dance-single";
    this.quantization = attributes.quantization ?? 4;
    this.maxVisibleRows = attributes.maxvisiblerows ?? 0;
    this.size = attributes.size ?? 64;
    this.xmod = attributes.xmod ?? 1;
    this.animate = attributes.animate ?? false;
    this.showStage = attributes.showstage ?? false;

    this.layout = LAYOUT[this.stepsType];
    this.rowSpacing = this.size * this.xmod * (DEFAULT_QUANTIZATION / this.quantization);
    
    this.rows = parseStepchart(stepchart, this.quantization, MAX_QUANTIZATION, DEFAULT_QUANTIZATION, this.layout);

    if (this.maxVisibleRows == 0)
    {
      this.maxVisibleRows = this.rows.length;
    }
    this.containerHeight = (3 * this.size) + (this.maxVisibleRows * this.rowSpacing);
    
    this.chartContainer = this.buildChartContainer();

    const header = this.buildHeader();
    this.chartContainer.appendChild(header);

    const body = this.buildChart();
    this.chartContainer.appendChild(body);

    const wrapper = document.querySelector(`#${this.id}`);
    if (wrapper)
    {
      wrapper.appendChild(this.chartContainer);
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
    let top = this.rowSpacing * rowIndex;

    let noteElem = this.createElement("sc-arrow", direction, `beat-subdivision-${subdivision}`, `note-type-${note.type}`);
    noteElem.setAttribute("data-beat", beat.toPrecision(4));
    noteElem.setAttribute("data-foot", note.footPart);
    noteElem.setAttribute("data-note-type", note.type);

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

  private createElement(...classes: string[])
  {
    let element = document.createElement("div");
    element.classList.add(...classes);
    return element;
  }
}

globalThis.StepchartDisplay = StepchartDisplay;