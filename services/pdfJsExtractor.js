// services/pdfJsExtractor.js
const pdfjsLib = require("pdfjs-dist/build/pdf.js");

async function extractPdfTextPdfJs(buffer) {
  // Convert Buffer → Uint8Array (PDF.js requirement)
  const uint8 = new Uint8Array(buffer);

  const loadingTask = pdfjsLib.getDocument({ data: uint8 });
  const pdf = await loadingTask.promise;

  let finalText = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(" ");
    finalText += text + "\n\n";
  }

  return finalText;
}

module.exports = { extractPdfTextPdfJs };
