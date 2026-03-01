require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const PptxGenJS = require("pptxgenjs");

const app = express();
app.use(cors());
app.use(express.json());

// =========================
// ✅ HEALTH CHECK ROUTE
// =========================
app.get("/", (req, res) => {
  res.send("🚀 Premium SlideForge Backend is Running");
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// =========================
// HELPER: EXTRACT JSON SAFELY
// =========================
const extractJSON = (text) => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    return JSON.parse(text.substring(start, end + 1));
  }
  throw new Error("Failed to parse AI response");
};

// =========================
// HELPER: FETCH AI IMAGE AS BASE64
// =========================
const fetchImageBase64 = async (prompt) => {
  try {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      prompt
    )}?width=1024&height=1024&nologo=true`;

    const response = await fetch(url, { timeout: 10000 }); // 10 sec timeout
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  } catch (error) {
    console.error("Image Fetch Error:", error.message);
    return null; // Return null so PPT still generates without the image
  }
};

// =========================
// GENERATE SLIDES JSON
// =========================
app.post("/generate-json", async (req, res) => {
  try {
    const { topic } = req.body;

    if (!topic) return res.status(400).json({ error: "Topic required" });

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const prompt = `
You are an expert executive presentation designer. Create a premium 6-slide presentation about "${topic}".

IMPORTANT:
Return ONLY valid JSON. No markdown, no backticks, no explanation.

FORMAT:
{
 "title": "Presentation Title",
 "slides": [
   {
     "heading": "Short Title Here",
     "points": [
       "Punchy, high-impact point 1",
       "Punchy, high-impact point 2",
       "Punchy, high-impact point 3"
     ],
     "speakerNotes": "Detailed presenter explanation to be read aloud during the presentation.",
     "imagePrompt": "A highly detailed, professional, cinematic aesthetic image representing [slide context]",
     "icon": "🚀"
   }
 ]
}

Rules:
1. Heading max 5-7 words.
2. Bullet max 12 words.
3. Keep speakerNotes strictly professional and descriptive.
4. Return pure JSON only.
`;

    const result = await model.generateContent(prompt);
    const text = await result.response.text();
    const data = extractJSON(text);

    res.json(data);
  } catch (err) {
    console.error("GENERATION ERROR:", err);
    res.status(500).json({ error: "Generation failed" });
  }
});

// =========================
// DOWNLOAD PPT (PREMIUM THEMES)
// =========================
app.post("/download-ppt", async (req, res) => {
  try {
    const { data, template } = req.body;

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9"; // W: 10 inches, H: 5.625 inches

    // Fetch images in parallel for speed
    const slidesWithImages = await Promise.all(
      data.slides.map(async (slide) => {
        const base64Image = await fetchImageBase64(slide.imagePrompt);
        return { ...slide, base64Image };
      })
    );

    slidesWithImages.forEach((slide, index) => {
      const s = pptx.addSlide();

      // Ensure Speaker Notes are added to EVERY slide
      if (slide.speakerNotes) {
        s.addNotes(slide.speakerNotes);
      }

      // ============================================
      // 1. MODERN THEME (Dark, Sleek, Edge-to-Edge)
      // ============================================
      if (template === "modern") {
        s.background = { fill: "09090B" }; // Deep Slate/Black

        // Neon Pink Accent Line
        s.addShape(pptx.ShapeType.rect, {
          x: 0.6,
          y: 1.2,
          w: 0.6,
          h: 0.05,
          fill: { color: "EC4899" },
        });

        // Fixed Gap: Heading (y: 1.5) immediately followed by points (y: 2.3)
        s.addText(`${slide.heading}`, {
          x: 0.6,
          y: 1.5,
          w: 4.4,
          h: 0.8,
          fontSize: 36,
          bold: true,
          color: "FFFFFF",
          fontFace: "Arial",
          valign: "top", // Forces text to top, preventing gaps
        });

        s.addText(slide.points.join("\n"), {
          x: 0.6,
          y: 2.4, // Tight spacing to the heading
          w: 4.4,
          h: 2.5,
          fontSize: 18,
          color: "D1D5DB",
          fontFace: "Arial",
          valign: "top",
          bullet: { type: "bullet", color: "EC4899" },
          lineSpacing: 32,
        });

        // Edge-to-Edge Image on Right Side
        if (slide.base64Image) {
          s.addImage({
            data: slide.base64Image,
            x: 5.5,
            y: 0,
            w: 4.5,
            h: 5.625,
            sizing: { type: "crop", w: 4.5, h: 5.625 },
          });
        }
      } 
      
      // ============================================
      // 2. BUSINESS THEME (Executive Navy, Clean Lines)
      // ============================================
      else if (template === "business") {
        s.background = { fill: "0B101E" }; // Dark Navy Executive bg

        // Left Architectural Blue Bar
        s.addShape(pptx.ShapeType.rect, {
          x: 0,
          y: 0,
          w: 0.15,
          h: "100%",
          fill: { color: "2563EB" },
        });

        // Fixed Gap Configuration
        s.addText(`${slide.heading}`, {
          x: 0.8,
          y: 1.5,
          w: 4.5,
          h: 0.8,
          fontSize: 32,
          bold: true,
          color: "FFFFFF",
          fontFace: "Calibri",
          valign: "top",
        });

        s.addText(slide.points.join("\n"), {
          x: 0.8,
          y: 2.4,
          w: 4.5,
          h: 2.5,
          fontSize: 16,
          color: "9CA3AF",
          fontFace: "Calibri",
          valign: "top",
          bullet: { type: "number", color: "3B82F6" },
          lineSpacing: 28,
        });

        // Slide Number Watermark
        s.addText(`SLIDE / 0${index + 1}`, {
          x: 8.0,
          y: 5.1,
          w: 1.5,
          h: 0.3,
          fontSize: 10,
          color: "4B5563",
          fontFace: "Courier New",
          align: "right",
        });

        // Professional Square Image Crop
        if (slide.base64Image) {
          s.addImage({
            data: slide.base64Image,
            x: 5.8,
            y: 1.0,
            w: 3.6,
            h: 3.6,
            sizing: { type: "crop", w: 3.6, h: 3.6 },
          });
        }
      } 
      
      // ============================================
      // 3. ACADEMIC THEME (Ivory, Serif Fonts, Academic Lines)
      // ============================================
      else {
        s.background = { fill: "FDFBF7" }; // Ivory/Cream Paper

        // Top Oxford Blue Header Bar
        s.addShape(pptx.ShapeType.rect, {
          x: 0,
          y: 0,
          w: "100%",
          h: 0.2,
          fill: { color: "1A2E44" },
        });

        // Crimson Red Sub-line
        s.addShape(pptx.ShapeType.rect, {
          x: 0,
          y: 0.2,
          w: "100%",
          h: 0.02,
          fill: { color: "8B1E0F" },
        });

        // Serif Fonts with fixed tight gaps
        s.addText(`${slide.heading}`, {
          x: 0.6,
          y: 1.4,
          w: 4.5,
          h: 1.0,
          fontSize: 34,
          bold: true,
          color: "1A2E44",
          fontFace: "Georgia",
          valign: "top",
        });

        s.addText(slide.points.join("\n"), {
          x: 0.6,
          y: 2.4,
          w: 4.5,
          h: 2.5,
          fontSize: 17,
          color: "334155",
          fontFace: "Georgia",
          valign: "top",
          bullet: { type: "bullet", characterCode: "2022", color: "8B1E0F" },
          lineSpacing: 30,
        });

        // Roman Numeral Subtle Watermark
        const romanNumerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
        s.addText(romanNumerals[index] || index + 1, {
          x: 8.5,
          y: 0.5,
          w: 1.0,
          h: 1.0,
          fontSize: 64,
          bold: true,
          italic: true,
          color: "E5E0D8", // Very subtle gray-brown
          fontFace: "Georgia",
          align: "right",
        });

        // Landscape Photo Frame
        if (slide.base64Image) {
          s.addImage({
            data: slide.base64Image,
            x: 5.5,
            y: 1.6,
            w: 4.0,
            h: 2.8,
            sizing: { type: "crop", w: 4.0, h: 2.8 },
          });
        }
      }
    });

    const buffer = await pptx.write("nodebuffer");

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${data.title.replace(/[^a-z0-9]/gi, "_")}.pptx"`
    );

    res.send(buffer);
  } catch (err) {
    console.error("PPT ERROR:", err);
    res.status(500).json({ error: "PPT generation failed" });
  }
});

// =========================
// ✅ RENDER PORT FIX
// =========================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🔥 Premium Backend running on port ${PORT}`);
});