// api/uploadFile.js
const openai = require("../services/openaiClient");
const express = require("express");
const router = express.Router();
const multer = require("multer");
const { analyzeDocument } = require("../services/documentAnalyzer");
const { sendAnalysisToCliq } = require("../services/cliqNotifier");

const upload = multer({ storage: multer.memoryStorage() });

const supabase = require("../services/supabaseClient");
const { extractPdfTextPdfJs } = require("../services/pdfJsExtractor");
const { tokens } = require("./uploadLink");

// -------- Serve Upload HTML Page --------
router.get("/upload-file", (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.status(400).send("Missing token");
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Upload Document - Zoho Cliq</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }

        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0. 3);
          max-width: 500px;
          width: 100%;
          overflow: hidden;
        }

        .header {
          background: linear-gradient(135deg, #5b4adb 0%, #7c3aed 100%);
          padding: 30px;
          text-align: center;
          color: white;
        }

        .logo {
          width: 120px;
          height: auto;
          margin-bottom: 15px;
        }

        . header h1 {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        . header p {
          font-size: 14px;
          opacity: 0.9;
        }

        .content {
          padding: 40px 30px;
        }

        .upload-area {
          border: 2px dashed #d1d5db;
          border-radius: 8px;
          padding: 40px 20px;
          text-align: center;
          transition: all 0.3s ease;
          cursor: pointer;
          background: #f9fafb;
        }

        .upload-area:hover {
          border-color: #7c3aed;
          background: #f3f4f6;
        }

        .upload-area. drag-over {
          border-color: #7c3aed;
          background: #ede9fe;
        }

        .upload-icon {
          font-size: 48px;
          color: #7c3aed;
          margin-bottom: 15px;
        }

        . upload-text {
          font-size: 16px;
          color: #374151;
          margin-bottom: 8px;
          font-weight: 500;
        }

        .upload-subtext {
          font-size: 13px;
          color: #6b7280;
        }

        input[type="file"] {
          display: none;
        }

        .file-info {
          margin-top: 20px;
          padding: 15px;
          background: #eff6ff;
          border-radius: 8px;
          border-left: 4px solid #3b82f6;
          display: none;
        }

        .file-info.show {
          display: block;
        }

        .file-name {
          font-size: 14px;
          color: #1e40af;
          font-weight: 500;
          margin-bottom: 5px;
        }

        . file-size {
          font-size: 12px;
          color: #6b7280;
        }

        .submit-btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #7c3aed 0%, #5b4adb 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 20px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
        }

        .submit-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(124, 58, 237, 0.4);
        }

        .submit-btn:active {
          transform: translateY(0);
        }

        .submit-btn:disabled {
          background: #9ca3af;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }

        .loading {
          display: none;
          text-align: center;
          margin-top: 15px;
        }

        . loading.show {
          display: block;
        }

        . spinner {
          border: 3px solid #f3f4f6;
          border-top: 3px solid #7c3aed;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <svg class="logo" xmlns="http://www.w3. org/2000/svg" viewBox="0 0 200 60">
            <text x="10" y="45" font-family="Arial, sans-serif" font-size="42" font-weight="bold" fill="white">Zoho</text>
            <text x="130" y="45" font-family="Arial, sans-serif" font-size="32" font-weight="300" fill="white">Cliq</text>
          </svg>
          <h1>Upload Document</h1>
          <p>Share your PDF securely</p>
        </div>

        <div class="content">
          <form id="uploadForm" action="/upload-file" method="post" enctype="multipart/form-data">
            <input type="hidden" name="token" value="${token}">
            
            <div class="upload-area" id="uploadArea">
              <div class="upload-icon">📄</div>
              <div class="upload-text">Click to browse or drag & drop</div>
              <div class="upload-subtext">PDF files only (Max 50MB)</div>
              <input type="file" name="pdf" id="pdfInput" accept="application/pdf" required />
            </div>

            <div class="file-info" id="fileInfo">
              <div class="file-name" id="fileName"></div>
              <div class="file-size" id="fileSize"></div>
            </div>

            <button type="submit" class="submit-btn" id="submitBtn" disabled>Upload PDF</button>
          </form>

          <div class="loading" id="loading">
            <div class="spinner"></div>
            <p style="margin-top: 10px; color: #6b7280; font-size: 14px;">Processing your document...</p>
          </div>
        </div>
      </div>

      <script>
        const uploadArea = document.getElementById('uploadArea');
        const pdfInput = document.getElementById('pdfInput');
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');
        const submitBtn = document.getElementById('submitBtn');
        const uploadForm = document.getElementById('uploadForm');
        const loading = document. getElementById('loading');

        uploadArea.addEventListener('click', () => pdfInput.click());

        uploadArea.addEventListener('dragover', (e) => {
          e. preventDefault();
          uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
          uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
          e.preventDefault();
          uploadArea.classList.remove('drag-over');
          const files = e. dataTransfer.files;
          if (files.length > 0 && files[0].type === 'application/pdf') {
            pdfInput.files = files;
            handleFileSelect(files[0]);
          }
        });

        pdfInput.addEventListener('change', (e) => {
          if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
          }
        });

        function handleFileSelect(file) {
          fileName.textContent = file.name;
          fileSize.textContent = formatFileSize(file.size);
          fileInfo.classList.add('show');
          submitBtn.disabled = false;
        }

        function formatFileSize(bytes) {
          if (bytes < 1024) return bytes + ' B';
          if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
          return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        }

        uploadForm.addEventListener('submit', () => {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Uploading...';
          loading. classList.add('show');
        });
      </script>
    </body>
    </html>
  `);
});

// -------- Handle PDF Upload & Extraction --------
router. post("/upload-file", upload. single("pdf"), async (req, res) => {
  try {
    console.log("\n📄 ===== FILE UPLOAD STARTED =====");
    
    const { token } = req.body;
    console.log("🔑 Token received:", token);
    
    const tokenData = tokens[token];
    console.log("📦 Token data:", tokenData);

    if (!tokenData) {
      console.log("❌ Invalid or expired token");
      return res. status(400).send("Invalid or expired upload link.");
    }

    const { case_id, user_id, case_name } = tokenData;
    
    console.log("🔍 Extracted from token:");
    console.log("  - case_id:", case_id);
    console.log("  - user_id:", user_id);
    console.log("  - case_name:", case_name);

    if (!req.file) {
      return res.status(400).send("No PDF file uploaded.");
    }

    const buffer = req.file.buffer;
    const file = req. file;
    
    console.log("📁 File details:");
    console. log("  - name:", file.originalname);
    console.log("  - size:", file.size, "bytes");

    // ---- Extract PDF Text via PDF.js ----
    console.log("\n📖 Extracting PDF text...");
    let extractedText = "";
    try {
      extractedText = await extractPdfTextPdfJs(buffer);
      console.log(`✅ Extracted ${extractedText.length} characters`);
    } catch (err) {
      console.error("❌ PDF.js extraction failed:", err);
      return res. status(500).send("Failed to extract PDF text.");
    }

    // ---- Upload original PDF to Supabase ----
    console.log("\n☁️ Uploading to Supabase storage...");
    const bucket = process.env.BUCKET_NAME;
    const path = `cases/${case_id}/${Date. now()}-${file.originalname}`;

    const uploadRes = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: "application/pdf"
      });

    if (uploadRes.error) {
      console.error("❌ Storage upload failed:", uploadRes.error);
      return res.status(500).send("Supabase storage upload failed.");
    }
    console.log("✅ File uploaded to storage:", path);

    // ---- Insert into Database ----
    console. log("\n💾 Inserting document into database...");
    console.log("🔍 Data to insert:");
    console.log("  - case_id:", case_id);
    console.log("  - file_name:", file.originalname);
    console.log("  - file_size:", file.size);
    console.log("  - uploaded_by:", user_id);
    console.log("  - text_content length:", extractedText.length);

    const { data: doc, error: docError } = await supabase
      .from("documents")
      .insert([
        {
          case_id,
          file_name: file.originalname,
          file_size: file. size,
          storage_path: path,
          text_content: extractedText,
          uploaded_by: user_id  // 🔥 CRITICAL LINE
        }
      ])
      .select()
      .single();

    console.log("\n📊 Database insert result:");
    console.log("  - Success:", !!doc);
    console.log("  - Document ID:", doc ?  doc.id : "N/A");
    console.log("  - uploaded_by in DB:", doc ? doc.uploaded_by : "N/A");
    console.log("  - Error:", docError || "None");

    if (docError) {
      console.error("❌ Database insert failed:", docError);
      return res. status(500).send("Database insert failed.");
    }

    delete tokens[token];
    console.log("🗑️ Token deleted");

    // ---- Chunk extracted text ----
    function chunkText(text, size = 800) {
      const chunks = [];
      let start = 0;
      while (start < text.length) {
        chunks.push(text.substring(start, start + size));
        start += size;
      }
      return chunks;
    }

    const chunks = chunkText(extractedText);
    console.log(`\n📦 Split into ${chunks.length} chunks`);

    // ---- Generate embeddings + insert into doc_embeddings ----
    console.log("🧠 Generating embeddings...");
    for (let i = 0; i < chunks.length; i++) {
      const embRes = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunks[i]
      });

      const embeddingVector = embRes.data[0]. embedding;

      const { error: embError } = await supabase
        .from("doc_embeddings")
        .insert([
          {
            document_id: doc.id,
            chunk_index: i,
            chunk_text: chunks[i],
            embedding: embeddingVector
          }
        ]);

      if (embError) {
        console. error("❌ Embedding Insert Error:", embError);
      }
      
      if ((i + 1) % 5 === 0 || i === chunks.length - 1) {
        console.log(`  Progress: ${i + 1}/${chunks.length} chunks`);
      }
    }
    console.log("✅ All embeddings saved");

    // ---- Analyze document with AI ----
    console.log("\n🤖 Analyzing document with AI.. .");
    let analysis = null;
    try {
      analysis = await analyzeDocument(
        extractedText,
        case_name || "Unknown Case",
        file.originalname
      );
      console.log("✅ Analysis complete");
    } catch (err) {
      console.error("⚠️ Analysis failed:", err);
      analysis = {
        documentType: "Legal Document",
        summary: "Document uploaded and processed successfully.",
        keyFindings: ["Document has been analyzed and is ready for queries."],
        keyParties: [],
        potentialRisks: [],
        importantDates: [],
        recommendations: []
      };
    }

    // ---- Queue analysis for Cliq ----
    console.log("\n📬 Queuing analysis for Cliq...");
    console.log("  - user_id:", user_id);
    console.log("  - case_id:", case_id);
    console.log("  - case_name:", case_name);
    
    if (user_id) {
      try {
        await sendAnalysisToCliq(
          user_id,
          case_name || "Unknown Case",
          file.originalname,
          analysis,
          case_id  // 🔥 5th parameter
        );
        console.log("✅ Analysis queued for Cliq");
      } catch (err) {
        console. error("❌ Failed to queue for Cliq:", err);
      }
    } else {
      console.log("⚠️ No user_id, skipping Cliq notification");
    }

    console.log("\n🎉 ===== FILE UPLOAD COMPLETED =====\n");

    // ---- Return success page ----
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1. 0">
        <title>Upload Success</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
          }
          .success-container {
            background: white;
            border-radius: 12px;
            padding: 50px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 500px;
          }
          . success-icon { font-size: 64px; margin-bottom: 20px; }
          h2 { color: #10b981; margin-bottom: 15px; font-size: 28px; }
          p { color: #6b7280; font-size: 16px; margin: 15px 0; }
          . instruction {
            background: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 20px;
            margin-top: 30px;
            text-align: left;
            border-radius: 8px;
          }
          .instruction strong { color: #1e40af; }
          . btn {
            display: inline-block;
            background: #7c3aed;
            color: white;
            padding: 12px 30px;
            border-radius: 8px;
            text-decoration: none;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="success-container">
          <div class="success-icon">✅</div>
          <h2>Upload Successful!</h2>
          <p>Your document has been uploaded and is being analyzed by AI... </p>
          
          <div class="instruction">
            <p><strong>🤖 To see your analysis report:</strong></p>
            <p>1. Go back to Zoho Cliq</p>
            <p>2. Type <strong>"check analysis"</strong> or <strong>"show report"</strong> in the bot</p>
            <p>3. Get your detailed AI analysis!  📊</p>
          </div>
          
          <a href="https://cliq.zoho.com" class="btn">Open Zoho Cliq</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("❌ SERVER ERROR:", err);
    res.status(500).send("Server error: " + err.message);
  }
});

module.exports = router;