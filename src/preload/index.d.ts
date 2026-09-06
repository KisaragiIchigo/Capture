import type { CaptureBridge } from '@shared/types'

declare global {
  interface Window {
    capture: CaptureBridge
  }
}

export {}
