// Frame-state bridge across the Astro/React seam. A per-route ScrollTrigger (see
// init-scene-scroll.ts, created and torn down by onPage) writes `progress`; the
// scene reads it every frame inside useFrame. A plain mutable singleton, not a
// store: the reader runs at 60-120Hz and must not allocate, and no React render
// should ever be triggered by scrolling.
export type SceneScroll = { progress: number }

const state: SceneScroll = { progress: 0 }

export const getSceneScroll = (): Readonly<SceneScroll> => state

export const setSceneProgress = (value: number): void => {
  state.progress = value
}

export const resetSceneScroll = (): void => {
  state.progress = 0
}
