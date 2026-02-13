import React, { useState, useEffect } from "react";
import { History, Activity, FileText, Image, AlertCircle, X, Calendar, User, Stethoscope } from "lucide-react";

const BACKEND_URL = import.meta.env.VITE_API_URL;

export default function PatientHistoryPage() {
  const [latestAnalysis, setLatestAnalysis] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCase, setSelectedCase] = useState(null);

  // Review State
  const [reviewStatus, setReviewStatus] = useState("pending");
  const [reviewNotes, setReviewNotes] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  const fetchCases = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/doctor/cases`);
      if (res.ok) {
        const data = await res.json();
        setCases(data);
      }
    } catch (err) {
      console.error("Failed to fetch cases:", err);
      setError("Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check for latest analysis from localStorage (just submitted)
    const lastAnalysis = localStorage.getItem("lastAnalysis");
    if (lastAnalysis) {
      try {
        setLatestAnalysis(JSON.parse(lastAnalysis));
        localStorage.removeItem("lastAnalysis"); // Clear after reading
      } catch (e) {
        console.error("Failed to parse lastAnalysis", e);
      }
    }

    // Fetch all cases from backend
    fetchCases();
  }, []);

  useEffect(() => {
    if (selectedCase) {
      setReviewStatus(selectedCase.verification_status || "pending");
      setReviewNotes(selectedCase.doctor_notes || "");
    }
  }, [selectedCase]);

  const handleSaveReview = async () => {
    if (!selectedCase) return;
    setSavingReview(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/doctor/cases/${selectedCase.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verification_status: reviewStatus,
          doctor_notes: reviewNotes
        })
      });

      if (res.ok) {
        // Update local state to reflect changes immediately
        const updatedCase = {
          ...selectedCase,
          verification_status: reviewStatus,
          doctor_notes: reviewNotes,
          status: 'reviewed'
        };

        setCases(cases.map(c => c.id === selectedCase.id ? updatedCase : c));
        setSelectedCase(updatedCase);
        // Optional: Close modal or show success message?
      } else {
        alert("Failed to save review");
      }
    } catch (e) {
      console.error("Error saving review:", e);
      alert("Error saving review");
    } finally {
      setSavingReview(false);
    }
  };



  const formatDate = (dateString) => {
    if (!dateString) return "Unknown Date";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Latest Analysis Result (if just submitted) */}
      {latestAnalysis && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 shadow-lg rounded-xl p-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold !text-green-700 mb-4">
            <AlertCircle className="w-6 h-6" />
            Latest Analysis Result
          </h1>

          <div className="grid md:grid-cols-2 gap-6">
            {/* DDX Results */}
            <div className="bg-white rounded-lg p-4 shadow">
              <h2 className="font-semibold text-lg !text-blue-600 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Symptom-Based Diagnosis
              </h2>
              {latestAnalysis.ddx_candidates && latestAnalysis.ddx_candidates.length > 0 ? (
                <ul className="space-y-2">
                  {latestAnalysis.ddx_candidates.slice(0, 5).map((c, i) => (
                    <li key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="font-medium !text-gray-800">{c.name}</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                        {Math.round((c.base_probability || 0) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="!text-gray-500">No DDx candidates identified</p>
              )}
            </div>

            {/* X-Ray Analysis */}
            <div className="bg-white rounded-lg p-4 shadow">
              <h2 className="font-semibold text-lg !text-blue-600 mb-3 flex items-center gap-2">
                <Image className="w-5 h-5" />
                X-Ray Analysis
              </h2>
              {latestAnalysis.cnn_output &&
                latestAnalysis.cnn_output !== "Model unavailable" &&
                latestAnalysis.cnn_output !== "Model Not Available" &&
                latestAnalysis.image_url ? (
                <div>
                  <p className="text-lg font-medium !text-gray-800 mb-2">
                    Top Prediction: {latestAnalysis.cnn_output}
                  </p>
                  {latestAnalysis.cnn_confidence && (
                    <p className="!text-gray-600 mb-3">
                      Confidence: {Math.round(latestAnalysis.cnn_confidence * 100)}%
                    </p>
                  )}
                  {latestAnalysis.image_url && (
                    <img
                      src={`${BACKEND_URL}${latestAnalysis.image_url}`}
                      alt="X-Ray"
                      className="w-full h-48 object-cover rounded-md border"
                    />
                  )}
                </div>
              ) : (
                <p className="!text-gray-500">No X-Ray analysis available</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History List */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-2xl font-bold !text-gray-800 mb-6 flex items-center gap-2">
          <History className="w-6 h-6" />
          Previous Consultations
        </h2>

        {loading ? (
          <div className="text-center py-12">
            <Activity className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="!text-gray-500">Loading history...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">{error}</div>
        ) : cases.length === 0 ? (
          <div className="text-center py-12 !text-gray-500">
            No previous history found.
          </div>
        ) : (
          <div className="space-y-4">
            {cases.map((patientCase) => {
              const ddxCandidates = typeof patientCase.ddx_candidates === 'string'
                ? JSON.parse(patientCase.ddx_candidates || '[]')
                : patientCase.ddx_candidates || [];

              const cnnOutput = patientCase.cnn_output;

              return (
                <div
                  key={patientCase.id}
                  onClick={() => setSelectedCase(patientCase)}
                  className="border rounded-lg p-4 hover:bg-blue-50 transition cursor-pointer group"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                          {formatDate(patientCase.created_at)}
                        </span>
                        {patientCase.status === "analyzed" && (
                          <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                            Analyzed
                          </span>
                        )}
                        {patientCase.status === "reviewed" && (
                          <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                            Reviewed
                          </span>
                        )}
                      </div>

                      <h3 className="font-semibold !text-gray-800 text-lg mb-1 group-hover:text-blue-600 transition-colors">
                        {patientCase.patient_name || "Patient Case"}
                      </h3>

                      <div className="text-sm !text-gray-600 line-clamp-2">
                        <span className="font-medium">Symptoms: </span>
                        {patientCase.symptoms || "No symptoms recorded"}
                      </div>
                    </div>

                    <div className="text-right">
                      {cnnOutput && patientCase.image_url && (
                        <div className="mb-1">
                          <span className="text-xs !text-gray-500">X-Ray: </span>
                          <span className="font-medium text-sm !text-gray-700">{cnnOutput}</span>
                        </div>
                      )}

                      {ddxCandidates.length > 0 && (
                        <div>
                          <span className="text-xs !text-gray-500">Top DDx: </span>
                          <span className="font-medium text-sm !text-gray-700">{ddxCandidates[0].name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Case Details Modal */}
      {selectedCase && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto transform transition-all">

            {/* Modal Header */}
            <div className="sticky top-0 bg-white px-6 py-4 border-b flex justify-between items-center z-10">
              <div>
                <h2 className="text-2xl font-bold !text-gray-800">Case Details</h2>
                <p className="text-sm !text-gray-500 flex items-center gap-2 mt-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(selectedCase.created_at)}
                  <span className="mx-2">•</span>
                  <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-semibold">
                    {selectedCase.status || "Completed"}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setSelectedCase(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-8">

              {/* Patient Info & Symptoms */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold !text-gray-700 mb-3 flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-600" />
                    Patient Information
                  </h3>
                  <div className="space-y-2 text-sm !text-gray-600">
                    <p><span className="font-medium text-gray-800">Name:</span> {selectedCase.patient_name || "Unknown"}</p>
                    <p><span className="font-medium text-gray-800">Age:</span> {selectedCase.age || "?"}</p>
                    <p><span className="font-medium text-gray-800">Sex:</span> {selectedCase.sex || "?"}</p>
                    <p><span className="font-medium text-gray-800">Region:</span> {selectedCase.region || "Global"}</p>
                    <p><span className="font-medium text-gray-800">Blood Type:</span> {selectedCase.blood_type || "Unknown"}</p>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold !text-gray-700 mb-3 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-600" />
                    Clinical Presentation
                  </h3>
                  <p className="text-sm !text-gray-700 whitespace-pre-wrap">
                    {selectedCase.symptoms || "No symptoms recorded."}
                  </p>
                </div>
              </div>

              {/* Diagnosis Results */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* DDX */}
                <div className="border rounded-xl overflow-hidden">
                  <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
                    <h3 className="font-semibold !text-blue-800 flex items-center gap-2">
                      <Stethoscope className="w-5 h-5" />
                      Differential Diagnosis
                    </h3>
                  </div>
                  <div className="p-4 bg-white">
                    {(typeof selectedCase.ddx_candidates === 'string'
                      ? JSON.parse(selectedCase.ddx_candidates || '[]')
                      : selectedCase.ddx_candidates || []
                    ).length > 0 ? (
                      <ul className="space-y-3">
                        {(typeof selectedCase.ddx_candidates === 'string'
                          ? JSON.parse(selectedCase.ddx_candidates || '[]')
                          : selectedCase.ddx_candidates || []
                        ).map((c, i) => (
                          <li key={i} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded transition">
                            <span className="font-medium !text-gray-700">{c.name}</span>
                            <div className="flex items-center gap-3">
                              <div className="w-24 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-500 h-2 rounded-full"
                                  style={{ width: `${(c.base_probability || 0) * 100}%` }}
                                ></div>
                              </div>
                              <span className="text-sm font-semibold !text-blue-600 w-10 text-right">
                                {Math.round((c.base_probability || 0) * 100)}%
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 italic">No candidates identified.</p>
                    )}
                  </div>
                </div>

                {/* Radiology */}
                <div className="border rounded-xl overflow-hidden">
                  <div className="bg-purple-50 px-4 py-3 border-b border-purple-100">
                    <h3 className="font-semibold !text-purple-800 flex items-center gap-2">
                      <Image className="w-5 h-5" />
                      Radiology Analysis
                    </h3>
                  </div>
                  <div className="p-4 bg-white">
                    {selectedCase.cnn_output && (selectedCase.image_url || selectedCase.gradcam_url) ? (
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <div>
                            <p className="text-sm text-gray-500">Prediction</p>
                            <p className="text-lg font-bold !text-gray-800">{selectedCase.cnn_output}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Confidence</p>
                            <div className="inline-block bg-purple-100 text-purple-700 text-sm font-bold px-3 py-1 rounded-full">
                              {Math.round((selectedCase.confidence || selectedCase.cnn_confidence || 0) * 100)}%
                            </div>
                          </div>
                        </div>

                        <div className="relative group">
                          <img
                            src={
                              (selectedCase.gradcam_url || selectedCase.image_url)?.startsWith("http")
                                ? (selectedCase.gradcam_url || selectedCase.image_url)
                                : `${BACKEND_URL}${selectedCase.gradcam_url || selectedCase.image_url}`
                            }
                            alt={selectedCase.gradcam_url ? "Grad-CAM Heatmap" : "X-Ray"}
                            className="w-full h-48 object-contain bg-black rounded-lg border shadow-sm"
                          />
                          {selectedCase.gradcam_url && (
                            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                              Heatmap Active
                            </div>
                          )}
                        </div>
                        {!selectedCase.gradcam_url && (
                          <p className="text-xs text-gray-400 mt-2 italic">No heatmap available for this scan.</p>
                        )}
                      </div>
                    ) : (
                      <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                        <Image className="w-12 h-12 opacity-50" />
                        <span className="ml-2">No imaging data</span>
                      </div>
                    )}

                  </div>
                </div>
              </div>

              {/* Analysis/Reasoning Text if available */}
              {selectedCase.analysis_output && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-5">
                  <h3 className="font-semibold !text-amber-800 mb-2 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Medical Reasoning
                  </h3>
                  <p className="text-sm !text-gray-700 leading-relaxed max-h-60 overflow-y-auto">
                    {selectedCase.analysis_output}
                  </p>
                </div>
              )}

              {/* Doctor Review Section */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                <h3 className="font-semibold !text-gray-800 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-purple-600" />
                  Doctor Verification
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Diagnosis Verification</label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setReviewStatus("approved")}
                        className={`px-4 py-2 rounded-md font-medium transition-colors border ${reviewStatus === "approved"
                          ? "bg-green-600 text-white border-green-600"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-green-50"
                          }`}
                      >
                        Approve Diagnosis
                      </button>
                      <button
                        onClick={() => setReviewStatus("rejected")}
                        className={`px-4 py-2 rounded-md font-medium transition-colors border ${reviewStatus === "rejected"
                          ? "bg-red-600 text-white border-red-600"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-red-50"
                          }`}
                      >
                        Reject Diagnosis
                      </button>
                      <button
                        onClick={() => setReviewStatus("pending")}
                        className={`px-4 py-2 rounded-md font-medium transition-colors border ${reviewStatus === "pending"
                          ? "bg-gray-600 text-white border-gray-600"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                      >
                        Pending Review
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Doctor Notes</label>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                      rows="4"
                      placeholder="Enter clinical observations, additional test recommendations, or verification notes..."
                    ></textarea>
                  </div>
                </div>
              </div>

            </div>

            <div className="p-6 bg-gray-50 border-t flex justify-between items-center">
              <span className="text-sm text-gray-500 italic">
                {selectedCase.updated_at ? `Last updated: ${formatDate(selectedCase.updated_at)}` : ""}
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedCase(null)}
                  className="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors font-medium"
                >
                  Close
                </button>
                <button
                  onClick={handleSaveReview}
                  disabled={savingReview}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
                >
                  {savingReview ? (
                    <>Saving...</>
                  ) : (
                    <>Save Review</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
