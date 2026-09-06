import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@shared': resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        input: { index: resolve('src/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        input: { index: resolve('src/preload/index.ts') }
      }
    }
  },
  renderer: {
    root: resolve('src/renderer'),
    // file:// 起動時に資産を相対解決させる。先頭スラッシュ絶対パスを禁じる前提。
    base: './',
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          // 範囲指定ファインダーは独立した透過ウィンドウなので、エントリを分ける。
          finder: resolve('src/renderer/finder.html'),
          // 画面へ描き込む窓も独立した透過ウィンドウなので、エントリを分ける。
          drawing: resolve('src/renderer/drawing.html'),
          // レーザーポインターは常にクリックスルーで、描き込みとは別の窓になる。
          pointer: resolve('src/renderer/pointer.html'),
          // 撮れたことを知らせる札も、どの窓の生死にも依存しない独立した窓にする。
          toast: resolve('src/renderer/toast.html')
        }
      }
    }
  }
})
