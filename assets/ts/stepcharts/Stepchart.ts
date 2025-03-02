import { NotedataParserWithParity } from "./chart/gameTypes/parity/NotedataParserWithParity";
import { StageLayout } from "./StageLayouts";
import { Simfile } from "./chart/sm/Simfile";
import { ParityGenInternal } from "./util/ParityGenInternals";
import { DEFAULT_WEIGHTS } from "./util/ParityDataTypes";
import { Row as ChartRow } from "./util/ParityDataTypes";
import { NotedataEntry as ChartNote, NoteType as ChartNoteType } from "./chart/sm/NoteTypes";
import { Chart } from "./chart/sm/Chart";


// NOTE that this is different from SMEditor's `NoteData` enum!
// Don't use `./chart/sm/NoteTypes/NoteType` outside of the `chart` directory

export enum NoteType
{
  None = "0",
  Tap = "1",
  HoldHead = "2",
  HoldTail = "3",
  RollHead = "4",
  Mine = "M",
  HoldBody = "H",
  RollBody = "R"
}

export const NOTE_TYPE_LOOKUP_REV: Record<ChartNoteType, NoteType> = {
  Tap: NoteType.Tap,
  Hold: NoteType.HoldHead,
  Roll: NoteType.RollHead,
  Mine: NoteType.Mine,
  Fake: NoteType.None,
  Lift: NoteType.None,
}


export type HoldType = NoteType.None | NoteType.HoldBody | NoteType.RollBody;


export enum FootPart
{
  None = "",
  LeftHeel = "L",
  LeftToe = "l",
  RightHeel = "R",
  RightToe = "r"
}

export interface Note
{
  type: NoteType;
  holdType: HoldType;
  column: number;
  footPart: FootPart;
}

export interface Row
{
  notes: Note[];
  beat: number;
}
export class StepchartParser
{
  

  public static  getParityNoteString(smString: string, getParityNoteString: number)
  {
    let parser = new NotedataParserWithParity();
    let simfile = Simfile.fromNotesString(smString);
    console.log(`StepchartParser:: simfile=`, simfile);
    for (let stepsType in simfile.charts)
    {
      let parityGenerator = new ParityGenInternal(stepsType);
      let charts = simfile.charts[stepsType];
      for (let chart of charts)
      {
        let analysis = parityGenerator.analyze(chart.getNotedata(), undefined, DEFAULT_WEIGHTS);
        return parser.serialize(chart.getNotedata(), chart.gameType, getParityNoteString) + ";\n"
      }
    }
  }


  
  public static  parseSimfile(smString: string, maxQuantization: number, defaultQuantization: number, layout: StageLayout) 
  {
    let stepchart = StepchartParser.getParityNoteString(smString, maxQuantization);
    return StepchartParser.parseStepchart(stepchart, maxQuantization, maxQuantization, defaultQuantization, layout);
  }

  public static  parseStepchart(stepchart: string, quantization: number, maxQuantization: number, defaultQuantization: number, layout: StageLayout): Row[]
  {
    let rows: Row[] = [];

    let lines = stepchart.split("\n");
    let whitespace = /\s/gi;

    let beatsPerRow = (maxQuantization / defaultQuantization) / quantization;

    let columnHoldType: HoldType[] = [];
    for (let c = 0; c < layout.columnCount; c++)
    {
      columnHoldType.push(NoteType.None);
    }

    for (let line of lines)
    {
      let row: Row = {
        notes: [],
        beat: (rows.length * beatsPerRow) + 1,
      };

      line = line.trim();
      let lineParts = line.replaceAll(whitespace, "").split("");

      if (lineParts.length == 0)
      {
        continue;
      }
      if (lineParts.length < layout.columnCount)
      {
        console.warn(`parseStepchart:: could not parse line "${line}"`);
        console.warn(lineParts);
        continue;
      }
      let columns = lineParts.slice(0, layout.columnCount);
      let footPlacements: string[] = [];

      if (lineParts.length > layout.columnCount)
      {
        footPlacements = lineParts.slice(layout.columnCount);
      }

      for (let c = 0; c < columns.length; c++)
      {
        

        let note: Note = {
          type: StepchartParser.getNoteType(columns[c]),
          holdType: NoteType.None,
          column: c,
          footPart: FootPart.None,
        }
        
        if (note.type == NoteType.None && columnHoldType[c] != NoteType.None)
        {
          note.type = columnHoldType[c];
          note.holdType = columnHoldType[c];
        }

        if (note.type != NoteType.None)
        {
          let footPlacement = footPlacements.shift() ?? "";
          note.footPart = StepchartParser.getFootPart(footPlacement);
        }

        if (note.type == NoteType.HoldHead)
        {
          note.holdType = NoteType.HoldBody;
          columnHoldType[c] = NoteType.HoldBody;
        }
        else if (note.type == NoteType.RollHead)
        {
          note.holdType = NoteType.RollBody;
          columnHoldType[c] = NoteType.RollBody;
        }
        else if (note.type == NoteType.HoldTail)
        {
          note.holdType = columnHoldType[c];
          columnHoldType[c] = NoteType.None;
        }



        row.notes.push(note);
      }

      rows.push(row);
    }

    return rows;
  }


  public static getNoteType(n: string): NoteType
  {
    switch (n)
    {
      case "0":
        return NoteType.None;
      case "1":
        return NoteType.Tap;
      case "2":
        return NoteType.HoldHead;
      case "3":
        return NoteType.HoldTail;
      case "4":
        return NoteType.RollHead;
      case "M":
        return NoteType.Mine;
      case "H":
        return NoteType.HoldBody;
      case "R":
        return NoteType.RollBody;
      default:
        return NoteType.None;
    }
  }

  public static getFootPart(f: string): FootPart
  {
    switch (f)
    {
      case "L":
        return FootPart.LeftHeel;
      case "l":
        return FootPart.LeftToe;
      case "R":
        return FootPart.RightHeel;
      case "r":
        return FootPart.RightToe;
      default:
        return FootPart.None;
    }
  }
}