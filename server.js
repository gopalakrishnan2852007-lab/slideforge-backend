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

    if (!topic)
      return res.status(400).json({ error: "Topic required" });

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

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
     "imagePrompt": "A highly detailed, aesthetic, photorealistic image representing concept",
     "icon": "🚀"
   }
 ]
}

Rules:
1. Heading max 5 words.
2. Bullet max 10 words.
3. Return pure JSON only.
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
// DOWNLOAD PPT
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

      // ===== MODERN =====
      if (template === "modern") {
        s.background = { fill: "1E1B4B" };

        if (slide.base64Image) {
          s.addImage({
            data: slide.base64Image,
            x: 5.5,
            y: 0,
            w: 4.5,
            h: 5.625,
          });
        }

        s.addText(`${slide.icon} ${slide.heading}`, {
          x: 0.5,
          y: 0.4,
          w: 4.5,
          h: 1.8,
          fontSize: 32,
          bold: true,
          color: "FFFFFF",
          valign: "top",
        });

        s.addText(slide.points.join("\n"), {
          x: 0.5,
          y: 2.3,
          w: 4.5,
          h: 3,
          fontSize: 18,
          color: "E0E7FF",
          bullet: true,
        });
      }

      // ===== BUSINESS =====
      else if (template === "business") {
        s.background = { fill: "FFFFFF" };

        s.addText(`${slide.icon} ${slide.heading}`, {
          x: 0.5,
          y: 0.5,
          w: 9,
          h: 1,
          fontSize: 32,
          bold: true,
        });

        s.addText(slide.points.join("\n"), {
          x: 0.5,
          y: 1.6,
          w: 5,
          h: 3.5,
          fontSize: 18,
          bullet: { type: "number" },
        });

        if (slide.base64Image) {
          s.addImage({
            data: slide.base64Image,
            x: 6,
            y: 1.8,
            w: 3.2,
            h: 3.2,
          });
        }
      }

      // ===== ACADEMIC =====
      else {
        s.background = { fill: "F8FAFC" };

        s.addText(`${slide.icon} ${slide.heading}`, {
          x: 0.5,
          y: 0.5,
          w: 9,
          h: 1,
          fontSize: 34,
          bold: true,
          align: "center",
        });

        s.addText(slide.points.join("\n"), {
          x: 0.5,
          y: 1.8,
          w: 4.5,
          h: 3,
          fontSize: 18,
          bullet: true,
        });

        if (slide.base64Image) {
          s.addImage({
            data: slide.base64Image,
            x: 5.2,
            y: 1.8,
            w: 4,
            h: 3,
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
      `attachment; filename=${data.title.replace(/[^a-z0-9]/gi, "_")}.pptx`
    );

    res.send(buffer);
  } catch (err) {
    console.error("PPT ERROR:", err);
    res.status(500).json({ error: "PPT generation failed" });
  }
});

// =========================
// ✅ RENDER PORT FIX (IMPORTANT)
// =========================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🔥 Premium Backend running on port ${PORT}`);
});