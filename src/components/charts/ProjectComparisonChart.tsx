import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { ProjectContribution } from "../../types/domain";
import { useFilterStore } from "../../store/filterStore";
import { formatNumber } from "../../utils/format";

interface ProjectComparisonChartProps {
  data: ProjectContribution[];
}

export function ProjectComparisonChart({ data }: ProjectComparisonChartProps) {
  const addCrossFilter = useFilterStore((s) => s.addCrossFilter);

  const chartData = data.map((row) => ({
    name: row.projectName.length > 18 ? `${row.projectName.slice(0, 16)}…` : row.projectName,
    fullName: row.projectName,
    projectId: row.projectId,
    Available: row.availableUnits,
    Booked: row.bookedUnits,
  }));

  return (
    <div className="rounded-2xl border border-border-subtle bg-white p-4 shadow-card">
      <h3 className="text-sm font-semibold text-charcoal">Available vs Booked by Project</h3>
      <p className="text-xs text-charcoal-soft">Click a bar to filter the dashboard to that project</p>

      <div className="mt-3 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 12, bottom: 4, left: 4 }}
            onClick={(state) => {
              const payload = (state as unknown as { activePayload?: { payload: typeof chartData[number] }[] })
                ?.activePayload?.[0]?.payload;
              if (payload) {
                addCrossFilter({
                  source: "chart",
                  dimension: "project",
                  value: payload.projectId,
                  label: payload.fullName,
                });
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8ef" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#4a5a6b" }} tickFormatter={formatNumber} />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              tick={{ fontSize: 11, fill: "#1a2530" }}
            />
            <Tooltip
              formatter={(value) => formatNumber(Number(value))}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Available" stackId="a" fill="#0f9d94" radius={[0, 0, 0, 0]} cursor="pointer" />
            <Bar dataKey="Booked" stackId="a" fill="#c98a1f" radius={[0, 4, 4, 0]} cursor="pointer" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
