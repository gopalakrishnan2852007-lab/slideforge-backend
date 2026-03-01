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

// ================= TEXT CLEANER (FIXES THE ** BUG) =================
// This completely strips out unwanted markdown like **, _, or *
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

    // STRICT PROMPT: Stops the AI from using Markdown and forces short text
    const prompt = `
You are a world-class executive designer for Apple and Stripe. Create an Ultra-Premium 6-slide presentation about "${topic}".

CRITICAL RULES:
1. NO MARKDOWN. NEVER use **asterisks**, bolding, or italics anywhere.
2. "heading" MUST be under 5 words.
3. "points" MUST be exactly 3 bullet points. Each point MUST be strictly under 12 words.
4. Keep speaker notes detailed and professional.
5. Return ONLY valid JSON.

FORMAT:
{
 "title":"Presentation Title",
 "slides":[
  {
   "type":"intro | content | image | summary",
   "heading":"Short heading",
   "points":["Clean point 1", "Clean point 2", "Clean point 3"],
   "speakerNotes":"Detailed explanation",
   "imagePrompt":"Cinematic, highly detailed, photorealistic corporate image of [subject]"
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

// ================= GOD LEVEL PPT GENERATION =================
app.post("/download-ppt", async (req, res) => {
  try {
    const { data } = req.body;

    if (!data || !Array.isArray(data.slides)) {
      return res.status(400).json({ error: "Invalid slide data" });
    }

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9"; // 10 x 5.625 inches

    const slides = await Promise.all(
      data.slides.map(async (s) => ({
        ...s,
        base64Image: await fetchImageBase64(s.imagePrompt),
      }))
    );

    // ==========================================
    // COVER SLIDE (Cinematic Intro)
    // ==========================================
    const cover = pptx.addSlide();
    cover.background = { fill: "050505" }; // Pure deep space obsidian

    // Glowing Neon Accent Top Line
    cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.1, fill: { color: "6366F1" } }); 

    // Abstract left block
    cover.addShape(pptx.ShapeType.rect, { x: 1, y: 1.5, w: 0.1, h: 2.5, fill: { color: "06B6D4" } }); 

    const safeTitle = cleanText(data.title || "Executive Briefing").toUpperCase();

    cover.addText(safeTitle, {
      x: 1.3, y: 1.5, w: 8, h: 2,
      fontSize: 48, bold: true, color: "FFFFFF", fontFace: "Helvetica Neue", valign: "middle",
    });

    cover.addText("SLIDEFORGE AI • STRATEGIC OVERVIEW", {
      x: 1.3, y: 3.6, w: 8, h: 0.5,
      fontSize: 12, bold: true, color: "64748B", fontFace: "Courier New", tracking: 3
    });

    // ==========================================
    // DYNAMIC SLIDES
    // ==========================================
    slides.forEach((slide, index) => {
      const s = pptx.addSlide();
      const layout = slide.type || "content";
      const headingText = cleanText(slide.heading || "");
      const pointsArray = (slide.points || []).map(cleanText); // Cleans all bullet points

      if (slide.speakerNotes) s.addNotes(cleanText(slide.speakerNotes));

      // Global Slide Master Aesthetics (Applies to all content slides)
      if (layout !== "image") {
        s.background = { fill: "0B0F19" }; // Rich dark slate
        // Global subtle footer line
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 5.3, w: "100%", h: 0.02, fill: { color: "1E293B" } });
        // Slide number
        s.addText(`0${index + 1}`, { x: 9.0, y: 5.1, w: 0.5, h: 0.3, fontSize: 10, color: "475569", fontFace: "Helvetica Neue", align: "right" });
      }

      // ===== 1. INTRO SLIDE =====
      if (layout === "intro") {
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.15, h: "100%", fill: { color: "6366F1" } }); // Left Indigo Bar

        s.addText(headingText, {
          x: 1, y: 1.2, w: 8, h: 1,
          fontSize: 40, bold: true, color: "FFFFFF", fontFace: "Helvetica Neue", valign: "top"
        });

        s.addText(pointsArray.join("\n\n"), {
          x: 1, y: 2.5, w: 8, h: 2,
          fontSize: 22, color: "94A3B8", fontFace: "Helvetica Neue", valign: "top", lineSpacing: 34
        });
      }

      // ===== 2. CORE CONTENT SLIDE (FIXED SPACING & OVERLAPPING) =====
      else if (layout === "content") {
        // STRICT TOP BOUNDARY FOR HEADING (Will never overlap bullets)
        s.addText(headingText, {
          x: 0.6, y: 0.6, w: 5.0, h: 0.8,
          fontSize: 34, bold: true, color: "FFFFFF", fontFace: "Helvetica Neue", valign: "top"
        });

        // Elegant Divider Line
        s.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.5, w: 1.0, h: 0.03, fill: { color: "06B6D4" } }); // Cyan line

        // STRICT LOWER BOUNDARY FOR BULLETS
        s.addText(pointsArray.join("\n"), {
          x: 0.6, y: 1.8, w: 5.0, h: 3.2,
          fontSize: 18, color: "CBD5E1", fontFace: "Helvetica Neue", valign: "top",
          bullet: { type: "bullet", color: "6366F1" }, // Custom Indigo bullets
          lineSpacing: 36 // Perfect gap between points
        });

        // Premium Right-Side Image Framing
        if (slide.base64Image) {
          // Subtle drop shadow box behind image
          s.addShape(pptx.ShapeType.rect, { x: 5.95, y: 0.75, w: 3.6, h: 4.0, fill: { color: "6366F1", transparency: 20 } });
          // The actual image
          s.addImage({
            data: slide.base64Image,
            x: 5.8, y: 0.6, w: 3.6, h: 4.0,
            sizing: { type: "crop", w: 3.6, h: 4.0 }
          });
        }
      }

      // ===== 3. CINEMATIC IMAGE SLIDE =====
      else if (layout === "image") {
        s.background = { fill: "000000" };

        if (slide.base64Image) {
          // Full bleed image covering entire slide
          s.addImage({ data: slide.base64Image, x: 0, y: 0, w: 10, h: 5.625, sizing: { type: "crop", w: 10, h: 5.625 } });
        }

        // Dark gradient overlay at bottom for text readability
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 3.8, w: 10, h: 1.825, fill: { color: "000000", transparency: 30 } });

        s.addText(headingText, {
          x: 0.5, y: 4.2, w: 9, h: 1,
          fontSize: 36, bold: true, color: "FFFFFF", fontFace: "Helvetica Neue", align: "center", shadow: { type: "outer", opacity: 0.8 }
        });
      }

      // ===== 4. SUMMARY / KEY TAKEAWAYS =====
      else {
        s.background = { fill: "F8FAFC" }; // Bright contrast for finale

        // Executive Light Theme Layout
        s.addShape(pptx.ShapeType.rect, { x: 1, y: 0, w: 8, h: 0.1, fill: { color: "06B6D4" } });

        s.addText("KEY TAKEAWAYS", {
          x: 1.5, y: 0.8, w: 7, h: 0.6,
          fontSize: 24, bold: true, color: "0F172A", fontFace: "Helvetica Neue", align: "center", tracking: 2
        });

        s.addShape(pptx.ShapeType.rect, { x: 4.5, y: 1.5, w: 1.0, h: 0.02, fill: { color: "6366F1" } }); // Centered divider

        s.addText(pointsArray.join("\n"), {
          x: 1.5, y: 2.0, w: 7, h: 2.5,
          fontSize: 20, color: "334155", fontFace: "Helvetica Neue", valign: "top", align: "center",
          bullet: { type: "bullet", color: "6366F1" }, lineSpacing: 40
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
  console.log(`🔥 SlideForge Ultra Premium running on ${PORT}`)
);