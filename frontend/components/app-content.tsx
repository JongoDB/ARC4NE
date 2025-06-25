"use client"

import type React from "react"
import { useAuth } from "@/contexts/auth-context"
import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { ProtectedRoute } from "@/components/protected-route"

export function AppContent({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const pathname = usePathname()
  const isLoginPage = pathname === "/login"

  if (isLoginPage) {
    return <>{children}</>
  }

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen w-full bg-muted/40">
        <Sidebar />
        <main className="flex flex-col flex-1 gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">{children}</main>
      </div>
    </ProtectedRoute>
  )
}
