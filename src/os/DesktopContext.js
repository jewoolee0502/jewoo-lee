// Provides the `.l-desk` element to desktop overlays (the BugHunt layer in phase 5).
import { createContext, useContext } from 'react'

export const DesktopContext = createContext(null)

/** The `.l-desk` element, or null before it mounts. */
export const useDesktopEl = () => useContext(DesktopContext)
