import React, { useEffect, useState, useRef } from "react";
import {
  FileText,
  Eye,
  Loader2,
  X,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const BACKEND_URL = import.meta.env.VITE_API_URL;

export default function DoctorCaseReview() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCase, setSelectedCase] = useState(null);
  const reportRef = useRef();

  // Review State
  const [reviewStatus, setReviewStatus] = useState("pending");
  const [reviewNotes, setReviewNotes] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  // ---------- Fetch all patient cases ----------
  useEffect(() => {
    const fetchCases = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/doctor/cases`);
        const data = await res.json();
        if (res.ok) setCases(data);
        else setError(data.error || "Failed to fetch cases.");
      } catch {
        setError("Server error. Try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchCases();
  }, []);

  // Sync review state when a case is selected
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
        alert("Review saved successfully!");
      } else {
        const errorData = await res.json();
        alert(`Failed to save review: ${errorData.detail || res.statusText}`);
      }
    } catch (e) {
      console.error("Error saving review:", e);
      alert(`Error saving review: ${e.message}`);
    } finally {
      setSavingReview(false);
    }
  };

  // ---------- PDF Export ----------
  const downloadPDF = async () => {
    if (!reportRef.current) return;
    const input = reportRef.current;
    const canvas = await html2canvas(input, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${selectedCase.patient_name || "Patient_Report"}.pdf`);
  };

  return (
    <div className="min-w-full mx-auto p-6 bg-gray-50 min-h-screen">
      <h1 className="flex items-center gap-3 text-3xl font-bold text-blue-600 mb-6">
        <FileText className="w-7 h-7" />
        Patient Diagnoses
      </h1>

      {/* ---------- Loading / Error / Empty ---------- */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center py-20 text-red-600">
          <AlertCircle className="w-8 h-8 mb-2" />
          <p>{error}</p>
        </div>
      ) : cases.length === 0 ? (
        <p className="text-center text-gray-600 mt-10">
          No patient submissions yet.
        </p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl shadow-md border border-gray-200">
          <table className="min-w-full text-sm align-middle">
            <thead className="bg-blue-600 text-white text-left">
              <tr>
                <th className="py-3 px-4">Patient Name</th>
                <th className="py-3 px-4">Symptoms</th>
                <th className="py-3 px-4">CNN Output</th>
                <th className="py-3 px-4">Analysis Output</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr
                  key={c.id}
                  className="text-black hover:bg-blue-50 border-b transition"
                >
                  <td className="py-3 px-4">{c.patient_name || "N/A"}</td>
                  <td className="py-3 px-4">{c.symptoms || "N/A"}</td>
                  <td className="py-3 px-4 text-red-600">
                    {c.cnn_output || "Pending"}
                  </td>
                  <td className="py-3 px-4">
                    {c.analysis_output || "Awaiting Review"}
                  </td>
                  <td className="py-3 px-4">
                    {c.verification_status === 'approved' && (
                      <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded">Approved</span>
                    )}
                    {c.verification_status === 'rejected' && (
                      <span className="bg-red-100 text-red-800 text-xs font-semibold px-2.5 py-0.5 rounded">Rejected</span>
                    )}
                    {(!c.verification_status || c.verification_status === 'pending') && (
                      <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-0.5 rounded">Pending</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => setSelectedCase(c)}
                      className="!bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                    >
                      <Eye className="w-4 h-4 inline mr-1" /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- Modal View ---------- */}
      {selectedCase && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">

            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
              <h2 className="text-xl font-bold text-gray-800 ml-2">Case Review</h2>
              <button
                onClick={() => setSelectedCase(null)}
                className="p-2 hover:bg-gray-200 rounded-full transition"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8" ref={reportRef}>
              <h2 className="text-2xl font-bold text-blue-700 mb-6">
                Patient Report
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* ---------- Patient Info ---------- */}
                <div className="space-y-4 text-gray-800">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <h3 className="font-semibold text-blue-800 mb-3 border-b border-blue-200 pb-2">Patient Details</h3>
                    <p><strong>Name:</strong> {selectedCase.patient_name}</p>
                    <p><strong>Age:</strong> {selectedCase.age || "N/A"}</p>
                    <p><strong>Blood Type:</strong> {selectedCase.blood_type || "N/A"}</p>
                    <p><strong>Symptoms:</strong> {selectedCase.symptoms}</p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h3 className="font-semibold text-gray-800 mb-3 border-b border-gray-200 pb-2">AI Analysis</h3>
                    <p><strong>CNN Output:</strong> {selectedCase.cnn_output || "Not Analyzed"}</p>

                    {/* CNN Predictions Dictionary */}
                    {selectedCase.cnn_all_predictions && (() => {
                      try {
                        const allPreds = JSON.parse(selectedCase.cnn_all_predictions);
                        return (
                          <div className="mt-3">
                            <p className="font-medium text-sm text-gray-600 mb-1">Detailed Probabilities:</p>
                            <ul className="space-y-1">
                              {allPreds.slice(0, 5).map(([condition, prob]) => (
                                <li key={condition} className="flex justify-between items-center text-xs">
                                  <span className="text-gray-700">{condition}</span>
                                  <span className="text-blue-600 font-semibold">{Math.round(prob * 100)}%</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      } catch {
                        return null;
                      }
                    })()}

                    {/* Top 3 Predictions */}
                    {selectedCase.analysis_output && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="font-semibold text-blue-600 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4" /> Medical Reasoning
                        </p>
                        <p className="text-gray-700 mt-2 text-sm leading-relaxed">
                          {selectedCase.analysis_output}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ---------- Image Section ---------- */}
                <div className="space-y-6">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 h-full">
                    <h3 className="font-semibold text-gray-800 mb-3 border-b border-gray-200 pb-2 text-center">Radiology Imaging</h3>

                    <div className="grid grid-cols-1 gap-4">
                      {/* Original X-ray */}
                      {selectedCase.image_url ? (
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-gray-500 mb-1">Original Scan</span>
                          <img
                            src={`${BACKEND_URL}${selectedCase.image_url}`}
                            alt="Uploaded X-ray"
                            className="rounded-lg object-contain max-h-[250px] w-full border border-gray-300 bg-black"
                          />
                        </div>
                      ) : (
                        <p className="text-gray-400 text-center italic py-10">No image uploaded</p>
                      )}

                      {/* Grad-CAM */}
                      {selectedCase.gradcam_url ? (
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-gray-500 mb-1">AI Attention Map (Grad-CAM)</span>
                          <img
                            src={
                              selectedCase.gradcam_url.startsWith("http")
                                ? selectedCase.gradcam_url
                                : `${BACKEND_URL}${selectedCase.gradcam_url}`
                            }
                            alt="GradCAM Heatmap"
                            className="rounded-lg object-contain max-h-[250px] w-full border border-gray-300 bg-black"
                          />
                        </div>
                      ) : (
                        <p className="text-gray-400 text-center italic py-10">No heatmap available</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ---------- Doctor Verification Section (NEW) ---------- */}
              <div className="mt-8 bg-purple-50 border border-purple-100 rounded-xl p-6">
                <h3 className="text-lg font-bold text-purple-800 mb-4 flex items-center gap-2">
                  <Eye className="w-5 h-5" /> Doctor Verification & Notes
                </h3>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Verification Status</label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setReviewStatus("approved")}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors border ${reviewStatus === "approved"
                          ? "bg-green-600 text-white border-green-600 shadow-sm"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-green-50"
                          }`}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => setReviewStatus("rejected")}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors border ${reviewStatus === "rejected"
                          ? "bg-red-600 text-white border-red-600 shadow-sm"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-red-50"
                          }`}
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => setReviewStatus("pending")}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors border ${reviewStatus === "pending"
                          ? "bg-gray-600 text-white border-gray-600 shadow-sm"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                      >
                        Pending
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Clinical Notes</label>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none text-sm"
                      placeholder="Add your medical observations, corrections, or treatment recommendations here..."
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-between items-center rounded-b-2xl">
              <button
                onClick={downloadPDF}
                className="px-5 py-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors font-medium flex items-center gap-2"
              >
                <FileText className="w-4 h-4" /> Download Report
              </button>

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedCase(null)}
                  className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium"
                >
                  Close
                </button>
                <button
                  onClick={handleSaveReview}
                  disabled={savingReview}
                  className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium shadow-md flex items-center gap-2"
                >
                  {savingReview ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : "Save Review"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

