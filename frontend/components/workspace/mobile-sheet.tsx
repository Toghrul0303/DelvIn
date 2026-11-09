"use client"

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import { motion, useDragControls, type DragControls, type PanInfo } from "framer-motion"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useLanguage } from "./language-context"

const SheetDragContext = createContext<DragControls | null>(null)

export function useSheetDragControls() {
  return useContext(SheetDragContext)
}

type MobileSheetProps = {
  open: boolean
  onClose: () => void
  side: "left" | "bottom"
  label: string
  id?: string
  children: ReactNode
  /** Desktop width of the bottom sheet's in-flow column. */
  columnWidth?: number
  columnCollapsed?: boolean
}

function useKeyboardInset(active: boolean) {
  const [box, setBox] = useState({ inset: 0, height: 0 })
  useEffect(() => {
    if (!active) return
    const viewport = window.visualViewport
    const update = () => {
      const height = viewport?.height ?? window.innerHeight
      const offsetTop = viewport?.offsetTop ?? 0
      const inset = Math.max(0, Math.round(window.innerHeight - height - offsetTop))
      setBox({ inset, height: Math.round(height) })
    }
    update()
    viewport?.addEventListener("resize", update)
    viewport?.addEventListener("scroll", update)
    window.addEventListener("resize", update)
    return () => {
      viewport?.removeEventListener("resize", update)
      viewport?.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [active])
  return box
}

export function MobileSheet({
  open,
  onClose,
  side,
  label,
  id,
  children,
  columnWidth,
  columnCollapsed = false,
}: MobileSheetProps) {
  const mobile = useMediaQuery("(max-width: 767px)")
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const { t } = useLanguage()
  const reactId = useId()
  const panelId = id ?? reactId
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreFocus = useRef<HTMLElement | null>(null)
  const controls = useDragControls()
  const keyboard = useKeyboardInset(side === "bottom" && mobile && open)
  const dialog = side === "left" ? open : mobile && open

  useEffect(() => {
    if (!dialog) return
    restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panel = panelRef.current
    const focusable = panel?.querySelector<HTMLElement>(
      "button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])",
    )
    focusable?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== "Tab" || !panel) return
      const nodes = [...panel.querySelectorAll<HTMLElement>(
        "button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])",
      )].filter((node) => !node.hasAttribute("disabled") && node.tabIndex !== -1)
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      restoreFocus.current?.focus()
    }
  }, [dialog, onClose])

  if (side === "left" && !mobile) return null
  if (side === "left" && !open) return null

  if (side === "bottom" && !mobile) {
    return (
      <div
        className={cn("relative h-full shrink-0", columnCollapsed && "w-0")}
        style={columnCollapsed || !columnWidth ? undefined : { width: columnWidth }}
      >
        {children}
      </div>
    )
  }

  const closeLabel = side === "left" ? t("nav.closeMenu") : t("chat.collapse")
  const sheetHeight =
    side === "bottom" && keyboard.height > 0
      ? Math.min(Math.round(window.innerHeight * 0.75), keyboard.height)
      : undefined

  const onDragEnd = (_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    if (info.offset.y > 80 || info.velocity.y > 500) onClose()
  }

  const panel = (
    <motion.div
      ref={panelRef}
      id={panelId}
      role={dialog ? "dialog" : undefined}
      aria-modal={dialog ? true : undefined}
      aria-hidden={side === "bottom" && !open ? true : undefined}
      aria-label={label}
      inert={side === "bottom" && !open ? true : undefined}
      drag={side === "bottom" && open ? "y" : false}
      dragControls={controls}
      dragListener={false}
      dragSnapToOrigin
      dragConstraints={{ top: 0 }}
      dragElastic={{ top: 0, bottom: 0.6 }}
      onDragEnd={onDragEnd}
      initial={reduceMotion || side === "bottom" ? false : { x: "-100%" }}
      animate={side === "bottom" ? { y: open ? 0 : "100%" } : { x: 0 }}
      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 38 }}
      style={
        side === "bottom"
          ? {
              bottom: keyboard.inset,
              height: sheetHeight,
            }
          : undefined
      }
      className={cn(
        "overscroll-contain bg-card text-foreground shadow-2xl",
        side === "left" &&
          "absolute bottom-0 left-0 top-[calc(4rem+env(safe-area-inset-top))] z-[410] flex w-[min(20rem,88vw)] flex-col border-r border-border",
        side === "bottom" &&
          "fixed inset-x-0 z-[430] flex h-[75dvh] flex-col overflow-hidden rounded-t-2xl border border-border",
        side === "bottom" && !open && "pointer-events-none",
      )}
    >
      {side === "bottom" ? (
        <div
          role="button"
          tabIndex={0}
          aria-label={t("chat.dragToClose")}
          onPointerDown={(event) => controls.start(event)}
          className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
        >
          <span className="h-1.5 w-10 rounded-full bg-muted-foreground/35" />
        </div>
      ) : null}
      <SheetDragContext.Provider value={side === "bottom" ? controls : null}>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </SheetDragContext.Provider>
    </motion.div>
  )

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label={closeLabel}
          onClick={onClose}
          className={cn(
            "bg-black/40",
            side === "left" ? "absolute inset-0 z-[400]" : "fixed inset-0 z-[420] md:hidden",
          )}
        />
      ) : null}
      {panel}
    </>
  )
}

export function startSheetDrag(controls: DragControls | null, event: ReactPointerEvent) {
  if (!controls) return
  const target = event.target
  if (!(target instanceof Element)) return
  if (target.closest("button, a, input, textarea, select, label")) return
  controls.start(event)
}
