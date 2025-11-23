import { useState } from "react";
import {
  Upload,
  Image as ImageIcon,
  X,
  Copy,
  Check,
  Loader2,
  Share2,
  FileText,
  Table,
  Download,
} from "lucide-react";
import heicConvert from "heic-convert"; // Use browser build if available, or just 'heic-convert' and see if vite handles it
import * as XLSX from "xlsx";
import { extractTextFromImage } from "./services/gemini";
import "./index.css";

function App() {
  const [image, setImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [processingPreview, setProcessingPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [format, setFormat] = useState("text"); // 'text' or 'structure' (Excel)

  const handleFileSelect = async (file) => {
    if (!file) return;

    // Allow HEIC/HEIF
    const isImage =
      file.type.startsWith("image/") ||
      file.name.toLowerCase().endsWith(".heic") ||
      file.name.toLowerCase().endsWith(".heif");

    if (!isImage) {
      setError("Please upload an image file (JPG, PNG, HEIC, etc).");
      return;
    }

    setError(null);
    setText("");
    setProcessingPreview(true);

    try {
      let fileToProcess = file;

      // Handle HEIC conversion
      if (
        file.name.toLowerCase().endsWith(".heic") ||
        file.name.toLowerCase().endsWith(".heif") ||
        file.type === "image/heic" ||
        file.type === "image/heif"
      ) {
        try {
          // Convert to ArrayBuffer
          const arrayBuffer = await file.arrayBuffer();
          // Convert to Uint8Array for heic-convert
          const buffer = new Uint8Array(arrayBuffer);

          const outputBuffer = await heicConvert({
            buffer: buffer,
            format: "JPEG",
            quality: 0.8,
          });

          const blob = new Blob([outputBuffer], { type: "image/jpeg" });
          fileToProcess = new File(
            [blob],
            file.name.replace(/\.(heic|heif)$/i, ".jpg"),
            { type: "image/jpeg" }
          );

          // If conversion successful, we can use this for both preview and processing
          setImage(fileToProcess);
        } catch (e) {
          console.error("HEIC conversion failed", e);
          // Fallback: If preview fails, we still try to process the original file with Gemini
          setError(
            `Preview unavailable: ${
              e.message || "Conversion failed"
            }. Attempting to extract text...`
          );

          // Use original file for processing
          setImage(file);
          setPreviewUrl(null);
          setProcessingPreview(false);

          // Force process original file
          processImage(file, format);
          return;
        }
      } else {
        setImage(file);
      }

      // Use FileReader for preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target.result);
        setProcessingPreview(false);
        // Auto start extraction with the processed file
        processImage(fileToProcess, format);
      };
      reader.readAsDataURL(fileToProcess);
    } catch (err) {
      console.error(err);
      setError("Error processing image file.");
      setProcessingPreview(false);
    }
  };

  const processImage = async (file, selectedFormat) => {
    setLoading(true);
    try {
      const extractedText = await extractTextFromImage(file, selectedFormat);
      setText(extractedText);
    } catch (err) {
      setError("Failed to extract text. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFormatChange = (newFormat) => {
    if (format === newFormat) return;
    setFormat(newFormat);
    if (image) {
      processImage(image, newFormat);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const clearAll = () => {
    setImage(null);
    setPreviewUrl(null);
    setText("");
    setError(null);
  };

  const copyToClipboard = () => {
    if (text) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const generateExcelFile = () => {
    try {
      // Parse CSV text to workbook
      const workbook = XLSX.read(text, { type: "string", raw: true });
      // If read fails to detect CSV properly, we might need to parse manually and use utils.aoa_to_sheet
      // But XLSX.read usually handles CSV strings well.

      // Write to buffer
      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });
      return new File([excelBuffer], "extracted_data.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    } catch (e) {
      console.error("Error generating Excel:", e);
      // Fallback: try manual parsing if XLSX.read failed on string
      const rows = parseCSV(text);
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      const excelBuffer = XLSX.write(wb, {
        bookType: "xlsx",
        type: "array",
      });
      return new File([excelBuffer], "extracted_data.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    }
  };

  const downloadFile = (file) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const shareResult = async () => {
    if (!text) return;

    try {
      // If Excel format
      if (format === "structure") {
        const file = generateExcelFile();

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: "Extracted Excel Data",
              text: "Here is the extracted data in Excel format.",
            });
            return;
          } catch (shareErr) {
            if (shareErr.name !== "AbortError") {
              // If share fails (but was supported), fallback to download
              downloadFile(file);
            }
            return;
          }
        } else {
          // Fallback to download if sharing not supported
          downloadFile(file);
          return;
        }
      }

      // Default text sharing
      if (navigator.share) {
        await navigator.share({
          title: "Extracted Text",
          text: text,
        });
      } else {
        // Fallback for text: copy to clipboard
        copyToClipboard();
        alert(
          "Sharing is not supported on this browser. Text copied to clipboard instead."
        );
      }
    } catch (err) {
      console.log("Error sharing:", err);
      if (err.name !== "AbortError") {
        alert("Sharing failed.");
      }
    }
  };

  // Simple CSV parser
  const parseCSV = (csvText) => {
    if (!csvText) return [];
    const rows = csvText.split("\n").filter((row) => row.trim() !== "");
    return rows.map((row) => {
      // Handle quoted fields roughly
      const regex = /(?:^|,)(\"(?:[^\"]+|\"\")*\"|[^,]*)/g;
      const cells = [];
      let match;
      while ((match = regex.exec(row))) {
        let cell = match[1].replace(/^,/, "");
        if (cell.startsWith('"') && cell.endsWith('"')) {
          cell = cell.slice(1, -1).replace(/""/g, '"');
        }
        cells.push(cell.trim());
      }
      return cells;
    });
  };

  const renderTable = () => {
    if (format !== "structure" || !text) return null;

    const data = parseCSV(text);
    if (data.length === 0) return null;

    return (
      <div
        className="table-preview"
        style={{
          overflowX: "auto",
          marginBottom: "1rem",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius-md)",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.875rem",
          }}
        >
          <thead>
            <tr style={{ background: "#f1f5f9" }}>
              {data[0].map((header, i) => (
                <th
                  key={i}
                  style={{
                    padding: "0.75rem",
                    borderBottom: "1px solid var(--border-color)",
                    textAlign: "left",
                    fontWeight: 600,
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(1).map((row, i) => (
              <tr
                key={i}
                style={{
                  borderBottom:
                    i === data.length - 2
                      ? "none"
                      : "1px solid var(--border-color)",
                }}
              >
                {row.map((cell, j) => (
                  <td key={j} style={{ padding: "0.75rem" }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="container">
      <header>
        <h1>OCR Text Extractor</h1>
        <p>Powered by Gemini AI</p>
      </header>

      <main>
        {/* Format Selection */}
        <div
          className="format-selection"
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          <button
            className={`btn ${format === "text" ? "primary" : "secondary"}`}
            onClick={() => handleFormatChange("text")}
          >
            <FileText size={16} />
            Plain Text
          </button>
          <button
            className={`btn ${
              format === "structure" ? "primary" : "secondary"
            }`}
            onClick={() => handleFormatChange("structure")}
          >
            <Table size={16} />
            Excel Format (.xlsx)
          </button>
        </div>

        {/* Upload Section */}
        <div
          className={`upload-section ${!image ? "active" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          style={{
            border: "2px dashed var(--border-color)",
            borderRadius: "var(--radius-lg)",
            padding: "3rem 2rem",
            textAlign: "center",
            cursor: !image ? "pointer" : "default",
            background: "#f8fafc",
            position: "relative",
            display: image ? "none" : "block",
          }}
          onClick={() =>
            !image && document.getElementById("file-input").click()
          }
        >
          <input
            type="file"
            id="file-input"
            accept="image/*,.heic,.heif"
            hidden
            onChange={(e) => handleFileSelect(e.target.files[0])}
          />
          <div
            className="upload-content"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            {processingPreview ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.5rem",
                  color: "var(--primary-color)",
                }}
              >
                <Loader2 className="animate-spin" size={48} />
                <p>Processing image...</p>
              </div>
            ) : (
              <>
                <Upload
                  size={48}
                  color="var(--primary-color)"
                  style={{ opacity: 0.8 }}
                />
                <p
                  className="upload-text"
                  style={{ fontSize: "1.1rem", fontWeight: 500 }}
                >
                  Drag & Drop or{" "}
                  <span
                    style={{
                      color: "var(--primary-color)",
                      textDecoration: "underline",
                    }}
                  >
                    Click to Upload
                  </span>
                </p>
                <p
                  className="upload-hint"
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  Supports JPG, PNG, BMP, HEIC
                </p>
              </>
            )}
          </div>
        </div>

        {/* Preview Section */}
        {(previewUrl || (image && !previewUrl)) && (
          <div
            className="preview-section"
            style={{
              position: "relative",
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
              border: "1px solid var(--border-color)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: "200px",
              background: "#f1f5f9",
            }}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Preview"
                style={{
                  width: "100%",
                  maxHeight: "400px",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "2rem",
                  color: "var(--text-secondary)",
                }}
              >
                <ImageIcon
                  size={48}
                  style={{ marginBottom: "1rem", opacity: 0.5 }}
                />
                <p>Preview Unavailable</p>
                <p style={{ fontSize: "0.875rem" }}>{image.name}</p>
              </div>
            )}
            <button
              onClick={clearAll}
              style={{
                position: "absolute",
                top: "1rem",
                right: "1rem",
                background: "rgba(0,0,0,0.5)",
                color: "white",
                border: "none",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div
            className="error-state"
            style={{
              color: "#ef4444",
              textAlign: "center",
              padding: "1rem",
              background: "#fef2f2",
              borderRadius: "var(--radius-md)",
            }}
          >
            {error}
          </div>
        )}

        {/* Result Section */}
        {(text || loading) && (
          <div
            className="result-section"
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <div
              className="result-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
                {loading ? "Extracting Text..." : "Extracted Text"}
              </h2>
              <div
                className="actions"
                style={{ display: "flex", gap: "0.5rem" }}
              >
                <button
                  className="btn secondary"
                  onClick={copyToClipboard}
                  disabled={loading}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  className="btn secondary"
                  onClick={shareResult}
                  title="Share"
                  disabled={loading}
                >
                  <Share2 size={16} />
                  Share
                </button>
                <button className="btn secondary" onClick={clearAll}>
                  Clear
                </button>
              </div>
            </div>

            {loading ? (
              <div
                className="loading-container"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "3rem",
                  background: "#f8fafc",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-secondary)",
                  minHeight: "200px",
                }}
              >
                <Loader2
                  className="animate-spin"
                  size={32}
                  style={{
                    marginBottom: "1rem",
                    color: "var(--primary-color)",
                  }}
                />
                <p>Analyzing image and extracting text...</p>
              </div>
            ) : (
              <>
                {/* Table Preview */}
                {format === "structure" && renderTable()}

                {/* Text Area - Only show if format is text */}
                {format === "text" && (
                  <textarea
                    readOnly
                    value={text}
                    style={{
                      width: "100%",
                      height: "200px",
                      padding: "1rem",
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--radius-md)",
                      resize: "vertical",
                      fontFamily: "inherit",
                      fontSize: "1rem",
                      background: "#f8fafc",
                    }}
                  />
                )}
              </>
            )}
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default App;
