import { useState, useRef, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { epicsApi, type Epic } from "@/lib/api"

function EpicRow({ epic }: { epic: Epic }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(epic.name ?? "")
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const update = useMutation({
    mutationFn: (name: string) => epicsApi.update(epic.id, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["epics"] }),
  })

  const remove = useMutation({
    mutationFn: () => epicsApi.delete(epic.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["epics"] }),
  })

  function commit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== epic.name) {
      update.mutate(trimmed)
    } else {
      setDraft(epic.name ?? "")
    }
    setEditing(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commit()
    if (e.key === "Escape") {
      setDraft(epic.name ?? "")
      setEditing(false)
    }
  }

  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/50">
      {editing ? (
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          className="h-7 flex-1 text-sm"
          disabled={update.isPending}
        />
      ) : (
        <span
          className="flex-1 cursor-text truncate py-0.5 text-sm"
          onClick={() => setEditing(true)}
        >
          {epic.name ?? <span className="text-muted-foreground italic">Unnamed</span>}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
        onClick={() => remove.mutate()}
        disabled={remove.isPending}
      >
        <Trash2 />
      </Button>
    </div>
  )
}

function NewEpicRow({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const create = useMutation({
    mutationFn: (n: string) => epicsApi.create(n),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epics"] })
      onDone()
    },
  })

  function commit() {
    const trimmed = name.trim()
    if (trimmed) create.mutate(trimmed)
    else onDone()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commit()
    if (e.key === "Escape") onDone()
  }

  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1">
      <Input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        placeholder="Epic name…"
        className="h-7 flex-1 text-sm"
        disabled={create.isPending}
      />
    </div>
  )
}

export function EpicsPage() {
  const [adding, setAdding] = useState(false)
  const { data: epics, isLoading, isError } = useQuery({
    queryKey: ["epics"],
    queryFn: epicsApi.list,
  })

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Epics</h1>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAdding(true)}
          disabled={adding}
        >
          <Plus />
          Add Epic
        </Button>
      </div>

      <div className="flex flex-col">
        {isLoading && (
          <p className="px-2 py-1 text-sm text-muted-foreground">Loading…</p>
        )}
        {isError && (
          <p className="px-2 py-1 text-sm text-destructive">Failed to load epics.</p>
        )}
        {epics?.map((epic) => <EpicRow key={epic.id} epic={epic} />)}
        {adding && <NewEpicRow onDone={() => setAdding(false)} />}
      </div>
    </div>
  )
}
