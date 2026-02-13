import React from "react";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, role }) {
    const authToken = localStorage.getItem("authToken");
    const userRole = localStorage.getItem("role");

    if (!authToken) {
        return <Navigate to="/" replace />;
    }

    if (role && userRole !== role) {
        return <Navigate to="/" replace />;
    }

    return children;
}
