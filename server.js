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

// ================= IMAGE FETCH WITH TIMEOUT =================
const fetchImageBase64 = async (prompt) => {
  try {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      prompt
    )}?width=1024&height=1024&nologo=true`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 sec timeout

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  } catch {
    console.log("⚠️ Image generation timed out/failed. Skipping image.");
    return null;
  }
};

// ================= AI CONTENT GENERATION =================
app.post("/generate-json", async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) return res.status(400).json({ error: "Topic required" });

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // STRICT PROMPT: Forces AI to keep text short so it NEVER overflows
    const prompt = `
Create an Ultra-Premium executive presentation about "${topic}".

STRICT RULES TO PREVENT OVERFLOW:
1. "heading" MUST be under 6 words.
2. "points" MUST be exactly 3 bullet points.
3. Each point MUST be strictly under 12 words.
4. Return ONLY valid JSON.

FORMAT:
{
 "title": "Main Presentation Title (Max 6 words)",
 "slides": [
  {
   "type": "intro | content | image | summary",
   "heading": "Short heading",
   "points": ["Short point 1", "Short point 2", "Short point 3"],
   "speakerNotes": "Detailed presenter explanation (can be long).",
   "imagePrompt": "Cinematic, professional, highly detailed, photorealistic image of [subject]"
  }
 ]
}

Ensure the first slide is "intro" and the last slide is "summary".
`;

    const result = await model.generateContent(prompt);
    const text = await result.response.text();

    res.json(extractJSON(text));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI Generation failed" });
  }
});

// ================= PPTX ULTRA-PREMIUM ENGINE =================
app.post("/download-ppt", async (req, res) => {
  try {
    const { data } = req.body;

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9"; // Width: 10, Height: 5.625

    // Parallel fetch images for speed
    const slides = await Promise.all(
      data.slides.map(async (s) => ({
        ...s,
        base64Image: await fetchImageBase64(s.imagePrompt),
      }))
    );

    // ==========================================
    // SLIDE 0: MAIN TITLE COVER
    // ==========================================
    const cover = pptx.addSlide();
    cover.background = { fill: "0B0F19" }; // Deep Obsidian Black

    // Aesthetic Cover Shapes
    cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.15, h: "100%", fill: { color: "00E5FF" } }); // Cyan edge
    cover.addShape(pptx.ShapeType.oval, { x: -2, y: -2, w: 6, h: 6, fill: { color: "1A2235", transparency: 50 } }); // Subtle glow

    cover.addText(data.title.toUpperCase(), {
      x: 1, y: 1.8, w: 8, h: 1.5,
      fontSize: 44, bold: true, color: "FFFFFF", fontFace: "Helvetica", align: "center", valign: "middle"
    });

    cover.addShape(pptx.ShapeType.rect, { x: 4.5, y: 3.4, w: 1, h: 0.05, fill: { color: "00E5FF" } }); // Centered accent line

    cover.addText("EXECUTIVE BRIEFING // SLIDEFORGE AI", {
      x: 1, y: 3.7, w: 8, h: 0.5,
      fontSize: 12, color: "64748B", fontFace: "Courier New", align: "center", tracking: 2
    });

    // ==========================================
    // DYNAMIC SLIDES GENERATION
    // ==========================================
    slides.forEach((slide, index) => {
      const s = pptx.addSlide();
      const layout = slide.type || "content";

      // ALWAYS add speaker notes safely
      if (slide.speakerNotes) s.addNotes(slide.speakerNotes);

      // ------------------------------------------
      // 1. INTRO SLIDE (Text Focus)
      // ------------------------------------------
      if (layout === "intro") {
        s.background = { fill: "0B0F19" };
        
        s.addShape(pptx.ShapeType.rect, { x: 1, y: 1, w: 8, h: 3.625, fill: { color: "131826" } }); // Card background
        s.addShape(pptx.ShapeType.rect, { x: 1, y: 1, w: 0.1, h: 3.625, fill: { color: "00E5FF" } }); // Left edge accent

        s.addText(slide.heading, {
          x: 1.5, y: 1.5, w: 7, h: 1,
          fontSize: 36, bold: true, color: "FFFFFF", fontFace: "Helvetica", valign: "top"
        });

        s.addText(slide.points.join("\n\n"), {
          x: 1.5, y: 2.6, w: 7, h: 1.8,
          fontSize: 18, color: "94A3B8", fontFace: "Helvetica", valign: "top", lineSpacing: 28
        });
      }

      // ------------------------------------------
      // 2. CONTENT SLIDE (The Bread & Butter - NO OVERLAPPING)
      // ------------------------------------------
      else if (layout === "content") {
        s.background = { fill: "0B0F19" };

        // HEADER BOUNDARY (Locked at Y: 0.6, Height: 0.8)
        s.addText(slide.heading, {
          x: 0.6, y: 0.6, w: 5.5, h: 0.8,
          fontSize: 32, bold: true, color: "FFFFFF", fontFace: "Helvetica", valign: "top"
        });

        // ACCENT LINE (Divider)
        s.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.45, w: 1.5, h: 0.03, fill: { color: "00E5FF" } });

        // BULLET POINTS BOUNDARY (Locked at Y: 1.8, Height: 3.2 - Physically impossible to overlap heading)
        s.addText(slide.points.join("\n"), {
          x: 0.6, y: 1.8, w: 5.2, h: 3.2,
          fontSize: 18, color: "CBD5E1", fontFace: "Helvetica", valign: "top", 
          bullet: { type: "bullet", color: "00E5FF" }, lineSpacing: 34
        });

        // PREMIUM IMAGE FRAME (Right Side)
        if (slide.base64Image) {
          // Grey/Cyan shadow box offset behind image
          s.addShape(pptx.ShapeType.rect, { x: 6.3, y: 1.7, w: 3.2, h: 3.2, fill: { color: "00E5FF", transparency: 20 } });
          
          // Actual Image Box
          s.addImage({
            data: slide.base64Image,
            x: 6.1, y: 1.5, w: 3.2, h: 3.2,
            sizing: { type: "crop", w: 3.2, h: 3.2 }
          });
        } else {
          // Fallback box if image fails to load
          s.addShape(pptx.ShapeType.rect, { x: 6.1, y: 1.5, w: 3.2, h: 3.2, fill: { color: "1A2235" } });
          s.addText("VISUAL DATA", { x: 6.1, y: 1.5, w: 3.2, h: 3.2, color: "334155", align: "center", fontSize: 14 });
        }
      }

      // ------------------------------------------
      // 3. IMAGE SLIDE (Full Bleed Cinematic)
      // ------------------------------------------
      else if (layout === "image") {
        s.background = { fill: "000000" };

        if (slide.base64Image) {
          s.addImage({ data: slide.base64Image, x: 0, y: 0, w: 10, h: 5.625, sizing: { type: "crop", w: 10, h: 5.625 } });
        }

        // Dark gradient/transparent overlay block at the bottom so text is readable
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 4.0, w: 10, h: 1.625, fill: { color: "000000", transparency: 40 } });

        s.addText(slide.heading, {
          x: 0.5, y: 4.2, w: 9, h: 0.6,
          fontSize: 30, bold: true, color: "FFFFFF", fontFace: "Helvetica", align: "center", shadow: { type: "outer", opacity: 0.8 }
        });
      }

      // ------------------------------------------
      // 4. SUMMARY SLIDE (Clean Executive Card)
      // ------------------------------------------
      else {
        s.background = { fill: "F1F5F9" }; // Switch to clean platinum white/grey for conclusion

        // Executive Summary Centered Card
        s.addShape(pptx.ShapeType.rect, { x: 1.5, y: 1.0, w: 7.0, h: 3.8, fill: { color: "FFFFFF" } }); // White card
        s.addShape(pptx.ShapeType.rect, { x: 1.5, y: 1.0, w: 7.0, h: 0.05, fill: { color: "00E5FF" } }); // Top cyan border
        s.addShape(pptx.ShapeType.rect, { x: 1.5, y: 1.0, w: 7.0, h: 3.8, line: { color: "E2E8F0", width: 1 }, fill: { type: "none" } }); // Card Border

        s.addText("KEY TAKEAWAYS", {
          x: 1.5, y: 1.3, w: 7, h: 0.6,
          fontSize: 22, bold: true, color: "0F172A", align: "center", tracking: 2
        });

        // Fixed boundaries inside the card
        s.addText(slide.points.join("\n"), {
          x: 2.0, y: 2.0, w: 6.0, h: 2.5,
          fontSize: 18, color: "334155", fontFace: "Helvetica", valign: "top",
          bullet: { type: "bullet", color: "00E5FF" }, lineSpacing: 34
        });
      }

      // ==========================================
      // GLOBAL FOOTER (Slide Numbers)
      // ==========================================
      const isDark = layout !== "summary"; // Summary is white background
      s.addText(`0${index + 1}`, {
        x: 9.0, y: 5.1, w: 0.5, h: 0.3,
        fontSize: 10, fontFace: "Courier New", align: "right",
        color: isDark ? "64748B" : "94A3B8"
      });
    });

    const buffer = await pptx.write("nodebuffer");

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `attachment; filename="${data.title.replace(/[^a-z0-9]/gi, "_")}.pptx"`);
    res.send(buffer);

  } catch (err) {
    console.error("PPT ERROR:", err);
    res.status(500).json({ error: "PPT generation failed" });
  }
});

// ================= PORT =================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🔥 SlideForge Ultra Premium running on ${PORT}`));