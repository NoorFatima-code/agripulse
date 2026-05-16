import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildSeries, computeEstimate, CROPS, type FarmInputs } from "@/lib/agronomy";

interface Props {
  input: FarmInputs;
}

// SVG attributes don't resolve CSS var() — use literal colors that match the design tokens.
const COLORS = {
  water: "oklch(0.65 0.14 230)",
  harvest: "oklch(0.78 0.15 75)",
  primary: "oklch(0.55 0.14 145)",
  grid: "oklch(0.9 0.02 150)",
  axis: "oklch(0.55 0.03 150)",
};

const tooltipStyle = {
  background: "hsl(0 0% 100%)",
  border: "1px solid oklch(0.9 0.02 150)",
  borderRadius: "12px",
  fontSize: "12px",
  boxShadow: "0 8px 30px -6px oklch(0.3 0.08 150 / 0.18)",
} as const;

export function ResultsCharts({ input }: Props) {
  const series = useMemo(() => buildSeries(input), [input]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const cropCompare = useMemo(() => {
    return Object.values(CROPS).map((c) => {
      const e = computeEstimate({ ...input, crop: c.key });
      return {
        crop: c.label,
        water: Math.round(e.dailyLitersTotal / 1000),
        yield: e.yieldTotalTons,
      };
    });
  }, [input]);

  if (!mounted) {
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-[300px] rounded-2xl border bg-card shadow-soft" />
        <div className="h-[300px] rounded-2xl border bg-card shadow-soft" />
        <div className="h-[320px] rounded-2xl border bg-card shadow-soft lg:col-span-2" />
      </div>
    );
  }


  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">7-Day Water Demand</CardTitle>
          <p className="text-xs text-muted-foreground">Daily irrigation volume in m³</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="waterFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.water} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={COLORS.water} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="day" stroke={COLORS.axis} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke={COLORS.axis} fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="water" stroke={COLORS.water} strokeWidth={2.5} fill="url(#waterFill)" name="Water (m³)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Daily Yield Pace</CardTitle>
          <p className="text-xs text-muted-foreground">Estimated kg accumulated per day</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="day" stroke={COLORS.axis} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke={COLORS.axis} fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="yieldKg" stroke={COLORS.harvest} strokeWidth={2.5} dot={{ r: 3, fill: COLORS.harvest }} name="Yield (kg)" />
              <Line type="monotone" dataKey="eto" stroke={COLORS.primary} strokeWidth={2} strokeDasharray="4 4" dot={false} name="ETo (mm)" />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-soft lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Crop Comparison · Same Field Conditions</CardTitle>
          <p className="text-xs text-muted-foreground">How your inputs would perform across different crops</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={cropCompare} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="crop" stroke={COLORS.axis} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" stroke={COLORS.axis} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" stroke={COLORS.axis} fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar yAxisId="left" dataKey="water" fill={COLORS.water} radius={[6, 6, 0, 0]} name="Water (m³/day)" />
              <Bar yAxisId="right" dataKey="yield" fill={COLORS.harvest} radius={[6, 6, 0, 0]} name="Yield (tons)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
