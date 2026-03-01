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
      // 1. MODERN THEME (Neon, Layered Geometry, Dark Mode)
      // ============================================
      if (template === "modern") {
        s.background = { fill: "09090B" }; // Deep Midnight Black

        // Aesthetic background glow effect (purple circular overlay)
        s.addShape(pptx.ShapeType.oval, {
          x: -1, y: -1, w: 5, h: 5,
          fill: { color: "6B21A8", transparency: 85 },
        });

        // Neon Pink Accent Line
        s.addShape(pptx.ShapeType.rect, {
          x: 0.6, y: 0.8, w: 0.8, h: 0.05,
          fill: { color: "EC4899" },
        });

        // FIX: High 'h' for heading prevents overlapping. Y=1.0.
        s.addText(`${slide.heading}`, {
          x: 0.6, y: 1.0, w: 4.4, h: 1.4,
          fontSize: 34,
          bold: true,
          color: "FFFFFF",
          fontFace: "Arial",
          valign: "top", // Locks to top of the 1.4h box
        });

        // FIX: Points start at Y=2.5, leaving a perfect gap
        s.addText(slide.points.join("\n"), {
          x: 0.6, y: 2.5, w: 4.4, h: 2.5,
          fontSize: 18,
          color: "D1D5DB",
          fontFace: "Arial",
          valign: "top",
          bullet: { type: "bullet", color: "EC4899" },
          lineSpacing: 34,
        });

        // Image with soft rounded styling layout
        if (slide.base64Image) {
          s.addImage({
            data: slide.base64Image,
            x: 5.5, y: 0.5, w: 4.0, h: 4.6,
            sizing: { type: "crop", w: 4.0, h: 4.6 },
            rounding: true, // Modern rounded corners
          });
        }
      } 
      
      // ============================================
      // 2. BUSINESS THEME (Glassmorphism, Corporate Gold & Navy)
      // ============================================
      else if (template === "business") {
        s.background = { fill: "050F24" }; // Ultra Dark Corporate Navy

        // Layered Content Box (Simulates glass/card background)
        s.addShape(pptx.ShapeType.rect, {
          x: 0.4, y: 0.5, w: 4.8, h: 4.6,
          fill: { color: "132342", transparency: 20 },
        });

        // Gold Accent Border attached to the content box
        s.addShape(pptx.ShapeType.rect, {
          x: 0.4, y: 0.5, w: 0.06, h: 4.6,
          fill: { color: "F59E0B" }, // Premium Gold
        });

        // FIX: Safely contained heading inside the box
        s.addText(`${slide.heading}`, {
          x: 0.8, y: 0.8, w: 4.2, h: 1.4,
          fontSize: 32,
          bold: true,
          color: "FFFFFF",
          fontFace: "Calibri",
          valign: "top",
        });

        // FIX: Perfect gap before bullets
        s.addText(slide.points.join("\n"), {
          x: 0.8, y: 2.3, w: 4.2, h: 2.6,
          fontSize: 16,
          color: "9CA3AF",
          fontFace: "Calibri",
          valign: "top",
          bullet: { type: "number", color: "F59E0B" }, // Gold numbers
          lineSpacing: 30,
        });

        // Elegant Bottom Footer Line & Number
        s.addShape(pptx.ShapeType.rect, {
          x: 5.8, y: 5.0, w: 3.6, h: 0.01,
          fill: { color: "3B82F6", transparency: 50 },
        });
        
        s.addText(`SLIDE 0${index + 1}`, {
          x: 8.0, y: 5.1, w: 1.5, h: 0.3,
          fontSize: 10,
          color: "60A5FA",
          fontFace: "Courier New",
          align: "right",
        });

        // Corporate Square Image with simulated gold border backing
        if (slide.base64Image) {
          // Fake border shadow behind image
          s.addShape(pptx.ShapeType.rect, {
            x: 5.75, y: 0.95, w: 3.7, h: 3.7,
            fill: { color: "F59E0B" },
          });
          // Actual Image
          s.addImage({
            data: slide.base64Image,
            x: 5.8, y: 1.0, w: 3.6, h: 3.6,
            sizing: { type: "crop", w: 3.6, h: 3.6 },
          });
        }
      } 
      
      // ============================================
      // 3. ACADEMIC THEME (Ivy League Borders, Ivory Paper, Drop Shadows)
      // ============================================
      else {
        s.background = { fill: "FDFBF7" }; // Textured Ivory Paper Look

        // Academic Frame Border (Thin Navy line around the whole slide)
        s.addShape(pptx.ShapeType.rect, {
          x: 0.2, y: 0.2, w: 9.6, h: 5.25,
          line: { color: "1A2E44", width: 1.5 },
          fill: { type: "none" }, // Transparent inside
        });

        // Top Header Divider Line
        s.addShape(pptx.ShapeType.rect, {
          x: 0.2, y: 1.0, w: 9.6, h: 0.02,
          fill: { color: "8B1E0F" }, // Crimson Red
        });

        // FIX: Heading is placed beautifully in the top segment
        s.addText(`${slide.heading}`, {
          x: 0.5, y: 0.35, w: 9.0, h: 0.6,
          fontSize: 32,
          bold: true,
          color: "1A2E44",
          fontFace: "Georgia",
          valign: "middle",
        });

        // FIX: Bullet points sit cleanly in the main body area
        s.addText(slide.points.join("\n"), {
          x: 0.6, y: 1.5, w: 4.4, h: 3.5,
          fontSize: 18,
          color: "334155",
          fontFace: "Georgia",
          valign: "top",
          bullet: { type: "bullet", characterCode: "2022", color: "8B1E0F" },
          lineSpacing: 34,
        });

        // Roman Numeral Subtle Watermark
        const romanNumerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
        s.addText(romanNumerals[index] || index + 1, {
          x: 8.5, y: 4.3, w: 1.0, h: 1.0,
          fontSize: 48,
          bold: true,
          italic: true,
          color: "E5E0D8", // Very subtle gray-brown
          fontFace: "Georgia",
          align: "right",
        });

        // Elegant Image with simulated Drop Shadow effect
        if (slide.base64Image) {
          // Grey shadow box offset behind image
          s.addShape(pptx.ShapeType.rect, {
            x: 5.6, y: 1.6, w: 3.8, h: 2.8,
            fill: { color: "D1D5DB" }, // Shadow color
          });
          // Actual Image
          s.addImage({
            data: slide.base64Image,
            x: 5.5, y: 1.5, w: 3.8, h: 2.8,
            sizing: { type: "crop", w: 3.8, h: 2.8 },
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