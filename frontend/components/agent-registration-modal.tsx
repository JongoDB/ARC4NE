"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Copy, Download, CheckCircle, AlertCircle, Package } from "lucide-react"
import { registerAgent } from "@/lib/api"

interface AgentRegistrationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAgentRegistered: () => void
}

interface RegistrationResult {
  agent_id: string
  name: string
  psk_provided: string
}

export function AgentRegistrationModal({ open, onOpenChange, onAgentRegistered }: AgentRegistrationModalProps) {
  const [step, setStep] = useState<"form" | "credentials" | "instructions">("form")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    tags: "",
  })
  const [registrationResult, setRegistrationResult] = useState<RegistrationResult | null>(null)
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const result = await registerAgent({
        name: formData.name,
        os_info: formData.description || undefined,
        tags: formData.tags
          ? formData.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined,
      })

      console.log("Registration result:", result) // Debug log
      setRegistrationResult(result)
      setStep("credentials")
    } catch (err) {
      console.error("Registration error:", err) // Debug log
      setError(err instanceof Error ? err.message : "Failed to register agent")
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string, item: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedItems((prev) => new Set([...prev, item]))
      setTimeout(() => {
        setCopiedItems((prev) => {
          const newSet = new Set(prev)
          newSet.delete(item)
          return newSet
        })
      }, 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const getApiBaseUrl = () => {
    if (process.env.NEXT_PUBLIC_API_URL) {
      return process.env.NEXT_PUBLIC_API_URL
    }
    if (typeof window !== "undefined") {
      return `${window.location.origin}/api/v1`
    }
    return "/api/v1"
  }

  const generateAgentConfig = () => {
    if (!registrationResult) return ""

    const serverUrl =
      typeof window !== "undefined"
        ? `${window.location.protocol}//${window.location.host}/api/v1/agent`
        : "https://localhost/api/v1/agent"

    return JSON.stringify(
      {
        agent_id: registrationResult.agent_id,
        psk: registrationResult.psk_provided,
        server_url: serverUrl,
        beacon_interval_seconds: 60,
        collect_system_metrics: true,
        verify_ssl: false,
      },
      null,
      2,
    )
  }

  const downloadAgentPackage = async () => {
    if (!registrationResult) return

    try {
      const apiBaseUrl = getApiBaseUrl()
      const downloadUrl = `${apiBaseUrl}/agent/files/${registrationResult.agent_id}`

      console.log("Downloading agent package from:", downloadUrl)

      // Create a temporary link to trigger the download
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = `arc4ne-agent-${registrationResult.agent_id.substring(0, 8)}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error("Failed to download agent package:", error)
      setError("Failed to download agent package")
    }
  }

  const downloadIndividualFile = async (filename: string) => {
    if (!registrationResult) return

    try {
      const apiBaseUrl = getApiBaseUrl()

      if (filename === "agent_config.json") {
        // Generate and download the config file
        const configContent = generateAgentConfig()
        const blob = new Blob([configContent], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        // Download Python files from the backend
        const fileEndpoint = filename === "arc4ne_agent.py" ? "agent" : "config"
        const downloadUrl = `${apiBaseUrl}/agent/files/${registrationResult.agent_id}/${fileEndpoint}`

        console.log(`Downloading ${filename} from:`, downloadUrl)

        const response = await fetch(downloadUrl)
        if (!response.ok) {
          throw new Error(`Failed to download ${filename}`)
        }

        const content = await response.text()
        const blob = new Blob([content], { type: "text/x-python" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error(`Failed to download ${filename}:`, error)
      setError(`Failed to download ${filename}`)
    }
  }

  const handleClose = () => {
    setStep("form")
    setFormData({ name: "", description: "", tags: "" })
    setRegistrationResult(null)
    setError(null)
    setCopiedItems(new Set())
    onOpenChange(false)
    if (registrationResult) {
      onAgentRegistered()
    }
  }

  const renderFormStep = () => (
    <>
      <DialogHeader>
        <DialogTitle>Register New Agent</DialogTitle>
        <DialogDescription>
          Create a new agent registration and get the configuration needed to deploy it.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Agent Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., web-server-01, db-primary"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Brief description of this agent's purpose"
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            value={formData.tags}
            onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))}
            placeholder="production, web-server, critical (comma-separated)"
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Agent"}
          </Button>
        </DialogFooter>
      </form>
    </>
  )

  const renderCredentialsStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          Agent Created Successfully
        </DialogTitle>
        <DialogDescription>Save these credentials securely. The PSK will not be shown again.</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Important:</strong> Copy these credentials now. The Pre-Shared Key (PSK) cannot be retrieved later.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">Agent ID</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 p-2 bg-muted rounded text-sm font-mono">{registrationResult?.agent_id}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(registrationResult?.agent_id || "", "agent_id")}
              >
                {copiedItems.has("agent_id") ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Pre-Shared Key (PSK)</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">
                {registrationResult?.psk_provided}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(registrationResult?.psk_provided || "", "psk")}
              >
                {copiedItems.has("psk") ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="border-t pt-3">
            <Label className="text-sm font-medium">Agent Package Download</Label>
            <div className="space-y-2 mt-2">
              <Button variant="outline" onClick={downloadAgentPackage} className="w-full bg-transparent">
                <Package className="h-4 w-4 mr-2" />
                Download Complete Agent Package
              </Button>
              <p className="text-xs text-muted-foreground">
                Downloads: agent_config.json, arc4ne_agent.py, and config.py as ZIP file
              </p>
            </div>
          </div>

          <div className="border-t pt-3">
            <Label className="text-sm font-medium">Individual Files</Label>
            <div className="grid grid-cols-1 gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => downloadIndividualFile("agent_config.json")}>
                <Download className="h-4 w-4 mr-2" />
                agent_config.json
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadIndividualFile("arc4ne_agent.py")}>
                <Download className="h-4 w-4 mr-2" />
                arc4ne_agent.py
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadIndividualFile("config.py")}>
                <Download className="h-4 w-4 mr-2" />
                config.py
              </Button>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => setStep("instructions")}>
          Show Deployment Instructions
        </Button>
        <Button onClick={handleClose}>Done</Button>
      </DialogFooter>
    </>
  )

  const renderInstructionsStep = () => (
    <>
      <DialogHeader>
        <DialogTitle>Agent Deployment Instructions</DialogTitle>
        <DialogDescription>Follow these steps to deploy your agent on the target machine.</DialogDescription>
      </DialogHeader>

      <div className="space-y-4 max-h-96 overflow-y-auto">
        <div className="space-y-3">
          <div>
            <h4 className="font-medium flex items-center gap-2">
              <Badge variant="outline">1</Badge>
              Prepare the target machine
            </h4>
            <div className="ml-8 mt-2">
              <code className="block p-3 bg-muted rounded text-sm">
                # Install Python 3 and pip (if not already installed){"\n"}
                sudo apt update{"\n"}
                sudo apt install python3 python3-pip{"\n"}
                {"\n"}# Install required Python packages{"\n"}
                pip3 install requests psutil{"\n"}
                {"\n"}# Note: psutil is optional but recommended for enhanced system metrics{"\n"}# Without psutil, only
                basic telemetry will be available
              </code>
            </div>
          </div>

          <div>
            <h4 className="font-medium flex items-center gap-2">
              <Badge variant="outline">2</Badge>
              Download and place agent files
            </h4>
            <div className="ml-8 mt-2 space-y-2">
              <p className="text-sm text-muted-foreground">Create a directory and place all three downloaded files:</p>
              <code className="block p-3 bg-muted rounded text-sm">
                # Create agent directory{"\n"}
                mkdir -p ~/arc4ne-agent{"\n"}
                cd ~/arc4ne-agent{"\n"}
                {"\n"}# Extract the ZIP file or place individual files here:{"\n"}# - agent_config.json (contains your
                credentials){"\n"}# - arc4ne_agent.py (main agent script){"\n"}# - config.py (configuration loader)
              </code>
            </div>
          </div>

          <div>
            <h4 className="font-medium flex items-center gap-2">
              <Badge variant="outline">3</Badge>
              Run the agent
            </h4>
            <div className="ml-8 mt-2">
              <code className="block p-3 bg-muted rounded text-sm">
                # Make sure you're in the agent directory{"\n"}
                cd ~/arc4ne-agent{"\n"}
                {"\n"}# Run the agent{"\n"}
                python3 arc4ne_agent.py
              </code>
            </div>
          </div>

          <div>
            <h4 className="font-medium flex items-center gap-2">
              <Badge variant="outline">4</Badge>
              Verify connection
            </h4>
            <div className="ml-8 mt-2">
              <p className="text-sm text-muted-foreground">
                Check the ARC4NE web interface. The agent should appear as "online" within a few minutes of starting.
                You should see enhanced beacon messages in the agent's console output.
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-medium flex items-center gap-2">
              <Badge variant="outline">5</Badge>
              Optional: Run as service
            </h4>
            <div className="ml-8 mt-2">
              <p className="text-sm text-muted-foreground mb-2">
                For production use, consider running the agent as a systemd service:
              </p>
              <code className="block p-3 bg-muted rounded text-sm">
                # Create service file{"\n"}
                sudo nano /etc/systemd/system/arc4ne-agent.service{"\n"}
                {"\n"}# Add service configuration and enable{"\n"}
                sudo systemctl enable arc4ne-agent{"\n"}
                sudo systemctl start arc4ne-agent
              </code>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => setStep("credentials")}>
          Back to Credentials
        </Button>
        <Button onClick={handleClose}>Done</Button>
      </DialogFooter>
    </>
  )

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        {step === "form" && renderFormStep()}
        {step === "credentials" && renderCredentialsStep()}
        {step === "instructions" && renderInstructionsStep()}
      </DialogContent>
    </Dialog>
  )
}
