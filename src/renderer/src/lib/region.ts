import type { DisplaySource, RegionRect } from '@shared/types'

/** 範囲指定を初めて選んだときの初期値。基準モニタの中央に 1280×720 を置く。 */
export function defaultRegion(displays: DisplaySource[]): RegionRect {
  const monitor = displays.find((display) => display.isPrimary) ?? displays[0]
  const width = 1280
  const height = 720
  return {
    x: Math.max(0, Math.round(((monitor?.width ?? 1920) - width) / 2)),
    y: Math.max(0, Math.round(((monitor?.height ?? 1080) - height) / 2)),
    width,
    height
  }
}
