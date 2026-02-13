import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import PatientChart from "../components/PatientChart";
import DiagnosisDistribution from "../components/DiagnosisDistribution";
import RecentPatients from "../components/RecentPatients";
import Card from "../components/Card";

const BACKEND_URL = import.meta.env.VITE_API_URL;

export default function Dashboard() {
  const [stats, setStats] = useState({
    total_patients: 0,
    pending_diagnoses: 0,
    completed_reports: 0,
    activity_change: "0%"
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/doctor/stats`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <main className="p-6 w-full space-y-4">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        {/* Left: Welcome message */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Welcome Back, Doctor
          </h2>
          <p className="mt-1 text-gray-600">
            Here's what's happening with your patients today.
          </p>
        </div>

        {/* Right: Navigation Button */}
        <div className="mt-4 md:mt-0">
          <Link
            to="/cases"
            className="inline-block px-5 py-3 rounded-lg !bg-blue-600 hover:!bg-blue-700 !text-white font-medium shadow transition"
          >
            View Cases
          </Link>
        </div>
      </header>

      {/* Stats Cards - Now using live data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
        <Card
          title="Total Patients"
          value={loading ? "..." : stats.total_patients.toLocaleString()}
          color="text-gray-900"
        />
        <Card
          title="Pending Diagnoses"
          value={loading ? "..." : stats.pending_diagnoses.toString()}
          color="text-red-500"
        />
        <Card
          title="Completed Reports"
          value={loading ? "..." : stats.completed_reports.toString()}
          color="text-green-600"
        />
        <Card
          title="Activity"
          value={loading ? "..." : stats.activity_change}
          color="text-blue-600"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
        <PatientChart />
        <DiagnosisDistribution />
      </div>

      {/* Recent Patients Section */}
      <section className="w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-black">Recent Patients</h2>
          <Link
            to="/patients"
            className="text-blue-600 hover:underline font-medium"
          >
            View All →
          </Link>
        </div>
        <RecentPatients />
      </section>
    </main>
  );
}
