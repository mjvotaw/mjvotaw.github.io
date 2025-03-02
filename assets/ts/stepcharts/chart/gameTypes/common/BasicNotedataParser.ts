import { lcm, lcm2, roundDigit } from "../../../util/Math"
import { getDivision } from "../../../util/Util"
import {
  isHoldNote,
  Notedata,
  NoteType,
  PartialHoldNotedataEntry,
  PartialNotedata,
  PartialNotedataEntry,
} from "../../sm/NoteTypes"
import { TimingData } from "../../sm/TimingData"
import { NotedataParser } from "../base/NotedataParser"
import { GameType } from "../GameTypeRegistry"

const NOTE_TYPE_LOOKUP: Record<string, NoteType> = {
  "1": "Tap",
  "2": "Hold",
  "4": "Roll",
  M: "Mine",
  F: "Fake",
  L: "Lift",
}

const NOTE_TYPE_LOOKUP_REV: Record<NoteType, string> = {
  Tap: "1",
  Hold: "2",
  Roll: "4",
  Mine: "M",
  Fake: "F",
  Lift: "L",
}

export class BasicNotedataParser extends NotedataParser {
  serialize(notedata: PartialNotedata, gameType: GameType): string {
    if (notedata.length == 0) return ""
    const measures = []
    let nIndex = 0
    const holdEnds: { col: number; beat: number }[] = notedata
      .filter(isHoldNote)
      .map(hold => {
        return { col: hold.col, beat: hold.beat + hold.hold }
      })
      .sort((a, b) => a.beat - b.beat)
    const lastNote = notedata.at(-1)!
    const lastBeat = lastNote.beat + (isHoldNote(lastNote) ? lastNote.hold : 0)
    let numMeasures = Math.ceil(lastBeat / 4)
    if (lastBeat % 4 == 0) numMeasures++
    for (let measure = 0; measure < numMeasures; measure++) {
      let measureString = "// measure " + measure + "\n"
      const measureNotes = []
      while (notedata[nIndex]?.beat < measure * 4 + 4) {
        measureNotes.push(notedata[nIndex++])
      }
      const measureHoldNotes = []
      while (holdEnds[0]?.beat < measure * 4 + 4) {
        measureHoldNotes.push(holdEnds.shift()!)
      }
      const division = Math.max(
        4,
        lcm2(
          lcm(measureNotes.map(note => getDivision(note.beat))),
          lcm(measureHoldNotes.map(note => getDivision(note.beat)))
        )
      )
      for (let div = 0; div < division; div++) {
        const beat = measure * 4 + (4 / division) * div
        const row = new Array(gameType.numCols).fill("0")
        while (
          roundDigit(measureNotes[0]?.beat ?? -1, 3) == roundDigit(beat, 3)
        ) {
          const note = measureNotes.shift()!
          row[note.col] = NOTE_TYPE_LOOKUP_REV[note.type]
          if (note.notemods) row[note.col] += `{${note.notemods}}`
          if (note.keysounds) row[note.col] += `{${note.keysounds}}`
        }
        while (
          roundDigit(measureHoldNotes[0]?.beat ?? -1, 3) == roundDigit(beat, 3)
        ) {
          const note = measureHoldNotes.shift()!
          row[note.col] = "3"
        }
        measureString += row.join("") + "\n"
      }
      measures.push(measureString)
    }
    return measures.join(",  ")
  }

  fromString(data: string, gameType: GameType): PartialNotedata {
    const measures = data.split(",")
    const notedata: PartialNotedata = []
    const holds: (PartialNotedataEntry | undefined)[] = []
    for (let measure_num = 0; measure_num < measures.length; measure_num++) {
      const rows = measures[measure_num].trim().split("\n")
      for (let row_index = 0; row_index < rows.length; row_index++) {
        const row = rows[row_index].trim()
        let col = 0
        for (let c = 0; c < row.length; c++) {
          if (col >= gameType.numCols) break
          const beat = measure_num * 4 + (row_index / rows.length) * 4
          let type = row[c]
          if (type == "{" || type == "[") {
            let data = ""
            c++
            while (c < row.length && row[c] != "}" && row[c] != "]") {
              data += row[c]
              c++
            }
            const lastNote = notedata.at(-1)
            if (lastNote && (row[c] == "}" || row[c] == "]")) {
              if (row[c] == "}") {
                lastNote.notemods = data
              } else {
                lastNote.keysounds = data
              }
            }
            continue
          }
          if (type == "D" && (row[c + 1] == "L" || row[c + 1] == "M")) {
            // lift holds / mineholds
            if (row[c + 1] == "L") type = "L"
            else type = "M"
            c++
          }
          if (type != "0" && type != "3") {
            const entry = {
              beat: beat,
              col: col,
              type: NOTE_TYPE_LOOKUP[type],
            } satisfies PartialNotedataEntry
            if (entry.type == undefined) {
              console.log(
                "Unknown note type " + type + " at beat " + beat + " col " + col
              )
              continue
            }
            if (type == "2" || type == "4") {
              if (holds[col]) {
                console.log(
                  "Missing end of hold/roll for note " +
                    JSON.stringify(holds[col])
                )
              }
              holds[col] = entry
            }
            notedata.push(entry)
          }
          if (type == "3") {
            if (holds[col]) {
              ;(holds[col] as PartialHoldNotedataEntry).hold =
                beat - holds[col]!.beat
              holds[col] = undefined
            } else {
              console.log(
                "Extra end of hold/roll at beat " + beat + " col " + col
              )
            }
          }
          col++
        }
      }
    }
    return notedata
  }

  getStats(notedata: Notedata): Record<string, number> {
    const stats: Record<string, number> = {
      Taps: 0,
      Jumps: 0,
      Hands: 0,
      Holds: 0,
      Rolls: 0,
      Mines: 0,
      Fakes: 0,
      Lifts: 0,
    }
    let row = -1
    let cols = 0
    const holdBeats: (number | undefined)[] = []
    for (const note of notedata) {
      if (note.beat != row) {
        let holdCols = 0
        for (let i = 0; i < holdBeats.length; i++) {
          if (holdBeats[i]) {
            if (row > holdBeats[i]!) holdBeats[i] = undefined
            else if (holdBeats[i]! < note.beat) holdCols++
          }
        }
        if (cols > 1) stats.Jumps++
        if (cols + holdCols > 2) stats.Hands++
        cols = 0
        row = note.beat
      }
      if (note.type != "Mine" && !note.fake) cols++
      if (note.fake) {
        stats.Fakes++
        continue
      }
      switch (note.type) {
        case "Tap":
          stats.Taps++
          break
        case "Hold":
          stats.Holds++
          break
        case "Roll":
          stats.Rolls++
          break
        case "Lift":
          stats.Lifts++
          break
        case "Mine":
          stats.Mines++
          break
      }
      if (isHoldNote(note)) {
        holdBeats[note.col] = note.beat + note.hold
      }
    }
    let holdCols = 0
    for (let i = 0; i < holdBeats.length; i++) {
      if (holdBeats[i] && holdBeats[i]! < notedata[notedata.length - 1].beat)
        holdCols++
    }
    if (cols > 1) stats.Jumps++
    if (cols + holdCols > 2) stats.Hands++
    return stats
  }

  getNPSGraph(notedata: Notedata, timingData: TimingData): number[] {
    const lastNote = notedata.at(-1)
    if (!lastNote) return []
    let chartEnd = lastNote.beat
    if (isHoldNote(lastNote)) {
      chartEnd += lastNote.hold
    }
    const nps = []

    let noteIndex = 0
    while (notedata[noteIndex]) {
      const measure = Math.floor(
        timingData.getMeasure(notedata[noteIndex].beat)
      )
      const measureStartBeat = timingData.getBeatFromMeasure(measure)
      const measureEndBeat = timingData.getBeatFromMeasure(measure + 1)
      const deltaTime =
        timingData.getSecondsFromBeat(measureEndBeat) -
        timingData.getSecondsFromBeat(measureStartBeat)
      if (deltaTime <= 0.05) {
        while (notedata[noteIndex]?.beat < measureEndBeat) noteIndex++
        nps[measure] = 0
        continue
      }
      let noteCount = 0
      while (notedata[noteIndex]?.beat < measureEndBeat) {
        const type = notedata[noteIndex].type
        if (
          !notedata[noteIndex].fake &&
          !notedata[noteIndex].warped &&
          (type == "Hold" || type == "Roll" || type == "Tap" || type == "Lift")
        )
          noteCount++
        noteIndex++
      }
      nps[measure] = noteCount / deltaTime
    }
    return nps
  }
}
