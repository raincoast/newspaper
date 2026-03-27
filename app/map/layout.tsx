import type { ReactNode } from "react"

export default function MapLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex h-[100dvh] w-full flex-col overflow-hidden bg-black">
      {children}
    </div>
  )
}
