import { cn } from "@/lib/utils"

export function TutorAvatar({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/avatar.png"
      alt="Delvin"
      className={cn("shrink-0 rounded-lg object-contain", className)}
    />
  )
}
