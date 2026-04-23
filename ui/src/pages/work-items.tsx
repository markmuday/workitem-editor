import { useState, useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { InlineCombobox, type ComboboxOption } from "@/components/ui/inline-combobox"
import { cn } from "@/lib/utils"
import {
  workItemsApi,
  epicsApi,
  teamMembersApi,
  type WorkItem,
  type WorkItemBody,
  type Epic,
  type TeamMember,
} from "@/lib/api"

// --- Date utilities ---

function prevBusinessDay(): Date {
  const d = new Date()
  do {
    d.setDate(d.getDate() - 1)
  } while (d.getDay() === 0 || d.getDay() === 6)
  return d
}

function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

const todayStr = () => localDateStr(new Date())
const yesterdayStr = () => localDateStr(prevBusinessDay())

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const [year, month, day] = iso.split("T")[0].split("-").map(Number)
  const d = new Date(year, month - 1, day)
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  if (year !== new Date().getFullYear()) opts.year = "numeric"
  return d.toLocaleDateString("en-US", opts)
}

function isoToDateStr(iso: string | null): string {
  if (!iso) return yesterdayStr()
  return iso.split("T")[0]
}

// --- Date picker ---

type DateMode = "yesterday" | "today" | "custom"

function detectMode(dateStr: string): DateMode {
  if (dateStr === todayStr()) return "today"
  if (dateStr === yesterdayStr()) return "yesterday"
  return "custom"
}

function DatePicker({
  value,
  onChange,
  onEscape,
}: {
  value: string
  onChange: (v: string) => void
  onEscape?: () => void
}) {
  const [mode, setMode] = useState<DateMode>(() => detectMode(value))
  const [customVal, setCustomVal] = useState(value)

  function handleModeChange(m: DateMode) {
    setMode(m)
    if (m === "yesterday") onChange(yesterdayStr())
    else if (m === "today") onChange(todayStr())
    else onChange(customVal)
  }

  function handleCustomChange(v: string) {
    setCustomVal(v)
    onChange(v)
  }

  return (
    <div className="flex flex-col gap-0.5">
      <select
        value={mode}
        onChange={(e) => handleModeChange(e.target.value as DateMode)}
        className="h-7 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring dark:bg-input/30"
      >
        <option value="yesterday">Yesterday</option>
        <option value="today">Today</option>
        <option value="custom">Custom…</option>
      </select>
      {mode === "custom" && (
        <input
          type="date"
          value={customVal}
          onChange={(e) => handleCustomChange(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onEscape?.()}
          className="h-7 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring dark:bg-input/30"
        />
      )}
    </div>
  )
}

// --- Draft ---

interface WorkItemDraft {
  dateStr: string
  teamMemberId: string
  epicId: string
  description: string
  percentOfDay: number
}

function initDraft(item?: WorkItem): WorkItemDraft {
  return {
    dateStr: isoToDateStr(item?.created_at ?? null),
    teamMemberId: item?.team_member_id ?? "",
    epicId: item?.epic_id ?? "",
    description: item?.description ?? "",
    percentOfDay: item?.percent_of_day ?? 100,
  }
}

function draftToBody(draft: WorkItemDraft): WorkItemBody {
  return {
    description: draft.description || null,
    team_member_id: draft.teamMemberId || null,
    epic_id: draft.epicId || null,
    percent_of_day: draft.percentOfDay,
    created_at: `${draft.dateStr}T00:00:00.000Z`,
  }
}

const PERCENT_OPTIONS = [10, 25, 50, 75, 100]

// date | member | epic | description | percent | action
const ROW_COLS = "grid-cols-[150px_140px_140px_1fr_72px_28px]"

// --- Shared edit fields (fragment — drops directly into the parent grid) ---

function EditFields({
  draft,
  onChange,
  epics,
  members,
  onDescriptionKeyDown,
  onEscape,
  autoFocusMember,
  onCreateMember,
  onCreateEpic,
}: {
  draft: WorkItemDraft
  onChange: (patch: Partial<WorkItemDraft>) => void
  epics: Epic[]
  members: TeamMember[]
  onDescriptionKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onEscape?: () => void
  autoFocusMember?: boolean
  onCreateMember?: (name: string) => Promise<ComboboxOption>
  onCreateEpic?: (name: string) => Promise<ComboboxOption>
}) {
  const memberOptions: ComboboxOption[] = members.map((m) => ({
    id: m.id,
    name: m.name ?? "",
  }))
  const epicOptions: ComboboxOption[] = epics.map((e) => ({
    id: e.id,
    name: e.name ?? "",
  }))

  return (
    <>
      <DatePicker
        value={draft.dateStr}
        onChange={(v) => onChange({ dateStr: v })}
        onEscape={onEscape}
      />
      <InlineCombobox
        value={draft.teamMemberId}
        options={memberOptions}
        onChange={(id) => onChange({ teamMemberId: id })}
        onCreate={onCreateMember}
        placeholder="— member —"
        autoFocus={autoFocusMember}
      />
      <InlineCombobox
        value={draft.epicId}
        options={epicOptions}
        onChange={(id) => onChange({ epicId: id })}
        onCreate={onCreateEpic}
        placeholder="— epic —"
      />
      <Input
        value={draft.description}
        onChange={(e) => onChange({ description: e.target.value })}
        onKeyDown={onDescriptionKeyDown}
        placeholder="Description…"
        className="h-7 text-sm"
      />
      <Select
        value={String(draft.percentOfDay)}
        onChange={(e) => onChange({ percentOfDay: Number(e.target.value) })}
        className="h-7 text-sm"
      >
        {PERCENT_OPTIONS.map((p) => (
          <option key={p} value={p}>
            {p}%
          </option>
        ))}
      </Select>
    </>
  )
}

// --- WorkItemRow ---

function WorkItemRow({
  item,
  epics,
  members,
}: {
  item: WorkItem
  epics: Epic[]
  members: TeamMember[]
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<WorkItemDraft>(() => initDraft(item))
  const rowRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const update = useMutation({
    mutationFn: (d: WorkItemDraft) => workItemsApi.update(item.id, draftToBody(d)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["work-items"] }),
  })

  const remove = useMutation({
    mutationFn: () => workItemsApi.delete(item.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["work-items"] }),
  })

  async function onCreateMember(name: string): Promise<ComboboxOption> {
    const m = await teamMembersApi.create(name)
    queryClient.invalidateQueries({ queryKey: ["team-members"] })
    return { id: m.id, name: m.name ?? name }
  }

  async function onCreateEpic(name: string): Promise<ComboboxOption> {
    const e = await epicsApi.create(name)
    queryClient.invalidateQueries({ queryKey: ["epics"] })
    return { id: e.id, name: e.name ?? name }
  }

  function commit() {
    update.mutate(draft)
    setEditing(false)
  }

  function cancel() {
    setDraft(initDraft(item))
    setEditing(false)
  }

  function handleRowBlur(e: React.FocusEvent) {
    if (!rowRef.current?.contains(e.relatedTarget as Node)) {
      if (editing) commit()
    }
  }

  function handleRowKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") cancel()
  }

  const memberName = members.find((m) => m.id === item.team_member_id)?.name
  const epicName = epics.find((e) => e.id === item.epic_id)?.name

  return (
    <div
      ref={rowRef}
      onBlur={handleRowBlur}
      onKeyDown={handleRowKeyDown}
      className={cn(
        `group grid ${ROW_COLS} items-center gap-x-2 rounded-md px-2 py-1.5`,
        editing ? "bg-muted/30" : "cursor-pointer hover:bg-muted/50",
      )}
      onClick={() => !editing && setEditing(true)}
    >
      {editing ? (
        <>
          <EditFields
            draft={draft}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            epics={epics}
            members={members}
            onEscape={cancel}
            onCreateMember={onCreateMember}
            onCreateEpic={onCreateEpic}
            onDescriptionKeyDown={(e) => {
              if (e.key === "Enter") commit()
              if (e.key === "Escape") cancel()
            }}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation()
              cancel()
            }}
            type="button"
          >
            ✕
          </Button>
        </>
      ) : (
        <>
          <span className="truncate text-xs text-muted-foreground">
            {formatDate(item.created_at)}
          </span>
          <span className="truncate text-sm">
            {memberName ?? (
              <span className="italic text-muted-foreground">—</span>
            )}
          </span>
          <span className="truncate text-sm">
            {epicName ?? <span className="italic text-muted-foreground">—</span>}
          </span>
          <span className="truncate text-sm">
            {item.description ?? (
              <span className="italic text-muted-foreground">—</span>
            )}
          </span>
          <span className="text-right text-sm text-muted-foreground">
            {item.percent_of_day != null ? `${item.percent_of_day}%` : "—"}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              remove.mutate()
            }}
            disabled={remove.isPending}
          >
            <Trash2 />
          </Button>
        </>
      )}
    </div>
  )
}

// --- NewWorkItemRow ---

function NewWorkItemRow({
  epics,
  members,
  onDone,
}: {
  epics: Epic[]
  members: TeamMember[]
  onDone: () => void
}) {
  const [draft, setDraft] = useState<WorkItemDraft>(() => initDraft())
  const rowRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: (d: WorkItemDraft) => workItemsApi.create(draftToBody(d)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-items"] })
      onDone()
    },
  })

  async function onCreateMember(name: string): Promise<ComboboxOption> {
    const m = await teamMembersApi.create(name)
    queryClient.invalidateQueries({ queryKey: ["team-members"] })
    return { id: m.id, name: m.name ?? name }
  }

  async function onCreateEpic(name: string): Promise<ComboboxOption> {
    const e = await epicsApi.create(name)
    queryClient.invalidateQueries({ queryKey: ["epics"] })
    return { id: e.id, name: e.name ?? name }
  }

  function commit() {
    create.mutate(draft)
  }

  function handleRowBlur(e: React.FocusEvent) {
    if (!rowRef.current?.contains(e.relatedTarget as Node)) {
      commit()
    }
  }

  return (
    <div
      ref={rowRef}
      onBlur={handleRowBlur}
      onKeyDown={(e) => e.key === "Escape" && onDone()}
      className={`grid ${ROW_COLS} items-center gap-x-2 rounded-md bg-muted/30 px-2 py-1.5`}
    >
      <EditFields
        draft={draft}
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        epics={epics}
        members={members}
        onEscape={onDone}
        autoFocusMember
        onCreateMember={onCreateMember}
        onCreateEpic={onCreateEpic}
        onDescriptionKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") onDone()
        }}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-foreground"
        onClick={onDone}
        type="button"
      >
        ✕
      </Button>
    </div>
  )
}

// --- Page ---

export function WorkItemsPage() {
  const [adding, setAdding] = useState(false)
  const queryClient = useQueryClient()

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["work-items"],
    queryFn: workItemsApi.list,
  })

  const { data: epics = [] } = useQuery({
    queryKey: ["epics"],
    queryFn: epicsApi.list,
  })

  const { data: members = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: teamMembersApi.list,
  })

  // Prefetch epics/members so selects are ready
  void queryClient

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Work Items</h1>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAdding(true)}
          disabled={adding}
        >
          <Plus />
          Add Work Item
        </Button>
      </div>

      <div className="flex flex-col">
        {adding && (
          <NewWorkItemRow
            epics={epics}
            members={members}
            onDone={() => setAdding(false)}
          />
        )}
        {isLoading && (
          <p className="px-2 py-1 text-sm text-muted-foreground">Loading…</p>
        )}
        {isError && (
          <p className="px-2 py-1 text-sm text-destructive">
            Failed to load work items.
          </p>
        )}
        {items?.map((item) => (
          <WorkItemRow
            key={item.id}
            item={item}
            epics={epics}
            members={members}
          />
        ))}
      </div>
    </div>
  )
}
