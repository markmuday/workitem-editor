import { http, HttpResponse } from "msw"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EpicsPage } from "./epics"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { epicFixtures } from "@/test/handlers"

describe("EpicsPage", () => {
  describe("listing", () => {
    it("renders all epics", async () => {
      renderWithProviders(<EpicsPage />)
      await screen.findByText("Frontend")
      expect(screen.getByText("Backend")).toBeInTheDocument()
    })

    it("shows an error message when the request fails", async () => {
      server.use(http.get("/api/epics", () => HttpResponse.error()))
      renderWithProviders(<EpicsPage />)
      await screen.findByText("Failed to load epics.")
    })
  })

  describe("inline editing", () => {
    it("clicking a name shows an input pre-filled with the current value", async () => {
      renderWithProviders(<EpicsPage />)
      await userEvent.click(await screen.findByText("Frontend"))
      expect(screen.getByRole("textbox")).toHaveValue("Frontend")
    })

    it("pressing Enter commits the edit", async () => {
      const user = userEvent.setup()
      renderWithProviders(<EpicsPage />)

      await user.click(await screen.findByText("Frontend"))
      const input = screen.getByRole("textbox")
      await user.clear(input)
      await user.type(input, "Platform")
      await user.keyboard("{Enter}")

      await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument())
    })

    it("pressing Escape cancels the edit and restores the original name", async () => {
      const user = userEvent.setup()
      renderWithProviders(<EpicsPage />)

      await user.click(await screen.findByText("Frontend"))
      await user.clear(screen.getByRole("textbox"))
      await user.keyboard("{Escape}")

      expect(await screen.findByText("Frontend")).toBeInTheDocument()
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    })

    it("blurring the input commits the edit", async () => {
      const user = userEvent.setup()
      renderWithProviders(<EpicsPage />)

      await user.click(await screen.findByText("Frontend"))
      const input = screen.getByRole("textbox")
      await user.clear(input)
      await user.type(input, "Platform")
      await user.tab()

      await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument())
    })
  })

  describe("adding", () => {
    it("clicking Add Epic shows a focused empty input", async () => {
      const user = userEvent.setup()
      renderWithProviders(<EpicsPage />)
      await screen.findByText("Frontend")

      await user.click(screen.getByRole("button", { name: /add epic/i }))

      const input = screen.getByPlaceholderText("Epic name…")
      expect(input).toHaveFocus()
      expect(input).toHaveValue("")
    })

    it("typing a name and pressing Enter creates the epic and clears the row", async () => {
      const user = userEvent.setup()
      renderWithProviders(<EpicsPage />)
      await screen.findByText("Frontend")

      await user.click(screen.getByRole("button", { name: /add epic/i }))
      await user.type(screen.getByPlaceholderText("Epic name…"), "New Epic")
      await user.keyboard("{Enter}")

      await waitFor(() =>
        expect(screen.queryByPlaceholderText("Epic name…")).not.toBeInTheDocument()
      )
    })

    it("pressing Escape dismisses the new row without creating", async () => {
      const user = userEvent.setup()
      renderWithProviders(<EpicsPage />)
      await screen.findByText("Frontend")

      await user.click(screen.getByRole("button", { name: /add epic/i }))
      await user.keyboard("{Escape}")

      expect(screen.queryByPlaceholderText("Epic name…")).not.toBeInTheDocument()
    })

    it("blurring an empty new row dismisses it without creating", async () => {
      const user = userEvent.setup()
      renderWithProviders(<EpicsPage />)
      await screen.findByText("Frontend")

      await user.click(screen.getByRole("button", { name: /add epic/i }))
      await user.tab()

      await waitFor(() =>
        expect(screen.queryByPlaceholderText("Epic name…")).not.toBeInTheDocument()
      )
    })
  })

  describe("deleting", () => {
    it("clicking the delete button removes the epic from the list", async () => {
      const user = userEvent.setup()
      server.use(
        http.get("/api/epics", () => HttpResponse.json([epicFixtures[0]])),
      )
      renderWithProviders(<EpicsPage />)
      await screen.findByText("Frontend")

      server.use(
        http.get("/api/epics", () => HttpResponse.json([])),
      )
      await user.click(screen.getByRole("button", { name: "" }))

      await waitFor(() => expect(screen.queryByText("Frontend")).not.toBeInTheDocument())
    })
  })
})
