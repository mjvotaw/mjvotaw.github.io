import { Chart } from "./Chart"
import { SimfileTimingData } from "./SimfileTimingData"
import { TimingData } from "./TimingData"
import {
  DeletableEvent,
  TimingEvent,
  TimingEventType,
  TimingType,
} from "./TimingTypes"

export class ChartTimingData extends TimingData {
  readonly simfileTimingData: SimfileTimingData
  private readonly chart: Chart

  constructor(simfileTimingData: SimfileTimingData, chart: Chart) {
    super()
    this.simfileTimingData = simfileTimingData
    this.chart = chart
  }

  getColumn<Type extends TimingEventType>(type: Type) {
    return this.columns[type] ?? this.simfileTimingData.getColumn(type)
  }

  private splitSM<Event extends DeletableEvent>(events: Event[]) {
    const smEvents: Event[] = []
    const chartEvents: Event[] = []
    for (const event of events) {
      if (event.isChartTiming) chartEvents.push(event)
      else smEvents.push(event)
    }
    return [smEvents, chartEvents]
  }

  private splitSMPairs<Event extends DeletableEvent>(pairs: [Event, Event][]) {
    const smPairs: [Event, Event][] = []
    const chartPairs: [Event, Event][] = []
    for (const pair of pairs) {
      if (pair[0].isChartTiming) chartPairs.push(pair)
      else smPairs.push(pair)
    }
    return [smPairs, chartPairs]
  }

  insert(events: TimingEvent[]): void {
    let smResults: ReturnType<TimingData["_insert"]>
    let chartResults: ReturnType<TimingData["_insert"]>
    const hasTimeSig = events.find(event => event.type == "TIMESIGNATURES")
    const [sm, chart] = this.splitSM(events)
    smResults = this.simfileTimingData._insert(sm)
    
    this.simfileTimingData._delete(smResults.errors)
    chartResults = this._insert(chart)
    this._delete(chartResults.errors)
    this.simfileTimingData.reloadCache()
  }

  modify(events: [TimingEvent, TimingEvent][]): void {
    let smResults: ReturnType<TimingData["_modify"]>
    let chartResults: ReturnType<TimingData["_modify"]>
    const hasTimeSig = events.find(pair => pair[0].type == "TIMESIGNATURES")
    const [sm, chart] = this.splitSMPairs(events)
    
    smResults = this.simfileTimingData._modify(sm)
    this.simfileTimingData._delete(smResults.errors)
    chartResults = this._modify(chart)
    this._delete(chartResults.errors)
    this.simfileTimingData.reloadCache()
      
  }

  delete(events: DeletableEvent[]): void {
    let smResults: ReturnType<TimingData["_delete"]>
    let chartResults: ReturnType<TimingData["_delete"]>
    const hasTimeSig = events.find(event => event.type == "TIMESIGNATURES")
    const [sm, chart] = this.splitSM(events)
    
    smResults = this.simfileTimingData._delete(sm)
    this.simfileTimingData._delete(smResults.errors)
    chartResults = this._delete(chart)
    this._delete(chartResults.errors)
    this.simfileTimingData.reloadCache()
  }

  getOffset(): number {
    return this.offset ?? this.simfileTimingData.getOffset()
  }

  usesChartTiming(): boolean {
    return this.offset !== undefined || Object.values(this.columns).length > 0
  }

  hasChartOffset() {
    return this.offset !== undefined
  }

  isPropertyChartSpecific(type: TimingEventType): boolean {
    return type in this.columns
  }

  reloadCache(types: TimingType[] = []) {
    super.reloadCache(types)
    this.chart.recalculateNotes()
  }
}
