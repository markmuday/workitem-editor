import { useState, useRef, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { teamMembersApi, type TeamMember } from "@/lib/api"

function TeamMemberRow({ member }: { member: TeamMember }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(member.name ?? "")
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const update = useMutation({
    mutationFn: (name: string) =>
      teamMembersApi.update(member.id, name, member.last_epic_id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team-members"] }),
  })

  const remove = useMutation({
    mutationFn: () => teamMembersApi.delete(member.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team-members"] }),
  })

  function commit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== member.name) {
      update.mutate(trimmed)
    } else {
      setDraft(member.name ?? "")
    }
    setEditing(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commit()
    if (e.key === "Escape") {
      setDraft(member.name ?? "")
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
          {member.name ?? <span className="text-muted-foreground italic">Unnamed</span>}
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

function NewTeamMemberRow({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const create = useMutation({
    mutationFn: (n: string) => teamMembersApi.create(n),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] })
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
        placeholder="Name…"
        className="h-7 flex-1 text-sm"
        disabled={create.isPending}
      />
    </div>
  )
}

export function TeamMembersPage() {
  const [adding, setAdding] = useState(false)
  const { data: members, isLoading, isError } = useQuery({
    queryKey: ["team-members"],
    queryFn: teamMembersApi.list,
  })

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Team Members</h1>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAdding(true)}
          disabled={adding}
        >
          <Plus />
          Add Member
        </Button>
      </div>

      <div className="flex flex-col">
        {isLoading && (
          <p className="px-2 py-1 text-sm text-muted-foreground">Loading…</p>
        )}
        {isError && (
          <p className="px-2 py-1 text-sm text-destructive">Failed to load team members.</p>
        )}
        {members?.map((member) => <TeamMemberRow key={member.id} member={member} />)}
        {adding && <NewTeamMemberRow onDone={() => setAdding(false)} />}
      </div>
    </div>
  )
}
