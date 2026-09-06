import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LazyMotion, domAnimation } from 'framer-motion'

// フォントはバンドルへ同梱する。CSP により外部 CDN からは読み込めない。
import '@fontsource-variable/archivo'
import '@fontsource/chivo-mono/400.css'
import '@fontsource/chivo-mono/500.css'
import '@fontsource/ibm-plex-sans-jp/400.css'
import '@fontsource/ibm-plex-sans-jp/500.css'
import '@fontsource/ibm-plex-sans-jp/600.css'

import './styles/globals.css'
import { App } from './App'

const container = document.getElementById('root')
if (!container) throw new Error('root 要素が見つかりません。')

createRoot(container).render(
  <StrictMode>
    {/* アニメーション機能を遅延読み込みし、初期バンドルを軽くする。各所では m を使う。 */}
    <LazyMotion features={domAnimation} strict>
      <App />
    </LazyMotion>
  </StrictMode>
)
