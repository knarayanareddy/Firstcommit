import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Clock } from "lucide-react";

interface CohortData {
  userId: string;
  userName: string;
  completionTimeDays: number;
  avgQuizScore: number;
  xpEarned: number;
}

export function CohortScatterChart({ data }: { data: CohortData[] }) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" /> Velocity vs. Proficiency
        </CardTitle>
        <p className="text-[10px] text-muted-foreground">
          Completion Rate (days) vs. Quiz Performance (%)
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis
                type="number"
                dataKey="completionTimeDays"
                name="Days to Complete"
                unit="d"
                label={{ value: "Days to Complete", position: "bottom", style: { fill: "hsl(var(--muted-foreground))", fontSize: 10 } }}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                type="number"
                dataKey="avgQuizScore"
                name="Avg Quiz Score"
                unit="%"
                domain={[0, 100]}
                label={{ value: "Quiz Score (%)", angle: -90, position: "left", style: { fill: "hsl(var(--muted-foreground))", fontSize: 10 } }}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              />
              <ZAxis type="number" dataKey="xpEarned" range={[50, 400]} name="XP Earned" />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Scatter name="Learners" data={data} fill="hsl(var(--primary))">
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.avgQuizScore > 80 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.5)"}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
