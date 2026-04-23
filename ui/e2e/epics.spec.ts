import { test, expect, type APIRequestContext } from "@playwright/test"

const PREFIX = "[e2e]"

async function deleteEpicByName(request: APIRequestContext, name: string) {
  const res = await request.get("http://localhost:8080/api/epics")
  const epics = await res.json() as { id: string; name: string }[]
  for (const epic of epics.filter((e) => e.name?.startsWith(PREFIX) || e.name === name)) {
    await request.delete(`http://localhost:8080/api/epics/${epic.id}`)
  }
}

test.afterEach(async ({ request }) => {
  await deleteEpicByName(request, "")
})

test.describe("Epics page", () => {
  test("loads existing epics from the server", async ({ page }) => {
    await page.goto("/epics")
    // The list should render (at least the heading) without an error state
    await expect(page.getByRole("heading", { name: "Epics" })).toBeVisible()
    await expect(page.getByText("Failed to load epics.")).not.toBeVisible()
  })

  test("creates a new epic via the Add Epic row", async ({ page }) => {
    await page.goto("/epics")
    await page.getByRole("button", { name: /add epic/i }).click()

    const input = page.getByPlaceholder("Epic name…")
    await expect(input).toBeFocused()
    await input.fill(`${PREFIX} create test`)
    await input.press("Enter")

    await expect(page.getByText(`${PREFIX} create test`)).toBeVisible()
  })

  test("inline-edits an epic name", async ({ page, request }) => {
    // Create via API so the test is self-contained
    const res = await request.post("http://localhost:8080/api/epics", {
      data: { name: `${PREFIX} edit me` },
    })
    expect(res.ok()).toBeTruthy()

    await page.goto("/epics")
    await page.getByText(`${PREFIX} edit me`).click()

    const input = page.getByRole("textbox")
    await input.fill(`${PREFIX} edited`)
    await input.press("Enter")

    await expect(page.getByText(`${PREFIX} edited`)).toBeVisible()
    await expect(page.getByText(`${PREFIX} edit me`)).not.toBeVisible()
  })

  test("pressing Escape cancels an inline edit", async ({ page, request }) => {
    await request.post("http://localhost:8080/api/epics", {
      data: { name: `${PREFIX} cancel me` },
    })

    await page.goto("/epics")
    await page.getByText(`${PREFIX} cancel me`).click()

    const input = page.getByRole("textbox")
    await input.fill("something else")
    await input.press("Escape")

    await expect(page.getByText(`${PREFIX} cancel me`)).toBeVisible()
    await expect(page.getByRole("textbox")).not.toBeVisible()
  })

  test("deletes an epic", async ({ page, request }) => {
    await request.post("http://localhost:8080/api/epics", {
      data: { name: `${PREFIX} delete me` },
    })

    await page.goto("/epics")
    const row = page.locator("div").filter({ hasText: `${PREFIX} delete me` }).last()
    await row.hover()
    await row.getByRole("button").click()

    await expect(page.getByText(`${PREFIX} delete me`)).not.toBeVisible()
  })
})
