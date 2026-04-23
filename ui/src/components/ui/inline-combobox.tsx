import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

export interface ComboboxOption {
  id: string
  name: string
}

interface Props {
  value: string
  options: ComboboxOption[]
  onChange: (id: string) => void
  onCreate?: (name: string) => Promise<ComboboxOption>
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

export function InlineCombobox({
  value,
  options,
  onChange,
  onCreate,
  placeholder = "—",
  className,
  autoFocus,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIdx, setActiveIdx] = useState(-1)
  const [busy, setBusy] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.id === value)

  const filtered = query
    ? options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
    : options

  const exactMatch = options.some(
    (o) => o.name.toLowerCase() === query.trim().toLowerCase(),
  )
  const showAdd = !!onCreate && query.trim().length > 0 && !exactMatch
  const itemCount = filtered.length + (showAdd ? 1 : 0)

  function openDropdown() {
    setQuery(selected?.name ?? "")
    setActiveIdx(-1)
    setOpen(true)
    requestAnimationFrame(() => inputRef.current?.select())
  }

  function closeDropdown() {
    setOpen(false)
    setQuery("")
    setActiveIdx(-1)
  }

  function pick(option: ComboboxOption) {
    onChange(option.id)
    closeDropdown()
  }

  function clear() {
    onChange("")
    closeDropdown()
  }

  async function addNew() {
    if (!onCreate || !query.trim()) return
    setBusy(true)
    try {
      const created = await onCreate(query.trim())
      onChange(created.id)
      closeDropdown()
    } finally {
      setBusy(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "Escape":
        e.stopPropagation()
        closeDropdown()
        break
      case "ArrowDown":
        e.preventDefault()
        setActiveIdx((i) => Math.min(i + 1, itemCount - 1))
        break
      case "ArrowUp":
        e.preventDefault()
        setActiveIdx((i) => Math.max(i - 1, 0))
        break
      case "Enter":
        e.preventDefault()
        if (activeIdx >= 0 && activeIdx < filtered.length) {
          pick(filtered[activeIdx])
        } else if (activeIdx === filtered.length && showAdd) {
          addNew()
        } else if (filtered.length === 1) {
          pick(filtered[0])
        } else if (showAdd && filtered.length === 0) {
          addNew()
        }
        break
    }
  }

  useEffect(() => {
    if (!autoFocus) return
    setQuery(selected?.name ?? "")
    setOpen(true)
    requestAnimationFrame(() => inputRef.current?.select())
  }, [])

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) closeDropdown()
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [open])

  if (!open) {
    return (
      <span
        tabIndex={0}
        onFocus={openDropdown}
        onClick={openDropdown}
        className={cn(
          "block cursor-pointer truncate py-0.5 text-sm select-none outline-none",
          !selected && "italic text-muted-foreground",
          className,
        )}
      >
        {selected?.name ?? placeholder}
      </span>
    )
  }

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActiveIdx(-1)
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (!busy) closeDropdown() }}
        disabled={busy}
        placeholder="Search…"
        autoFocus
        className="h-7 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      />
      <div className="absolute left-0 top-full z-50 mt-1 min-w-full overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md">
        {value && (
          <div
            onMouseDown={(e) => {
              e.preventDefault()
              clear()
            }}
            className="cursor-pointer border-b border-border px-3 py-1.5 text-sm italic text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            — clear —
          </div>
        )}
        {filtered.map((opt, i) => (
          <div
            key={opt.id}
            onMouseDown={(e) => {
              e.preventDefault()
              pick(opt)
            }}
            className={cn(
              "cursor-pointer px-3 py-1.5 text-sm",
              i === activeIdx
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {opt.name}
          </div>
        ))}
        {showAdd && (
          <div
            onMouseDown={(e) => {
              e.preventDefault()
              addNew()
            }}
            className={cn(
              "cursor-pointer border-t border-border px-3 py-1.5 text-sm",
              activeIdx === filtered.length
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            Add &ldquo;{query.trim()}&rdquo;
          </div>
        )}
        {itemCount === 0 && !showAdd && (
          <div className="px-3 py-1.5 text-sm text-muted-foreground">
            No matches
          </div>
        )}
      </div>
    </div>
  )
}
