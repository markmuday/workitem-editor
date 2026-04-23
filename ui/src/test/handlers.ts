import { http, HttpResponse } from "msw"
import type { Epic, TeamMember } from "@/lib/api"

export const epicFixtures: Epic[] = [
  { id: "epic-1", name: "Frontend", created_at: "2024-01-01T00:00:00Z", modified_at: "2024-01-01T00:00:00Z" },
  { id: "epic-2", name: "Backend", created_at: "2024-01-02T00:00:00Z", modified_at: "2024-01-02T00:00:00Z" },
]

export const teamMemberFixtures: TeamMember[] = [
  { id: "member-1", name: "Alice", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z", last_epic_id: null },
  { id: "member-2", name: "Bob", created_at: "2024-01-02T00:00:00Z", updated_at: "2024-01-02T00:00:00Z", last_epic_id: "epic-1" },
]

export const handlers = [
  http.get("/api/epics", () => HttpResponse.json(epicFixtures)),

  http.post("/api/epics", async ({ request }) => {
    const body = await request.json() as { name: string }
    const epic: Epic = {
      id: "epic-new",
      name: body.name,
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
    }
    return HttpResponse.json(epic, { status: 201 })
  }),

  http.put("/api/epics/:id", async ({ params, request }) => {
    const body = await request.json() as { name: string }
    const epic = epicFixtures.find((e) => e.id === params.id)
    return HttpResponse.json({ ...epic, name: body.name })
  }),

  http.delete("/api/epics/:id", () => new HttpResponse(null, { status: 204 })),

  http.get("/api/team-members", () => HttpResponse.json(teamMemberFixtures)),

  http.post("/api/team-members", async ({ request }) => {
    const body = await request.json() as { name: string }
    const member: TeamMember = {
      id: "member-new",
      name: body.name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_epic_id: null,
    }
    return HttpResponse.json(member, { status: 201 })
  }),

  http.put("/api/team-members/:id", async ({ params, request }) => {
    const body = await request.json() as { name: string; last_epic_id: string | null }
    const member = teamMemberFixtures.find((m) => m.id === params.id)
    return HttpResponse.json({ ...member, name: body.name })
  }),

  http.delete("/api/team-members/:id", () => new HttpResponse(null, { status: 204 })),
]
