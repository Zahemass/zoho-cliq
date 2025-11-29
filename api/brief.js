// api/brief.js
const express = require("express");
const router = express. Router();
const { generateLegalBrief } = require("../services/briefGenerator");
const supabase = require("../services/supabaseClient");
const PDFDocument = require('pdfkit');

// ========================================
// POST api (Must come first)
// ========================================

// POST /api/brief/generate
router.post("/generate", async (req, res) => {
  try {
    const { case_id, user_id } = req.body;

    console.log("\n📋 Brief generation request:");
    console.log("- case_id:", case_id);
    console.log("- user_id:", user_id);

    if (!case_id) {
      return res.status(400).json({ error: "case_id is required" });
    }

    // CHECK IF BRIEF ALREADY EXISTS
    console.log("🔍 Checking for existing brief...");
    
    const { data: existingBrief, error: fetchError } = await supabase
      .from("briefs")
      .select("*")
      .eq("case_id", case_id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error("❌ Error checking existing brief:", fetchError);
    }

    if (existingBrief && existingBrief.length > 0) {
      const brief = existingBrief[0];
      const createdAt = new Date(brief. created_at);
      const hoursSinceCreation = (Date.now() - createdAt. getTime()) / (1000 * 60 * 60);

      console.log("✅ Found existing brief (ID:", brief.id, ")");
      console.log("⏰ Created:", hoursSinceCreation. toFixed(1), "hours ago");

      if (hoursSinceCreation < 24) {
        console. log("📦 Returning cached brief (no GPT call)");
        
        return res.json({
          success: true,
          brief: brief,
          cached: true,
          message: "Brief retrieved from cache (generated " + 
                   (hoursSinceCreation < 1 
                     ? Math.round(hoursSinceCreation * 60) + " minutes ago"
                     : Math.round(hoursSinceCreation) + " hours ago") + ")"
        });
      } else {
        console.log("⏰ Brief is too old (>24hrs), regenerating...");
      }
    } else {
      console. log("❌ No existing brief found, generating new one.. .");
    }

    console.log("🤖 Calling GPT-4 to generate new brief...");
    const result = await generateLegalBrief(case_id);

    res.json(result);
  } catch (error) {
    console.error("❌ Brief API error:", error);
    res. status(500).json({
      error: error.message || "Failed to generate brief",
    });
  }
});

// ========================================
// GET api - SPECIFIC PATHS FIRST! 
// ========================================

// 🔥 GET /brief/:id/view - MUST COME BEFORE /:id ROUTE! 
// 🔥 GET /brief/:id/view - BEAUTIFUL DARK MODE WITH MARKDOWN RENDERING
router.get("/:id/view", async (req, res) => {
  try {
    const { id } = req. params;

    const { data: brief, error } = await supabase
      .from("briefs")
      .select("*, cases(*)")
      .eq("id", id)
      .single();

    if (error) throw error;

    if (!brief) {
      return res.status(404).send("Brief not found");
    }

    const html = `
<! DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Legal Brief - ${brief.cases.name}</title>
  
  <!-- Fonts -->
  <link href="https://fonts.googleapis.com/css2? family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  
  <!-- Highlight.js for code syntax (if any) -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  
  <!-- Marked. js for markdown rendering -->
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  
  <!-- DOMPurify for security -->
  <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js"></script>
  
  <style>
    :root {
      --bg-primary: #0f0f23;
      --bg-secondary: #1a1a2e;
      --bg-tertiary: #16213e;
      --bg-card: #1e1e3f;
      --text-primary: #e8e8f0;
      --text-secondary: #a0a0b8;
      --text-muted: #6b6b8a;
      --accent-primary: #7c3aed;
      --accent-secondary: #a78bfa;
      --accent-gradient: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
      --border-color: rgba(167, 139, 250, 0.2);
      --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
      --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.4);
      --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.5);
      --radius-sm: 8px;
      --radius-md: 12px;
      --radius-lg: 16px;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg-primary);
      background-image: 
        radial-gradient(at 0% 0%, rgba(124, 58, 237, 0.15) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(167, 139, 250, 0.15) 0px, transparent 50%);
      color: var(--text-primary);
      line-height: 1.7;
      min-height: 100vh;
      padding: 20px;
      position: relative;
      overflow-x: hidden;
    }

    /* Animated background particles */
    body::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: 
        radial-gradient(circle at 20% 50%, rgba(124, 58, 237, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 80% 80%, rgba(167, 139, 250, 0.1) 0%, transparent 50%);
      animation: floatParticles 20s ease-in-out infinite;
      pointer-events: none;
      z-index: 0;
    }

    @keyframes floatParticles {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(30px, -30px) scale(1.1); }
      66% { transform: translate(-20px, 20px) scale(0.9); }
    }

    . container {
      max-width: 1100px;
      margin: 0 auto;
      background: var(--bg-secondary);
      border-radius: var(--radius-lg);
      overflow: hidden;
      box-shadow: var(--shadow-lg);
      border: 1px solid var(--border-color);
      animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      z-index: 1;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(40px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Header */
    .header {
      background: var(--accent-gradient);
      padding: 50px 60px;
      position: relative;
      overflow: hidden;
    }

    .header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -10%;
      width: 600px;
      height: 600px;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
      border-radius: 50%;
      animation: pulse 8s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 0.3; }
      50% { transform: scale(1.1); opacity: 0.5; }
    }

    . header-content {
      position: relative;
      z-index: 1;
    }

    .header h1 {
      font-size: 42px;
      font-weight: 800;
      margin-bottom: 8px;
      letter-spacing: -1px;
      text-shadow: 0 2px 10px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header . subtitle {
      font-size: 16px;
      opacity: 0.95;
      font-weight: 500;
      margin-bottom: 30px;
    }

    . meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-top: 25px;
    }

    . meta-card {
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(10px);
      border-radius: var(--radius-md);
      padding: 16px 20px;
      border: 1px solid rgba(255,255,255,0.2);
      transition: all 0.3s ease;
    }

    .meta-card:hover {
      background: rgba(255,255,255,0.2);
      transform: translateY(-2px);
    }

    .meta-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.8;
      font-weight: 600;
      margin-bottom: 6px;
    }

    . meta-value {
      font-size: 16px;
      font-weight: 600;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: rgba(255,255,255,0.2);
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      border: 1px solid rgba(255,255,255,0.3);
    }

    /* Content */
    .content {
      padding: 60px;
      background: var(--bg-card);
    }

    .markdown-body {
      color: var(--text-primary);
      font-size: 16px;
      line-height: 1. 8;
    }

    .markdown-body h1,
    .markdown-body h2 {
      font-size: 28px;
      font-weight: 700;
      color: var(--accent-secondary);
      margin-top: 50px;
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 2px solid var(--border-color);
      position: relative;
      letter-spacing: -0.5px;
    }

    .markdown-body h1:first-child,
    .markdown-body h2:first-child {
      margin-top: 0;
    }

    .markdown-body h1::after,
    .markdown-body h2::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      width: 100px;
      height: 2px;
      background: var(--accent-gradient);
    }

    .markdown-body h3 {
      font-size: 20px;
      font-weight: 600;
      color: var(--text-primary);
      margin-top: 35px;
      margin-bottom: 16px;
      padding-left: 16px;
      border-left: 4px solid var(--accent-primary);
    }

    .markdown-body h4 {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-top: 28px;
      margin-bottom: 14px;
    }

    .markdown-body p {
      margin-bottom: 18px;
      color: var(--text-secondary);
    }

    .markdown-body strong {
      color: var(--text-primary);
      font-weight: 600;
    }

    .markdown-body em {
      color: var(--accent-secondary);
      font-style: italic;
    }

    .markdown-body ul,
    .markdown-body ol {
      margin: 20px 0;
      padding-left: 30px;
    }

    .markdown-body li {
      margin-bottom: 12px;
      color: var(--text-secondary);
      line-height: 1.7;
    }

    .markdown-body li::marker {
      color: var(--accent-primary);
      font-weight: 600;
    }

    .markdown-body blockquote {
      margin: 25px 0;
      padding: 20px 24px;
      background: var(--bg-secondary);
      border-left: 4px solid var(--accent-primary);
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      font-style: italic;
    }

    .markdown-body code {
      font-family: 'JetBrains Mono', monospace;
      background: var(--bg-secondary);
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 14px;
      color: var(--accent-secondary);
      border: 1px solid var(--border-color);
    }

    .markdown-body pre {
      background: var(--bg-secondary);
      padding: 20px;
      border-radius: var(--radius-md);
      overflow-x: auto;
      margin: 25px 0;
      border: 1px solid var(--border-color);
    }

    .markdown-body pre code {
      background: none;
      padding: 0;
      border: none;
      color: var(--text-primary);
    }

    .markdown-body hr {
      margin: 40px 0;
      border: none;
      height: 1px;
      background: var(--border-color);
    }

    . markdown-body table {
      width: 100%;
      border-collapse: collapse;
      margin: 25px 0;
    }

    .markdown-body th,
    .markdown-body td {
      padding: 12px;
      border: 1px solid var(--border-color);
      text-align: left;
    }

    .markdown-body th {
      background: var(--bg-secondary);
      font-weight: 600;
      color: var(--accent-secondary);
    }

    /* Actions */
    .actions {
      padding: 40px 60px;
      background: var(--bg-tertiary);
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: center;
      gap: 15px;
      flex-wrap: wrap;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 14px 28px;
      background: var(--accent-gradient);
      color: white;
      text-decoration: none;
      border-radius: var(--radius-md);
      font-size: 15px;
      font-weight: 600;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4);
      border: none;
      cursor: pointer;
      position: relative;
      overflow: hidden;
    }

    .btn::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%);
      opacity: 0;
      transition: opacity 0.3s;
    }

    .btn:hover::before {
      opacity: 1;
    }

    .btn:hover {
      transform: translateY(-3px);
      box-shadow: 0 6px 25px rgba(124, 58, 237, 0.5);
    }

    .btn:active {
      transform: translateY(-1px);
    }

    .btn-secondary {
      background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%);
      box-shadow: 0 4px 15px rgba(74, 85, 104, 0. 4);
    }

    . btn-secondary:hover {
      box-shadow: 0 6px 25px rgba(74, 85, 104, 0. 5);
    }

    /* Theme Toggle */
    .theme-toggle {
      position: fixed;
      top: 30px;
      right: 30px;
      z-index: 1000;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 50px;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      box-shadow: var(--shadow-md);
      transition: all 0.3s ease;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .theme-toggle:hover {
      transform: scale(1.05);
      box-shadow: var(--shadow-lg);
    }

    /* Footer */
    .footer {
      padding: 30px 60px;
      background: var(--bg-primary);
      color: var(--text-secondary);
      text-align: center;
      font-size: 14px;
      border-top: 1px solid var(--border-color);
    }

    .footer-content {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .footer . highlight {
      color: var(--accent-secondary);
      font-weight: 700;
      padding: 6px 16px;
      background: rgba(124, 58, 237, 0.15);
      border-radius: 8px;
      border: 1px solid var(--border-color);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.3s ease;
    }

    .footer .highlight:hover {
      background: rgba(124, 58, 237, 0.25);
      transform: scale(1.05);
    }

    /* Responsive */
    @media (max-width: 768px) {
      body {
        padding: 10px;
      }

      .header, .content, .actions, .footer {
        padding-left: 25px;
        padding-right: 25px;
      }

      .header h1 {
        font-size: 32px;
      }

      . markdown-body {
        font-size: 15px;
      }

      . markdown-body h1,
      .markdown-body h2 {
        font-size: 24px;
      }

      .markdown-body h3 {
        font-size: 18px;
      }

      .actions {
        flex-direction: column;
      }

      .btn {
        width: 100%;
        justify-content: center;
      }

      .theme-toggle {
        top: 15px;
        right: 15px;
        padding: 10px 16px;
        font-size: 12px;
      }

      .meta-grid {
        grid-template-columns: 1fr;
      }
    }

    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .theme-toggle,
      .actions,
      .footer {
        display: none;
      }
      
      .container {
        box-shadow: none;
        border: none;
      }
      
      .header {
        background: #7c3aed;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }

      .content {
        background: white;
        color: black;
      }

      .markdown-body,
      .markdown-body p,
      .markdown-body li {
        color: black;
      }
    }

    /* Loading animation */
    @keyframes shimmer {
      0% { background-position: -1000px 0; }
      100% { background-position: 1000px 0; }
    }

    .loading {
      animation: shimmer 2s infinite;
      background: linear-gradient(
        to right,
        var(--bg-secondary) 0%,
        var(--bg-tertiary) 50%,
        var(--bg-secondary) 100%
      );
      background-size: 1000px 100%;
    }
  </style>
</head>
<body>
  <div class="theme-toggle" onclick="toggleTheme()">
    <span id="theme-icon">🌙</span>
    <span id="theme-text">Dark Mode</span>
  </div>

  <div class="container">
    <div class="header">
      <div class="header-content">
        <h1>⚖️ LEGAL BRIEF</h1>
        <p class="subtitle">AI-Generated Court Document</p>
        
        <div class="meta-grid">
          <div class="meta-card">
            <div class="meta-label">📁 Case Name</div>
            <div class="meta-value">${brief.cases. name}</div>
          </div>
          
          <div class="meta-card">
            <div class="meta-label">📅 Generated</div>
            <div class="meta-value">${new Date(brief.created_at).toLocaleDateString("en-IN", { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            })}</div>
          </div>
          
          <div class="meta-card">
            <div class="meta-label">📊 Statistics</div>
            <div class="meta-value">
              <span class="badge">${brief.metadata.word_count || 'N/A'} words</span>
              <span class="badge">${brief.metadata.sections_count || 'N/A'} sections</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="content">
      <div class="markdown-body" id="markdown-content"></div>
    </div>

    <div class="actions">
      <a href="/brief/${brief.id}/pdf" class="btn">
        <span>📥</span>
        <span>Download PDF</span>
      </a>
      <a href="javascript:window.print()" class="btn btn-secondary">
        <span>🖨️</span>
        <span>Print Brief</span>
      </a>
      <a href="https://cliq.zoho.com" class="btn btn-secondary">
        <span>↩️</span>
        <span>Back to Cliq</span>
      </a>
    </div>

    <div class="footer">
      <div class="footer-content">
        <span>Generated by Legal AI via</span>
        <span class="highlight">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          Zoho Cliq
        </span>
        <span> ${new Date().getFullYear()}</span>
      </div>
    </div>
  </div>

  <script>
    // Marked.js configuration
    marked.setOptions({
      breaks: true,
      gfm: true,
      headerIds: true,
      mangle: false,
      sanitize: false
    });

    // Render markdown content
    const markdownContent = ${JSON.stringify(brief.content)};
    const html = marked. parse(markdownContent);
    const clean = DOMPurify.sanitize(html);
    document.getElementById('markdown-content').innerHTML = clean;

    // Highlight code blocks
    document.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);
    });

    // Theme toggle (optional light mode support)
    function toggleTheme() {
      // Since we're in dark mode only, this could toggle to light mode
      // For now, just show an alert
      alert('Light mode coming soon!  🌞');
    }

    // Smooth scroll reveal
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry. target.style.transform = 'translateY(0)';
        }
      });
    }, observerOptions);

    document.querySelectorAll('. markdown-body > *').forEach(el => {
      el.style.opacity = '0';
      el. style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      observer.observe(el);
    });
  </script>
</body>
</html>
    `;

    res.send(html);
  } catch (error) {
    console.error("❌ View brief error:", error);
    res. status(500).send("Error loading brief");
  }
});

// 🔥 GET /brief/:id/pdf - MUST COME BEFORE /:id ROUTE!
// GET /brief/:id/pdf - Download brief as PDF
router.get("/:id/pdf", async (req, res) => {
  try {
    const { id } = req.params;

    const { data: brief, error } = await supabase
      .from("briefs")
      .select("*, cases(*)")
      .eq("id", id)
      .single();

    if (error) throw error;

    if (!brief) {
      return res.status(404).send("Brief not found");
    }

    // Create PDF
    const doc = new PDFDocument({ 
      margin: 72,  // 1 inch margins
      size: 'A4',
      bufferPages: true  // 🔥 IMPORTANT: Buffer all pages first!
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="legal-brief-${brief.cases.name. replace(/[^a-z0-9]/gi, '-')}.pdf"`
    );

    doc.pipe(res);

    // Header
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .text('LEGAL BRIEF', { align: 'center' });
    
    doc.moveDown(0.5);
    
    doc.fontSize(12)
       . font('Helvetica')
       .text(`Case: ${brief. cases.name}`, { align: 'center' });
    
    doc.fontSize(10)
       .text(`Generated: ${new Date(brief.created_at).toLocaleDateString('en-IN')}`, { 
         align: 'center' 
       });
    
    doc.moveDown(2);

    // Add horizontal line
    doc.moveTo(72, doc.y)
       .lineTo(540, doc.y)
       . stroke();
    
    doc.moveDown(1);

    // Content - clean markdown formatting
    const content = brief.content
      .replace(/#{2,3} /g, '')  // Remove markdown headers
      .replace(/\*\*/g, '');     // Remove bold markers

    doc.fontSize(11)
       .font('Helvetica')
       .text(content, {
         align: 'justify',
         lineGap: 4
       });

    // 🔥 GET PAGE RANGE (AFTER content is added!)
    const range = doc.bufferedPageRange();  // Returns {start: 0, count: 3}
    
    console.log("📄 PDF has", range.count, "pages (from", range.start, "to", range.start + range.count - 1, ")");

    // 🔥 ADD FOOTER TO ALL PAGES (correct loop)
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      
      doc.fontSize(8)
         .font('Helvetica')
         .text(
           `Page ${i + 1} of ${range.count} | Generated by Legal AI`,
           72,
           doc.page.height - 50,
           { align: 'center', width: doc.page.width - 144 }
         );
    }

    // 🔥 FINALIZE PDF
    doc.end();
    
  } catch (error) {
    console.error("❌ PDF generation error:", error);
    
    // Only send error if response hasn't started
    if (!res.headersSent) {
      res.status(500).send("Error generating PDF");
    }
  }
});

// 🔥 GET /brief/case/:caseId - MUST COME BEFORE /:id! 
router.get("/case/:caseId", async (req, res) => {
  try {
    const { caseId } = req.params;

    const { data: briefs, error } = await supabase
      .from("briefs")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ success: true, briefs: briefs || [] });
  } catch (error) {
    console.error("❌ Get case briefs error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 🔥 GET /brief/:id - MUST COME LAST!  (Catch-all)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data: brief, error } = await supabase
      .from("briefs")
      .select("*, cases(*)")
      .eq("id", id)
      .single();

    if (error) throw error;

    if (!brief) {
      return res.status(404).json({ error: "Brief not found" });
    }

    res. json({ success: true, brief });
  } catch (error) {
    console.error("❌ Get brief error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;