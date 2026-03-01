require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const PptxGenJS = require("pptxgenjs");

const app = express();
app.use(cors());
app.use(express.json());

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
    )}?width=800&height=800&nologo=true`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  } catch (error) {
    console.error("Image Fetch Error:", error.message);
    return null; 
  }
};

// =========================
// GENERATE SLIDES JSON
// =========================
app.post("/generate-json", async (req, res) => {
  try {
    const { topic } = req.body;

    if (!topic) return res.status(400).json({ error: "Topic required" });

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // FIXED PROMPT: Enforcing short titles to prevent overlap
    const prompt = `
You are an expert presentation designer. Create a premium 6-slide presentation about "${topic}".

IMPORTANT:
Return ONLY valid JSON. No markdown, no backticks, no explanation.

FORMAT:
{
 "title": "Presentation Title",
 "slides": [
   {
     "heading": "Short Title Here", 
     "points": [
       "Short, punchy point 1",
       "Short, punchy point 2",
       "Short, punchy point 3"
     ],
     "speakerNotes": "Detailed presenter explanation.",
     "imagePrompt": "A highly detailed, aesthetic, photorealistic image representing [specific concept], modern corporate style, 8k resolution",
     "icon": "🚀" 
   }
 ]
}

Rules:
1. "heading" MUST be extremely short (Maximum 5 words).
2. "imagePrompt" MUST be a detailed prompt for an AI image generator.
3. "icon" MUST be a single relevant Unicode emoji.
4. Keep bullet points concise (max 10 words each).
`;

    const result = await model.generateContent(prompt);
    const text = await result.response.text();
    const data = extractJSON(text);

    res.json(data);
  } catch (err) {
    console.error("GENERATION ERROR:", err);
    res.status(500).json({ error: "Generation failed. Please try again." });
  }
});

// =========================
// DOWNLOAD PPT (PREMIUM THEMES)
// =========================
app.post("/download-ppt", async (req, res) => {
  try {
    const { data, template } = req.body;

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9";

    const slidesWithImages = await Promise.all(
      data.slides.map(async (slide) => {
        const base64Image = await fetchImageBase64(slide.imagePrompt);
        return { ...slide, base64Image };
      })
    );

    slidesWithImages.forEach((slide) => {
      const s = pptx.addSlide();

      // ==========================================
      // THEME: MODERN 
      // ==========================================
      if (template === "modern") {
        s.background = { fill: "1E1B4B" }; 
        
        if (slide.base64Image) {
          s.addImage({
            data: slide.base64Image,
            x: 5.5, y: 0, w: 4.5, h: 5.625,
            sizing: { type: "cover", w: 4.5, h: 5.625 }
          });
        } else {
          s.addShape(pptx.ShapeType.rect, { fill: "312E81", x: 5.5, y: 0, w: 4.5, h: 5.625 });
        }

        // FIXED: Pushed title up, added valign: "top", smaller font
        s.addText(`${slide.icon} ${slide.heading}`, {
          x: 0.5, y: 0.4, w: 4.5, h: 1.8,
          fontSize: 32, bold: true, color: "FFFFFF", fontFace: "Segoe UI",
          valign: "top", breakLine: true
        });

        // FIXED: Pushed bullets down, added proper bullet styling
        s.addText(slide.points.map(p => p).join("\n"), {
          x: 0.5, y: 2.3, w: 4.5, h: 3.0,
          fontSize: 18, color: "E0E7FF", fontFace: "Segoe UI",
          bullet: { type: "bullet", color: "E0E7FF" },
          lineSpacing: 32, valign: "top"
        });
      }

      // ==========================================
      // THEME: BUSINESS
      // ==========================================
      else if (template === "business") {
        s.background = { fill: "FFFFFF" }; 

        s.addShape(pptx.ShapeType.rect, { fill: "0F172A", x: 0, y: 0, w: "100%", h: 1.2 });
        s.addShape(pptx.ShapeType.rect, { fill: "F59E0B", x: 0, y: 1.2, w: "100%", h: 0.05 });

        // FIXED Layout
        s.addText(`${slide.icon} ${slide.heading}`, {
          x: 0.5, y: 0.1, w: 9, h: 1,
          fontSize: 32, bold: true, color: "FFFFFF", fontFace: "Arial", valign: "middle"
        });

        s.addText(slide.points.map(p => p).join("\n"), {
          x: 0.5, y: 1.6, w: 5, h: 3.5,
          fontSize: 18, color: "334155", fontFace: "Arial",
          bullet: { type: "number" }, lineSpacing: 32, valign: "top"
        });

        if (slide.base64Image) {
          s.addImage({
            data: slide.base64Image,
            x: 6, y: 1.8, w: 3.2, h: 3.2, rounding: true 
          });
        }
      }

      // ==========================================
      // THEME: ACADEMIC 
      // ==========================================
      else {
        s.background = { fill: "F8FAFC" }; 

        s.addShape(pptx.ShapeType.rect, {
          x: 0.2, y: 0.2, w: 9.6, h: 5.2,
          fill: "TRANSPARENT", line: { color: "64748B", width: 2 }
        });

        // FIXED Layout
        s.addText(`${slide.icon} ${slide.heading}`, {
          x: 0.5, y: 0.5, w: 9, h: 1.2,
          fontSize: 34, bold: true, color: "0F172A",
          fontFace: "Georgia", align: "center", valign: "top"
        });

        s.addText(slide.points.map(p => p).join("\n"), {
          x: 0.5, y: 1.8, w: 4.5, h: 3.2, 
          fontSize: 18, color: "1E293B", fontFace: "Georgia",
          bullet: { type: "bullet", characterCode: "25BA" }, // Right-pointing arrow bullet
          lineSpacing: 28, valign: "top"
        });

        if (slide.base64Image) {
          s.addImage({
            data: slide.base64Image,
            x: 5.2, y: 1.8, w: 4, h: 3,
            sizing: { type: "contain", w: 4, h: 3 }
          });
        }
      }

      if (slide.speakerNotes) {
        s.addNotes(slide.speakerNotes);
      }
    });

    const buffer = await pptx.write("nodebuffer");

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${data.title.replace(/[^a-z0-9]/gi, '_')}.pptx`
    );

    res.send(buffer);
  } catch (err) {
    console.error("PPT ERROR:", err);
    res.status(500).json({ error: "PPT generation failed" });
  }
});

app.listen(5000, () => {
  console.log("🔥 Premium Backend running on http://localhost:5000");
});