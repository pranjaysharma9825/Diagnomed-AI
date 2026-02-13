import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";

import Navbar from "./components/Navbar"; // Doctor navbar
import PatientNavbar from "./components/PatientNavbar"; // Patient navbar
import ProtectedRoute from "./components/ProtectedRoute";

import Dashboard from "./pages/Dashboard";
import DoctorCaseReview from "./pages/DoctorCaseReview";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import PatientProfile from "./pages/PatientProfile";
import PatientHome from "./pages/PatientHome";
import SymptomsPage from "./pages/SymptomsPage";
import UploadScansPage from "./pages/UploadScansPage";
import PatientHistoryPage from "./pages/PatientHistoryPage";
import DiagnosisFlow from "./pages/DiagnosisFlow";

export default function App() {
  const role = localStorage.getItem("role");
  const authToken = localStorage.getItem("authToken");
  const location = useLocation();

  // Don't show navbar on login page
  const isLoginPage = location.pathname === "/";
  const showDoctorNavbar = !isLoginPage && authToken && role === "doctor";
  const showPatientNavbar = !isLoginPage && authToken && role === "patient";

  return (
    <div className="min-h-screen min-w-screen bg-gray-50 flex flex-col">
      {/* Show navbar based on role and auth state */}
      {showDoctorNavbar && <Navbar />}
      {showPatientNavbar && <PatientNavbar />}

      <Routes>
        {/* Doctor Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute role="doctor">
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cases"
          element={
            <ProtectedRoute role="doctor">
              <DoctorCaseReview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute role="doctor">
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* Patient Routes */}
        <Route
          path="/patient-home"
          element={
            <ProtectedRoute role="patient">
              <PatientHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient-profile"
          element={
            <ProtectedRoute role="patient">
              <PatientProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/symptoms"
          element={
            <ProtectedRoute role="patient">
              <SymptomsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/upload-scans"
          element={
            <ProtectedRoute role="patient">
              <UploadScansPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient-history"
          element={
            <ProtectedRoute role="patient">
              <PatientHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/diagnosis-flow"
          element={
            <ProtectedRoute role="patient">
              <DiagnosisFlow />
            </ProtectedRoute>
          }
        />

        {/* Login page */}
        <Route path="/" element={<Login />} />

        {/* Fallback */}
        <Route path="*" element={<Login />} />
      </Routes>
    </div>
  );
}
