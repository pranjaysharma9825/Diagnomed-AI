import React, { useState } from "react";
import { Upload, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const BACKEND_URL = import.meta.env.VITE_API_URL;

export default function UploadScansPage() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    const symptoms = localStorage.getItem("symptoms") || "";

    // At least one of symptoms or file should be present
    if (!file && !symptoms) {
      return setStatus("❌ Please provide symptoms or select an image file.");
    }

    const formData = new FormData();
    formData.append("name", "Anonymous Patient");
    formData.append("symptoms", symptoms);
    if (file) {
      formData.append("image", file);
    }

    try {
      setLoading(true);
      setStatus("⏳ Analyzing...");

      const res = await fetch(`${BACKEND_URL}/api/patient/submit`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setStatus("✅ Analysis complete!");
        // Store CNN data and case_id for the diagnosis flow
        localStorage.setItem("lastCaseId", data.case_id);
        localStorage.setItem("lastAnalysis", JSON.stringify(data));

        // Save CNN predictions for diagnosis-flow to use
        if (data.predictions && Object.keys(data.predictions).length > 0) {
          localStorage.setItem("cnnPredictions", JSON.stringify(data.predictions));
        }
        if (data.image_url) {
          localStorage.setItem("imageUrl", data.image_url);
        }
        if (data.gradcam_url) {
          localStorage.setItem("gradcamUrl", data.gradcam_url);
        }
        if (data.case_id) {
          localStorage.setItem("diagnosisCaseId", data.case_id);
        }

        // Navigate to interactive diagnosis flow (not patient-history)
        setTimeout(() => {
          navigate("/diagnosis-flow");
        }, 500);
      } else {
        setStatus("❌ Error: " + (data.error || data.detail || "Something went wrong"));
      }
    } catch (err) {
      console.error(err);
      setStatus("❌ Server error, please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkipScan = async () => {
    const symptoms = localStorage.getItem("symptoms");
    if (!symptoms) {
      return setStatus("⚠️ No symptoms saved. Please go back and enter symptoms first.");
    }

    const formData = new FormData();
    formData.append("name", "Anonymous Patient");
    formData.append("symptoms", symptoms);

    try {
      setLoading(true);
      setStatus("⏳ Analyzing symptoms only...");

      const res = await fetch(`${BACKEND_URL}/api/patient/submit`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setStatus("✅ Analysis complete!");
        localStorage.setItem("lastCaseId", data.case_id);
        localStorage.setItem("lastAnalysis", JSON.stringify(data));
        // Clear any stale CNN data since this is symptom-only
        localStorage.removeItem("cnnPredictions");
        localStorage.removeItem("imageUrl");
        localStorage.removeItem("gradcamUrl");
        localStorage.removeItem("diagnosisCaseId");
        localStorage.removeItem("diagnosisSessionId");
        // Navigate to interactive diagnosis flow
        setTimeout(() => {
          navigate("/diagnosis-flow");
        }, 500);
      } else {
        setStatus("❌ Error: " + (data.error || data.detail || "Something went wrong"));
      }
    } catch (err) {
      console.error(err);
      setStatus("❌ Server error, please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <h1 className="flex items-center gap-3 text-3xl font-bold !text-blue-600 mb-6">
        <Upload className="w-7 h-7" />
        Upload CT / MRI / X-ray Scans
      </h1>

      {/* Description */}
      <p className="mb-6 text-gray-600">
        Upload your scans for AI analysis. This step is <strong>optional</strong> -
        you can skip if you only want symptom-based diagnosis.
      </p>

      {/* Upload Form */}
      <form
        onSubmit={handleUpload}
        className="bg-white shadow-md rounded-2xl p-6 space-y-4"
      >
        <label className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:!border-blue-400 hover:!bg-blue-50 transition">
          <span className="!text-gray-500 mb-2">Click to select a file</span>
          <span className="text-sm !text-gray-400">
            Supported: PNG, JPG, PDF
          </span>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {file && (
          <p className="!text-gray-700 text-sm mt-2">
            Selected file: {file.name}
          </p>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className={`flex-1 py-3 rounded-xl font-semibold text-lg transition ${loading
              ? "!bg-gray-400 cursor-not-allowed"
              : "!bg-blue-600 !text-white hover:!bg-blue-700"
              }`}
          >
            {loading ? "Analyzing..." : "Upload & Analyze"}
          </button>

          <button
            type="button"
            onClick={handleSkipScan}
            disabled={loading}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition ${loading
              ? "!bg-gray-300 cursor-not-allowed"
              : "!bg-gray-100 !text-gray-700 hover:!bg-gray-200 border border-gray-300"
              }`}
          >
            Skip Scan <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>

      {status && <p className="mt-4 !text-blue-700 text-center font-medium">{status}</p>}
    </div>
  );
}
