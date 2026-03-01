require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const PptxGenJS = require("pptxgenjs");

const app = express();
app.use(cors());
app.use(express.json());

// ================= HEALTH =================
app.get("/", (req, res) => {
  res.send("🚀 SlideForge God-Level Theme Engine Running");
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ================= TEXT CLEANER =================
const cleanText = (text) => {
  if (!text) return "";
  return text.replace(/\*\*/g, "").replace(/\*/g, "").replace(/_/g, "").trim();
};

// ================= JSON SAFE PARSER =================
const extractJSON = (text) => {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON found");
    return JSON.parse(text.substring(start, end + 1));
  } catch (err) {
    console.error("Failed to parse AI response:", text);
    throw new Error("Invalid AI JSON format");
  }
};

// ================= IMAGE FETCH (TIMEOUT SAFE) =================
const fetchImageBase64 = async (prompt) => {
  try {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      prompt
    )}?width=1024&height=1024&nologo=true`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  } catch {
    console.log("⚠️ Image skipped due to timeout");
    return null;
  }
};

// ================= AI GENERATION (NOW WITH ICONS) =================
app.post("/generate-json", async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) return res.status(400).json({ error: "Topic required" });

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
You are a world-class presentation designer. Create a 6-slide executive deck about "${topic}".

CRITICAL RULES:
1. NO MARKDOWN ALLOWED. Do not use ** or * anywhere.
2. "heading" MUST be extremely short (Max 4 words).
3. "points" MUST be exactly 3 bullet points. Max 10 words per point.
4. "icon" MUST be a single appropriate premium emoji (like 📊, 🧠, ⚡, 🌐).
5. Return ONLY valid JSON.

FORMAT:
{
 "title":"Presentation Title",
 "slides":[
  {
   "type":"intro | content | image | summary",
   "heading":"Short Heading",
   "icon":"💎",
   "points":["Point one is short", "Point two is short", "Point three is short"],
   "speakerNotes":"Detailed explanation for the presenter to read.",
   "imagePrompt":"Cinematic corporate image of [subject]"
  }
 ]
}
`;

    const result = await model.generateContent(prompt);
    const text = await result.response.text();

    res.json(extractJSON(text));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI Generation failed" });
  }
});

// ================= THE FLAWLESS TRIPLE-THEME ENGINE =================
app.post("/download-ppt", async (req, res) => {
  try {
    const { data, template } = req.body; // Extracting the chosen theme from frontend!
    const activeTheme = template || "modern"; // Default to modern if none passed

    if (!data || !Array.isArray(data.slides)) {
      return res.status(400).json({ error: "Invalid slide data" });
    }

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9"; // W: 10, H: 5.625

    // Parallel Image Fetching
    const slides = await Promise.all(
      data.slides.map(async (s) => ({
        ...s,
        base64Image: await fetchImageBase64(s.imagePrompt),
      }))
    );

    const safeTitle = cleanText(data.title || "Executive Briefing").toUpperCase();

    // ==========================================
    // COVER SLIDE (THEME DEPENDENT)
    // ==========================================
    const cover = pptx.addSlide();

    if (activeTheme === "modern") {
      cover.background = { fill: "09090B" }; // Deep Midnight
      cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.1, fill: { color: "EC4899" } }); // Pink Top
      cover.addText(safeTitle, { x: 1, y: 2, w: 8, h: 1.5, fontSize: 48, bold: true, color: "FFFFFF", fontFace: "Arial", align: "center" });
    } 
    else if (activeTheme === "business") {
      cover.background = { fill: "0B101E" }; // Executive Navy
      cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.3, h: "100%", fill: { color: "2563EB" } }); // Blue Side Bar
      cover.addText(safeTitle, { x: 1, y: 2, w: 8, h: 1.5, fontSize: 44, bold: true, color: "FFFFFF", fontFace: "Arial", align: "left" });
    } 
    else if (activeTheme === "academic") {
      cover.background = { fill: "FDFBF7" }; // Ivory Paper
      cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.2, fill: { color: "1A2E44" } }); // Oxford Blue Top
      cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0.2, w: "100%", h: 0.03, fill: { color: "8B1E0F" } }); // Crimson Sub Line
      cover.addText(safeTitle, { x: 1, y: 2, w: 8, h: 1.5, fontSize: 42, bold: true, color: "1A2E44", fontFace: "Georgia", align: "center" });
    }

    // ==========================================
    // DYNAMIC CONTENT SLIDES
    // ==========================================
    slides.forEach((slide, index) => {
      const s = pptx.addSlide();
      const layout = slide.type || "content";
      
      const rawHeading = cleanText(slide.heading || "");
      const icon = slide.icon || "🔹"; 
      const headingText = `${icon}  ${rawHeading}`; // Append AI Icon to Heading
      
      const pointsArray = (slide.points || []).map(cleanText);

      if (slide.speakerNotes) s.addNotes(cleanText(slide.speakerNotes));

      // ---------------------------------------------------------
      // THEME 1: MODERN (Neon Pink/Purple, Dark, Sleek)
      // ---------------------------------------------------------
      if (activeTheme === "modern") {
        s.background = { fill: "09090B" };
        s.addText(`0${index + 1}`, { x: 9.2, y: 5.1, w: 0.5, h: 0.3, fontSize: 10, color: "475569", fontFace: "Arial", align: "right" });

        if (layout === "content" || layout === "intro") {
          // Locked Heading Area
          s.addText(headingText, { x: 0.5, y: 0.5, w: 5.0, h: 1.0, fontSize: 34, bold: true, color: "FFFFFF", fontFace: "Arial", valign: "top" });
          
          // Divider Line (Safely below heading)
          s.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.6, w: 1.5, h: 0.03, fill: { color: "EC4899" } }); // Neon Pink
          
          // Locked Bullets Area
          s.addText(pointsArray.join("\n"), {
            x: 0.5, y: 1.9, w: 4.8, h: 3.2,
            fontSize: 20, color: "CBD5E1", fontFace: "Arial", valign: "top", bullet: true, lineSpacing: 40
          });

          // Edge-to-Edge Right Image
          if (slide.base64Image) {
            s.addImage({ data: slide.base64Image, x: 5.5, y: 0, w: 4.5, h: 5.625, sizing: { type: "crop", w: 4.5, h: 5.625 } });
          }
        }
      }

      // ---------------------------------------------------------
      // THEME 2: BUSINESS (Navy Background, Corporate Blue/Gold)
      // ---------------------------------------------------------
      else if (activeTheme === "business") {
        s.background = { fill: "0B101E" };
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.15, h: "100%", fill: { color: "2563EB" } }); // Blue side stripe
        s.addText(`SLIDE / 0${index + 1}`, { x: 8.5, y: 5.1, w: 1.0, h: 0.3, fontSize: 10, color: "4B5563", fontFace: "Arial", align: "right" });

        if (layout === "content" || layout === "intro") {
          // Locked Heading Area
          s.addText(headingText, { x: 0.6, y: 0.5, w: 5.0, h: 1.0, fontSize: 32, bold: true, color: "FFFFFF", fontFace: "Arial", valign: "top" });
          
          // Divider Line
          s.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.6, w: 1.0, h: 0.04, fill: { color: "F59E0B" } }); // Gold
          
          // Locked Bullets Area
          s.addText(pointsArray.join("\n"), {
            x: 0.6, y: 1.9, w: 4.8, h: 3.2,
            fontSize: 18, color: "D1D5DB", fontFace: "Arial", valign: "top", bullet: true, lineSpacing: 40
          });

          // Gold Shadow Framed Image
          if (slide.base64Image) {
            s.addShape(pptx.ShapeType.rect, { x: 5.85, y: 1.05, w: 3.6, h: 3.6, fill: { color: "F59E0B" } }); // Gold shadow
            s.addImage({ data: slide.base64Image, x: 5.7, y: 0.9, w: 3.6, h: 3.6, sizing: { type: "crop", w: 3.6, h: 3.6 } });
          }
        }
      }

      // ---------------------------------------------------------
      // THEME 3: ACADEMIC (Ivory Paper, Navy/Crimson, Georgia Font)
      // ---------------------------------------------------------
      else if (activeTheme === "academic") {
        s.background = { fill: "FDFBF7" }; // Ivory
        
        // Classic Top Borders
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.15, fill: { color: "1A2E44" } }); // Navy
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0.15, w: "100%", h: 0.02, fill: { color: "8B1E0F" } }); // Crimson
        
        // Roman Numeral Footer
        const numerals = ["I", "II", "III", "IV", "V", "VI", "VII"];
        s.addText(numerals[index], { x: 9.0, y: 5.1, w: 0.5, h: 0.3, fontSize: 12, bold: true, color: "1A2E44", fontFace: "Georgia", align: "right" });

        if (layout === "content" || layout === "intro") {
          // Locked Heading Area (Georgia Font)
          s.addText(headingText, { x: 0.5, y: 0.5, w: 5.0, h: 1.0, fontSize: 32, bold: true, color: "1A2E44", fontFace: "Georgia", valign: "top" });
          
          // Divider Line
          s.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.6, w: 2.0, h: 0.02, fill: { color: "8B1E0F" } }); // Crimson
          
          // Locked Bullets Area (Dark Grey Text)
          s.addText(pointsArray.join("\n"), {
            x: 0.5, y: 1.9, w: 4.8, h: 3.2,
            fontSize: 18, color: "334155", fontFace: "Georgia", valign: "top", bullet: true, lineSpacing: 40
          });

          // Elegant Grey Framed Image
          if (slide.base64Image) {
            s.addShape(pptx.ShapeType.rect, { x: 5.6, y: 1.0, w: 4.0, h: 3.0, fill: { color: "E2E8F0" } }); // Grey Frame
            s.addImage({ data: slide.base64Image, x: 5.7, y: 1.1, w: 3.8, h: 2.8, sizing: { type: "crop", w: 3.8, h: 2.8 } });
          }
        }
      }

      // ==========================================
      // GLOBAL FALLBACKS (If layout is image/summary)
      // ==========================================
      if (layout === "image") {
        s.background = { fill: "000000" };
        if (slide.base64Image) {
          s.addImage({ data: slide.base64Image, x: 0, y: 0, w: 10, h: 5.625, sizing: { type: "crop", w: 10, h: 5.625 } });
        }
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 4.0, w: 10, h: 1.625, fill: { color: "000000", transparency: 50 } });
        s.addText(headingText, { x: 0.5, y: 4.3, w: 9, h: 1, fontSize: 36, bold: true, color: "FFFFFF", fontFace: "Arial", align: "center" });
      }

      if (layout === "summary") {
        s.background = { fill: activeTheme === "academic" ? "FDFBF7" : "FFFFFF" }; // White/Ivory
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.15, fill: { color: activeTheme === "modern" ? "EC4899" : activeTheme === "business" ? "2563EB" : "1A2E44" } });
        
        s.addText(`🌟 KEY TAKEAWAYS`, { x: 1.5, y: 0.8, w: 7, h: 0.8, fontSize: 28, bold: true, color: "0F172A", fontFace: activeTheme === "academic" ? "Georgia" : "Arial", align: "center", tracking: 2 });
        s.addShape(pptx.ShapeType.rect, { x: 4.5, y: 1.6, w: 1.0, h: 0.04, fill: { color: "94A3B8" } });
        
        s.addText(pointsArray.join("\n"), {
          x: 1.5, y: 2.1, w: 7, h: 2.5,
          fontSize: 20, color: "334155", fontFace: activeTheme === "academic" ? "Georgia" : "Arial", valign: "top", align: "center", bullet: true, lineSpacing: 48
        });
      }
    });

    const buffer = await pptx.write("nodebuffer");

    const fileName = (data.title || "presentation").replace(/[^a-z0-9]/gi, "_");

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}.pptx"`);
    res.send(buffer);
  } catch (err) {
    console.error("PPT ERROR:", err);
    res.status(500).json({ error: "PPT generation failed" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🔥 God-Level Engine running on ${PORT}`));