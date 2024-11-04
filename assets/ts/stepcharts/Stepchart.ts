import { StageLayout } from "./StageLayouts";

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


export function parseStepchart(stepchart: string, quantization: number, maxQuantization: number, defaultQuantization: number, layout: StageLayout): Row[]
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
      beat: rows.length * beatsPerRow
    };

    line = line.trim();
    let lineParts = line.replaceAll(whitespace, "").split("");

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
        type: getNoteType(columns[c]),
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
        note.footPart = getFootPart(footPlacement);
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


function getNoteType(n: string): NoteType
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

function getFootPart(f: string): FootPart
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