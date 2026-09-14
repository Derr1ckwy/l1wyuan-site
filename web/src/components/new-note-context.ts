import { createContext, useContext } from 'react'

export type NewNotePreset = { categoryId?: string; sectionId?: string }

type NewNoteOpener = (preset?: NewNotePreset) => void

export const NewNoteContext = createContext<NewNoteOpener>(() => {})

export function useNewNote(): NewNoteOpener {
  return useContext(NewNoteContext)
}
