import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource-variable/archivo'
import '@fontsource/ibm-plex-sans-jp/400.css'
import '@fontsource/ibm-plex-sans-jp/500.css'

import '../styles/globals.css'
import '../finder/finder.css'
import { PaletteWindow } from './PaletteWindow'

const container = document.getElementById('root')
if (!container) throw new Error('root 要素が見つかりません。')

createRoot(container).render(
  <StrictMode>
    <PaletteWindow />
  </StrictMode>
)
