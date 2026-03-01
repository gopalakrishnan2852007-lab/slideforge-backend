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
  res.send("🚀 SlideForge Ultra Premium Backend Running");
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ================= TEXT CLEANER (REMOVES **) =================
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

// ================= IMAGE FETCH =================
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

// ================= AI GENERATION =================
app.post("/generate-json", async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) return res.status(400).json({ error: "Topic required" });

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // STRICT PROMPT: Forces incredibly short text and NO markdown.
    const prompt = `
You are a world-class presentation designer. Create a 6-slide executive deck about "${topic}".

CRITICAL RULES:
1. NO MARKDOWN ALLOWED. Do not use ** or * anywhere.
2. "heading" MUST be extremely short (Max 4 words).
3. "points" MUST be exactly 3 bullet points. Max 10 words per point.
4. Return ONLY valid JSON.

FORMAT:
{
 "title":"Presentation Title",
 "slides":[
  {
   "type":"intro | content | image | summary",
   "heading":"Short Heading",
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

// ================= THE FLAWLESS PPT ENGINE =================
app.post("/download-ppt", async (req, res) => {
  try {
    const { data } = req.body;

    if (!data || !Array.isArray(data.slides)) {
      return res.status(400).json({ error: "Invalid slide data" });
    }

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9"; // 10 inches wide, 5.625 inches high

    // Parallel Image Fetching
    const slides = await Promise.all(
      data.slides.map(async (s) => ({
        ...s,
        base64Image: await fetchImageBase64(s.imagePrompt),
      }))
    );

    // ==========================================
    // COVER SLIDE
    // ==========================================
    const cover = pptx.addSlide();
    cover.background = { fill: "0A0A0A" }; // Ultra Dark Charcoal

    // Sleek God-Level Accent Lines
    cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.15, fill: { color: "00E5FF" } }); // Top Cyan Bar
    cover.addShape(pptx.ShapeType.rect, { x: 0.8, y: 1.5, w: 0.08, h: 2.5, fill: { color: "2563EB" } }); // Left Blue Bar

    const safeTitle = cleanText(data.title || "Executive Briefing").toUpperCase();

    cover.addText(safeTitle, {
      x: 1.2, y: 1.5, w: 8, h: 2.0,
      fontSize: 48, bold: true, color: "FFFFFF", fontFace: "Arial", valign: "middle"
    });

    cover.addText("CONFIDENTIAL STRATEGY DECK", {
      x: 1.2, y: 3.8, w: 8, h: 0.5,
      fontSize: 12, bold: true, color: "94A3B8", fontFace: "Arial", tracking: 3
    });

    // ==========================================
    // DYNAMIC SLIDES
    // ==========================================
    slides.forEach((slide, index) => {
      const s = pptx.addSlide();
      const layout = slide.type || "content";
      
      const headingText = cleanText(slide.heading || "");
      const pointsArray = (slide.points || []).map(cleanText);

      if (slide.speakerNotes) s.addNotes(cleanText(slide.speakerNotes));

      // Global Master Background
      if (layout !== "image") {
        s.background = { fill: "0F111A" }; // Deep Executive Slate
        s.addText(`0${index + 1}`, { x: 9.0, y: 5.1, w: 0.5, h: 0.3, fontSize: 10, color: "475569", fontFace: "Arial", align: "right" });
      }

      // ===== 1. INTRO SLIDE =====
      if (layout === "intro") {
        s.addText(headingText, {
          x: 1, y: 1.0, w: 8, h: 1.2,
          fontSize: 42, bold: true, color: "FFFFFF", fontFace: "Arial", valign: "top"
        });

        s.addText(pointsArray.join("\n\n"), {
          x: 1, y: 2.5, w: 8, h: 2.5,
          fontSize: 24, color: "CBD5E1", fontFace: "Arial", valign: "top"
        });
      }

      // ===== 2. CORE CONTENT (THE STRICT GRID FIX) =====
      else if (layout === "content") {
        
        // 1. HEADING BOX (Locked from Y: 0.5 to 1.7. Huge room, will never hit the line)
        s.addText(headingText, {
          x: 0.6, y: 0.5, w: 4.8, h: 1.2,
          fontSize: 36, bold: true, color: "FFFFFF", fontFace: "Arial", valign: "top"
        });

        // 2. THE DIVIDER LINE (Locked at Y: 1.8. Safely below the heading)
        s.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.8, w: 1.2, h: 0.04, fill: { color: "00E5FF" } });

        // 3. THE BULLET POINTS (Locked from Y: 2.1 down. Flawless standard bullets)
        s.addText(pointsArray.join("\n"), {
          x: 0.6, y: 2.1, w: 4.8, h: 3.0,
          fontSize: 20, color: "E2E8F0", fontFace: "Arial", valign: "top",
          bullet: true, // Uses standard, unbreakable PowerPoint bullets
          lineSpacing: 44 // Perfect spacing between lines
        });

        // 4. THE IMAGE (Right Side)
        if (slide.base64Image) {
          // Elegant Blue back-shadow
          s.addShape(pptx.ShapeType.rect, { x: 5.8, y: 1.1, w: 3.8, h: 3.8, fill: { color: "2563EB" } });
          
          s.addImage({
            data: slide.base64Image,
            x: 5.6, y: 0.9, w: 3.8, h: 3.8,
            sizing: { type: "crop", w: 3.8, h: 3.8 }
          });
        }
      }

      // ===== 3. FULL BLEED IMAGE SLIDE =====
      else if (layout === "image") {
        s.background = { fill: "000000" };

        if (slide.base64Image) {
          s.addImage({ data: slide.base64Image, x: 0, y: 0, w: 10, h: 5.625, sizing: { type: "crop", w: 10, h: 5.625 } });
        }

        s.addShape(pptx.ShapeType.rect, { x: 0, y: 4.0, w: 10, h: 1.625, fill: { color: "000000", transparency: 40 } });

        s.addText(headingText, {
          x: 0.5, y: 4.3, w: 9, h: 1,
          fontSize: 36, bold: true, color: "FFFFFF", fontFace: "Arial", align: "center"
        });
      }

      // ===== 4. SUMMARY SLIDE =====
      else {
        s.background = { fill: "FFFFFF" }; // Bright white finale

        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.15, fill: { color: "2563EB" } });

        s.addText("EXECUTIVE SUMMARY", {
          x: 1.5, y: 0.8, w: 7, h: 0.8,
          fontSize: 28, bold: true, color: "0F172A", fontFace: "Arial", align: "center", tracking: 2
        });

        s.addShape(pptx.ShapeType.rect, { x: 4.5, y: 1.6, w: 1.0, h: 0.04, fill: { color: "00E5FF" } });

        s.addText(pointsArray.join("\n"), {
          x: 1.5, y: 2.1, w: 7, h: 2.5,
          fontSize: 22, color: "334155", fontFace: "Arial", valign: "top", align: "center",
          bullet: true, lineSpacing: 48
        });
      }
    });

    const buffer = await pptx.write("nodebuffer");

    const fileName = (data.title || "presentation").replace(/[^a-z0-9]/gi, "_");

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}.pptx"`
    );

    res.send(buffer);
  } catch (err) {
    console.error("PPT ERROR:", err);
    res.status(500).json({ error: "PPT generation failed" });
  }
});

// ================= PORT =================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🔥 SlideForge God-Level Backend running on ${PORT}`)
);