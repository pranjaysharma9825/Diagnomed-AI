import React, { useState, useEffect } from "react";
import { User, Mail, Phone, Calendar, Droplet, AlertTriangle, Activity, MapPin, Edit2, Save, X } from "lucide-react";

export default function PatientProfile() {
  const [isEditing, setIsEditing] = useState(false);

  // Default profile data or load from localStorage
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem("patientProfile");
    return saved ? JSON.parse(saved) : {
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "+91 98765 43210",
      age: "30",
      bloodGroup: "B+",
      location: "New Delhi, India",
      allergies: "None",
      conditions: "Hypertension, Diabetes"
    };
  });

  // Save to localStorage whenever profile changes (or on explicit save)
  const handleSave = () => {
    localStorage.setItem("patientProfile", JSON.stringify(profile));
    setIsEditing(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const InputField = ({ label, name, value, icon: Icon, type = "text" }) => (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-gray-500" />}
        {label}
      </label>
      {isEditing ? (
        <input
          type={type}
          name={name}
          value={value}
          onChange={handleChange}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
        />
      ) : (
        <p className="text-gray-800 font-medium py-2 px-1 border-b border-transparent">
          {value || <span className="text-gray-400 italic">Not set</span>}
        </p>
      )}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold !text-gray-900">My Profile</h1>
          <p className="!text-gray-600">
            Manage your personal information and account settings.
          </p>
        </div>
        <button
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          className={`px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all ${isEditing
              ? "bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200"
              : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200"
            }`}
        >
          {isEditing ? (
            <>
              <Save className="w-4 h-4" /> Save Changes
            </>
          ) : (
            <>
              <Edit2 className="w-4 h-4" /> Edit Profile
            </>
          )}
        </button>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl shadow-md p-6 space-y-8 relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>

        {/* Top section with avatar */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
          <div className="w-24 h-24 flex items-center justify-center rounded-full bg-blue-100 border-4 border-white shadow-md">
            <User className="w-10 h-10 text-blue-600" />
          </div>
          <div className="text-center sm:text-left flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-3 max-w-md">
                <input
                  type="text"
                  name="name"
                  value={profile.name}
                  onChange={handleChange}
                  className="text-2xl font-bold text-gray-900 border-b-2 border-blue-200 focus:border-blue-600 outline-none w-full bg-transparent px-1"
                  placeholder="Your Name"
                />
                <input
                  type="text"
                  name="location"
                  value={profile.location}
                  onChange={handleChange}
                  className="text-gray-600 border-b border-gray-200 focus:border-blue-500 outline-none w-full bg-transparent px-1"
                  placeholder="City, Country"
                />
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold !text-gray-900">{profile.name}</h2>
                <p className="!text-gray-600 flex items-center justify-center sm:justify-start gap-2 mt-1">
                  <MapPin className="w-4 h-4" />
                  {profile.location} • Patient
                </p>
                <p className="text-sm !text-gray-500 mt-2">Joined: Jan 2025</p>
              </>
            )}
          </div>
        </div>

        {/* Personal Information Grid */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold !text-gray-800 mb-6 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            Personal Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
            <InputField label="Email Address" name="email" value={profile.email} icon={Mail} />
            <InputField label="Phone Number" name="phone" value={profile.phone} icon={Phone} />
            <InputField label="Age" name="age" value={profile.age} icon={Calendar} type="number" />
            <InputField label="Blood Group" name="bloodGroup" value={profile.bloodGroup} icon={Droplet} />
          </div>
        </div>

        {/* Medical Information */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold !text-gray-800 mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-600" />
            Medical Profile
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Meds & Allergies
              </label>
              {isEditing ? (
                <textarea
                  name="allergies"
                  value={profile.allergies}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                  placeholder="List any allergies..."
                />
              ) : (
                <p className="text-gray-800 bg-orange-50 p-3 rounded-lg border border-orange-100">
                  {profile.allergies || "None"}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Activity className="w-4 h-4 text-red-500" />
                Chronic Conditions
              </label>
              {isEditing ? (
                <textarea
                  name="conditions"
                  value={profile.conditions}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                  placeholder="List chronic conditions..."
                />
              ) : (
                <p className="text-gray-800 bg-red-50 p-3 rounded-lg border border-red-100">
                  {profile.conditions || "None"}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Account Settings */}
        <div className="border-t pt-6 mt-6">
          <h3 className="text-lg font-semibold !text-gray-800 mb-4">
            Account Settings
          </h3>
          <div className="flex flex-wrap gap-4">
            {isEditing && (
              <button
                onClick={() => setIsEditing(false)}
                className="px-5 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition flex items-center gap-2"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
            )}
            <button className="px-5 py-2 bg-gray-200 !text-gray-700 rounded-lg hover:bg-gray-300 transition">
              Change Password
            </button>
            <button className="px-5 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition">
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
