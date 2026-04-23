import { http, HttpResponse } from "msw"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TeamMembersPage } from "./team-members"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { teamMemberFixtures } from "@/test/handlers"

describe("TeamMembersPage", () => {
  describe("listing", () => {
    it("renders all team members", async () => {
      renderWithProviders(<TeamMembersPage />)
      await screen.findByText("Alice")
      expect(screen.getByText("Bob")).toBeInTheDocument()
    })

    it("shows an error message when the request fails", async () => {
      server.use(http.get("/api/team-members", () => HttpResponse.error()))
      renderWithProviders(<TeamMembersPage />)
      await screen.findByText("Failed to load team members.")
    })
  })

  describe("inline editing", () => {
    it("clicking a name shows an input pre-filled with the current value", async () => {
      renderWithProviders(<TeamMembersPage />)
      await userEvent.click(await screen.findByText("Alice"))
      expect(screen.getByRole("textbox")).toHaveValue("Alice")
    })

    it("pressing Enter commits the edit", async () => {
      const user = userEvent.setup()
      renderWithProviders(<TeamMembersPage />)

      await user.click(await screen.findByText("Alice"))
      const input = screen.getByRole("textbox")
      await user.clear(input)
      await user.type(input, "Alicia")
      await user.keyboard("{Enter}")

      await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument())
    })

    it("pressing Escape cancels the edit and restores the original name", async () => {
      const user = userEvent.setup()
      renderWithProviders(<TeamMembersPage />)

      await user.click(await screen.findByText("Alice"))
      await user.clear(screen.getByRole("textbox"))
      await user.keyboard("{Escape}")

      expect(await screen.findByText("Alice")).toBeInTheDocument()
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    })

    it("preserves last_epic_id when updating name", async () => {
      const user = userEvent.setup()
      let capturedBody: unknown
      server.use(
        http.put("/api/team-members/:id", async ({ request }) => {
          capturedBody = await request.json()
          const member = teamMemberFixtures.find((m) => m.id === "member-2")!
          return HttpResponse.json({ ...member, name: "Bobby" })
        }),
      )
      renderWithProviders(<TeamMembersPage />)

      await user.click(await screen.findByText("Bob"))
      const input = screen.getByRole("textbox")
      await user.clear(input)
      await user.type(input, "Bobby")
      await user.keyboard("{Enter}")

      await waitFor(() => {
        expect(capturedBody).toMatchObject({ name: "Bobby", last_epic_id: "epic-1" })
      })
    })
  })

  describe("adding", () => {
    it("clicking Add Member shows a focused empty input", async () => {
      const user = userEvent.setup()
      renderWithProviders(<TeamMembersPage />)
      await screen.findByText("Alice")

      await user.click(screen.getByRole("button", { name: /add member/i }))

      const input = screen.getByPlaceholderText("Name…")
      expect(input).toHaveFocus()
      expect(input).toHaveValue("")
    })

    it("typing a name and pressing Enter creates the member", async () => {
      const user = userEvent.setup()
      renderWithProviders(<TeamMembersPage />)
      await screen.findByText("Alice")

      await user.click(screen.getByRole("button", { name: /add member/i }))
      await user.type(screen.getByPlaceholderText("Name…"), "Carol")
      await user.keyboard("{Enter}")

      await waitFor(() =>
        expect(screen.queryByPlaceholderText("Name…")).not.toBeInTheDocument()
      )
    })

    it("pressing Escape dismisses the new row without creating", async () => {
      const user = userEvent.setup()
      renderWithProviders(<TeamMembersPage />)
      await screen.findByText("Alice")

      await user.click(screen.getByRole("button", { name: /add member/i }))
      await user.keyboard("{Escape}")

      expect(screen.queryByPlaceholderText("Name…")).not.toBeInTheDocument()
    })
  })

  describe("deleting", () => {
    it("clicking the delete button removes the member from the list", async () => {
      const user = userEvent.setup()
      server.use(
        http.get("/api/team-members", () => HttpResponse.json([teamMemberFixtures[0]])),
      )
      renderWithProviders(<TeamMembersPage />)
      await screen.findByText("Alice")

      server.use(
        http.get("/api/team-members", () => HttpResponse.json([])),
      )
      await user.click(screen.getByRole("button", { name: "" }))

      await waitFor(() => expect(screen.queryByText("Alice")).not.toBeInTheDocument())
    })
  })
})
