"use client"

import type { ButtonHTMLAttributes } from "react"

type Props = ButtonHTMLAttributes<HTMLButtonElement>

export default function PrimaryButton({ className = "", ...props }: Props) {
  return (
    <button
      className={[
        "inline-flex items-center justify-center",
        "w-full sm:w-auto",
        "px-4 py-2",
        "bg-white text-black",
        "rounded-xl",
        "backdrop-blur",
        "border border-black/10",
        "active:opacity-80",
        "transition-opacity",
        className
      ].join(" ")}
      {...props}
    />
  )
}

