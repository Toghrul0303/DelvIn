"use client"

import type { RefObject } from "react"
import { useMode } from "./mode-context"
import { PomodoroTimer } from "./pomodoro-timer"

/** Pomodoro dock, centered on the Desk canvas. The music player is deferred. */
export function BottomDock({
  constraintsRef,
}: {
  constraintsRef?: RefObject<HTMLDivElement | null>
}) {
  const { showTimer } = useMode()
  if (!showTimer) return null
  return (
    <div className="absolute top-3 left-3 z-[320] flex items-center md:top-auto md:bottom-4 md:left-1/2 md:-translate-x-1/2">
      <PomodoroTimer dragConstraints={constraintsRef} />
    </div>
  )
}
