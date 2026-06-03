"use strict";

const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const PORT = Number(process.env.PORT || 5187);
const HOST = process.env.HOST || "127.0.0.1";
const PUBLIC_DIR = path.join(__dirname, "public");
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

const TOPIC_BANK = [
  { label: "service", terms: ["service", "staff", "team", "employee", "owner", "friendly", "helpful", "rude"] },
  { label: "quality", terms: ["quality", "fresh", "clean", "professional", "care", "detail", "work"] },
  { label: "speed", terms: ["fast", "quick", "slow", "wait", "late", "delay", "timely", "appointment"] },
  { label: "price", terms: ["price", "cost", "expensive", "cheap", "value", "affordable", "overcharged"] },
  { label: "food", terms: ["food", "meal", "dish", "coffee", "taste", "flavor", "menu"] },
  { label: "location", terms: ["location", "parking", "area", "store", "shop", "office", "place"] },
  { label: "delivery", terms: ["delivery", "pickup", "order", "driver", "package"] },
  { label: "cleanliness", terms: ["clean", "dirty", "hygiene", "spotless", "mess"] }
];

const NEGATIVE_TERMS = ["bad", "terrible", "awful", "rude", "dirty", "slow", "late", "cold", "broken", "wrong", "overcharged", "disappointed", "refund", "never"];
const POSITIVE_TERMS = ["great", "excellent", "amazing", "friendly", "helpful", "fresh", "clean", "fast", "professional", "perfect", "love", "best"];

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/api/status") {
      return sendJson(response, 200, {
        aiEnabled: Boolean(process.env.OPENAI_API_KEY),
        model: process.env.OPENAI_API_KEY ? OPENAI_MODEL : "local-generator"
      });
    }

    if (request.method === "POST" && url.pathname === "/api/generate") {
      const payload = await readJsonBody(request);
      const cleanedPayload = normalizePayload(payload);

      if (!cleanedPayload.reviewText) {
        return sendJson(response, 400, { error: "Review text is required." });
      }

      if (process.env.OPENAI_API_KEY) {
        try {
          const aiResult = await generateWithOpenAI(cleanedPayload);
          return sendJson(response, 200, aiResult);
        } catch (error) {
          const fallback = generateLocalResponse(cleanedPayload);
          fallback.source = "local-fallback";
          fallback.aiError = error.message;
          return sendJson(response, 200, fallback);
        }
      }

      return sendJson(response, 200, generateLocalResponse(cleanedPayload));
    }

    if (request.method !== "GET") {
      return sendJson(response, 405, { error: "Method not allowed." });
    }

    return serveStatic(url.pathname, response);
  } catch (error) {
    return sendJson(response, 500, { error: error.message || "Unexpected server error." });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Review Response Generator running at http://${HOST}:${PORT}/`);
  if (!process.env.OPENAI_API_KEY) {
    console.log("OPENAI_API_KEY is not set; using the local drafting engine.");
  }
});

async function serveStatic(urlPath, response) {
  const safePath = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(PUBLIC_DIR, safePath === "/" ? "index.html" : safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendJson(response, 403, { error: "Forbidden." });
  }

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(data);
  } catch {
    const fallback = await fs.readFile(path.join(PUBLIC_DIR, "index.html"));
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    });
    response.end(fallback);
  }
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON request body."));
      }
    });
    request.on("error", reject);
  });
}

async function generateWithOpenAI(payload) {
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      source: { type: "string" },
      drafts: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            response: { type: "string" }
          },
          required: ["id", "label", "response"]
        }
      },
      analysis: {
        type: "object",
        additionalProperties: false,
        properties: {
          sentiment: { type: "string" },
          topics: { type: "array", items: { type: "string" } },
          seoTerms: { type: "array", items: { type: "string" } },
          riskNotes: { type: "array", items: { type: "string" } },
          characterCount: { type: "number" }
        },
        required: ["sentiment", "topics", "seoTerms", "riskNotes", "characterCount"]
      }
    },
    required: ["source", "drafts", "analysis"]
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You draft public replies to Google and Yelp reviews for small businesses.",
                "Return exactly three distinct response drafts in valid JSON.",
                "Use the reviewer name when supplied.",
                "Match the star rating and review content.",
                "For negative reviews, acknowledge the issue, apologize without over-admitting liability, invite direct follow-up, and avoid arguing.",
                "For positive reviews, sound specific and grateful.",
                "For neutral reviews, balance appreciation with a concrete improvement note.",
                "Make the copy SEO-friendly by naturally using the business category, city, and supplied keywords once where appropriate.",
                "Never mention SEO, search rankings, AI, policies, incentives, or discounts.",
                "Do not claim that the business has already fixed something unless the review says so."
              ].join(" ")
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(payload)
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "review_response_result",
          strict: true,
          schema
        }
      },
      temperature: 0.8,
      max_output_tokens: 1400
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `OpenAI request failed with ${response.status}`);
  }

  const outputText = extractOutputText(data);
  if (!outputText) {
    throw new Error("OpenAI returned no response text.");
  }

  const parsed = JSON.parse(outputText);
  parsed.source = "openai";
  parsed.analysis.characterCount = parsed.drafts[0]?.response?.length || 0;
  return parsed;
}

function extractOutputText(data) {
  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  if (Array.isArray(data.output)) {
    return data.output
      .flatMap(item => item.content || [])
      .map(part => part.text || "")
      .join("")
      .trim();
  }

  return "";
}

function normalizePayload(payload) {
  return {
    businessName: cleanField(payload.businessName, 80),
    businessCategory: cleanField(payload.businessCategory, 80),
    city: cleanField(payload.city, 80),
    platform: cleanField(payload.platform || "Google", 20),
    reviewerName: cleanField(payload.reviewerName, 60),
    rating: clampNumber(Number(payload.rating || 5), 1, 5),
    reviewText: cleanField(payload.reviewText, 4000),
    keywords: cleanField(payload.keywords, 200),
    tone: cleanField(payload.tone || "Professional", 40),
    length: cleanField(payload.length || "Standard", 40),
    callToAction: cleanField(payload.callToAction || "Invite return visit", 60)
  };
}

function generateLocalResponse(payload) {
  const analysis = analyzeReview(payload);
  const name = firstName(payload.reviewerName) || "there";
  const business = payload.businessName || "our business";
  const category = payload.businessCategory || "local business";
  const platform = payload.platform || "Google";
  const seoPhrase = buildSeoPhrase(payload);
  const detail = extractReviewDetail(payload.reviewText, analysis.topics);

  const variants = [
    buildDraft({
      payload,
      analysis,
      name,
      business,
      category,
      platform,
      seoPhrase,
      detail,
      style: "balanced"
    }),
    buildDraft({
      payload,
      analysis,
      name,
      business,
      category,
      platform,
      seoPhrase,
      detail,
      style: "specific"
    }),
    buildDraft({
      payload,
      analysis,
      name,
      business,
      category,
      platform,
      seoPhrase,
      detail,
      style: "short"
    })
  ];

  return {
    source: "local",
    drafts: variants.map((response, index) => ({
      id: ["balanced", "specific", "concise"][index],
      label: ["Balanced", "Personal", "Concise"][index],
      response
    })),
    analysis: {
      sentiment: analysis.sentiment,
      topics: analysis.topics,
      seoTerms: analysis.seoTerms,
      riskNotes: analysis.riskNotes,
      characterCount: variants[0].length
    }
  };
}

function buildDraft(context) {
  const { payload, analysis, name, business, platform, seoPhrase, detail, style } = context;
  const rating = payload.rating;
  const cta = payload.callToAction;
  const isShort = payload.length === "Short" || style === "short";
  const isDetailed = payload.length === "Detailed" && style !== "short";

  if (rating >= 4) {
    const opener = style === "specific"
      ? `Hi ${name}, thank you for the ${rating}-star review and for mentioning "${detail}."`
      : `Hi ${name}, thank you for taking the time to leave us a ${rating}-star review on ${platform}.`;
    const middle = `We are glad your experience with ${business} stood out, and our team appreciates the kind words.`;
    const seo = seoPhrase ? buildPositiveSeoSentence(payload) : "";
    const closer = cta === "Ask for update"
      ? "We hope to see you again soon."
      : "We look forward to welcoming you back.";
    return compact([opener, middle, isShort ? "" : seo, closer].join(" "));
  }

  if (rating === 3) {
    const opener = `Hi ${name}, thank you for sharing this feedback about your visit to ${business}.`;
    const middle = analysis.positiveHits.length
      ? `We are glad ${analysis.positiveHits[0]} worked well, and we also hear where the experience could have been better.`
      : `We appreciate the honest note and understand there were parts of the experience that could have been better.`;
    const concern = analysis.negativeHits.length
      ? `Your comments about ${analysis.negativeHits[0]} will help us improve.`
      : "Your comments will help us improve the next visit.";
    const seo = seoPhrase && isDetailed ? `${buildBusinessRole(payload)} we take this kind of feedback seriously.` : "";
    return compact([opener, middle, concern, seo, "Thank you again for giving us the chance to do better."].join(" "));
  }

  const opener = `Hi ${name}, we are sorry your experience with ${business} did not meet expectations.`;
  const concern = analysis.negativeHits.length
    ? `Thank you for calling out the issue with ${analysis.negativeHits[0]}; we understand how frustrating that can be.`
    : "Thank you for letting us know what happened; we understand how frustrating that can be.";
  const seo = seoPhrase && isDetailed ? `Our ${buildTeamPhrase(payload)} wants every customer to feel heard and taken care of.` : "";
  const followUp = cta === "Invite return visit"
    ? "Please contact us directly so we can learn more and work toward making this right."
    : "Please contact us directly so we can look into this with the right context.";
  return compact([opener, concern, seo, followUp].join(" "));
}

function analyzeReview(payload) {
  const text = (payload.reviewText || "").toLowerCase();
  const topics = TOPIC_BANK
    .filter(topic => topic.terms.some(term => text.includes(term)))
    .map(topic => topic.label);

  const negativeHits = NEGATIVE_TERMS.filter(term => text.includes(term));
  const positiveHits = POSITIVE_TERMS.filter(term => text.includes(term));
  let sentiment = "positive";

  if (payload.rating <= 2 || negativeHits.length > positiveHits.length + 1) {
    sentiment = "negative";
  } else if (payload.rating === 3 || (negativeHits.length && positiveHits.length)) {
    sentiment = "mixed";
  }

  const seoTerms = [
    payload.businessCategory,
    payload.city,
    ...String(payload.keywords || "").split(",")
  ]
    .map(term => cleanField(term, 50))
    .filter(Boolean)
    .filter((term, index, list) => list.findIndex(item => item.toLowerCase() === term.toLowerCase()) === index)
    .slice(0, 6);

  const riskNotes = [];
  if (payload.rating <= 2) {
    riskNotes.push("Move detailed dispute resolution to a private conversation.");
  }
  if (/refund|lawsuit|injury|sick|unsafe|harass/i.test(payload.reviewText)) {
    riskNotes.push("Review before posting because the customer mentions a sensitive issue.");
  }
  riskNotes.push("Avoid incentives or keyword stuffing in public replies.");

  return {
    sentiment,
    topics: topics.length ? topics : ["overall experience"],
    seoTerms,
    riskNotes,
    negativeHits,
    positiveHits
  };
}

function buildSeoPhrase(payload) {
  const category = payload.businessCategory ? payload.businessCategory.trim() : "";
  const city = payload.city ? payload.city.trim() : "";

  if (category && city) {
    return `${category} in ${city}`;
  }
  if (category) {
    return category;
  }
  if (city) {
    return `local business in ${city}`;
  }
  return "";
}

function buildPositiveSeoSentence(payload) {
  const category = cleanField(payload.businessCategory, 80);
  const city = cleanField(payload.city, 80);

  if (category && city) {
    return `It means a lot to serve the ${city} community as ${withArticle(category)}.`;
  }
  if (category) {
    return `It means a lot to be trusted as ${withArticle(category)}.`;
  }
  if (city) {
    return `It means a lot to serve customers in ${city}.`;
  }
  return "";
}

function buildBusinessRole(payload) {
  const category = cleanField(payload.businessCategory, 80);
  const city = cleanField(payload.city, 80);

  if (category && city) {
    return `As ${withArticle(category)} in ${city},`;
  }
  if (category) {
    return `As ${withArticle(category)},`;
  }
  if (city) {
    return `As a local business in ${city},`;
  }
  return "As a local business,";
}

function buildTeamPhrase(payload) {
  const category = cleanField(payload.businessCategory, 80);
  const city = cleanField(payload.city, 80);

  if (category && city) {
    return `${category} team in ${city}`;
  }
  if (category) {
    return `${category} team`;
  }
  if (city) {
    return `team in ${city}`;
  }
  return "team";
}

function extractReviewDetail(reviewText, topics) {
  const clean = cleanField(reviewText, 240);
  if (!clean) {
    return topics[0] || "your experience";
  }

  const sentence = clean.split(/[.!?]/).map(item => item.trim()).find(Boolean) || clean;
  const shortened = sentence.length > 90 ? sentence.slice(0, 87).trim() : sentence.replace(/[.!?]+$/g, "");
  return shortened || topics[0] || "your experience";
}

function cleanField(value, maxLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function firstName(name) {
  return cleanField(name, 60).split(" ")[0];
}

function compact(value) {
  return value.replace(/\s+/g, " ").replace(/\s+\./g, ".").trim();
}

function withArticle(phrase) {
  const clean = cleanField(phrase, 80);
  if (/^(a|an|the)\s/i.test(clean)) {
    return clean;
  }
  return `${/^[aeiou]/i.test(clean) ? "an" : "a"} ${clean}`;
}

function clampNumber(value, min, max) {
  if (Number.isNaN(value)) {
    return max;
  }
  return Math.min(max, Math.max(min, value));
}
