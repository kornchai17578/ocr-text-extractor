import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the API with the provided key
// NOTE: In a production app, this should be proxied through a backend.
const API_KEY = "AIzaSyDtchUXIM7phDiq6sQ8R-uhDj6sItHawbY";
const genAI = new GoogleGenerativeAI(API_KEY);

export async function extractTextFromImage(file, format = "text") {
  try {
    // Using Gemini 2.0 Flash Experimental as requested (closest to Gemini 2 Pro available)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    // Convert file to base64
    const base64Data = await fileToGenerativePart(file);

    let prompt =
      "Extract all text from this image. Return ONLY the extracted text.";

    if (format === "structure") {
      // Reusing 'structure' key for CSV to minimize changes in App.jsx state logic for now, or I can rename it. Let's keep 'structure' as the key but change behavior to CSV.
      prompt +=
        " Analyze the image layout. If you detect a table, invoice, bill, or structured data, you MUST extract it as CSV format. Use comma (,) as delimiter. Quote fields if they contain commas or newlines. Do not use markdown code blocks or any other formatting. Just raw CSV.";
    } else {
      prompt +=
        " Return the text as a continuous block or simple paragraphs, ignoring complex layout or tables.";
    }

    prompt +=
      " Do not add any markdown formatting (like ```markdown) or explanations around the result.";

    const result = await model.generateContent([prompt, base64Data]);
    const response = await result.response;
    const text = response.text();

    return text;
  } catch (error) {
    console.error("Error extracting text:", error);
    throw error;
  }
}

async function fileToGenerativePart(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result.split(",")[1];

      // Fix MIME type for HEIC if browser doesn't detect it
      let mimeType = file.type;
      if (!mimeType || mimeType === "") {
        if (file.name.toLowerCase().endsWith(".heic")) mimeType = "image/heic";
        if (file.name.toLowerCase().endsWith(".heif")) mimeType = "image/heif";
      }

      resolve({
        inlineData: {
          data: base64String,
          mimeType: mimeType,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
