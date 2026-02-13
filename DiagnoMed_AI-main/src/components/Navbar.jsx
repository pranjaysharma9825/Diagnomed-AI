import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, User, LogOut } from "lucide-react";

export default function Navbar() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const authToken = localStorage.getItem("authToken");
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    navigate("/"); // redirect to login page
  };

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="bg-white dark:bg-panel-deep shadow px-6 py-3 flex justify-between items-center min-w-screen">
      {/* Logo */}
      <h1 className="text-xl font-bold text-blue-600 dark:text-accent-pink">
        DiagnoMed AI
      </h1>

      {authToken ? (
        <>
          {/* Nav Links */}
          <nav className="space-x-6">
            <Link
              to="/dashboard"
              className="text-gray-600 hover:text-blue-600 dark:text-text-light dark:hover:text-primary"
            >
              Dashboard
            </Link>
            <Link
              to="/cases"
              className="text-gray-600 hover:text-blue-600 dark:text-text-light dark:hover:text-primary"
            >
              Case Review
            </Link>
          </nav>

          {/* Right Section: Search +Profile */}
          <div className="flex items-center space-x-6">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                className="pl-10 pr-4 py-2 w-48 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-panel-dark text-gray-900 dark:text-text-light focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <Link
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 !text-white font-bold shadow !hover:bg-blue-700 transition"
              >
                <User className="w-5 h-5" />
              </Link>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 !bg-white dark:bg-panel-dark border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden">
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 px-4 py-2 !text-gray-700 border border-transparent hover:border-blue-500 rounded-lg transition-colors"
                  >
                    <User className="w-4 h-4" />
                    Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 !text-gray-700 dark:text-text-light hover:bg-blue-50 dark:hover:bg-blue-600/30 hover:text-blue-600 dark:hover:text-white w-full text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <nav>
          <Link
            to="/"
            className="text-gray-600 hover:text-blue-600 dark:text-text-light dark:hover:text-primary"
          >
            Login
          </Link>
        </nav>
      )
      }
    </header>
  );
}