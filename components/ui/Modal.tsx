"use client"

import { useEffect } from "react"

export default function Modal({
  open,
  title,
  children,
  onClose
}: {
  open: boolean
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white/90 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-black/10 bg-white px-3 py-1 text-sm"
          >
            关闭
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  )
}

