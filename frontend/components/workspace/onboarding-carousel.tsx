"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { ArrowLeft, ArrowRight, X } from "lucide-react"
import { cn } from "@/lib/utils"

const VIDEO_SOURCES = [
  "/onboarding/01.mp4",
  "/onboarding/02.mp4",
  "/onboarding/03.mp4",
  "/onboarding/04.mp4",
  "/onboarding/05.mp4",
]

type OnboardingSlide = {
  badge: string
  title: string
  description: string
  label: string
  videoClassName?: string
}

const slides: OnboardingSlide[] = [
  {
    badge: "01 / 05  •  THE CORE",
    title: "Generate Your Canvas",
    description:
      "Upload a PDF or ask a question, and watch DelvIn instantly generate a rich, interactive visual solution board tailored for you.",
    label: "Your ideas, made tangible",
  },
  {
    badge: "02 / 05  •  DEEP DIVE",
    title: "The Explanation Wand",
    description:
      "Select any generated formula or complex text with the Wand tool to unlock step-by-step Socratic breakdowns and deep explanations.",
    label: "Every concept, within reach",
  },
  {
    badge: "03 / 05  •  KNOWLEDGE BASE",
    title: "Personal Memory Box",
    description:
      "Bookmark your key formulas, graphs, and complete step-by-step solutions with a single click for instant review anytime.",
    label: "Keep what matters close",
  },
  {
    badge: "04 / 05  •  PRODUCTIVITY",
    title: "Smart Task Tracker",
    description:
      "Working on multi-question assignments? Extract and track entire problem sets seamlessly in your personal sidebar task list.",
    label: "Progress you can see",
  },
  {
    badge: "05 / 05  •  WELCOME",
    title: "Ready to Elevate Your Workflow?",
    description:
      "You are all set! Jump into the workspace, drop a PDF or question, and explore the future of academic learning.",
    label: "Your next breakthrough starts here",
  },
]

export function OnboardingCarousel({ onDismiss }: { onDismiss: () => void }) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onDismiss])

  const slide = slides[active]
  const isLast = active === slides.length - 1

  return createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center overflow-y-auto bg-black/70 px-3 py-5 font-sans backdrop-blur-md sm:px-6 sm:py-8"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onDismiss()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-description"
        className="relative my-auto w-full max-w-[1050px] overflow-hidden rounded-[1.6rem] border border-border bg-card p-3 text-foreground shadow-2xl sm:rounded-[2rem] sm:p-5"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(60rem 40rem at 85% -10%, color-mix(in oklab, var(--brand-purple) 14%, transparent), transparent), radial-gradient(50rem 40rem at -10% 110%, color-mix(in oklab, var(--brand-red) 12%, transparent), transparent)",
          }}
        />
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close onboarding"
          className="absolute top-5 right-5 z-10 flex items-center gap-2 rounded-full border border-border bg-secondary/70 px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground sm:top-7 sm:right-7"
        >
          <span className="hidden sm:inline">Skip tour</span>
          <X className="size-4" aria-hidden="true" />
        </button>
        <div
          key={active}
          className="animate-in fade-in fill-mode-both relative grid items-center gap-6 px-1 pt-12 pb-2 duration-300 sm:gap-10 sm:px-3 sm:pt-5 sm:pb-3 md:grid-cols-[1.12fr_.88fr] md:gap-11 md:px-5 md:py-5"
        >
          <div className="relative min-w-0">
            <div className="relative aspect-[16/8.5] w-full overflow-hidden rounded-[1.15rem] border border-border bg-muted">
              <video
                className={cn(
                  "absolute bottom-0 left-0 h-[106.5%] w-full object-cover",
                  slide.videoClassName,
                )}
                src={VIDEO_SOURCES[active]}
                autoPlay
                loop
                muted
                playsInline
                aria-label={`${slide.title} walkthrough`}
              />
            </div>
            <p className="mt-3 flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
              DelvIn workspace preview
            </p>
          </div>
          <div className="flex min-w-0 flex-col justify-center py-1 sm:py-3 md:py-8">
            <p className="mb-5 text-[10px] font-semibold tracking-[.16em] text-primary uppercase">
              {slide.badge}
            </p>
            <h2
              id="onboarding-title"
              className="max-w-md font-display text-[clamp(1.8rem,4vw,2.65rem)] font-semibold leading-[1.08] tracking-[-.045em] text-foreground"
            >
              {slide.title}
            </h2>
            <p
              id="onboarding-description"
              className="mt-4 max-w-md text-sm leading-7 text-muted-foreground sm:text-[15px]"
            >
              {slide.description}
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs text-foreground">
              <span className="bg-brand-gradient h-px w-6" aria-hidden="true" />
              <span>{slide.label}</span>
            </div>
            <div className="mt-7 flex items-center justify-between border-t border-border pt-5 sm:mt-9 sm:pt-6">
              <div className="flex items-center gap-1.5" aria-label={`Slide ${active + 1} of 5`}>
                {slides.map((item, index) => (
                  <button
                    key={item.badge}
                    type="button"
                    aria-label={`Go to slide ${index + 1}`}
                    aria-current={index === active ? "step" : undefined}
                    onClick={() => setActive(index)}
                    className={cn(
                      "h-2 rounded-full transition-all duration-300",
                      index === active
                        ? "bg-brand-gradient ring-brand-glow w-7"
                        : "w-2 bg-foreground/20 hover:bg-foreground/40",
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {active > 0 ? (
                  <button
                    type="button"
                    onClick={() => setActive((step) => step - 1)}
                    className="flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Back
                  </button>
                ) : null}
                {isLast ? (
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="bg-brand-gradient ring-brand-glow flex h-10 items-center rounded-full px-5 text-sm font-semibold text-white transition-transform hover:-translate-y-px"
                  >
                    Get Started
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActive((step) => step + 1)}
                    className="bg-brand-gradient ring-brand-glow group flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white transition-transform hover:-translate-y-px"
                  >
                    <span>Next Step</span>
                    <ArrowRight
                      className="size-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  )
}
