require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const PptxGenJS = require("pptxgenjs");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.get("/", (req, res) => res.send("🚀 SlideForge God-Level Engine Running"));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// ==========================================
// 🛠️ UTILS
// ==========================================
const cleanText = (text) => text?.replace(/\*\*/g, "").replace(/\*/g, "").replace(/_/g, "").trim() || "";

const extractJSON = (text) => {
  try {
    const cleanText = text.replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
    const start = cleanText.indexOf("{");
    const end = cleanText.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON boundaries found");
    return JSON.parse(cleanText.substring(start, end + 1));
  } catch (err) {
    console.error("❌ JSON Parse Error:", text);
    throw new Error("Invalid AI JSON format generated.");
  }
};

const fetchImageBase64 = async (prompt, seed = 1) => {
  if (!prompt) return null;
  try {
    const enhancedPrompt = `${prompt}, highly detailed, cinematic lighting, 8k resolution, photorealistic, no text`;
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); 
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  } catch (error) {
    console.error("Image fetch error:", error.message);
    return null;
  }
};

// ==========================================
// 🧠 PROMPT ENGINEERING
// ==========================================
const slideSchema = `
{
 "title": "Main Presentation Title",
 "slides": [
  {
   "layout": "image_right",
   "heading": "Short Punchy Heading",
   "points": ["Point one max 12 words", "Point two max 12 words", "Point three max 12 words"],
   "speakerNotes": "Detailed script for the presenter to read out loud...",
   "imagePrompt": "Cinematic 8k visual of [subject], photorealistic"
  }
 ]
}`;

app.post("/generate-json", async (req, res) => {
  try {
    const { topic, slideCount = 6, tone = "Professional" } = req.body;
    if (!topic) return res.status(400).json({ error: "Topic required" });

    const prompt = `You are an elite presentation designer. Create a ${slideCount}-slide deck about "${topic}". Tone: "${tone}".
CRITICAL RULES:
1. "layout" MUST always be "image_right" for a uniform, consistent professional design.
2. "heading" MUST be max 4 words.
3. "points" MUST be EXACTLY 3 bullet points.
4. "imagePrompt" IS ABSOLUTELY MANDATORY for every slide. Make it a highly detailed AI image generation prompt.
Return EXACTLY this JSON format: ${slideSchema}`;
    
    const result = await model.generateContent(prompt);
    res.json(extractJSON(await result.response.text()));
  } catch (err) {
    res.status(500).json({ error: "AI Generation failed." });
  }
});

app.post("/extend-slides", async (req, res) => {
  try {
    const { currentSlides, addCount = 4, tone } = req.body;
    const prompt = `Here are the current slides: ${JSON.stringify(currentSlides.map(s => s.heading))}.
Generate ${addCount} MORE slides continuing the narrative deeply. Tone: "${tone}".
CRITICAL: You MUST use the exact same JSON format as before, keeping "layout" as "image_right" and EXACTLY 3 "points".
Format to return: { "slides": [ { "layout": "image_right", "heading": "...", "points": ["..","..",".."], "speakerNotes": "...", "imagePrompt": "..." } ] }`;
    
    const result = await model.generateContent(prompt);
    res.json(extractJSON(await result.response.text()));
  } catch (err) {
    res.status(500).json({ error: "Failed to extend slides." });
  }
});

app.post("/improve-slide", async (req, res) => {
  try {
    const { heading, points, tone } = req.body;
    const result = await model.generateContent(`IMPROVE and BALANCE this slide. Tone: "${tone}". Heading: ${heading}, Points: ${JSON.stringify(points)}. Return JSON: { "heading": "...", "points": ["...", "...", "..."] }`);
    res.json(extractJSON(await result.response.text()));
  } catch (err) { res.status(500).json({ error: "Failed." }); }
});

app.post("/rewrite-slide", async (req, res) => {
  try {
    const { heading, points, tone } = req.body;
    const result = await model.generateContent(`Completely rewrite clearer. Tone: "${tone}". Current: ${heading} - ${JSON.stringify(points)}. Return JSON: { "heading": "...", "points": ["P1", "P2", "P3"], "speakerNotes": "...", "imagePrompt": "..." }`);
    res.json(extractJSON(await result.response.text()));
  } catch (err) { res.status(500).json({ error: "Failed." }); }
});

app.post("/generate-script", async (req, res) => {
  try {
    const { slides } = req.body;
    const result = await model.generateContent(`Write a professional speech script for these slides: ${JSON.stringify(slides)}. Return JSON: { "script": ["Slide 1...", "Slide 2..."] }`);
    res.json(extractJSON(await result.response.text()));
  } catch (err) { res.status(500).json({ error: "Failed." }); }
});

// ==========================================
// 👑 PPT RENDER ENGINE
// ==========================================
app.post("/download-ppt", async (req, res) => {
  try {
    const { data, template } = req.body;
    const activeTheme = template || "modern";
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9";

    const slidesWithImages = [];
    for (let i = 0; i < data.slides.length; i++) {
      const s = data.slides[i];
      const safePrompt = s.imagePrompt || s.heading || "abstract presentation background";
      const base64Image = await fetchImageBase64(safePrompt, i + 1);
      slidesWithImages.push({ ...s, base64Image });
    }

    // Fixed Color Palettes: ONE UNIFORM COLOR per Theme!
    const PALETTES = {
      modern: { bg: "09090B", text: "FFFFFF", accent: "6366F1", secondary: "94A3B8" }, 
      business: { bg: "FFFFFF", text: "1E293B", accent: "1D4ED8", secondary: "475569" }, 
      academic: { bg: "FDFBF7", text: "1E293B", accent: "0F766E", secondary: "475569" }
    };

    const fontMap = { modern: "Helvetica", business: "Arial", academic: "Georgia" };
    const font = fontMap[activeTheme];
    const safeTitle = cleanText(data.title);
    
    // Apply consistent colors to every slide
    const themeConfig = PALETTES[activeTheme];

    // Build Title Cover Slide
    const cover = pptx.addSlide();
    cover.background = { fill: themeConfig.bg };
    cover.addText(safeTitle, { x: 1, y: 2.2, w: 8, h: 1.5, fontSize: 44, bold: true, color: themeConfig.text, fontFace: font, align: "center" });
    cover.addShape(pptx.ShapeType.rect, { x: 4, y: 4, w: 2, h: 0.05, fill: { color: themeConfig.accent } });

    // Build Rest of Slides
    slidesWithImages.forEach((slide, index) => {
      const s = pptx.addSlide();
      
      s.background = { fill: themeConfig.bg };
      if (slide.speakerNotes) s.addNotes(cleanText(slide.speakerNotes));
      s.addText(`${index + 1}`, { x: 9.2, y: 5.2, w: 0.5, h: 0.3, fontSize: 10, color: themeConfig.secondary, align: "right" });

      const headingText = cleanText(slide.heading);
      const pointsText = (slide.points || []).map(cleanText).join("\n");

      // Consistent Layout: TEXT ON LEFT, IMAGE ON RIGHT
      s.addText(headingText, { x: 0.5, y: 0.8, w: 4.5, h: 1.2, fontSize: 32, bold: true, color: themeConfig.text, fontFace: font });
      s.addShape(pptx.ShapeType.rect, { x: 0.5, y: 2.1, w: 1.0, h: 0.03, fill: { color: themeConfig.accent } });
      s.addText(pointsText, { x: 0.5, y: 2.4, w: 4.5, h: 2.8, fontSize: 18, color: themeConfig.secondary, fontFace: font, bullet: true, lineSpacing: 40 });
      
      if (slide.base64Image) {
        s.addImage({ data: slide.base64Image, x: 5.5, y: 0, w: 4.5, h: 5.625, sizing: { type: "cover", w: 4.5, h: 5.625 } });
      }
    });

    const base64File = await pptx.write("base64");
    res.json({ fileName: `${safeTitle.replace(/[^a-z0-9]/gi, "_") || "Presentation"}.pptx`, fileData: base64File });
  } catch (err) {
    console.error("Export Error:", err);
    res.status(500).json({ error: "Export failed on server." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🔥 God-Level Engine running on ${PORT}`));