import { Notedata, PartialNotedata } from "../../sm/NoteTypes"
import { TimingData } from "../../sm/TimingData"
import { GameType } from "../GameTypeRegistry"

export abstract class NotedataParser {
  /**
   * Parses the string into Notedata.
   *
   * @abstract
   * @param {string} data
   * @param gameType
   * @return {*}  {PartialNotedata}
   * @memberof NotedataParser
   */
  abstract fromString(data: string, gameType: GameType): PartialNotedata

  /**
   * Converts Notedata into SM form.
   *
   * @abstract
   * @param {PartialNotedata} notedata
   * @param {GameType} gameType
   * @return {*}  {string}
   * @memberof NotedataParser
   */
  abstract serialize(notedata: PartialNotedata, gameType: GameType): string

  /**
   * Returns the stats associated with the notedata.
   *
   * @abstract
   * @param {Notedata} notedata
   * @return {*}  {Record<string, number>}
   * @memberof NotedataParser
   */
  abstract getStats(notedata: Notedata): Record<string, number>

  /**
   * Returns the note density per measure.
   *
   * @abstract
   * @param {Notedata} notedata
   * @param {TimingData} timingData
   * @return {*}  {number[]}
   * @memberof NotedataParser
   */
  abstract getNPSGraph(notedata: Notedata, timingData: TimingData): number[]
}
