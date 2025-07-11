"use client"

import { useEffect, useState } from "react"

export function DebugInfo() {
  const [debugInfo, setDebugInfo] = useState<any>({})

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDebugInfo({
        windowOrigin: window.location.origin,
        windowHost: window.location.host,
        windowHostname: window.location.hostname,
        windowPort: window.location.port,
        windowProtocol: window.location.protocol,
        envApiUrl: process.env.NEXT_PUBLIC_API_URL,
        calculatedApiUrl: `${window.location.origin}/api/v1`,
      })
    }
  }, [])

  if (process.env.NODE_ENV !== "development") {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded text-xs max-w-sm">
      <div className="font-bold mb-2">Debug Info:</div>
      <pre className="whitespace-pre-wrap">{JSON.stringify(debugInfo, null, 2)}</pre>
    </div>
  )
}
