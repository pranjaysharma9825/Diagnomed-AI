import React, { useState } from "react";
import { FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function SymptomsPage() {
  const [symptoms, setSymptoms] = useState("");
  const [region, setRegion] = useState("Global");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [familyHistory, setFamilyHistory] = useState("");
  const [geneticVariants, setGeneticVariants] = useState("");
  const navigate = useNavigate();

  const quickSymptoms = [
    "Headache",
    "Fever",
    "Cough",
    "Fatigue",
    "Nausea",
    "Sore throat",
    "Shortness of breath",
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!symptoms.trim()) return;

    // Save to localStorage
    localStorage.setItem("symptoms", symptoms);
    localStorage.setItem("patientRegion", region);
    localStorage.setItem("symptomMonth", month);
    localStorage.setItem("familyHistory", familyHistory);
    localStorage.setItem("geneticVariants", geneticVariants);

    // Navigate to scan upload page
    navigate("/upload-scans");
  };

  const handleSymptomOnlyAnalysis = () => {
    if (!symptoms.trim()) {
      alert("Please enter your symptoms first");
      return;
    }
    // Save symptoms and clear any stale CNN data
    localStorage.setItem("symptoms", symptoms);
    localStorage.setItem("patientRegion", region);
    localStorage.setItem("symptomMonth", month);
    localStorage.setItem("familyHistory", familyHistory);
    localStorage.setItem("geneticVariants", geneticVariants);

    // Clear stale analysis data
    localStorage.removeItem("cnnPredictions");
    localStorage.removeItem("imageUrl");
    localStorage.removeItem("gradcamUrl");
    localStorage.removeItem("diagnosisCaseId");
    localStorage.removeItem("diagnosisSessionId");

    navigate("/diagnosis-flow");
  };

  const handleToggleSymptom = (symptom) => {
    const symptomList = symptoms.split(",").map((s) => s.trim()).filter(Boolean);

    if (symptomList.includes(symptom)) {
      // Remove symptom if already in list
      const updated = symptomList.filter((s) => s !== symptom).join(", ");
      setSymptoms(updated);
    } else {
      // Add symptom
      setSymptoms(symptomList.length ? `${symptoms}, ${symptom}` : symptom);
    }
  };

  const isSymptomSelected = (symptom) => {
    const symptomList = symptoms.split(",").map((s) => s.trim());
    return symptomList.includes(symptom);
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <h1 className="flex items-center gap-3 text-3xl font-bold text-blue-600 mb-6">
        <FileText className="w-7 h-7" />
        Enter Your Symptoms
      </h1>

      {/* Quick Symptom Suggestions */}
      <div className="mb-4">
        <p className="text-gray-600 mb-2 font-medium">Quick Symptoms:</p>
        <div className="flex flex-wrap gap-2">
          {quickSymptoms.map((symptom) => (
            <button
              key={symptom}
              type="button"
              onClick={() => handleToggleSymptom(symptom)}
              className={`px-3 py-1 rounded-full text-sm transition ${isSymptomSelected(symptom)
                ? "!bg-blue-600 text-white"
                : "!bg-blue-100 text-blue-700 hover:bg-blue-200"
                }`}
            >
              {symptom}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-md rounded-2xl p-6 space-y-4"
      >
        <label className="block !text-gray-700 font-medium mb-2">
          Describe your symptoms:
        </label>
        <textarea
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
          placeholder="Describe your symptoms in detail, e.g., headache, mild fever, fatigue, or nausea..."
          rows={6}
          required
          className="w-full p-4 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 transition placeholder-gray-400 !text-black"
        />

        {/* Contextual Factors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 !text-black"
            >
              <option value="Global">Global / Other</option>
              <option value="North America">North America</option>
              <option value="South America">South America</option>
              <option value="Europe">Europe</option>
              <option value="Africa">Africa</option>
              <option value="South Asia">South Asia</option>
              <option value="East Asia">East Asia</option>
              <option value="Southeast Asia">Southeast Asia</option>
              <option value="Middle East">Middle East</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Month of Onset</label>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 !text-black"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(0, i).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Family History (Optional)</label>
            <input
              type="text"
              value={familyHistory}
              onChange={(e) => setFamilyHistory(e.target.value)}
              placeholder="e.g. Diabetes, Hypertension"
              className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 !text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Genetic Variants (Optional)</label>
            <input
              type="text"
              value={geneticVariants}
              onChange={(e) => setGeneticVariants(e.target.value)}
              placeholder="e.g. rs1800562, rs12345"
              className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 !text-black"
            />
          </div>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            className="flex-1 py-3 !bg-blue-600 text-white rounded-xl font-semibold text-lg hover:bg-blue-700 transition"
          >
            Continue to Scan Upload
          </button>
          <button
            type="button"
            onClick={handleSymptomOnlyAnalysis}
            className="px-6 py-3 !bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition"
          >
            Analyze Symptoms Only
          </button>
        </div>
      </form>
    </div>
  );
}
