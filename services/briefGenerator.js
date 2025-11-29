// services/briefGenerator.js
const { client: openai } = require("./openaiClient");
const supabase = require("./supabaseClient");

async function generateLegalBrief(caseId) {
  console.log("\n⚖️ ===== GENERATING LEGAL BRIEF =====");
  console.log("Case ID:", caseId);

  try {
    // 1. Get case data with all documents and analyses
    const { data: caseData, error: caseError } = await supabase
      . from("cases")
      .select(`
        *,
        documents (
          id,
          file_name,
          text_content,
          created_at
        )
      `)
      .eq("id", caseId)
      .single();

    if (caseError) {
      console.error("❌ Error fetching case:", caseError);
      throw caseError;
    }

    if (!caseData || !caseData.documents || caseData.documents.length === 0) {
      throw new Error("No documents found for this case");
    }

    console.log(`✅ Found case: ${caseData.name}`);
    console.log(`📄 Documents: ${caseData.documents. length}`);

    // 2. Get all document analyses from notification history
    // (We'll compile text from documents for now)
    const documentsText = caseData.documents
      .map((doc, index) => {
        const preview = doc.text_content.substring(0, 1500); // First 1500 chars
        return `\n--- Document ${index + 1}: ${doc.file_name} ---\n${preview}`;
      })
      .join("\n\n");

    console. log(`📝 Compiled ${documentsText.length} characters from documents`);

    // 3. Build comprehensive prompt for GPT-4
    const prompt = `You are an expert Indian legal brief writer. Generate a professional legal brief for submission to an Indian court. 

**CASE DETAILS:**
- Case Name: ${caseData.name}
- Case Type: ${caseData.description || "General Legal Matter"}
- Number of Documents: ${caseData. documents.length}
- Filing Date: ${new Date(caseData.created_at).toLocaleDateString("en-IN")}

**DOCUMENTS CONTENT:**
${documentsText}

**INSTRUCTIONS:**
Generate a complete, professional legal brief with the following sections.  Use proper legal formatting and language appropriate for Indian courts.

**REQUIRED SECTIONS:**

1. **TITLE & CASE NUMBER**
   Format: "IN THE [COURT NAME]"
   Case No.: [Generate appropriate format like "Civil Suit No.  XXX/2024"]

2. **PARTIES**
   List all parties (Plaintiff/Petitioner vs Defendant/Respondent)
   Include full names and roles

3. **FACTS OF THE CASE**
   Present facts chronologically
   Use numbered points (1., 2., 3., etc.)
   Be specific and detailed
   Include dates wherever mentioned

4. **ISSUES FOR CONSIDERATION**
   List key legal questions
   Format: "a) Whether.. .", "b) Whether...", etc. 

5. **LEGAL ARGUMENTS**
   Present arguments for the plaintiff/petitioner
   Reference relevant sections of law (IPC, CPC, Contract Act, etc.  where applicable)
   Use legal precedents if relevant
   Structure with numbered points

6. **EVIDENCE**
   List all documents submitted as evidence
   Explain relevance of each document
   Reference page numbers if mentioned

7. **PRECEDENTS & CASE LAW**
   Cite relevant Indian case laws if applicable
   If specific cases aren't mentioned, use general legal principles

8. **PRAYER / RELIEF SOUGHT**
   Clear statement of relief sought
   Use proper legal language ("It is therefore humbly prayed...")

**FORMATTING:**
- Use markdown formatting
- Bold section headers
- Use proper legal language
- Be professional and formal
- Length: Comprehensive but concise (aim for 1500-2000 words)
- Do NOT use placeholder text - make reasonable assumptions based on the documents

Generate the complete brief now:`;

    // 4. Call OpenAI GPT-4
    console.log("🤖 Calling GPT-4 to generate brief...");

    const response = await openai. chat.completions.create({
      model: "gpt-4o-mini", // Use gpt-4o for better quality
      messages: [
        {
          role: "system",
          content:
            "You are an expert Indian legal brief writer with 20 years of experience. Generate professional, court-ready legal briefs.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower = more focused and consistent
      max_tokens: 3000,
    });

    const briefContent = response.choices[0]. message.content;
    console. log(`✅ Brief generated: ${briefContent. length} characters`);

    // 5.  Calculate metadata
    const wordCount = briefContent.split(/\s+/).length;
    const sections = briefContent.split("\n## ").length - 1; // Count markdown sections

    const metadata = {
      word_count: wordCount,
      sections_count: sections,
      documents_referenced: caseData.documents.length,
      generated_at: new Date().toISOString(),
      case_name: caseData.name,
      model_used: "gpt-4o-mini",
    };

    // 6. Save to database
    console.log("💾 Saving brief to database.. .");

    const { data: brief, error: briefError } = await supabase
      .from("briefs")
      .insert({
        case_id: caseId,
        content: briefContent,
        metadata: metadata,
      })
      .select()
      .single();

    if (briefError) {
      console.error("❌ Error saving brief:", briefError);
      throw briefError;
    }

    console.log("✅ Brief saved with ID:", brief.id);
    console.log("===== BRIEF GENERATION COMPLETE =====\n");

    return {
      success: true,
      brief: brief,
      metadata: metadata,
    };
  } catch (error) {
    console.error("❌ Brief generation failed:", error);
    throw error;
  }
}

module.exports = { generateLegalBrief };