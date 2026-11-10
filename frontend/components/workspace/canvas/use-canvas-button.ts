"use client"

import { useEffect, type RefObject } from "react"
import { useEditor } from "tldraw"

/** Stop the press before tldraw's canvas handlers. The click stays separate. */
export function useCanvasButton(ref: RefObject<HTMLButtonElement | null>) {
  const editor = useEditor()
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const stop = (event: Event) => {
      event.stopPropagation()
      editor.markEventAsHandled(event)
    }
    node.addEventListener("pointerdown", stop, { capture: true })
    node.addEventListener("touchstart", stop, { capture: true, passive: false })
    return () => {
      node.removeEventListener("pointerdown", stop, { capture: true })
      node.removeEventListener("touchstart", stop, { capture: true })
    }
  }, [editor, ref])
}
