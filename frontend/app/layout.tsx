import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/contexts/auth-context"
import { AppContent } from "@/components/app-content"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "ARC4NE C2",
  description: "ARC4NE Command and Control Interface",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <AppContent>{children}</AppContent>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
