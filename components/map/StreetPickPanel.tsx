"use client"

import { MAP_GLASS_PANEL } from "./mapGlass"

export default function StreetPickPanel({
  streets,
  onPickStreet,
  onDone
}: {
  streets: string[]
  onPickStreet: (name: string) => void
  onDone: () => void
}) {
  return (
    <div
      className={`pointer-events-auto absolute left-3 right-3 top-[5.5rem] z-[38] max-h-[40vh] overflow-hidden sm:left-auto sm:right-3 sm:max-w-xs ${MAP_GLASS_PANEL} rounded-2xl`}
    >
      <div className="flex items-center justify-between border-b border-black/10 px-3 py-2">
        <span className="text-xs font-semibold text-gray-900">选择街道设置规则</span>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg px-2 py-1 text-xs text-gray-700 hover:bg-black/5"
        >
          完成
        </button>
      </div>
      <ul className="max-h-[min(36vh,320px)] overflow-y-auto py-1">
        {streets.length === 0 ? (
          <li className="px-3 py-6 text-center text-xs text-gray-500">当前区域暂无门牌街道数据</li>
        ) : (
          streets.map((name) => (
            <li key={name}>
              <button
                type="button"
                className="w-full px-3 py-2.5 text-left text-sm text-gray-900 hover:bg-black/5"
                onClick={() => onPickStreet(name)}
              >
                {name}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
