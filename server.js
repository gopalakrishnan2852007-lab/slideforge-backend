require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const PptxGenJS = require("pptxgenjs");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// ==========================================
// 🚀 HEALTH CHECK
// ==========================================
app.get("/", (req, res) => {
  res.send("🚀 SlideForge God-Level Theme Engine Running");
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// ==========================================
// 🛠️ UTILS: TEXT & JSON CLEANING
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
    console.error("❌ Failed to parse AI response:", text);
    throw new Error("Invalid AI JSON format generated.");
  }
};

const fetchImageBase64 = async (prompt) => {
  if (!prompt) return null;
  try {
    const enhancedPrompt = `${prompt}, high quality, cinematic, highly detailed, no text`;
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
// 🧠 1. GENERATE FULL DECK
// ==========================================
app.post("/generate-json", async (req, res) => {
  try {
    const { topic, slideCount = 6, tone = "Professional" } = req.body;
    if (!topic) return res.status(400).json({ error: "Topic required" });

    const prompt = `You are a world-class presentation designer. Create a brilliant ${slideCount}-slide executive deck about "${topic}". Story arc: Hook -> Context -> Core Concepts -> Future -> Summary. Tone MUST BE strictly: "${tone}".

CRITICAL RULES:
1. NO MARKDOWN ALLOWED. Do not use ** or *.
2. "heading" MUST be EXTREMELY short (Max 4 words).
3. "points" MUST be EXACTLY 3 bullet points. Max 12 words per point. Balance the text elegantly.
4. "icon" MUST be a single appropriate premium emoji.
5. "imagePrompt" MUST be highly descriptive for an AI image generator (Cinematic, vivid).
6. "speakerNotes" script for the presenter to say out loud.
7. Return ONLY valid JSON format below:

{
 "title": "Main Presentation Title",
 "slides": [
  {
   "type": "content",
   "heading": "Short Heading",
   "icon": "💎",
   "points": ["Point one", "Point two", "Point three"],
   "speakerNotes": "Welcome everyone to this presentation...",
   "imagePrompt": "Cinematic visual of [subject], 8k"
  }
 ]
}`;
    const result = await model.generateContent(prompt);
    res.json(extractJSON(await result.response.text()));
  } catch (err) {
    res.status(500).json({ error: "AI Generation failed. Check API limits." });
  }
});

// ==========================================
// ✨ 2. AI IMPROVE SINGLE SLIDE (Design Balance)
// ==========================================
app.post("/improve-slide", async (req, res) => {
  try {
    const { heading, points, tone = "Professional" } = req.body;
    const prompt = `You are an expert copywriter. IMPROVE and BALANCE the slide content. Tone: "${tone}".
ORIGINAL HEADING: ${heading}
ORIGINAL POINTS: ${JSON.stringify(points)}

RULES: Make heading punchy (max 4 words). Shorten long bullets to EXACTLY 3 points (max 10 words each). Highlight key impact. Format as JSON: { "heading": "...", "points": ["...", "...", "..."] }`;
    const result = await model.generateContent(prompt);
    res.json(extractJSON(await result.response.text()));
  } catch (err) {
    res.status(500).json({ error: "Failed to improve slide." });
  }
});

// ==========================================
// 🔄 3. AI REWRITE SLIDE (Completely rewrite)
// ==========================================
app.post("/rewrite-slide", async (req, res) => {
  try {
    const { heading, points, tone } = req.body;
    const prompt = `Completely rewrite this slide from scratch to be much clearer and more engaging. Tone: "${tone}".
Current: ${heading} - ${JSON.stringify(points)}
Return JSON: { "heading": "New Heading", "points": ["P1", "P2", "P3"], "speakerNotes": "new notes", "imagePrompt": "new image description" }`;
    const result = await model.generateContent(prompt);
    res.json(extractJSON(await result.response.text()));
  } catch (err) {
    res.status(500).json({ error: "Failed to rewrite slide." });
  }
});

// ==========================================
// 📈 4. SMART SLIDE EXPANSION
// ==========================================
app.post("/extend-slides", async (req, res) => {
  try {
    const { currentSlides, addCount = 4, tone } = req.body;
    const prompt = `Here are the current slides: ${JSON.stringify(currentSlides.map(s => s.heading))}.
Generate ${addCount} MORE slides that continue the narrative deeply. Tone: "${tone}".
Return JSON: { "slides": [ { "heading": "...", "points": [...], "icon": "...", "imagePrompt": "...", "speakerNotes": "..." } ] }`;
    const result = await model.generateContent(prompt);
    res.json(extractJSON(await result.response.text()));
  } catch (err) {
    res.status(500).json({ error: "Failed to extend slides." });
  }
});

// ==========================================
// 📋 5. AI SUMMARY MODE
// ==========================================
app.post("/generate-summary", async (req, res) => {
  try {
    const { slides } = req.body;
    const prompt = `Analyze these slides: ${JSON.stringify(slides.map(s => s.heading + " " + s.points.join(",")))}.
Generate ONE Executive Summary slide.
Return JSON: { "slide": { "heading": "Executive Summary", "points": ["Core takeaway 1", "Core takeaway 2", "Core takeaway 3"], "icon": "🌟", "imagePrompt": "Abstract success representation, professional", "speakerNotes": "To summarize our core findings..." } }`;
    const result = await model.generateContent(prompt);
    res.json(extractJSON(await result.response.text()));
  } catch (err) {
    res.status(500).json({ error: "Failed to generate summary." });
  }
});

// ==========================================
// 🎙️ 6. FULL SCRIPT GENERATOR
// ==========================================
app.post("/generate-script", async (req, res) => {
  try {
    const { slides } = req.body;
    const prompt = `Write a professional, cohesive presentation speech script for these slides: ${JSON.stringify(slides)}.
Return JSON containing an array of strings, where each string is the speech for that specific slide.
Format: { "script": ["Slide 1 speech...", "Slide 2 speech..."] }`;
    const result = await model.generateContent(prompt);
    res.json(extractJSON(await result.response.text()));
  } catch (err) {
    res.status(500).json({ error: "Failed to generate script." });
  }
});

// ==========================================
// 👑 7. PPT RENDER ENGINE
// ==========================================
app.post("/download-ppt", async (req, res) => {
  try {
    const { data, template } = req.body;
    const activeTheme = template || "modern";
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9";

    const slides = await Promise.all(data.slides.map(async (s) => ({
      ...s, base64Image: await fetchImageBase64(s.imagePrompt),
    })));

    const safeTitle = cleanText(data.title || "Presentation");
    const THEMES = {
      modern: { bg: "09090B", titleText: "FFFFFF", accent: "6366F1", secondary: "94A3B8", font: "Helvetica" },
      business: { bg: "FFFFFF", titleText: "1D4ED8", accent: "1D4ED8", secondary: "334155", font: "Arial" },
      academic: { bg: "FDFBF7", titleText: "1E293B", accent: "0F766E", secondary: "475569", font: "Georgia" }
    };
    const tConfig = THEMES[activeTheme];

    const cover = pptx.addSlide();
    cover.background = { fill: tConfig.bg };
    if (activeTheme === "modern") {
      cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.15, fill: { color: tConfig.accent } });
      cover.addText(safeTitle.toUpperCase(), { x: 1, y: 2.2, w: 8, h: 1.5, fontSize: 44, bold: true, color: tConfig.titleText, fontFace: tConfig.font, align: "center" });
    } else {
      cover.addText(safeTitle, { x: 1, y: 2.2, w: 8, h: 1.5, fontSize: 42, bold: true, color: tConfig.titleText, fontFace: tConfig.font, align: "center" });
    }

    slides.forEach((slide, index) => {
      const s = pptx.addSlide();
      const headingText = `${slide.icon || "🔹"}  ${cleanText(slide.heading)}`; 
      const pointsArray = (slide.points || []).map(cleanText);

      if (slide.speakerNotes) s.addNotes(cleanText(slide.speakerNotes));
      s.addText(`${index + 1} / ${slides.length}`, { x: 9.0, y: 5.2, w: 0.8, h: 0.3, fontSize: 10, color: tConfig.secondary, fontFace: tConfig.font, align: "right" });
      s.background = { fill: tConfig.bg };

      if (activeTheme === "modern") {
        s.addText(headingText, { x: 0.6, y: 0.4, w: 4.8, h: 1.6, fontSize: 32, bold: true, color: tConfig.titleText, fontFace: tConfig.font, valign: "top" });
        s.addShape(pptx.ShapeType.rect, { x: 0.6, y: 2.15, w: 1.2, h: 0.03, fill: { color: tConfig.accent } });
        s.addText(pointsArray.join("\n"), { x: 0.6, y: 2.4, w: 4.6, h: 2.8, fontSize: 18, color: tConfig.secondary, fontFace: tConfig.font, valign: "top", bullet: true, lineSpacing: 44 });
        if (slide.base64Image) s.addImage({ data: slide.base64Image, x: 5.5, y: 0, w: 4.5, h: 5.625, sizing: { type: "cover", w: 4.5, h: 5.625 } });
      } 
      else if (activeTheme === "business") {
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.15, fill: { color: tConfig.accent } });
        s.addText(headingText, { x: 0.6, y: 0.4, w: 8.8, h: 1.0, fontSize: 32, bold: true, color: tConfig.titleText, fontFace: tConfig.font, valign: "top" });
        s.addText(pointsArray.join("\n"), { x: 0.6, y: 1.7, w: 4.6, h: 3.2, fontSize: 18, color: tConfig.secondary, fontFace: tConfig.font, valign: "top", bullet: true, lineSpacing: 44 });
        if (slide.base64Image) {
          s.addShape(pptx.ShapeType.rect, { x: 5.4, y: 1.7, w: 4.0, h: 3.2, fill: { color: "F8FAFC" }, line: { color: "CBD5E1", width: 1 } }); 
          s.addImage({ data: slide.base64Image, x: 5.5, y: 1.8, w: 3.8, h: 3.0, sizing: { type: "cover", w: 3.8, h: 3.0 } });
        }
      }
      else {
        s.addText(headingText, { x: 0.6, y: 0.4, w: 4.8, h: 1.6, fontSize: 30, bold: true, color: tConfig.titleText, fontFace: tConfig.font, valign: "top" });
        s.addText(pointsArray.join("\n"), { x: 0.6, y: 2.4, w: 4.6, h: 2.8, fontSize: 18, color: tConfig.secondary, fontFace: tConfig.font, valign: "top", bullet: true, lineSpacing: 44 });
        if (slide.base64Image) s.addImage({ data: slide.base64Image, x: 5.6, y: 1.1, w: 3.8, h: 3.3, sizing: { type: "cover", w: 3.8, h: 3.3 } });
      }
    });

    const buffer = await pptx.write("nodebuffer");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}.pptx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: "Export failed." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🔥 God-Level Engine running on ${PORT}`));