import { create } from 'zustand'
import { bridge } from '../../bridge'
import type { CiPipelineInfo, CiRunView, GhRun } from '../../../../shared/types'

interface CicdState {
  pipelines: CiPipelineInfo[]
  runs: CiRunView[]
  /** runId → stepIndex → 日志文本（追加式）。 */
  logs: Record<string, Record<number, string>>
  activeRunId: string | null
  ghRepo: string | null
  ghRuns: GhRun[]
  ghError: string | null
  error: string | null

  refresh(): Promise<void>
  refreshGithub(): Promise<void>
  run(pipelineId: string): Promise<void>
  cancel(pipelineId: string): Promise<void>
  selectRun(runId: string): void
}

export const useCicd = create<CicdState>((set, get) => {
  let wired = false

  const wire = (): void => {
    if (wired) return
    wired = true
    bridge.onCiEvent((event) => {
      if (event.type === 'run') {
        set((state) => {
          const index = state.runs.findIndex((run) => run.runId === event.run.runId)
          const runs = index === -1
            ? [event.run, ...state.runs]
            : state.runs.map((run) => (run.runId === event.run.runId ? event.run : run))
          return { runs }
        })
      } else {
        set((state) => {
          const runLogs = state.logs[event.runId] ?? {}
          const prev = runLogs[event.stepIndex] ?? ''
          return {
            logs: {
              ...state.logs,
              [event.runId]: { ...runLogs, [event.stepIndex]: prev + event.text },
            },
          }
        })
      }
    })
  }

  return {
    pipelines: [],
    runs: [],
    logs: {},
    activeRunId: null,
    ghRepo: null,
    ghRuns: [],
    ghError: null,
    error: null,

    async refresh() {
      wire()
      try {
        const [pipelines, runs] = await Promise.all([bridge.cicd.pipelines(), bridge.cicd.runs()])
        set({ pipelines, runs, error: null })
      } catch (error) { set({ error: String(error) }) }
    },

    async refreshGithub() {
      try {
        const ghRepo = await bridge.cicd.githubRepo()
        if (!ghRepo) {
          set({ ghRepo: null, ghRuns: [], ghError: null })
          return
        }
        const ghRuns = await bridge.cicd.githubRuns()
        set({ ghRepo, ghRuns, ghError: null })
      } catch (error) { set({ ghError: String(error) }) }
    },

    async run(pipelineId) {
      try {
        const run = await bridge.cicd.run(pipelineId)
        set((state) => ({
          runs: [run, ...state.runs.filter((item) => item.runId !== run.runId)],
          activeRunId: run.runId,
          error: null,
        }))
      } catch (error) { set({ error: String(error) }) }
    },

    async cancel(pipelineId) {
      try {
        await bridge.cicd.cancel(pipelineId)
      } catch (error) { set({ error: String(error) }) }
    },

    selectRun(runId) { set({ activeRunId: runId }) },
  }
})
