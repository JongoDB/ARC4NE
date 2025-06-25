"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

interface TelemetryDataPoint {
  timestamp: string
  value: number
  label?: string
}

interface TelemetryChartProps {
  title: string
  description?: string
  data: TelemetryDataPoint[]
  dataKey: string
  color?: string
  unit?: string
  type?: "line" | "area"
  height?: number
}

export function TelemetryChart({
  title,
  description,
  data,
  dataKey,
  color = "#3b82f6",
  unit = "",
  type = "line",
  height = 300,
}: TelemetryChartProps) {
  const formatXAxis = (tickItem: string) => {
    try {
      const date = new Date(tickItem)
      return format(date, "HH:mm")
    } catch {
      return tickItem
    }
  }

  const formatTooltip = (value: any, name: string) => {
    return [`${value}${unit}`, name]
  }

  const formatTooltipLabel = (label: string) => {
    try {
      const date = new Date(label)
      return format(date, "MMM dd, HH:mm:ss")
    } catch {
      return label
    }
  }

  const currentValue = data.length > 0 ? data[data.length - 1]?.value : 0
  const previousValue = data.length > 1 ? data[data.length - 2]?.value : currentValue
  const trend = currentValue > previousValue ? "up" : currentValue < previousValue ? "down" : "stable"

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base font-medium">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">
            {currentValue.toFixed(1)}
            {unit}
          </div>
          <Badge variant={trend === "up" ? "destructive" : trend === "down" ? "default" : "secondary"}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {trend}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          {type === "area" ? (
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={formatXAxis} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={["dataMin - 5", "dataMax + 5"]} />
              <Tooltip formatter={formatTooltip} labelFormatter={formatTooltipLabel} />
              <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.3} />
            </AreaChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={formatXAxis} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={["dataMin - 5", "dataMax + 5"]} />
              <Tooltip formatter={formatTooltip} labelFormatter={formatTooltipLabel} />
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
