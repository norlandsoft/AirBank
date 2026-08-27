import { create } from 'zustand'
import { bridge } from '../bridge'

export interface LocalTerm {
  id: string
  title: string
}

interface TerminalState {
  bottomOpen: boolean
  terms: LocalTerm[]
  activeTermId: string | null

  toggleBottom(): void
  openTerm(cols: number, rows: number): Promise<string>
  closeTerm(termId: string): void
  setActive(termId: string): void
}

let wired = false
let seq = 1

export const useTerminal = create<TerminalState>((set, get) => {
  if (!wired) {
    wired = true
    bridge.onTermEvent((event) => {
      if (event.type === 'term-exit') {
        set((state) => {
          const terms = state.terms.filter((term) => term.id !== event.termId)
          return {
            terms,
            activeTermId: state.activeTermId === event.termId ? (terms[terms.length - 1]?.id ?? null) : state.activeTermId,
          }
        })
      }
    })
  }
  return {
    bottomOpen: false,
    terms: [],
    activeTermId: null,

    toggleBottom() { set((state) => ({ bottomOpen: !state.bottomOpen })) },

    async openTerm(cols, rows) {
      const termId = await bridge.term.open(cols, rows)
      const term: LocalTerm = { id: termId, title: `终端 ${seq++}` }
      set((state) => ({ terms: [...state.terms, term], activeTermId: termId, bottomOpen: true }))
      return termId
    },

    closeTerm(termId) {
      void bridge.term.close(termId)
      set((state) => {
        const terms = state.terms.filter((term) => term.id !== termId)
        return {
          terms,
          activeTermId: state.activeTermId === termId ? (terms[terms.length - 1]?.id ?? null) : state.activeTermId,
        }
      })
    },

    setActive(termId) { set({ activeTermId: termId }) },
  }
})
