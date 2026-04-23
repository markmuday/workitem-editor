import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createBrowserRouter, RouterProvider } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import "./index.css"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { RootLayout } from "@/layouts/root-layout.tsx"
import { HomePage } from "@/pages/home.tsx"
import { EpicsPage } from "@/pages/epics.tsx"
import { TeamMembersPage } from "@/pages/team-members.tsx"
import { WorkItemsPage } from "@/pages/work-items.tsx"

const queryClient = new QueryClient()

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "epics", element: <EpicsPage /> },
      { path: "team-members", element: <TeamMembersPage /> },
      { path: "work-items", element: <WorkItemsPage /> },
    ],
  },
])

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
)
