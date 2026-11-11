"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

export function ImagePreviewModal({
  src,
  closeLabel,
  onClose,
}: {
  src: string
  closeLabel: string
  onClose: () => void
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={closeLabel}
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className="absolute top-4 right-4 grid size-10 place-items-center rounded-full text-white/90 hover:bg-white/10"
      >
        <X className="size-5" aria-hidden="true" />
      </button>
      <img
        src={src}
        alt=""
        onClick={(event) => event.stopPropagation()}
        className="max-h-full max-w-full object-contain"
      />
    </div>,
    document.body,
  )
}
