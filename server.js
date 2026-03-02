require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const PptxGenJS = require("pptxgenjs");

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// 🚀 HEALTH CHECK
// ==========================================
app.get("/", (req, res) => {
  res.send("🚀 SlideForge God-Level Theme Engine Running");
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ==========================================
// 🛠️ UTILS: TEXT & JSON CLEANING
// ==========================================
const cleanText = (text) => {
  if (!text) return "";
  return text.replace(/\*\*/g, "").replace(/\*/g, "").replace(/_/g, "").trim();
};

const extractJSON = (text) => {
  try {
    // Strip markdown formatting (Gemini sometimes wraps responses in ```json ... ```)
    const cleanText = text.replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
    const start = cleanText.indexOf("{");
    const end = cleanText.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON boundaries found");
    
    return JSON.parse(cleanText.substring(start, end + 1));
  } catch (err) {
    console.error("❌ Failed to parse AI response:", text);
    throw new Error("Invalid AI JSON format generated.");
  }
};

// ==========================================
// 🎨 UTILS: IMAGE FETCHING (TIMEOUT SAFE)
// ==========================================
const fetchImageBase64 = async (prompt) => {
  if (!prompt) return null;
  try {
    // Premium modifiers for better AI image generation
    const enhancedPrompt = `${prompt}, high quality, 8k resolution, professional, highly detailed, no text`;
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&nologo=true`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second timeout limit

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  } catch (error) {
    console.log("⚠️ Image generation skipped (timeout or error)");
    return null;
  }
};

// ==========================================
// 🧠 AI GENERATION ROUTE
// ==========================================
app.post("/generate-json", async (req, res) => {
  try {
    const { topic, slideCount = 6 } = req.body;
    if (!topic) return res.status(400).json({ error: "Topic required" });

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const isSingleSlide = slideCount === 1;
    
    const contextPrompt = isSingleSlide
      ? `You are an elite presentation designer. Create EXACTLY 1 highly detailed slide about "${topic}". Do not create a title slide. This is a content slide.`
      : `You are a world-class McKinsey-level presentation designer. Create a brilliant ${slideCount}-slide executive deck about "${topic}". Ensure a logical story arc: Hook -> Context -> Core Concepts -> Future/Case Study -> Summary.`;

    const prompt = `
${contextPrompt}

CRITICAL RULES:
1. NO MARKDOWN ALLOWED. Do not use ** or * anywhere.
2. "heading" MUST be punchy and short (Max 5 words).
3. "points" MUST be EXACTLY 3 bullet points. Max 12 words per point. Be insightful, not generic.
4. "icon" MUST be a single appropriate premium emoji (like 📊, 🧠, ⚡, 🌐, 🚀).
5. "imagePrompt" MUST be highly descriptive for an AI image generator (e.g., "Cinematic lighting, modern corporate office, abstract geometry, deep blue tones").
6. Return ONLY valid JSON matching the format below.

FORMAT REQUIREMENTS:
{
 "title": "Main Presentation Title (Keep short)",
 "slides": [
  {
   "type": "intro | content | image | summary",
   "heading": "Short Heading",
   "icon": "💎",
   "points": ["Point one is insightful", "Point two is actionable", "Point three is compelling"],
   "speakerNotes": "Detailed, charismatic script for the presenter to read.",
   "imagePrompt": "Cinematic visual of [subject], 8k, photorealistic"
  }
 ]
}
`;

    const result = await model.generateContent(prompt);
    const text = await result.response.text();
    const parsedData = extractJSON(text);

    res.json(parsedData);
  } catch (err) {
    console.error("AI Gen Error:", err.message);
    res.status(500).json({ error: "AI Generation failed. Please try again." });
  }
});

// ==========================================
// 👑 PPTX RENDER ENGINE
// ==========================================
app.post("/download-ppt", async (req, res) => {
  try {
    const { data, template } = req.body;
    const activeTheme = template || "modern";

    if (!data || !Array.isArray(data.slides)) {
      return res.status(400).json({ error: "Invalid slide data provided." });
    }

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9"; // W: 10, H: 5.625

    // Fetch images in parallel for maximum speed
    const slides = await Promise.all(
      data.slides.map(async (s) => ({
        ...s,
        base64Image: await fetchImageBase64(s.imagePrompt),
      }))
    );

    const safeTitle = cleanText(data.title || "Executive Briefing");

    // ==========================================
    // 🎨 THEME CONFIGURATIONS
    // ==========================================
    const THEMES = {
      modern: {
        bg: "09090B", text: "FFFFFF", accent: "6366F1", secondary: "94A3B8", font: "Helvetica",
      },
      business: {
        bg: "0F172A", text: "F8FAFC", accent: "38BDF8", secondary: "CBD5E1", font: "Arial",
      },
      academic: {
        bg: "FDFBF7", text: "1E293B", accent: "0F766E", secondary: "475569", font: "Georgia",
      }
    };

    const tConfig = THEMES[activeTheme];

    // ==========================================
    // 1️⃣ COVER SLIDE
    // ==========================================
    const cover = pptx.addSlide();
    cover.background = { fill: tConfig.bg };

    if (activeTheme === "modern") {
      cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.15, fill: { color: tConfig.accent } });
      cover.addText(safeTitle.toUpperCase(), { x: 1, y: 2.2, w: 8, h: 1.5, fontSize: 44, bold: true, color: tConfig.text, fontFace: tConfig.font, align: "center", charSpacing: 2 });
    } 
    else if (activeTheme === "business") {
      cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.4, h: "100%", fill: { color: tConfig.accent } });
      cover.addText(safeTitle, { x: 1.2, y: 2.2, w: 8, h: 1.5, fontSize: 48, bold: true, color: tConfig.text, fontFace: tConfig.font, align: "left" });
    } 
    else if (activeTheme === "academic") {
      cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.2, fill: { color: "1E293B" } });
      cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0.2, w: "100%", h: 0.05, fill: { color: tConfig.accent } });
      cover.addText(safeTitle, { x: 1, y: 2.2, w: 8, h: 1.5, fontSize: 42, bold: true, color: tConfig.text, fontFace: tConfig.font, align: "center" });
    }

    // ==========================================
    // 2️⃣ DYNAMIC CONTENT SLIDES
    // ==========================================
    slides.forEach((slide, index) => {
      const s = pptx.addSlide();
      
      // ✅ FIX: Force "image" layout to act as "content" so bullets NEVER disappear
      let layout = slide.type || "content";
      if (layout === "image") layout = "content"; 
      
      const rawHeading = cleanText(slide.heading || "");
      const icon = slide.icon || "🔹"; 
      const headingText = `${icon}  ${rawHeading}`; 
      const pointsArray = (slide.points || []).map(cleanText);

      // Add Speaker Notes
      if (slide.speakerNotes) s.addNotes(cleanText(slide.speakerNotes));

      // Global Slide Numbering
      s.addText(`${index + 1} / ${slides.length}`, { 
        x: 9.0, y: 5.2, w: 0.8, h: 0.3, 
        fontSize: 10, color: tConfig.secondary, fontFace: tConfig.font, align: "right", bold: true 
      });

      // ---------------------------------------------------------
      // LAYOUT: CONTENT / INTRO
      // ---------------------------------------------------------
      if (layout === "content" || layout === "intro") {
        s.background = { fill: tConfig.bg };

        // Theme-specific background decorators
        if (activeTheme === "business") {
          s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.15, h: "100%", fill: { color: tConfig.accent } });
        } else if (activeTheme === "academic") {
          s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.1, fill: { color: "1E293B" } });
          s.addShape(pptx.ShapeType.rect, { x: 0, y: 0.1, w: "100%", h: 0.02, fill: { color: tConfig.accent } });
        }

        // ✅ FIX: Headings now have larger height (h: 1.4) and start higher (y: 0.4) so they don't overlap lines
        s.addText(headingText, { 
          x: 0.6, y: 0.4, w: 4.8, h: 1.4, 
          fontSize: activeTheme === "modern" ? 34 : 32, 
          bold: true, color: tConfig.text, fontFace: tConfig.font, valign: "top" 
        });
        
        // ✅ FIX: Divider pushed down to y: 1.9
        s.addShape(pptx.ShapeType.rect, { 
          x: 0.6, y: 1.9, w: 1.2, h: 0.03, fill: { color: tConfig.accent } 
        });
        
        // ✅ FIX: Bullets pushed down to y: 2.2
        s.addText(pointsArray.join("\n"), {
          x: 0.6, y: 2.2, w: 4.6, h: 3.0,
          fontSize: 18, color: tConfig.secondary, fontFace: tConfig.font, 
          valign: "top", bullet: { type: 'bullet', characterCode: '2022' }, lineSpacing: 44
        });

        // Image Handling (Right Side)
        if (slide.base64Image) {
          if (activeTheme === "modern") {
            s.addImage({ data: slide.base64Image, x: 5.5, y: 0, w: 4.5, h: 5.625, sizing: { type: "crop", w: 4.5, h: 5.625 } });
          } else if (activeTheme === "business") {
            s.addShape(pptx.ShapeType.rect, { x: 5.75, y: 1.15, w: 3.8, h: 3.8, fill: { color: tConfig.accent } }); 
            s.addImage({ data: slide.base64Image, x: 5.6, y: 1.0, w: 3.8, h: 3.8, sizing: { type: "crop", w: 3.8, h: 3.8 } });
          } else {
            s.addShape(pptx.ShapeType.rect, { x: 5.5, y: 1.0, w: 4.0, h: 3.5, fill: { color: "E2E8F0" } }); 
            s.addImage({ data: slide.base64Image, x: 5.6, y: 1.1, w: 3.8, h: 3.3, sizing: { type: "crop", w: 3.8, h: 3.3 } });
          }
        }
      }

      // ---------------------------------------------------------
      // LAYOUT: SUMMARY (Centered, Impactful)
      // ---------------------------------------------------------
      else if (layout === "summary") {
        s.background = { fill: activeTheme === "modern" ? "18181B" : tConfig.bg };
        
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.15, fill: { color: tConfig.accent } });
        
        s.addText(`🌟 KEY TAKEAWAYS`, { 
          x: 1.5, y: 0.8, w: 7, h: 0.8, 
          fontSize: 26, bold: true, color: tConfig.text, fontFace: tConfig.font, align: "center", charSpacing: 3 
        });
        
        s.addShape(pptx.ShapeType.rect, { x: 4.5, y: 1.6, w: 1.0, h: 0.04, fill: { color: tConfig.accent } });
        
        // ✅ FIX: Centered text box container, but left-aligned bullets so they don't look broken
        s.addText(pointsArray.join("\n"), {
          x: 2.0, y: 2.1, w: 6.0, h: 2.8,
          fontSize: 20, color: tConfig.secondary, fontFace: tConfig.font, 
          valign: "top", align: "left", bullet: { type: 'bullet', characterCode: '2022' }, lineSpacing: 44
        });
      }
    });

    const buffer = await pptx.write("nodebuffer");
    const fileName = (data.title || "Presentation").replace(/[^a-z0-9]/gi, "_");

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}.pptx"`);
    res.send(buffer);
    
  } catch (err) {
    console.error("❌ PPT Generation Error:", err);
    res.status(500).json({ error: "Failed to compile PowerPoint file." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🔥 God-Level Engine running on ${PORT}`));