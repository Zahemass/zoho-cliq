// api/chat.js
const express = require("express");
const router = express.Router();
const supabase = require("../services/supabaseClient");
const { openai } = require("../services/openaiClient");


// Configuration
const EMBED_MODEL = process.env.EMBED_MODEL || "text-embedding-3-small";
const CHAT_MODEL = process.env.CHAT_MODEL || "gpt-4o-mini";
const TOP_K = parseInt(process.env.RAG_TOP_K || "5", 10);
const MAX_CONTEXT_CHARS = parseInt(process.env.RAG_MAX_CONTEXT_CHARS || "3000", 10);

// Helpers
function cosineSim(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math. sqrt(nb));
}

function buildContextText(chunks) {
  let out = "";
  for (const c of chunks) {
    if (out.length + c.chunk_text.length > MAX_CONTEXT_CHARS) break;
    out += `---\n${c.chunk_text}\n`;
  }
  return out;
}

// POST /api/chat
router.post("/", async (req, res) => {
  try {
    let { query, case_id, user_id } = req.body;
    
    console.log("\n===== INCOMING CHAT REQUEST =====");
    console.log("Query:", query);
    console.log("Case ID (provided):", case_id);
    console.log("User ID:", user_id);
    
    if (!query) {
      return res.status(400).json({ error: "Missing `query` in body" });
    }

    // 🔥 AUTO-DETECT CASE IF NOT PROVIDED
    if (!case_id && user_id) {
      console.log("\n🔍 No case_id provided, attempting auto-detect for user:", user_id);
      
      // Try to find most recent document uploaded by this user
      const { data: recentDocs, error: docError } = await supabase
        .from("documents")
        . select("case_id, file_name, created_at")
        .eq("uploaded_by", user_id)
        .order("created_at", { ascending: false })
        . limit(1);
      
      if (docError) {
        console.error("❌ Error fetching recent documents:", docError);
      } else if (recentDocs && recentDocs.length > 0) {
        case_id = recentDocs[0].case_id;
        console.log("✅ Auto-detected case_id:", case_id, "from document:", recentDocs[0]. file_name);
      } else {
        console.log("⚠️ No documents found for user");
      }
    }

    // If still no case_id, return helpful error
    if (!case_id) {
      console.log("❌ No case context available");
      return res.json({ 
        success: false,
        answer: "⚠️ I need some context to answer your question.\n\n" +
                "Please either:\n" +
                "• Upload a document first using `/uploaddocument`\n" +
                "• Or type `/start` to select a case\n\n" +
                "Then I'll be able to answer questions about your legal documents!"
      });
    }

    console.log("✅ Using case_id:", case_id);
    console.log("=================================\n");

    // 1) Create embedding for the query
    console.log("Step 1: Creating query embedding.. .");
    const embResp = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: query,
    });

    const queryEmbedding = embResp. data[0].embedding;
    console.log("✅ Query embedding created, dimension:", queryEmbedding.length);

    // 2) Load document ids for this case
    console.log("\nStep 2: Fetching documents for case_id:", case_id);
    const { data: docs, error: docsErr } = await supabase
      .from("documents")
      .select("id, file_name")
      .eq("case_id", case_id);

    console.log("Documents query result:");
    console.log("- Found:", docs ?  docs.length : 0, "documents");
    console. log("- Documents:", docs);

    if (docsErr) {
      console.error("Supabase fetch documents error:", docsErr);
    }

    let candidateChunks = [];

    if (docs && docs.length > 0) {
      const docIds = docs.map((d) => d.id);
      console.log("- Document IDs:", docIds);

      // 3) Fetch embeddings for those document ids
      console.log("\nStep 3: Fetching embeddings for", docIds.length, "documents");
      const { data: embRows, error: embErr } = await supabase
        . from("doc_embeddings")
        .select("document_id, chunk_index, chunk_text, embedding")
        .in("document_id", docIds);

      console.log("Embeddings query result:");
      console.log("- Found:", embRows ? embRows.length : 0, "embedding rows");
      
      if (embRows && embRows.length > 0) {
        console.log("- First embedding sample:");
        console.log("  - document_id:", embRows[0].document_id);
        console.log("  - chunk_index:", embRows[0]. chunk_index);
        console. log("  - chunk_text length:", embRows[0].chunk_text ?  embRows[0].chunk_text.length : 0);
        console.log("  - chunk_text preview:", embRows[0]. chunk_text ? embRows[0].chunk_text.substring(0, 100) : "");
      }

      if (embErr) {
        console.error("Supabase fetch embeddings error:", embErr);
      } else if (embRows && embRows.length > 0) {
        // 4) compute similarity and pick top-K
        console.log("\nStep 4: Computing similarities.. .");
        for (const r of embRows) {
          let embedding = r.embedding;
          
          // Parse embedding if it's a string
          if (typeof embedding === 'string') {
            try {
              embedding = JSON.parse(embedding);
            } catch (e) {
              console.warn("  ⚠️ Failed to parse embedding for chunk:", r.chunk_index);
              continue;
            }
          }
          
          // Validate embedding is an array
          if (!embedding || !Array.isArray(embedding)) {
            console.warn("  ⚠️ Skipping invalid embedding for chunk:", r.chunk_index);
            continue;
          }
          
          const sim = cosineSim(queryEmbedding, embedding);
          candidateChunks. push({
            document_id: r.document_id,
            chunk_index: r.chunk_index,
            chunk_text: r.chunk_text,
            similarity: sim,
          });
        }

        candidateChunks. sort((a, b) => b.similarity - a.similarity);
        console.log("✅ Computed", candidateChunks.length, "similarities");
        if (candidateChunks. length > 0) {
          console.log("Top 3 matches:", candidateChunks. slice(0, 3).map(c => ({
            chunk: c.chunk_index,
            similarity: c.similarity. toFixed(4),
            preview: c.chunk_text.substring(0, 60) + "..."
          })));
        }
      }
    } else {
      console.log("⚠️ No documents found for this case");
    }

    // 5) Build prompt context
    let chosen = candidateChunks.slice(0, TOP_K);
    let contextText = "";
    if (chosen.length > 0) {
      contextText = buildContextText(chosen);
    }

    console.log("\nStep 5: Building context");
    console.log("- Chunks chosen:", chosen.length);
    console.log("- Context length:", contextText.length, "chars");

    // 6) Create final prompt/messages
    let messages = [
      {
        role: "system",
        content:
          "You are a Legal AI assistant. Use ONLY the provided context from case documents to answer the user's question. If the answer is not present in the context, be honest and say you couldn't find it.  Keep answers concise and cite relevant sections when appropriate.",
      },
    ];

    if (contextText && contextText.trim().length > 0) {
      messages.push({
        role: "system",
        content: `Context (DOCUMENT EXCERPTS):\n${contextText}`,
      });
      console.log("✅ Context added to prompt");
    } else {
      console.log("⚠️ No context available - answering without document context");
    }

    messages.push({
      role: "user",
      content: `User question: ${query}`,
    });

    // 7) Call OpenAI chat completion
    console.log("\nStep 6: Calling OpenAI...");
    const chatResp = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: messages,
      max_tokens: 1024,
      temperature: 0,
    });

    const answer =
      chatResp && chatResp. choices && chatResp.choices. length > 0
        ? chatResp.choices[0].message.content
        : "Sorry, I couldn't generate a reply.";

    console.log("✅ Answer generated");
    console. log("Answer preview:", answer.substring(0, 100) + "...");
    console.log("=================================\n");

    // 8) Return answer
    return res.json({
      success: true,
      answer,
      debug: {
        case_id_used: case_id,
        auto_detected: ! req.body.case_id && !!user_id,
        context_chunks_count: chosen.length,
        top_chunks: chosen.map((c) => ({
          similarity: c.similarity,
          chunk_index: c.chunk_index,
          snippet: c.chunk_text.slice(0, 240),
        })),
      },
    });
  } catch (err) {
    console.error("❌ Chat route error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

module.exports = router;