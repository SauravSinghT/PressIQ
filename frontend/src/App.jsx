import React, { useState, useRef, useEffect } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  ExternalLink, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  Newspaper,
  Award,
  Cpu,
  Clock,
  Coins,
  FileText,
  Plus,
  ChevronDown,
  Sparkles,
  Zap,
  X,
  Image as ImageIcon
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

export default function FakeNewsDetector() {
  // Model state: 'lite' (Text only) or 'pro' (Multimodal: Text + Image)
  const [selectedModel, setSelectedModel] = useState('lite'); 
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [isExplaining, setIsExplaining] = useState(false);

  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const processImageFile = (file) => {
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setAnalysisResult(null);
      setExplanation(null);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    processImageFile(file);
  };

  const handlePaste = (e) => {
    // Paste functionality for images is enabled only when PressIQ Pro is active
    if (selectedModel !== 'pro') return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          processImageFile(file);
          break;
        }
      }
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    setAnalysisResult(null);
    setExplanation(null);
    setIsAnalyzing(true);

    try {
      let response;
      
      // If an image is attached (only allowed in Pro mode)
      if (selectedModel === 'pro' && selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);

        response = await fetch(`${API_BASE}/analyze-image`, {
          method: 'POST',
          body: formData,
        });
      } else {
        // Text-based analysis
        if (!inputText.trim()) return;
        response = await fetch(`${API_BASE}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: inputText }),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }

      const data = await response.json();
      setAnalysisResult(data);
    } catch (err) {
      alert(`Analysis failed: ${err.message}`);
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFetchExplanation = async () => {
    const queryText = analysisResult?.extracted_text || inputText;
    if (!queryText) return;

    setIsExplaining(true);
    try {
      const response = await fetch(`${API_BASE}/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: queryText }),
      });

      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data = await response.json();
      setExplanation(data);
    } catch (err) {
      alert('Failed to fetch detailed explanation.');
      console.error(err);
    } finally {
      setIsExplaining(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F0EB] text-[#1A1A1A] font-sans flex flex-col justify-between selection:bg-[#D4C5A9] selection:text-black">
      
      {/* Top Banner Notice */}
      <div className="bg-[#D8C7A3] text-xs text-center py-2 px-4 font-medium tracking-wide border-b border-[#C4B28E]">
        "Verification cuts through noise & partisan bias." — PressIQ Analytical Engine ★★★★★
      </div>
 
      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-6 py-12 w-full flex-grow">
        
        {/* Header */}
        <header className="mb-12 text-left max-w-3xl">
          <div className="flex items-center gap-2 mb-4">
            <Newspaper className="w-8 h-8 text-[#1A1A1A]" />
            <span className="font-extrabold text-2xl tracking-tighter uppercase border-b-2 border-black pb-0.5">
              PRESS<span className="font-light italic text-gray-600">IQ</span>
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight text-[#1A1A1A] mb-4">
            See the Full Picture of News Claims. <span className="text-gray-500 font-normal">Text & Image Verification.</span>
          </h1>
          <p className="text-base md:text-lg text-gray-700 font-normal leading-relaxed">
            Analyze headlines, articles, or news graphic images to detect c bility, OCR extracted claims, and verify ground truth live.
          </p>
        </header>

        {/* Core Interactive Card */}
        <div className="bg-[#E7E3DA] rounded-xl p-6 md:p-8 border border-[#D0CBBF] shadow-sm mb-16 relative">
          
          <form onSubmit={handleAnalyze} className="space-y-4">
            
            {/* Top Bar inside Card: Label & Model Dropup Selector */}
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="news-input" className="text-sm font-bold uppercase tracking-wider text-gray-700">
                {selectedModel === 'pro' && selectedFile 
                  ? 'Image Attached & Text Analysis' 
                  : 'Paste Article Text, Web URL, or Image'}
              </label>

              {/* Dropup Model Switcher */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 bg-[#F2F0EB] hover:bg-[#E2DDD2] text-gray-900 px-3 py-1.5 rounded-lg border border-[#C5BFAF] text-xs font-semibold tracking-wide transition-all cursor-pointer shadow-sm"
                >
                  {selectedModel === 'lite' ? (
                    <>
                      <Zap className="w-3.5 h-3.5 text-amber-600" />
                      <span>PressIQ Lite</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      <span>PressIQ Pro</span>
                    </>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropup Menu Popup */}
                {isDropdownOpen && (
                  <div className="absolute right-0 bottom-full mb-2 w-64 bg-[#F8F6F0] border border-[#C5BFAF] rounded-xl shadow-xl z-50 p-1.5 animate-in fade-in zoom-in-95">
                    
                    {/* Option 1: Lite */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedModel('lite');
                        removeSelectedFile();
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-start gap-2.5 cursor-pointer ${
                        selectedModel === 'lite' ? 'bg-[#E7E3DA] font-bold' : 'hover:bg-[#ECE8DF]'
                      }`}
                    >
                      <Zap className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-gray-900 font-bold">PressIQ Lite</div>
                        <div className="text-[11px] text-gray-500 font-normal">Fast sub-30ms text screening. Low latency.</div>
                      </div>
                    </button>

                    {/* Option 2: Pro */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedModel('pro');
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-start gap-2.5 cursor-pointer mt-1 ${
                        selectedModel === 'pro' ? 'bg-[#E7E3DA] font-bold' : 'hover:bg-[#ECE8DF]'
                      }`}
                    >
                      <Sparkles className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-gray-900 font-bold flex items-center gap-1">
                          PressIQ Pro
                          <span className="bg-purple-100 text-purple-800 text-[9px] px-1.5 py-0.2 rounded font-semibold">LLM + Vision</span>
                        </div>
                        <div className="text-[11px] text-gray-500 font-normal">Supports Text + Image OCR. Deep LLM reasoning.</div>
                      </div>
                    </button>

                  </div>
                )}
              </div>
            </div>

            {/* Input Box Area */}
            <div className="relative">
              <textarea
                id="news-input"
                rows="5"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onPaste={handlePaste}
                placeholder={
                  selectedModel === 'pro'
                    ? "Paste news claim, paste image directly (Ctrl+V), or attach using (+) below..."
                    : "Paste news headline, full article text, or claim here to analyze authenticity..."
                }
                className="w-full bg-[#F2F0EB] text-black border border-[#C5BFAF] rounded-lg p-4 pr-12 focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] resize-none font-mono text-sm placeholder:text-gray-400"
              />

              {/* Image Thumbnail Preview inside text box */}
              {previewUrl && (
                <div className="absolute left-4 bottom-4 flex items-center gap-2 bg-[#E7E3DA] p-1.5 rounded-md border border-[#C5BFAF]">
                  <img src={previewUrl} alt="Upload preview" className="w-10 h-10 object-cover rounded" />
                  <span className="text-xs font-mono text-gray-700 max-w-[150px] truncate">
                    {selectedFile?.name || 'Pasted Image'}
                  </span>
                  <button
                    type="button"
                    onClick={removeSelectedFile}
                    className="text-gray-500 hover:text-black p-0.5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Clear button */}
              {(inputText || selectedFile) && (
                <button
                  type="button"
                  onClick={() => { setInputText(''); removeSelectedFile(); setAnalysisResult(null); setExplanation(null); }}
                  className="absolute top-3 right-3 text-xs text-gray-500 hover:text-black bg-[#E7E3DA] px-2 py-1 rounded"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Bottom Controls Bar */}
            <div className="flex items-center justify-between pt-2">
              
              <div className="flex items-center gap-3">
                {/* Plus (+) Button for Image Upload - Only enabled in Pro mode */}
                {selectedModel === 'pro' && (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                      id="file-upload-input"
                    />
                    <label
                      htmlFor="file-upload-input"
                      title="Attach News Image / Graphic"
                      className="flex items-center justify-center w-9 h-9 rounded-full bg-[#F2F0EB] hover:bg-[#E2DDD2] border border-[#C5BFAF] text-gray-700 cursor-pointer transition-colors shadow-sm"
                    >
                      <Plus className="w-5 h-5 text-gray-800" />
                    </label>
                  </div>
                )}

                <span className="text-xs text-gray-500">
                  {selectedModel === 'lite' 
                    ? 'Lite Model • Text Only • Fast Local ML Screening' 
                    : 'Pro Model • Multi-modal • Supports Direct Image Paste (Ctrl+V)'}
                </span>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isAnalyzing || (!inputText.trim() && !selectedFile)}
                className="bg-[#222222] hover:bg-black text-white px-6 py-3 rounded-md font-semibold text-sm transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Analyzing Content...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Analyze News
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Results Display Box */}
          {analysisResult && (
            <div className="mt-8 pt-8 border-t border-[#D0CBBF] animate-fade-in space-y-6">
              
              {/* Extracted Text Badge (If Image Uploaded) */}
              {analysisResult.extracted_text && (
                <div className="bg-[#F2F0EB] p-4 rounded-md border border-[#C5BFAF]">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">
                    OCR Extracted & Cleaned Text:
                  </span>
                  <p className="text-sm font-mono text-gray-900">"{analysisResult.extracted_text}"</p>
                </div>
              )}

              {/* Verdict Header */}
              <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
                <div>
                  <div className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full mb-2 ${
                    analysisResult.prediction === 'REAL'
                      ? 'bg-emerald-900 text-emerald-200'
                      : 'bg-rose-900 text-rose-200'
                  }`}>
                    {analysisResult.prediction === 'REAL' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    )}
                    VERDICT GENERATED
                  </div>
                  <h3 className="text-2xl font-bold">
                    VERIFIED {analysisResult.prediction}
                  </h3>
                  <p className="text-sm text-gray-600 font-medium mt-1">
                    Verified Path: {analysisResult.verified_by}
                  </p>
                </div>

                <div className="bg-[#F2F0EB] p-4 rounded-lg border border-[#C5BFAF] w-full md:w-auto flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-extrabold text-[#1A1A1A]">
                      {(analysisResult.confidence_score * 100).toFixed(1)}%
                    </div>
                    <div className="text-[10px] uppercase font-bold text-gray-500">
                      Confidence
                    </div>
                  </div>

                  <div className="h-8 w-px bg-gray-300"></div>

                  <div className="text-center">
                    <div className="text-2xl font-extrabold text-[#1A1A1A]">
                      {analysisResult.latency_ms} ms
                    </div>
                    <div className="text-[10px] uppercase font-bold text-gray-500">
                      Latency
                    </div>
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#F2F0EB] p-3 rounded border border-[#C5BFAF]">
                  <div className="text-xs text-gray-500 font-semibold mb-1 flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5 text-gray-700" /> Verification Path
                  </div>
                  <span className="font-bold text-sm text-gray-900">{analysisResult.verified_by}</span>
                </div>

                <div className="bg-[#F2F0EB] p-3 rounded border border-[#C5BFAF]">
                  <div className="text-xs text-gray-500 font-semibold mb-1 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-gray-700" /> Token Consumption
                  </div>
                  <span className="font-bold text-sm text-gray-900">
                    {analysisResult.token_usage?.total_tokens > 0 
                      ? `${analysisResult.token_usage.total_tokens} Tokens` 
                      : '0 Tokens (Local ML Used)'}
                  </span>
                </div>

                <div className="bg-[#F2F0EB] p-3 rounded border border-[#C5BFAF]">
                  <div className="text-xs text-gray-500 font-semibold mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-gray-700" /> Pipeline Speed
                  </div>
                  <span className="font-bold text-sm text-gray-900">
                    {analysisResult.latency_ms < 100 ? 'Ultra Fast (~15ms)' : 'RAG Fast'}
                  </span>
                </div>
              </div>

              {/* On-Demand Explanation Action */}
              {!explanation ? (
                <button
                  type="button"
                  onClick={handleFetchExplanation}
                  disabled={isExplaining}
                  className="w-full bg-[#333333] hover:bg-black text-white p-3 rounded-md font-semibold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isExplaining ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                      <span>Gathering Web Evidence & Fact-Checking...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 text-amber-400" />
                      <span>Get Detailed Fact-Check & Live Sources</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="bg-[#F2F0EB] p-5 rounded-md border border-[#C5BFAF] space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-700" />
                    <span>Detailed AI Explanation</span>
                  </h4>
                  <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-line font-serif">
                    {explanation.explanation}
                  </div>

                  {explanation.sources?.length > 0 && (
                    <div className="pt-3 border-t border-[#D0CBBF] space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-600 block">
                        Verified Live Sources:
                      </span>
                      <ul className="space-y-1 text-xs text-blue-800">
                        {explanation.sources.map((src, i) => (
                          <li key={i}>
                            <a href={src} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
                              <ExternalLink className="w-3 h-3 text-blue-600" />
                              {src}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-[#222222] text-[#E0E0E0] pt-12 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10 text-white tracking-wide">
            What Ground News Readers & Fact Checkers Are Saying
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-[#2D2D2D] p-6 rounded-xl border border-[#3A3A3A] flex flex-col justify-between">
              <div>
                <div className="text-yellow-500 text-sm mb-3">★★★★★</div>
                <h3 className="font-bold text-white text-lg mb-2 leading-snug">Cuts through the noise & partisan bias</h3>
                <p className="text-sm text-gray-400 leading-relaxed">"It is my constant go-to for checking headlines. Never before have users had more need for a tool that can help decipher truth from fiction."</p>
              </div>
              <span className="text-xs text-gray-500 mt-6 block">— Ms. xyz</span>
            </div>
            <div className="bg-[#2D2D2D] p-6 rounded-xl border border-[#3A3A3A] flex flex-col justify-between">
              <div>
                <div className="text-yellow-500 text-sm mb-3">★★★★★</div>
                <h3 className="font-bold text-white text-lg mb-2 leading-snug">Real News & Clear Metrics</h3>
                <p className="text-sm text-gray-400 leading-relaxed">"It is important to me to have honest news analysis because I do not want to further misinformation. Quick, clear, and unbiased."</p>
              </div>
              <span className="text-xs text-gray-500 mt-6 block">— Mr. xyz</span>
            </div>
            <div className="bg-[#2D2D2D] p-6 rounded-xl border border-[#3A3A3A] flex flex-col justify-between">
              <div>
                <div className="text-yellow-500 text-sm mb-3">★★★★★</div>
                <h3 className="font-bold text-white text-lg mb-2 leading-snug">The truth always lies in between</h3>
                <p className="text-sm text-gray-400 leading-relaxed">"PressIQ makes it much easier to research on my own, provides much more info in aggregate, and discourages emotional bias."</p>
              </div>
              <span className="text-xs text-gray-500 mt-6 block">— Mrs. xyz</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-8 border-t border-[#333333] pt-8 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-gray-300" />
              <span>APP OF THE DAY 5 TIMES</span>
            </div>
            <div className="flex items-center gap-2"><span className="font-bold text-white">4.7 ★</span><span>App Store</span></div>
            <div className="flex items-center gap-2"><span className="font-bold text-white">4.7 ★</span><span>Google Play</span></div>
            <div className="flex items-center gap-2"><span className="font-bold text-white">4.8 ★</span><span>Trustpilot Rating</span></div>
          </div>
        </div>
      </footer>

    </div>
  );
}