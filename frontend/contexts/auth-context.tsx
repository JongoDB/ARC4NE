"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

interface User {
  id: string
  username: string
  email: string
  roles: string[]
  is_active: boolean
}

interface AuthContextType {
  user: User | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  isLoading: boolean
  hasRole: (role: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  // ──────────────────────────────────────────────────────────────
  // Helper: build API base URL dynamically each time it's needed
  // ──────────────────────────────────────────────────────────────
  function getApiBaseUrl(): string {
    // 1 – If the env-var is set, trust it.
    if (process.env.NEXT_PUBLIC_API_URL) {
      console.log("Using env API URL:", process.env.NEXT_PUBLIC_API_URL)
      return process.env.NEXT_PUBLIC_API_URL
    }

    // 2 – On the client we can derive the origin at runtime.
    if (typeof window !== "undefined") {
      const dynamicUrl = `${window.location.origin}/api/v1`
      console.log("Using dynamic API URL:", dynamicUrl)
      return dynamicUrl
    }

    // 3 – Fallback (SSR / static export preview): relative path.
    console.log("Using fallback API URL: /api/v1")
    return "/api/v1"
  }

  // Function to make authenticated API calls
  const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
    const headers = {
      "Content-Type": "application/json",
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      ...options.headers,
    }

    let response = await fetch(url, { ...options, headers, credentials: "include" })

    // If we get a 401, try to refresh the token
    if (response.status === 401 && accessToken) {
      const apiBaseUrl = getApiBaseUrl()
      const refreshResponse = await fetch(`${apiBaseUrl}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      })

      if (refreshResponse.ok) {
        const { access_token } = await refreshResponse.json()
        setAccessToken(access_token)

        // Retry the original request with the new token
        response = await fetch(url, {
          ...options,
          headers: {
            ...headers,
            Authorization: `Bearer ${access_token}`,
          },
          credentials: "include",
        })
      } else {
        // Refresh failed, user needs to log in again
        setUser(null)
        setAccessToken(null)
        return response
      }
    }

    return response
  }

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const apiBaseUrl = getApiBaseUrl()
      console.log("Login attempt to:", `${apiBaseUrl}/auth/login`)

      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      })

      if (response.ok) {
        const { access_token } = await response.json()
        setAccessToken(access_token)

        // Fetch user info
        const userResponse = await fetch(`${apiBaseUrl}/auth/me`, {
          headers: { Authorization: `Bearer ${access_token}` },
          credentials: "include",
        })

        if (userResponse.ok) {
          const userData = await userResponse.json()
          setUser(userData)
          return true
        }
      }
      return false
    } catch (error) {
      console.error("Login error:", error)
      return false
    }
  }

  const logout = async () => {
    try {
      const apiBaseUrl = getApiBaseUrl()
      await fetch(`${apiBaseUrl}/auth/logout`, {
        method: "POST",
        credentials: "include",
      })
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      setUser(null)
      setAccessToken(null)
    }
  }

  const hasRole = (role: string): boolean => {
    return user?.roles.includes(role) ?? false
  }

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const apiBaseUrl = getApiBaseUrl()
        console.log("Checking auth with:", `${apiBaseUrl}/auth/refresh`)

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 3000) // 3 s safety

        const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          signal: controller.signal,
        })
        clearTimeout(timeout)

        if (response.ok) {
          const { access_token } = await response.json()
          setAccessToken(access_token)

          const userResponse = await fetch(`${apiBaseUrl}/auth/me`, {
            headers: { Authorization: `Bearer ${access_token}` },
            credentials: "include",
          })

          if (userResponse.ok) {
            const userData = await userResponse.json()
            setUser(userData)
          }
        } else {
          // Backend answered but token invalid → treat as guest.
          console.debug("[auth] refresh not valid – continuing unauthenticated")
        }
      } catch (err) {
        // Network failure (backend down / CORS / preview) – silently continue.
        console.debug("[auth] backend not reachable during preview; continuing as guest", err)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, []) // Remove API_BASE_URL dependency

  // Make the authenticated request function available globally
  React.useEffect(() => {
    // Store the function in a way that can be accessed by the API client
    ;(window as any).__authRequest = makeAuthenticatedRequest
  }, [accessToken])

  return <AuthContext.Provider value={{ user, login, logout, isLoading, hasRole }}>{children}</AuthContext.Provider>
}
