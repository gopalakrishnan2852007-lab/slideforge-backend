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
    console.log("⚠️ Image skipped");
    return null;
  }
};

// ================= AI GENERATION =================
app.post("/generate-json", async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) return res.status(400).json({ error: "Topic required" });

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const prompt = `
Create an Ultra-Premium executive presentation about "${topic}".

Return ONLY JSON.

{
 "title":"Presentation Title",
 "slides":[
  {
   "type":"intro | content | image | summary",
   "heading":"Short heading",
   "points":["Point 1","Point 2","Point 3"],
   "speakerNotes":"Explanation",
   "imagePrompt":"Professional cinematic image"
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

// ================= PPT GENERATION =================
app.post("/download-ppt", async (req, res) => {
  try {
    const { data } = req.body;

    // ✅ SAFETY CHECK (CRASH FIX)
    if (!data || !Array.isArray(data.slides)) {
      return res.status(400).json({ error: "Invalid slide data" });
    }

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9";

    const slides = await Promise.all(
      data.slides.map(async (s) => ({
        ...s,
        base64Image: await fetchImageBase64(s.imagePrompt),
      }))
    );

    // ================= COVER =================
    const cover = pptx.addSlide();
    cover.background = { fill: "0B0F19" };

    const safeTitle = (data.title || "Presentation").toUpperCase();

    cover.addText(safeTitle, {
      x: 1,
      y: 1.8,
      w: 8,
      h: 1.5,
      fontSize: 44,
      bold: true,
      color: "FFFFFF",
      align: "center",
    });

    // ================= CONTENT SLIDES =================
    slides.forEach((slide, index) => {
      const s = pptx.addSlide();
      const layout = slide.type || "content";

      if (slide.speakerNotes) s.addNotes(slide.speakerNotes);

      // ===== INTRO =====
      if (layout === "intro") {
        s.background = { fill: "0B0F19" };

        s.addText(slide.heading || "", {
          x: 1.5,
          y: 1.5,
          w: 7,
          h: 1,
          fontSize: 36,
          bold: true,
          color: "FFFFFF",
        });

        s.addText((slide.points || []).join("\n\n"), {
          x: 1.5,
          y: 2.6,
          w: 7,
          h: 1.8,
          fontSize: 18,
          color: "94A3B8",
        });
      }

      // ===== CONTENT =====
      else if (layout === "content") {
        s.background = { fill: "0B0F19" };

        s.addText(slide.heading || "", {
          x: 0.6,
          y: 0.6,
          w: 5.5,
          h: 0.8,
          fontSize: 32,
          bold: true,
          color: "FFFFFF",
        });

        s.addText((slide.points || []).join("\n"), {
          x: 0.6,
          y: 1.8,
          w: 5.2,
          h: 3.2,
          fontSize: 18,
          color: "CBD5E1",
          bullet: true,
        });

        if (slide.base64Image) {
          s.addImage({
            data: slide.base64Image,
            x: 6.1,
            y: 1.5,
            w: 3.2,
            h: 3.2,
          });
        }
      }

      // ===== IMAGE =====
      else if (layout === "image") {
        s.background = { fill: "000000" };

        if (slide.base64Image) {
          s.addImage({
            data: slide.base64Image,
            x: 0,
            y: 0,
            w: 10,
            h: 5.625,
          });
        }

        s.addText(slide.heading || "", {
          x: 0.5,
          y: 4.2,
          w: 9,
          h: 1,
          fontSize: 30,
          bold: true,
          color: "FFFFFF",
          align: "center",
        });
      }

      // ===== SUMMARY =====
      else {
        s.background = { fill: "F1F5F9" };

        s.addText("KEY TAKEAWAYS", {
          x: 1.5,
          y: 1.3,
          w: 7,
          h: 0.6,
          fontSize: 22,
          bold: true,
          align: "center",
        });

        s.addText((slide.points || []).join("\n"), {
          x: 2,
          y: 2,
          w: 6,
          h: 2.5,
          fontSize: 18,
          bullet: true,
        });
      }

      // Slide number
      s.addText(`0${index + 1}`, {
        x: 9,
        y: 5.1,
        w: 0.5,
        h: 0.3,
        fontSize: 10,
        color: "64748B",
      });
    });

    const buffer = await pptx.write("nodebuffer");

    const fileName = (data.title || "presentation")
      .replace(/[^a-z0-9]/gi, "_");

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