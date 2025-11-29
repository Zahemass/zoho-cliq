// api/documents.js
const express = require("express");
const router = express.Router();
const supabase = require("../services/supabaseClient");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const openai = require("../services/openaiClient");
const { parsePdfBuffer, chunkText } = require("../services/pdfJsExtractor");
const { analyzeDocument } = require("../services/documentAnalyzer");  // 🔥 Import analyzer
const { sendAnalysisToCliq } = require("../services/cliqNotifier");  // 🔥 Import notifier

router.post("/upload", upload. single("file"), async (req, res) => {
  try {
    const { case_id, user_id } = req.body;  // 🔥 Also get user_id
    const file = req.file;

    if (!file) return res.status(400).json({ error: "No file received." });
    if (!case_id) return res.status(400).json({ error: "case_id missing" });

    console.log("\n📄 Processing document upload...");
    console. log("- File:", file.originalname);
    console.log("- Case ID:", case_id);
    console.log("- User ID:", user_id);

    const path = `cases/${case_id}/${Date.now()}-${file.originalname}`;
    const bucket = process.env. BUCKET_NAME;

    // Upload PDF
    console.log("☁️ Uploading to storage...");
    const uploadRes = await supabase.storage
      .from(bucket)
      . upload(path, file.buffer, { contentType: "application/pdf" });

    if (uploadRes.error) throw uploadRes.error;
    console.log("✅ File uploaded to storage");

    // Parse PDF
    console.log("📖 Parsing PDF...");
    const text = await parsePdfBuffer(file.buffer);
    console.log(`✅ Extracted ${text.length} characters`);

    // Insert document row
    console.log("💾 Saving document metadata...");
    const docInsert = await supabase
      . from("documents")
      .insert([
        {
          case_id,
          file_name: file.originalname,
          file_size: file.size,
          storage_path: path,
          text_content: text,
          uploaded_by: user_id  // 🔥 Store who uploaded it
        }
      ])
      .select()
      .single();

    const doc = docInsert.data;
    console.log("✅ Document saved, ID:", doc.id);

    // Generate Embeddings
    console.log("🧠 Generating embeddings...");
    const chunks = chunkText(text);
    console.log(`📦 Split into ${chunks.length} chunks`);

    for (let i = 0; i < chunks.length; i++) {
      const embed = await openai.embeddings. create({
        model: process. env.EMBED_MODEL || "text-embedding-3-small",
        input: chunks[i]
      });

      await supabase.from("doc_embeddings").insert([
        {
          document_id: doc.id,
          chunk_index: i,
          chunk_text: chunks[i],
          embedding: embed.data[0].embedding
        }
      ]);
      
      if ((i + 1) % 5 === 0) {
        console.log(`  Progress: ${i + 1}/${chunks.length} chunks embedded`);
      }
    }
    console.log("✅ All embeddings saved");

    // 🔥 ANALYZE DOCUMENT WITH GPT-4
    console.log("\n🤖 Starting AI analysis...");
    
    // Get case name
    const { data: caseData } = await supabase
      . from("cases")
      .select("name")
      .eq("id", case_id)
      .single();
    
    const caseName = caseData ?  caseData.name : "Unknown Case";
    
    try {
      const analysis = await analyzeDocument(text, caseName, file.originalname);
      console.log("✅ Analysis complete");
      
      // 🔥 QUEUE NOTIFICATION FOR CLIQ BOT
      if (user_id) {
        console.log("📬 Queuing analysis for user:", user_id);
        await sendAnalysisToCliq(
          user_id, 
          caseName, 
          file.originalname, 
          analysis,
          case_id  // 🔥 PASS CASE_ID HERE! 
        );
        console.log("✅ Analysis queued for Cliq");
      } else {
        console.log("⚠️ No user_id provided, skipping Cliq notification");
      }
    } catch (analysisError) {
      console. error("❌ Analysis error:", analysisError. message);
      // Continue even if analysis fails
    }

    console.log("🎉 Document processing complete!\n");

    res.json({ 
      uploaded: true, 
      document: doc,
      message: "Document uploaded and analyzed successfully!  Type 'show report' in the bot to see the analysis."
    });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res. status(500).json({ error: err.message });
  }
});

module.exports = router;