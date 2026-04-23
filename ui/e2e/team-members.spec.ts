import { test, expect, type APIRequestContext } from "@playwright/test"

const PREFIX = "[e2e]"

async function cleanupTestMembers(request: APIRequestContext) {
  const res = await request.get("http://localhost:8080/api/team-members")
  const members = await res.json() as { id: string; name: string }[]
  for (const m of members.filter((m) => m.name?.startsWith(PREFIX))) {
    await request.delete(`http://localhost:8080/api/team-members/${m.id}`)
  }
}

test.afterEach(async ({ request }) => {
  await cleanupTestMembers(request)
})

test.describe("Team Members page", () => {
  test("loads existing team members from the server", async ({ page }) => {
    await page.goto("/team-members")
    await expect(page.getByRole("heading", { name: "Team Members" })).toBeVisible()
    await expect(page.getByText("Failed to load team members.")).not.toBeVisible()
  })

  test("creates a new team member via the Add Member row", async ({ page }) => {
    await page.goto("/team-members")
    await page.getByRole("button", { name: /add member/i }).click()

    const input = page.getByPlaceholder("Name…")
    await expect(input).toBeFocused()
    await input.fill(`${PREFIX} create test`)
    await input.press("Enter")

    await expect(page.getByText(`${PREFIX} create test`)).toBeVisible()
  })

  test("inline-edits a team member name", async ({ page, request }) => {
    await request.post("http://localhost:8080/api/team-members", {
      data: { name: `${PREFIX} edit me` },
    })

    await page.goto("/team-members")
    await page.getByText(`${PREFIX} edit me`).click()

    const input = page.getByRole("textbox")
    await input.fill(`${PREFIX} edited`)
    await input.press("Enter")

    await expect(page.getByText(`${PREFIX} edited`)).toBeVisible()
    await expect(page.getByText(`${PREFIX} edit me`)).not.toBeVisible()
  })

  test("pressing Escape cancels an inline edit", async ({ page, request }) => {
    await request.post("http://localhost:8080/api/team-members", {
      data: { name: `${PREFIX} cancel me` },
    })

    await page.goto("/team-members")
    await page.getByText(`${PREFIX} cancel me`).click()

    const input = page.getByRole("textbox")
    await input.fill("something else")
    await input.press("Escape")

    await expect(page.getByText(`${PREFIX} cancel me`)).toBeVisible()
    await expect(page.getByRole("textbox")).not.toBeVisible()
  })

  test("deletes a team member", async ({ page, request }) => {
    await request.post("http://localhost:8080/api/team-members", {
      data: { name: `${PREFIX} delete me` },
    })

    await page.goto("/team-members")
    const row = page.locator("div").filter({ hasText: `${PREFIX} delete me` }).last()
    await row.hover()
    await row.getByRole("button").click()

    await expect(page.getByText(`${PREFIX} delete me`)).not.toBeVisible()
  })
})
