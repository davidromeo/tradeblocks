"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

export const description = "Interactive equity performance chart"

const chartData = [
  { date: "2024-04-01", equity: 222, benchmark: 150 },
  { date: "2024-04-02", equity: 97, benchmark: 180 },
  { date: "2024-04-03", equity: 167, benchmark: 120 },
  { date: "2024-04-04", equity: 242, benchmark: 260 },
  { date: "2024-04-05", equity: 373, benchmark: 290 },
  { date: "2024-04-06", equity: 301, benchmark: 340 },
  { date: "2024-04-07", equity: 245, benchmark: 180 },
  { date: "2024-04-08", equity: 409, benchmark: 320 },
  { date: "2024-04-09", equity: 59, benchmark: 110 },
  { date: "2024-04-10", equity: 261, benchmark: 190 },
  { date: "2024-04-11", equity: 327, benchmark: 350 },
  { date: "2024-04-12", equity: 292, benchmark: 210 },
  { date: "2024-04-13", equity: 342, benchmark: 380 },
  { date: "2024-04-14", equity: 137, benchmark: 220 },
  { date: "2024-04-15", equity: 120, benchmark: 170 },
  { date: "2024-04-16", equity: 138, benchmark: 190 },
  { date: "2024-04-17", equity: 446, benchmark: 360 },
  { date: "2024-04-18", equity: 364, benchmark: 410 },
  { date: "2024-04-19", equity: 243, benchmark: 180 },
  { date: "2024-04-20", equity: 89, benchmark: 150 },
  { date: "2024-04-21", equity: 137, benchmark: 200 },
  { date: "2024-04-22", equity: 224, benchmark: 170 },
  { date: "2024-04-23", equity: 138, benchmark: 230 },
  { date: "2024-04-24", equity: 387, benchmark: 290 },
  { date: "2024-04-25", equity: 215, benchmark: 250 },
  { date: "2024-04-26", equity: 75, benchmark: 130 },
  { date: "2024-04-27", equity: 383, benchmark: 420 },
  { date: "2024-04-28", equity: 122, benchmark: 180 },
  { date: "2024-04-29", equity: 315, benchmark: 240 },
  { date: "2024-04-30", equity: 454, benchmark: 380 },
  { date: "2024-05-01", equity: 165, benchmark: 220 },
  { date: "2024-05-02", equity: 293, benchmark: 310 },
  { date: "2024-05-03", equity: 247, benchmark: 190 },
  { date: "2024-05-04", equity: 385, benchmark: 420 },
  { date: "2024-05-05", equity: 481, benchmark: 390 },
  { date: "2024-05-06", equity: 498, benchmark: 520 },
  { date: "2024-05-07", equity: 388, benchmark: 300 },
  { date: "2024-05-08", equity: 149, benchmark: 210 },
  { date: "2024-05-09", equity: 227, benchmark: 180 },
  { date: "2024-05-10", equity: 293, benchmark: 330 },
  { date: "2024-05-11", equity: 335, benchmark: 270 },
  { date: "2024-05-12", equity: 197, benchmark: 240 },
  { date: "2024-05-13", equity: 197, benchmark: 160 },
  { date: "2024-05-14", equity: 448, benchmark: 490 },
  { date: "2024-05-15", equity: 473, benchmark: 380 },
  { date: "2024-05-16", equity: 338, benchmark: 400 },
  { date: "2024-05-17", equity: 499, benchmark: 420 },
  { date: "2024-05-18", equity: 315, benchmark: 350 },
  { date: "2024-05-19", equity: 235, benchmark: 180 },
  { date: "2024-05-20", equity: 177, benchmark: 230 },
  { date: "2024-05-21", equity: 82, benchmark: 140 },
  { date: "2024-05-22", equity: 81, benchmark: 120 },
  { date: "2024-05-23", equity: 252, benchmark: 290 },
  { date: "2024-05-24", equity: 294, benchmark: 220 },
  { date: "2024-05-25", equity: 201, benchmark: 250 },
  { date: "2024-05-26", equity: 213, benchmark: 170 },
  { date: "2024-05-27", equity: 420, benchmark: 460 },
  { date: "2024-05-28", equity: 233, benchmark: 190 },
  { date: "2024-05-29", equity: 78, benchmark: 130 },
  { date: "2024-05-30", equity: 340, benchmark: 280 },
  { date: "2024-05-31", equity: 178, benchmark: 230 },
  { date: "2024-06-01", equity: 178, benchmark: 200 },
  { date: "2024-06-02", equity: 470, benchmark: 410 },
  { date: "2024-06-03", equity: 103, benchmark: 160 },
  { date: "2024-06-04", equity: 439, benchmark: 380 },
  { date: "2024-06-05", equity: 88, benchmark: 140 },
  { date: "2024-06-06", equity: 294, benchmark: 250 },
  { date: "2024-06-07", equity: 323, benchmark: 370 },
  { date: "2024-06-08", equity: 385, benchmark: 320 },
  { date: "2024-06-09", equity: 438, benchmark: 480 },
  { date: "2024-06-10", equity: 155, benchmark: 200 },
  { date: "2024-06-11", equity: 92, benchmark: 150 },
  { date: "2024-06-12", equity: 492, benchmark: 420 },
  { date: "2024-06-13", equity: 81, benchmark: 130 },
  { date: "2024-06-14", equity: 426, benchmark: 380 },
  { date: "2024-06-15", equity: 307, benchmark: 350 },
  { date: "2024-06-16", equity: 371, benchmark: 310 },
  { date: "2024-06-17", equity: 475, benchmark: 520 },
  { date: "2024-06-18", equity: 107, benchmark: 170 },
  { date: "2024-06-19", equity: 341, benchmark: 290 },
  { date: "2024-06-20", equity: 408, benchmark: 450 },
  { date: "2024-06-21", equity: 169, benchmark: 210 },
  { date: "2024-06-22", equity: 317, benchmark: 270 },
  { date: "2024-06-23", equity: 480, benchmark: 530 },
  { date: "2024-06-24", equity: 132, benchmark: 180 },
  { date: "2024-06-25", equity: 141, benchmark: 190 },
  { date: "2024-06-26", equity: 434, benchmark: 380 },
  { date: "2024-06-27", equity: 448, benchmark: 490 },
  { date: "2024-06-28", equity: 149, benchmark: 200 },
  { date: "2024-06-29", equity: 103, benchmark: 160 },
  { date: "2024-06-30", equity: 446, benchmark: 400 },
]

const chartConfig = {
  equity: {
    label: "Portfolio Equity",
    color: "var(--chart-1)",
  },
  benchmark: {
    label: "Benchmark",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("90d")

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  const filteredData = chartData.filter((item) => {
    const date = new Date(item.date)
    const referenceDate = new Date("2024-06-30")
    let daysToSubtract = 90
    if (timeRange === "30d") {
      daysToSubtract = 30
    } else if (timeRange === "7d") {
      daysToSubtract = 7
    }
    const startDate = new Date(referenceDate)
    startDate.setDate(startDate.getDate() - daysToSubtract)
    return date >= startDate
  })

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Portfolio Equity</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Compare block performance to a configurable benchmark.
          </span>
          <span className="@[540px]/card:hidden">Interactive equity curve</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 90 days</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 90 days" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 90 days
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillEquity" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-equity)"
                  stopOpacity={1.0}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-equity)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillBenchmark" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-benchmark)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-benchmark)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="equity"
              type="natural"
              fill="url(#fillEquity)"
              stroke="var(--color-equity)"
              strokeWidth={2}
            />
            <Area
              dataKey="benchmark"
              type="natural"
              fill="url(#fillBenchmark)"
              stroke="var(--color-benchmark)"
              strokeDasharray="6 4"
              strokeWidth={1.5}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
