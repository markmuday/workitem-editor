import { NavLink, Outlet } from "react-router"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/epics", label: "Epics" },
  { to: "/team-members", label: "Team Members" },
  { to: "/work-items", label: "Work Items" },
]

export function RootLayout() {
  return (
    <div className="flex min-h-svh">
      <aside className="w-56 shrink-0 border-r bg-sidebar px-4 py-6">
        <NavLink
          to="/"
          className="mb-8 block text-sm font-semibold text-sidebar-foreground"
        >
          Work Item Editor
        </NavLink>
        <nav className="flex flex-col gap-1">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  )
}
