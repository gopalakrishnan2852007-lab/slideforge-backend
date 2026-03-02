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

const fetchImageBase64 = async (prompt) => {
  if (!prompt) return null;
  try {
    const enhancedPrompt = `${prompt}, high quality, 8k resolution, professional, highly detailed, no text`;
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&nologo=true`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  } catch (error) {
    return null;
  }
};

// ==========================================
// 🧠 AI GENERATION ROUTE (WITH TONE CONTROL)
// ==========================================
app.post("/generate-json", async (req, res) => {
  try {
    const { topic, slideCount = 6, tone = "Professional" } = req.body;
    if (!topic) return res.status(400).json({ error: "Topic required" });

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const isSingleSlide = slideCount === 1;
    
    const contextPrompt = isSingleSlide
      ? `You are an elite presentation designer. Create EXACTLY 1 highly detailed content slide about "${topic}".`
      : `You are a world-class presentation designer. Create a brilliant ${slideCount}-slide executive deck about "${topic}". Story arc: Hook -> Context -> Core Concepts -> Future -> Summary.`;

    // 🚨 FIX: Made the heading rule MUCH stricter to prevent overlapping in PPT
    const prompt = `
${contextPrompt}

CRITICAL RULES:
1. CONTENT TONE MUST BE STRICTLY: "${tone}". Adjust vocabulary and style accordingly.
2. NO MARKDOWN ALLOWED. Do not use ** or *.
3. "heading" MUST be EXTREMELY short (Max 3 to 4 words). Do not write full sentences for headings.
4. "points" MUST be EXACTLY 3 bullet points. Max 12 words per point.
5. "icon" MUST be a single appropriate premium emoji.
6. "imagePrompt" MUST be highly descriptive for an AI image generator.
7. Return ONLY valid JSON.

FORMAT:
{
 "title": "Main Presentation Title",
 "slides": [
  {
   "type": "intro | content | summary",
   "heading": "Short Heading",
   "icon": "💎",
   "points": ["Point one", "Point two", "Point three"],
   "speakerNotes": "Script for the presenter.",
   "imagePrompt": "Cinematic visual of [subject], 8k"
  }
 ]
}
`;

    const result = await model.generateContent(prompt);
    const parsedData = extractJSON(await result.response.text());
    res.json(parsedData);
  } catch (err) {
    console.error("Generate Error:", err);
    res.status(500).json({ error: "AI Generation failed. Please try again." });
  }
});

// ==========================================
// ✨ AI IMPROVE SINGLE SLIDE
// ==========================================
app.post("/improve-slide", async (req, res) => {
  try {
    const { heading, points, tone = "Professional" } = req.body;
    
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `
You are an expert copywriter. Improve the following presentation slide content.
Make the tone STRICTLY: "${tone}".

ORIGINAL HEADING: ${heading}
ORIGINAL POINTS: ${JSON.stringify(points)}

CRITICAL RULES:
1. "heading" must be punchy, max 4 words. Never write long sentences.
2. "points" MUST be exactly 3 bullet points, max 12 words each. Ensure they are highly impactful.
3. Return ONLY valid JSON. Do NOT use markdown.

FORMAT:
{
  "heading": "Improved Heading",
  "points": ["Improved point 1", "Improved point 2", "Improved point 3"]
}
`;
    const result = await model.generateContent(prompt);
    const parsedData = extractJSON(await result.response.text());
    res.json(parsedData);
  } catch (err) {
    console.error("Improve Error:", err);
    res.status(500).json({ error: "Failed to improve slide." });
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
      return res.status(400).json({ error: "Invalid slide data." });
    }

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9";

    const slides = await Promise.all(data.slides.map(async (s) => ({
        ...s, base64Image: await fetchImageBase64(s.imagePrompt),
    })));

    const safeTitle = cleanText(data.title || "Presentation");

    const THEMES = {
      modern: { bg: "09090B", text: "FFFFFF", accent: "6366F1", secondary: "94A3B8", font: "Helvetica" },
      business: { bg: "0F172A", text: "F8FAFC", accent: "38BDF8", secondary: "CBD5E1", font: "Arial" },
      academic: { bg: "FDFBF7", text: "1E293B", accent: "0F766E", secondary: "475569", font: "Georgia" }
    };
    const tConfig = THEMES[activeTheme];

    // COVER
    const cover = pptx.addSlide();
    cover.background = { fill: tConfig.bg };
    if (activeTheme === "modern") {
      cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.15, fill: { color: tConfig.accent } });
      cover.addText(safeTitle.toUpperCase(), { x: 1, y: 2.2, w: 8, h: 1.5, fontSize: 44, bold: true, color: tConfig.text, fontFace: tConfig.font, align: "center", charSpacing: 2 });
    } else if (activeTheme === "business") {
      cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.4, h: "100%", fill: { color: tConfig.accent } });
      cover.addText(safeTitle, { x: 1.2, y: 2.2, w: 8, h: 1.5, fontSize: 48, bold: true, color: tConfig.text, fontFace: tConfig.font, align: "left" });
    } else {
      cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.2, fill: { color: "1E293B" } });
      cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0.2, w: "100%", h: 0.05, fill: { color: tConfig.accent } });
      cover.addText(safeTitle, { x: 1, y: 2.2, w: 8, h: 1.5, fontSize: 42, bold: true, color: tConfig.text, fontFace: tConfig.font, align: "center" });
    }

    // SLIDES
    slides.forEach((slide, index) => {
      const s = pptx.addSlide();
      let layout = slide.type || "content";
      if (layout === "image") layout = "content"; 
      
      const headingText = `${slide.icon || "🔹"}  ${cleanText(slide.heading || "")}`; 
      const pointsArray = (slide.points || []).map(cleanText);

      if (slide.speakerNotes) s.addNotes(cleanText(slide.speakerNotes));
      s.addText(`${index + 1} / ${slides.length}`, { x: 9.0, y: 5.2, w: 0.8, h: 0.3, fontSize: 10, color: tConfig.secondary, fontFace: tConfig.font, align: "right", bold: true });

      if (layout === "content" || layout === "intro") {
        s.background = { fill: tConfig.bg };
        if (activeTheme === "business") s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.15, h: "100%", fill: { color: tConfig.accent } });
        else if (activeTheme === "academic") {
          s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.1, fill: { color: "1E293B" } });
          s.addShape(pptx.ShapeType.rect, { x: 0, y: 0.1, w: "100%", h: 0.02, fill: { color: tConfig.accent } });
        }

        // 🚨 OVERLAP FIX: Made font smaller (32 -> 30), increased height box (h:1.6)
        s.addText(headingText, { 
          x: 0.6, 
          y: 0.4, 
          w: 4.8, 
          h: 1.6, 
          fontSize: activeTheme === "modern" ? 32 : 30, 
          bold: true, 
          color: tConfig.text, 
          fontFace: tConfig.font, 
          valign: "top" 
        });
        
        // 🚨 OVERLAP FIX: Pushed divider line much further down (1.9 -> 2.15)
        s.addShape(pptx.ShapeType.rect, { 
          x: 0.6, 
          y: 2.15, 
          w: 1.2, 
          h: 0.03, 
          fill: { color: tConfig.accent } 
        });
        
        // 🚨 OVERLAP FIX: Pushed bullet points much further down (2.2 -> 2.4)
        s.addText(pointsArray.join("\n"), { 
          x: 0.6, 
          y: 2.4, 
          w: 4.6, 
          h: 2.8, 
          fontSize: 18, 
          color: tConfig.secondary, 
          fontFace: tConfig.font, 
          valign: "top", 
          bullet: { type: 'bullet', characterCode: '2022' }, 
          lineSpacing: 44 
        });

        if (slide.base64Image) {
          if (activeTheme === "modern") s.addImage({ data: slide.base64Image, x: 5.5, y: 0, w: 4.5, h: 5.625, sizing: { type: "crop", w: 4.5, h: 5.625 } });
          else if (activeTheme === "business") {
            s.addShape(pptx.ShapeType.rect, { x: 5.75, y: 1.15, w: 3.8, h: 3.8, fill: { color: tConfig.accent } }); 
            s.addImage({ data: slide.base64Image, x: 5.6, y: 1.0, w: 3.8, h: 3.8, sizing: { type: "crop", w: 3.8, h: 3.8 } });
          } else {
            s.addShape(pptx.ShapeType.rect, { x: 5.5, y: 1.0, w: 4.0, h: 3.5, fill: { color: "E2E8F0" } }); 
            s.addImage({ data: slide.base64Image, x: 5.6, y: 1.1, w: 3.8, h: 3.3, sizing: { type: "crop", w: 3.8, h: 3.3 } });
          }
        }
      } else if (layout === "summary") {
        s.background = { fill: activeTheme === "modern" ? "18181B" : tConfig.bg };
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.15, fill: { color: tConfig.accent } });
        s.addText(`🌟 KEY TAKEAWAYS`, { x: 1.5, y: 0.8, w: 7, h: 0.8, fontSize: 26, bold: true, color: tConfig.text, fontFace: tConfig.font, align: "center", charSpacing: 3 });
        s.addShape(pptx.ShapeType.rect, { x: 4.5, y: 1.6, w: 1.0, h: 0.04, fill: { color: tConfig.accent } });
        s.addText(pointsArray.join("\n"), { x: 2.0, y: 2.1, w: 6.0, h: 2.8, fontSize: 20, color: tConfig.secondary, fontFace: tConfig.font, valign: "top", align: "left", bullet: { type: 'bullet', characterCode: '2022' }, lineSpacing: 44 });
      }
    });

    const buffer = await pptx.write("nodebuffer");
    const fileName = safeTitle.replace(/[^a-z0-9]/gi, "_") || "Presentation";

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