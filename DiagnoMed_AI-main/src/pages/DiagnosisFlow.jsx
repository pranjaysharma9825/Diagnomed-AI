import React, { useState, useEffect } from "react";
import {
    Activity,
    FlaskConical,
    DollarSign,
    CheckCircle,
    XCircle,
    ArrowRight,
    Pill,
    AlertTriangle,
    TrendingUp,
    Shield,
    FileText,
    HelpCircle,
    Info,
    BookOpen,
    ImageIcon,
    Scan,
    Printer
} from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import PriorsInfo from "./PriorsInfo";

const BACKEND_URL = import.meta.env.VITE_API_URL;

export default function DiagnosisFlow() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [step, setStep] = useState(1); // 1: Analysis, 2: Tests, 3: Results
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [sessionId, setSessionId] = useState(null);
    const [candidates, setCandidates] = useState([]);
    const [recommendedTests, setRecommendedTests] = useState([]);
    const [completedTests, setCompletedTests] = useState({});
    const [totalCost, setTotalCost] = useState(0);
    const [treatment, setTreatment] = useState(null);
    const [sessionStatus, setSessionStatus] = useState("in_progress");
    // New state for report and trustworthiness
    const [trustworthiness, setTrustworthiness] = useState(null);
    const [report, setReport] = useState(null);
    const [contextualFactors, setContextualFactors] = useState(null);
    const [similarCases, setSimilarCases] = useState([]);
    const [contraindications, setContraindications] = useState("");
    // CNN X-ray state
    const [cnnPredictions, setCnnPredictions] = useState(null);
    const [imageUrl, setImageUrl] = useState(null);
    const [gradcamUrl, setGradcamUrl] = useState(null);
    const [caseId, setCaseId] = useState(null);

    // Resume an existing session from localStorage
    const resumeSession = async (savedSessionId) => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`${BACKEND_URL}/api/diagnosis/${savedSessionId}/status`);
            if (res.ok) {
                const data = await res.json();
                setSessionId(savedSessionId);
                setCandidates(data.candidates || []);
                setRecommendedTests(data.recommended_tests || []);
                setCompletedTests(data.completed_tests || {});
                setTotalCost(data.total_cost || 0);
                setSessionStatus(data.status || "in_progress");
                // Go to step 2 (testing) since we already have candidates
                setStep(2);
            } else {
                // Session expired or not found — clear and start fresh
                localStorage.removeItem("diagnosisSessionId");
                const symptoms = localStorage.getItem("symptoms");
                if (symptoms) startDiagnosis(symptoms);
            }
        } catch (err) {
            localStorage.removeItem("diagnosisSessionId");
            setError("Could not resume session: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Load CNN data from localStorage (set by UploadScansPage)
        const savedCnn = localStorage.getItem("cnnPredictions");
        const savedImage = localStorage.getItem("imageUrl");
        const savedGradcam = localStorage.getItem("gradcamUrl");
        const savedCaseId = localStorage.getItem("diagnosisCaseId");

        if (savedCnn) {
            try { setCnnPredictions(JSON.parse(savedCnn)); } catch (e) { }
        }
        if (savedImage) setImageUrl(savedImage);
        if (savedGradcam) setGradcamUrl(savedGradcam);
        if (savedCaseId) setCaseId(savedCaseId);

        // First check for an active session to resume
        const savedSessionId = localStorage.getItem("diagnosisSessionId");
        if (savedSessionId) {
            resumeSession(savedSessionId);
            return;
        }
        // Otherwise check for new symptoms
        const symptoms = localStorage.getItem("symptoms");
        if (symptoms) {
            const savedCnn = localStorage.getItem("cnnPredictions");
            startDiagnosis(symptoms, savedCnn ? JSON.parse(savedCnn) : null, savedImage, savedGradcam, savedCaseId);
        }
    }, []);

    const startDiagnosis = async (symptomsText, cnnPreds = null, imgUrl = null, gcamUrl = null, csId = null) => {
        setLoading(true);
        setError("");

        try {
            // Extract symptom keywords
            const symptomKeywords = extractSymptoms(symptomsText);

            // Retrieve contextual factors from localStorage
            const storedRegion = localStorage.getItem("patientRegion") || "Global";
            const storedMonth = localStorage.getItem("symptomMonth");
            const storedFamily = localStorage.getItem("familyHistory");
            const storedGenetic = localStorage.getItem("geneticVariants");

            // Build request body with optional CNN predictions
            const requestBody = {
                symptoms: symptomKeywords,
                region: storedRegion,
                month: storedMonth ? parseInt(storedMonth) : undefined,
                family_history: storedFamily ? storedFamily.split(",").map(s => s.trim()).filter(Boolean) : [],
                genetic_variants: storedGenetic ? storedGenetic.split(",").map(s => s.trim()).filter(Boolean) : []
            };

            // Add CNN predictions if available
            if (cnnPreds) {
                requestBody.cnn_predictions = cnnPreds;
            }
            if (csId) {
                requestBody.case_id = csId;
            }
            if (imgUrl) {
                requestBody.image_url = imgUrl;
            }
            if (gcamUrl) {
                requestBody.gradcam_url = gcamUrl;
            }

            const res = await fetch(`${BACKEND_URL}/api/diagnosis/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            });

            const data = await res.json();

            if (res.ok) {
                setSessionId(data.session_id);
                setCandidates(data.candidates || []);
                setRecommendedTests(data.recommended_tests || []);
                setContextualFactors(data.contextual_factors || null);
                localStorage.removeItem("symptoms");
                // Clean up CNN localStorage items after use
                localStorage.removeItem("cnnPredictions");
                localStorage.removeItem("imageUrl");
                localStorage.removeItem("gradcamUrl");
                localStorage.removeItem("diagnosisCaseId");
                // Persist session for resume
                localStorage.setItem("diagnosisSessionId", data.session_id);
            } else {
                setError(data.detail || "Failed to start diagnosis");
            }
        } catch (err) {
            setError("Server error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const extractSymptoms = (text) => {
        const known = [
            "fever", "headache", "cough", "fatigue", "joint_pain",
            "rash", "nausea", "vomiting", "diarrhea", "chills",
            "chest_pain", "shortness_of_breath", "body_aches",
            "sore_throat", "runny_nose", "muscle_pain", "weakness"
        ];
        const textLower = text.toLowerCase();
        return known.filter(s => textLower.includes(s.replace("_", " ")) || textLower.includes(s));
    };

    const submitTestResult = async (testId, result) => {
        if (!sessionId) return;

        setLoading(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/diagnosis/${sessionId}/test-result`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ test_id: testId, result })
            });

            const data = await res.json();

            if (res.ok) {
                setCandidates(data.updated_candidates || []);
                setTotalCost(data.total_cost || 0);
                setSessionStatus(data.status);
                // Update recommended tests from backend (removes completed, adds new ones)
                if (data.recommended_tests) {
                    setRecommendedTests(data.recommended_tests);
                }
                setCompletedTests(prev => ({
                    ...prev,
                    [testId]: result
                }));
            } else {
                setError(data.detail || "Failed to submit test result");
            }
        } catch (err) {
            setError("Server error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const getFinalResult = async () => {
        if (!sessionId) return;

        setLoading(true);
        try {
            const queryParams = contraindications ? `?contraindications=${encodeURIComponent(contraindications)}` : "";
            const res = await fetch(`${BACKEND_URL}/api/diagnosis/${sessionId}/result${queryParams}`);
            const data = await res.json();

            if (res.ok) {
                setTreatment(data.treatment);
                setTrustworthiness(data.trustworthiness);
                setReport(data.report);

                // Fetch similar cases from RAG store
                try {
                    const symptomsForSearch = report?.patient_summary?.symptoms || candidates.slice(0, 3).map(c => c.name);
                    const similarRes = await fetch(`${BACKEND_URL}/api/cases/similar`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ symptoms: symptomsForSearch, top_k: 3 })
                    });
                    const similarData = await similarRes.json();
                    if (similarData.similar_cases) {
                        setSimilarCases(similarData.similar_cases);
                    }
                } catch (e) {
                    console.log("No similar cases available");
                }

                // Save result for History Page "Latest Analysis"
                const topCnn = cnnPredictions
                    ? Object.keys(cnnPredictions).reduce((a, b) => cnnPredictions[a] > cnnPredictions[b] ? a : b)
                    : null;
                const topConf = cnnPredictions
                    ? Math.max(...Object.values(cnnPredictions))
                    : null;

                const lastAnalysis = {
                    ddx_candidates: candidates,
                    cnn_output: topCnn,
                    cnn_confidence: topConf,
                    image_url: imageUrl,
                    gradcam_url: gradcamUrl,
                    predictions: cnnPredictions,
                    analysis_output: data.report?.summary || "Diagnosis complete.",
                    created_at: new Date().toISOString()
                };
                localStorage.setItem("lastAnalysis", JSON.stringify(lastAnalysis));

                setStep(3);
                // Session complete — clear saved session
                localStorage.removeItem("diagnosisSessionId");
            }
        } catch (err) {
            setError("Failed to get results");
        } finally {
            setLoading(false);
        }
    };

    const getProbabilityColor = (prob) => {
        if (prob >= 0.7) return "bg-red-500";
        if (prob >= 0.4) return "bg-yellow-500";
        return "bg-green-500";
    };

    const getConfidenceColor = (level) => {
        if (level === "High") return "text-green-600 bg-green-50 border-green-200";
        if (level === "Medium") return "text-yellow-600 bg-yellow-50 border-yellow-200";
        return "text-red-600 bg-red-50 border-red-200";
    };

    // Print handler
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-gray-50 print:bg-white">
            <div className="max-w-6xl mx-auto p-6 print:hidden">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold !text-blue-600 flex items-center gap-3">
                        <Activity className="w-8 h-8" />
                        Interactive Diagnosis
                    </h1>
                    <p className="!text-gray-600 mt-2">
                        Review candidates, order tests, and see probability updates in real-time
                    </p>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center gap-4 mb-8">
                    {[
                        { num: 1, label: "Analysis" },
                        { num: 2, label: "Testing" },
                        { num: 3, label: "Results" }
                    ].map((s, i) => (
                        <div key={s.num} className="flex items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= s.num ? "!bg-blue-600 !text-white" : "!bg-gray-200 !text-gray-500"
                                }`}>
                                {s.num}
                            </div>
                            <span className={`ml-2 ${step >= s.num ? "!text-blue-600 font-medium" : "!text-gray-400"}`}>
                                {s.label}
                            </span>
                            {i < 2 && <ArrowRight className="mx-4 !text-gray-300" />}
                        </div>
                    ))}
                </div>

                {/* Priors Info - Step 1 Only */}
                {step === 1 && !loading && <PriorsInfo region="Global" />}

                {/* CNN X-ray Evidence Banner */}
                {cnnPredictions && step <= 2 && !loading && (
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
                        <div className="flex items-start gap-4">
                            <div className="flex-1">
                                <h3 className="font-bold text-purple-800 flex items-center gap-2 mb-2">
                                    <Scan className="w-5 h-5" />
                                    X-ray CNN Analysis Applied
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(cnnPredictions)
                                        .sort(([, a], [, b]) => b - a)
                                        .slice(0, 5)
                                        .map(([label, confidence]) => (
                                            <span key={label} className={`px-2 py-1 rounded-full text-xs font-medium ${confidence >= 0.3 ? 'bg-purple-200 text-purple-800' :
                                                confidence >= 0.1 ? 'bg-purple-100 text-purple-700' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                {label}: {Math.round(confidence * 100)}%
                                            </span>
                                        ))}
                                </div>
                                <p className="text-xs text-purple-600 mt-2">
                                    CNN predictions have been factored into disease probabilities below
                                </p>
                            </div>
                            {gradcamUrl && (
                                <div className="flex-shrink-0">
                                    <img
                                        src={gradcamUrl.startsWith('http') ? gradcamUrl : `${BACKEND_URL}${gradcamUrl}`}
                                        alt="GradCAM Heatmap"
                                        className="w-24 h-24 rounded-lg object-cover border-2 border-purple-300"
                                        onError={(e) => e.target.style.display = 'none'}
                                    />
                                    <p className="text-xs text-purple-500 text-center mt-1">GradCAM</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Contextual Factors Display */}
                {contextualFactors && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center gap-3 text-sm">
                        <Info className="w-4 h-4 text-blue-600" />
                        <span className="text-blue-800">
                            <strong>Contextual factors applied:</strong> Region: {contextualFactors.region} •
                            Month: {contextualFactors.month} •
                            Seasonal: {contextualFactors.seasonal_applied ? "✓" : "—"} •
                            Genomic: {contextualFactors.genomic_applied ? "✓" : "—"} •
                            Family Hx: {contextualFactors.family_history_applied ? "✓" : "—"} •
                            CNN X-ray: {contextualFactors.cnn_applied ? `✓ (${contextualFactors.cnn_top_prediction || ''})` : "—"}
                        </span>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {loading && (
                    <div className="text-center py-8">
                        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                        <p className="mt-2 !text-gray-600">Processing...</p>
                    </div>
                )}

                {/* Step 1 & 2: Analysis and Testing */}
                {step <= 2 && !loading && (
                    <div className="grid lg:grid-cols-2 gap-6">
                        {/* Left: Disease Candidates */}
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h2 className="text-xl font-bold !text-gray-800 mb-4 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-blue-600" />
                                Disease Candidates
                            </h2>

                            {candidates.length === 0 ? (
                                <p className="!text-gray-500">No candidates yet. Enter symptoms to start.</p>
                            ) : (
                                <div className="space-y-3">
                                    {candidates.slice(0, 6).map((c, i) => (
                                        <div key={c.disease_id} className="border rounded-lg p-3 hover:bg-gray-50">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <span className="font-medium !text-gray-800">{i + 1}. {c.name}</span>
                                                    {c.updated_by_test && (
                                                        <span className="ml-2 text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded">
                                                            Updated
                                                        </span>
                                                    )}
                                                    {c.family_history_match && (
                                                        <span className="ml-2 text-xs px-2 py-0.5 bg-purple-100 text-purple-600 rounded">
                                                            Family Hx
                                                        </span>
                                                    )}
                                                    {c.genomic_modifier && (
                                                        <span className="ml-2 text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded">
                                                            Genomic
                                                        </span>
                                                    )}
                                                    {c.cnn_boost && (
                                                        <span className="ml-2 text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded flex items-center gap-1">
                                                            <Scan className="w-3 h-3" /> X-ray: {c.cnn_label}
                                                        </span>
                                                    )}
                                                    {c.added_by_cnn && (
                                                        <span className="ml-2 text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded">
                                                            CNN Added
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={`px-3 py-1 rounded-full text-white text-sm font-bold ${getProbabilityColor(c.base_probability)}`}>
                                                    {Math.round(c.base_probability * 100)}%
                                                </span>
                                            </div>
                                            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-500 ${getProbabilityColor(c.base_probability)}`}
                                                    style={{ width: `${c.base_probability * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Cost Summary */}
                            <div className="mt-6 pt-4 border-t">
                                <div className="flex justify-between items-center">
                                    <span className="!text-gray-600 flex items-center gap-2">
                                        <DollarSign className="w-4 h-4" />
                                        Total Test Cost:
                                    </span>
                                    <span className="font-bold text-lg !text-green-600">${totalCost.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Right: Recommended Tests */}
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h2 className="text-xl font-bold !text-gray-800 mb-4 flex items-center gap-2">
                                <FlaskConical className="w-5 h-5 text-purple-600" />
                                Recommended Tests
                            </h2>

                            {recommendedTests.length === 0 ? (
                                <p className="!text-gray-500">No tests available yet.</p>
                            ) : (
                                <div className="space-y-3">
                                    {recommendedTests.map((test) => (
                                        <div
                                            key={test.test_id}
                                            className={`border rounded-lg p-4 transition ${completedTests[test.test_id]
                                                ? "bg-gray-100 border-gray-300"
                                                : "hover:border-blue-400"
                                                }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="font-medium !text-gray-800">{test.name}</span>
                                                    <p className="text-sm !text-gray-500">For: {test.for_disease}</p>
                                                    <p className="text-xs !text-gray-400">
                                                        Sensitivity: {Math.round(test.sensitivity * 100)}% |
                                                        Specificity: {Math.round(test.specificity * 100)}%
                                                    </p>
                                                </div>
                                                <span className="!text-green-600 font-bold">${test.cost_usd}</span>
                                            </div>

                                            {completedTests[test.test_id] ? (
                                                <div className={`mt-3 p-2 rounded text-center font-medium ${completedTests[test.test_id] === "positive"
                                                    ? "bg-red-100 text-red-700"
                                                    : "bg-green-100 text-green-700"
                                                    }`}>
                                                    Result: {completedTests[test.test_id].toUpperCase()}
                                                </div>
                                            ) : (
                                                <div className="mt-3 flex gap-2">
                                                    <button
                                                        onClick={() => submitTestResult(test.test_id, "positive")}
                                                        className="flex-1 py-2 px-3 !bg-red-500 !text-white rounded-lg font-medium hover:bg-red-600 transition flex items-center justify-center gap-1"
                                                    >
                                                        <XCircle className="w-4 h-4" /> Positive
                                                    </button>
                                                    <button
                                                        onClick={() => submitTestResult(test.test_id, "negative")}
                                                        className="flex-1 py-2 px-3 !bg-green-500 !text-white rounded-lg font-medium hover:bg-green-600 transition flex items-center justify-center gap-1"
                                                    >
                                                        <CheckCircle className="w-4 h-4" /> Negative
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Get Results Button */}
                            {Object.keys(completedTests).length > 0 && (
                                <>
                                    <div className="mt-6 mb-4 bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                                        <label className="block text-sm font-bold text-yellow-800 mb-2 flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4" />
                                            Specific Contraindications (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={contraindications}
                                            onChange={(e) => setContraindications(e.target.value)}
                                            placeholder="e.g. Penicillin, Aspirin, Pregnancy, Liver Disease"
                                            className="w-full px-4 py-2 rounded-lg border border-yellow-300 focus:ring-2 focus:ring-yellow-500 focus:outline-none bg-white"
                                        />
                                        <p className="text-xs text-yellow-700 mt-2">
                                            Enter any known allergies or patient conditions to filter treatment options.
                                        </p>
                                    </div>

                                    <button
                                        onClick={getFinalResult}
                                        className="w-full py-3 !bg-blue-600 !text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                                    >
                                        Get Diagnosis & Treatment <ArrowRight className="w-5 h-5" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 3: Final Results & Treatment with Report and Trust Panel */}
                {step === 3 && !loading && (
                    <div className="space-y-6">
                        {/* Top Diagnosis Card */}
                        {candidates[0] && (
                            <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-6 shadow-lg">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold !text-gray-700 mb-2">Most Likely Diagnosis</h3>
                                        <span className="text-3xl font-bold !text-blue-600">{candidates[0].name}</span>
                                    </div>
                                    <div className="text-center">
                                        <span className="px-4 py-2 bg-blue-600 text-white rounded-full font-bold text-xl">
                                            {Math.round(candidates[0].base_probability * 100)}%
                                        </span>
                                        {trustworthiness && (
                                            <p className={`mt-2 text-sm font-medium px-3 py-1 rounded border ${getConfidenceColor(trustworthiness.confidence_level)}`}>
                                                {trustworthiness.confidence_level} Confidence
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid lg:grid-cols-2 gap-6">
                            {/* Left Column: Report */}
                            <div className="space-y-6">
                                {/* Diagnostic Journey */}
                                {report && (
                                    <div className="bg-white rounded-xl shadow-lg p-6">
                                        <h3 className="text-xl font-bold !text-gray-800 mb-4 flex items-center gap-2">
                                            <FileText className="w-5 h-5 text-blue-600" />
                                            Diagnostic Report
                                        </h3>

                                        {/* Patient Summary */}
                                        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-700 mb-2">Patient Summary</h4>
                                            <p className="text-sm text-gray-600">
                                                <strong>Symptoms:</strong> {report.patient_summary.symptoms.join(", ").replace(/_/g, " ")}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                <strong>Region:</strong> {report.patient_summary.region}
                                            </p>
                                        </div>

                                        {/* Tests Performed */}
                                        <div className="mb-4">
                                            <h4 className="font-semibold text-gray-700 mb-2">Tests Performed ({report.diagnostic_journey.tests_ordered})</h4>
                                            <div className="space-y-2">
                                                {report.diagnostic_journey.tests_details.map((t, i) => (
                                                    <div key={i} className={`flex justify-between items-center p-2 rounded ${t.result === "positive" ? "bg-red-50" : "bg-green-50"}`}>
                                                        <span className="text-sm">{t.name}</span>
                                                        <span className={`text-xs font-bold px-2 py-1 rounded ${t.result === "positive" ? "bg-red-200 text-red-800" : "bg-green-200 text-green-800"}`}>
                                                            {t.result.toUpperCase()}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="text-sm text-gray-600 mt-2">
                                                <strong>Total Cost:</strong> ${report.diagnostic_journey.total_cost.toFixed(2)}
                                            </p>
                                        </div>

                                        {/* Differential */}
                                        <div>
                                            <h4 className="font-semibold text-gray-700 mb-2">Differential Diagnosis</h4>
                                            <div className="space-y-1">
                                                {report.differential.map((d, i) => (
                                                    <div key={i} className="flex justify-between text-sm">
                                                        <span>{d.name}</span>
                                                        <span className="font-medium">{Math.round(d.probability * 100)}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Treatment */}
                                {treatment && (
                                    <div className="bg-white rounded-xl shadow-lg p-6">
                                        <h3 className="text-xl font-bold !text-gray-800 mb-4 flex items-center gap-2">
                                            <Pill className="w-5 h-5 text-purple-600" />
                                            Treatment Recommendations
                                        </h3>

                                        {treatment.medications?.length > 0 && (
                                            <div className="mb-4">
                                                <h4 className="font-semibold !text-gray-700 mb-2">Medications</h4>
                                                <ul className="space-y-2">
                                                    {treatment.medications.map((med, i) => (
                                                        <li key={i} className="bg-purple-50 p-3 rounded-lg">
                                                            <span className="font-medium">{med.name}</span>
                                                            <span className="!text-gray-600"> - {med.dosage}</span>
                                                            {med.duration && <span className="!text-gray-500"> ({med.duration})</span>}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {treatment.lifestyle?.length > 0 && (
                                            <div className="mb-4">
                                                <h4 className="font-semibold !text-gray-700 mb-2">Lifestyle</h4>
                                                <ul className="list-disc list-inside space-y-1 !text-gray-600">
                                                    {treatment.lifestyle.map((item, i) => (
                                                        <li key={i}>{item}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {treatment.follow_up && (
                                            <div className="bg-yellow-50 p-4 rounded-lg flex items-start gap-2">
                                                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <span className="font-medium !text-yellow-800">Follow-up: </span>
                                                    <span className="!text-yellow-700">{treatment.follow_up}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Right Column: Trustworthiness Panel */}
                            {trustworthiness && (
                                <div className="space-y-6">
                                    {/* Trust Score */}
                                    <div className="bg-white rounded-xl shadow-lg p-6">
                                        <h3 className="text-xl font-bold !text-gray-800 mb-4 flex items-center gap-2">
                                            <Shield className="w-5 h-5 text-green-600" />
                                            AI Trustworthiness
                                        </h3>

                                        {/* Confidence Gauge */}
                                        <div className="mb-4 text-center">
                                            <div className="inline-flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                                                <div className="text-4xl font-bold text-blue-600">
                                                    {Math.round(trustworthiness.confidence_score * 100)}%
                                                </div>
                                                <div className="text-left">
                                                    <p className="font-semibold text-gray-800">System Confidence</p>
                                                    <p className={`text-sm ${trustworthiness.confidence_level === "High" ? "text-green-600" : trustworthiness.confidence_level === "Medium" ? "text-yellow-600" : "text-red-600"}`}>
                                                        {trustworthiness.confidence_level} Level
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Similar Cases */}
                                        <div className="text-center mb-4 p-2 bg-blue-50 rounded-lg">
                                            <span className="text-sm text-blue-800">
                                                Based on patterns from <strong>{trustworthiness.similar_cases}</strong> similar cases
                                            </span>
                                        </div>
                                    </div>

                                    {/* Reasoning Chain */}
                                    <div className="bg-white rounded-xl shadow-lg p-6">
                                        <h3 className="text-lg font-bold !text-gray-800 mb-4 flex items-center gap-2">
                                            <HelpCircle className="w-5 h-5 text-blue-600" />
                                            How We Reached This Diagnosis
                                        </h3>
                                        <div className="space-y-2">
                                            {trustworthiness.reasoning_chain.map((step, i) => (
                                                <div key={i} className="flex gap-3 p-2 bg-gray-50 rounded-lg">
                                                    <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                                                        {i + 1}
                                                    </div>
                                                    <p className="text-sm text-gray-700">{step.replace(/^Step \d+: /, "")}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Evidence Table */}
                                    <div className="bg-white rounded-xl shadow-lg p-6">
                                        <h3 className="text-lg font-bold !text-gray-800 mb-4">Supporting Evidence</h3>
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {trustworthiness.evidence.map((e, i) => (
                                                <div key={i} className={`flex justify-between items-center p-2 rounded text-sm ${e.type === "test" ? (e.result === "positive" ? "bg-red-50" : "bg-green-50") : "bg-blue-50"}`}>
                                                    <span className="text-gray-700">{e.factor}</span>
                                                    <span className="font-medium text-gray-600">{Math.round(e.weight * 100)}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Uncertainty Disclosure */}
                                    {trustworthiness.uncertainty_factors?.length > 0 && (
                                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                                            <h4 className="font-semibold text-orange-800 mb-2 flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4" />
                                                Uncertainty Factors
                                            </h4>
                                            <ul className="space-y-1 text-sm text-orange-700">
                                                {trustworthiness.uncertainty_factors.map((u, i) => (
                                                    <li key={i}>• {u}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Similar Cases from RAG */}
                                    {similarCases.length > 0 && (
                                        <div className="bg-white rounded-xl shadow-lg p-6">
                                            <h3 className="text-lg font-bold !text-gray-800 mb-4 flex items-center gap-2">
                                                <BookOpen className="w-5 h-5 text-purple-600" />
                                                Similar Historical Cases
                                            </h3>
                                            <div className="space-y-3">
                                                {similarCases.map((c, i) => (
                                                    <div key={i} className="p-3 bg-purple-50 rounded-lg">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <span className="font-medium text-gray-800">{c.diagnosis}</span>
                                                                <p className="text-xs text-gray-500 mt-1">
                                                                    Symptoms: {c.symptoms.slice(0, 3).join(", ")}
                                                                </p>
                                                            </div>
                                                            <span className="text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded">
                                                                {Math.round(c.similarity_score * 100)}% match
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-3 text-center">
                                                Based on semantic similarity from past diagnoses
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-4">
                            <button
                                onClick={handlePrint}
                                className="flex-1 py-3 !bg-gray-800 !text-white rounded-xl font-medium hover:bg-gray-900 transition flex items-center justify-center gap-2"
                            >
                                <Printer className="w-5 h-5" /> Print Report
                            </button>
                            <button
                                onClick={() => navigate("/patient-history")}
                                className="flex-1 py-3 !bg-gray-200 !text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition"
                            >
                                View History
                            </button>
                            <button
                                onClick={() => {
                                    setStep(1);
                                    setSessionId(null);
                                    setCandidates([]);
                                    setRecommendedTests([]);
                                    setCompletedTests({});
                                    setTotalCost(0);
                                    setTreatment(null);
                                    setTrustworthiness(null);
                                    setReport(null);
                                    setSimilarCases([]);
                                    setContraindications("");
                                    setContextualFactors(null);
                                    localStorage.removeItem("diagnosisSessionId");
                                }}
                                className="flex-1 py-3 !bg-blue-600 !text-white rounded-xl font-medium hover:bg-blue-700 transition"
                            >
                                Start New Diagnosis
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Printable Report - Only visible when printing */}
            <div className="hidden print:block p-8 bg-white text-black max-w-[210mm] mx-auto">
                {/* Header */}
                <div className="border-b-2 border-gray-800 pb-4 mb-6 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Medical Diagnostic Report</h1>
                        <p className="text-gray-600 font-serif italic">DiagnoMed AI Clinical Support System</p>
                    </div>
                    <div className="text-right">
                        <p className="font-semibold text-lg">Automated Analysis</p>
                        <p className="text-sm text-gray-500">{new Date().toLocaleDateString()}</p>
                    </div>
                </div>

                {/* Patient Details */}
                <div className="mb-6 bg-gray-50 p-4 rounded border border-gray-200">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Session Details</h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <p><span className="font-semibold">Session ID:</span> {sessionId || "N/A"}</p>
                        <p><span className="font-semibold">Date:</span> {new Date().toLocaleString()}</p>
                        <p><span className="font-semibold">Region:</span> {localStorage.getItem("patientProfile") ? (JSON.parse(localStorage.getItem("patientProfile")).location || "Global") : "Global"}</p>
                    </div>
                </div>

                {/* Diagnosis Overview */}
                <div className="mb-8">
                    <h2 className="text-lg font-bold border-b border-gray-300 mb-3 pb-1 text-blue-800">Diagnostic Conclusions</h2>

                    {candidates.length > 0 ? (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xl font-bold text-blue-900">{candidates[0].name}</span>
                                <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                                    {Math.round((candidates[0].post_probability || candidates[0].base_probability || 0) * 100)}% Probability
                                </span>
                            </div>
                            <p className="text-sm text-blue-800">
                                Primary diagnosis based on symptoms, epidemiological data, and test results.
                            </p>
                        </div>
                    ) : (
                        <p>No diagnosis reached.</p>
                    )}

                    {/* Findings Table */}
                    <table className="w-full text-sm text-left mt-4 border-collapse">
                        <thead>
                            <tr className="border-b-2 border-gray-200">
                                <th className="py-2 text-gray-700 font-bold">Differential Diagnosis</th>
                                <th className="py-2 text-gray-700 font-bold">Probability</th>
                            </tr>
                        </thead>
                        <tbody>
                            {candidates.slice(0, 5).map((c, i) => (
                                <tr key={i} className="border-b border-gray-100">
                                    <td className="py-2 text-gray-800">{c.name}</td>
                                    <td className="py-2 font-medium text-gray-600">
                                        {Math.round((c.post_probability || c.base_probability || 0) * 100)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Clinical Evidence */}
                <div className="mb-8">
                    <h2 className="text-lg font-bold border-b border-gray-300 mb-3 pb-1 text-blue-800">Clinical Evidence</h2>

                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <h3 className="font-semibold text-gray-700 mb-2">Symptom Profile</h3>
                            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded border border-gray-100 italic">
                                "{localStorage.getItem("symptoms") || "N/A"}"
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold text-gray-700 mb-2">Radiology Analysis</h3>
                            {cnnPredictions && Object.keys(cnnPredictions).length > 0 ? (
                                <div className="bg-purple-50 p-3 rounded border border-purple-100">
                                    {Object.entries(cnnPredictions)
                                        .sort(([, a], [, b]) => b - a)
                                        .slice(0, 1)
                                        .map(([label, conf]) => (
                                            <div key={label}>
                                                <p className="text-sm font-bold text-purple-900">{label}</p>
                                                <p className="text-xs text-purple-700">Confidence: {Math.round(conf * 100)}%</p>
                                            </div>
                                        ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 italic">No imaging analysis performed.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Treatment Plan */}
                {treatment && (
                    <div className="mb-8">
                        <h2 className="text-lg font-bold border-b border-gray-300 mb-3 pb-1 text-blue-800">Recommended Management</h2>

                        {treatment.medications?.length > 0 && (
                            <div className="mb-4">
                                <h3 className="font-semibold text-gray-700 mb-2">Medications</h3>
                                <ul className="list-disc pl-5 text-sm space-y-1">
                                    {treatment.medications.map((m, i) => (
                                        <li key={i}><span className="font-medium">{m.name}</span> - {m.dosage} {m.duration && `(${m.duration})`}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {treatment.instructions?.length > 0 && (
                            <div>
                                <h3 className="font-semibold text-gray-700 mb-2">Instructions</h3>
                                <ul className="list-disc pl-5 text-sm space-y-1 text-gray-800">
                                    {treatment.instructions.map((inst, i) => (
                                        <li key={i}>{inst}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* Disclaimer Footer */}
                <div className="mt-12 pt-6 border-t border-gray-400 text-center text-[10px] text-gray-500">
                    <p className="mb-1">GENERATED BY ARTIFICIAL INTELLIGENCE - NOT A FINAL MEDICAL DIAGNOSIS</p>
                    <p>This report is generated by DiagnoMed AI for informational and clinical support purposes only. It should be reviewed by a qualified healthcare professional before taking any medical action.</p>
                </div>
            </div>
        </div>
    );
}
