export interface Epic {
  id: string
  name: string | null
  created_at: string | null
  modified_at: string | null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  if (res.status === 204) return undefined as T
  return res.json()
}

export interface TeamMember {
  id: string
  name: string | null
  created_at: string | null
  updated_at: string | null
  last_epic_id: string | null
}

export const teamMembersApi = {
  list: () => request<TeamMember[]>("/api/team-members"),
  create: (name: string) =>
    request<TeamMember>("/api/team-members", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  update: (id: string, name: string, last_epic_id: string | null) =>
    request<TeamMember>(`/api/team-members/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name, last_epic_id }),
    }),
  delete: (id: string) =>
    request<void>(`/api/team-members/${id}`, { method: "DELETE" }),
}

export interface WorkItem {
  id: string
  description: string | null
  team_member_id: string | null
  epic_id: string | null
  percent_of_day: number | null
  created_at: string | null
  updated_at: string | null
}

export interface WorkItemBody {
  description?: string | null
  team_member_id?: string | null
  epic_id?: string | null
  percent_of_day?: number | null
  created_at?: string | null
}

export const workItemsApi = {
  list: () => request<WorkItem[]>("/api/work-items"),
  create: (body: WorkItemBody) =>
    request<WorkItem>("/api/work-items", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: WorkItemBody) =>
    request<WorkItem>(`/api/work-items/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) =>
    request<void>(`/api/work-items/${id}`, { method: "DELETE" }),
}

export const epicsApi = {
  list: () => request<Epic[]>("/api/epics"),
  create: (name: string) =>
    request<Epic>("/api/epics", { method: "POST", body: JSON.stringify({ name }) }),
  update: (id: string, name: string) =>
    request<Epic>(`/api/epics/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
  delete: (id: string) =>
    request<void>(`/api/epics/${id}`, { method: "DELETE" }),
}
