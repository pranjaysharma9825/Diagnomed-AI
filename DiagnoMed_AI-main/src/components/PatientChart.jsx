import React, { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

export default function PatientChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrends = async () => {
      try {
        const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
        const response = await fetch(`${BACKEND_URL}/api/doctor/stats/trends`);
        if (response.ok) {
          const result = await response.json();
          setData(result);
        } else {
          console.error("Failed to fetch trends");
        }
      } catch (error) {
        console.error("Error fetching patient trends:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrends();
  }, []);

  return (
    <section className="bg-white dark:bg-panel-dark shadow rounded-xl p-6 w-full h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-text-light">
        Patient Trends (Last 7 Days)
      </h3>

      <div className="flex-grow min-h-[300px]">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400">Loading trends...</div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">No data available</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
              <XAxis dataKey="date" stroke="#374151" className="dark:stroke-text-light dark:text-text-light" />
              <YAxis stroke="#374151" className="dark:stroke-text-light dark:text-text-light" allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(42, 37, 89, 0.9)",
                  borderRadius: "0.5rem",
                  border: "none",
                  color: "#e0e0e0",
                }}
                itemStyle={{ color: "#e0e0e0" }}
              />
              <Line
                type="monotone"
                dataKey="patients"
                stroke="#3b82f6" // primary
                strokeWidth={3}
                dot={{ stroke: "#90cdf4", strokeWidth: 2, fill: "#3b82f6" }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
