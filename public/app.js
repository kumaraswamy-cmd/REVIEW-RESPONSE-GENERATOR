"use strict";

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

const SAMPLE_REVIEWS = [
  {
    businessName: "Kumar Family Dental",
    businessCategory: "dental clinic",
    city: "Pune",
    reviewerName: "Asha",
    platform: "Google",
    rating: 5,
    keywords: "family dentist, teeth cleaning",
    reviewText: "The staff was friendly, the clinic was clean, and my teeth cleaning appointment started on time. Great experience from start to finish."
  },
  {
    businessName: "Mango Leaf Cafe",
    businessCategory: "cafe",
    city: "Bengaluru",
    reviewerName: "Rohan",
    platform: "Yelp",
    rating: 3,
    keywords: "coffee, brunch cafe",
    reviewText: "The coffee was excellent and the place is nice, but the wait for our food was longer than expected."
  },
  {
    businessName: "North Star Auto Repair",
    businessCategory: "auto repair shop",
    city: "Mumbai",
    reviewerName: "Priya",
    platform: "Google",
    rating: 1,
    keywords: "car service, auto repair",
    reviewText: "I was disappointed because the repair took two extra days and no one called me with an update."
  }
];

const els = {};
const state = {
  platform: "Google",
  rating: 5,
  drafts: [],
  selectedDraft: 0,
  latestPayload: null,
  history: loadHistory()
};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindControls();
  renderHistory();
  checkAiStatus();
  if (window.lucide) {
    window.lucide.createIcons();
  }
});

function cacheElements() {
  [
    "businessName",
    "businessCategory",
    "city",
    "reviewerName",
    "reviewText",
    "keywords",
    "tone",
    "length",
    "callToAction",
    "generateBtn",
    "responseOutput",
    "variantTabs",
    "sentimentValue",
    "topicValue",
    "charCount",
    "keywordList",
    "riskList",
    "historyList",
    "copyBtn",
    "saveBtn",
    "downloadBtn",
    "clearHistoryBtn",
    "loadSampleBtn",
    "aiStatus",
    "toast"
  ].forEach(id => {
    els[id] = document.getElementById(id);
  });
}

function bindControls() {
  document.querySelectorAll("#platformGroup button").forEach(button => {
    button.addEventListener("click", () => {
      state.platform = button.dataset.value;
      setActiveButton("#platformGroup button", button);
    });
  });

  document.querySelectorAll("#ratingGroup button").forEach(button => {
    button.addEventListener("click", () => {
      state.rating = Number(button.dataset.value);
      setActiveButton("#ratingGroup button", button);
    });
  });

  els.generateBtn.addEventListener("click", generateResponses);
  els.copyBtn.addEventListener("click", copyResponse);
  els.saveBtn.addEventListener("click", saveCurrentDraft);
  els.downloadBtn.addEventListener("click", downloadDraft);
  els.clearHistoryBtn.addEventListener("click", clearHistory);
  els.loadSampleBtn.addEventListener("click", loadSample);
  els.responseOutput.addEventListener("input", () => {
    els.charCount.textContent = String(els.responseOutput.value.length);
  });
}

async function checkAiStatus() {
  if (location.protocol === "file:") {
    setAiStatus("Local drafting", false);
    return;
  }

  try {
    const response = await fetch("/api/status");
    const status = await response.json();
    setAiStatus(status.aiEnabled ? `AI ready: ${status.model}` : "Local drafting", status.aiEnabled);
  } catch {
    setAiStatus("Local drafting", false);
  }
}

async function generateResponses() {
  const payload = collectPayload();
  if (!payload.reviewText) {
    showToast("Paste a review first.");
    els.reviewText.focus();
    return;
  }

  state.latestPayload = payload;
  setLoading(true);

  try {
    const result = await requestDrafts(payload);
    renderResult(result);
    showToast(result.source === "openai" ? "AI drafts generated." : "Local drafts generated.");
  } catch (error) {
    const result = generateLocalResponse(payload);
    renderResult(result);
    showToast(`Using local drafts: ${error.message}`);
  } finally {
    setLoading(false);
  }
}

async function requestDrafts(payload) {
  if (location.protocol === "file:") {
    return generateLocalResponse(payload);
  }

  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Unable to generate response.");
  }
  return result;
}

function collectPayload() {
  return {
    businessName: cleanField(els.businessName.value, 80),
    businessCategory: cleanField(els.businessCategory.value, 80),
    city: cleanField(els.city.value, 80),
    platform: state.platform,
    reviewerName: cleanField(els.reviewerName.value, 60),
    rating: state.rating,
    reviewText: cleanField(els.reviewText.value, 4000),
    keywords: cleanField(els.keywords.value, 200),
    tone: els.tone.value,
    length: els.length.value,
    callToAction: els.callToAction.value
  };
}

function renderResult(result) {
  state.drafts = Array.isArray(result.drafts) ? result.drafts : [];
  state.selectedDraft = 0;
  renderVariantTabs();
  selectDraft(0);

  const analysis = result.analysis || {};
  els.sentimentValue.textContent = analysis.sentiment || "unknown";
  els.topicValue.textContent = (analysis.topics || []).join(", ") || "overall experience";
  els.charCount.textContent = String(state.drafts[0]?.response?.length || 0);
  renderChips(els.keywordList, analysis.seoTerms || [], "chip");
  renderChips(els.riskList, analysis.riskNotes || [], "risk-note");

  if (result.aiError) {
    showToast(`AI fallback used: ${result.aiError}`);
  }
}

function renderVariantTabs() {
  els.variantTabs.innerHTML = "";
  state.drafts.forEach((draft, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = index === state.selectedDraft ? "active" : "";
    button.textContent = draft.label || `Draft ${index + 1}`;
    button.addEventListener("click", () => selectDraft(index));
    els.variantTabs.appendChild(button);
  });
}

function selectDraft(index) {
  state.selectedDraft = index;
  const draft = state.drafts[index];
  els.responseOutput.value = draft?.response || "";
  els.charCount.textContent = String(els.responseOutput.value.length);
  Array.from(els.variantTabs.children).forEach((button, buttonIndex) => {
    button.classList.toggle("active", buttonIndex === index);
  });
}

async function copyResponse() {
  const text = els.responseOutput.value.trim();
  if (!text) {
    showToast("No response to copy.");
    return;
  }

  await navigator.clipboard.writeText(text);
  showToast("Copied.");
}

function saveCurrentDraft() {
  const text = els.responseOutput.value.trim();
  if (!text) {
    showToast("No response to save.");
    return;
  }

  const payload = state.latestPayload || collectPayload();
  state.history.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    createdAt: new Date().toISOString(),
    businessName: payload.businessName || "Business",
    platform: payload.platform,
    rating: payload.rating,
    reviewText: payload.reviewText,
    responseText: text
  });
  state.history = state.history.slice(0, 20);
  saveHistory();
  renderHistory();
  showToast("Draft saved.");
}

function downloadDraft() {
  const text = els.responseOutput.value.trim();
  if (!text) {
    showToast("No response to download.");
    return;
  }

  const payload = state.latestPayload || collectPayload();
  const filename = `${slugify(payload.businessName || "review-response")}.txt`;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function renderHistory() {
  els.historyList.innerHTML = "";

  if (!state.history.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No saved drafts yet.";
    els.historyList.appendChild(empty);
    return;
  }

  state.history.forEach(item => {
    const wrapper = document.createElement("div");
    wrapper.className = "history-item";
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `
      <div class="history-meta">
        <span>${escapeHtml(item.businessName)} / ${escapeHtml(item.platform)}</span>
        <span>${Number(item.rating)} stars</span>
      </div>
      <div class="history-text">${escapeHtml(item.responseText)}</div>
    `;
    button.addEventListener("click", () => {
      els.responseOutput.value = item.responseText;
      els.charCount.textContent = String(item.responseText.length);
      showToast("Saved draft loaded.");
    });
    wrapper.appendChild(button);
    els.historyList.appendChild(wrapper);
  });
}

function clearHistory() {
  state.history = [];
  saveHistory();
  renderHistory();
  showToast("Saved drafts cleared.");
}

function loadSample() {
  const sample = SAMPLE_REVIEWS[Math.floor(Math.random() * SAMPLE_REVIEWS.length)];
  els.businessName.value = sample.businessName;
  els.businessCategory.value = sample.businessCategory;
  els.city.value = sample.city;
  els.reviewerName.value = sample.reviewerName;
  els.keywords.value = sample.keywords;
  els.reviewText.value = sample.reviewText;
  state.platform = sample.platform;
  state.rating = sample.rating;
  document.querySelectorAll("#platformGroup button").forEach(button => {
    button.classList.toggle("active", button.dataset.value === sample.platform);
  });
  document.querySelectorAll("#ratingGroup button").forEach(button => {
    button.classList.toggle("active", Number(button.dataset.value) === sample.rating);
  });
}

function generateLocalResponse(payload) {
  const analysis = analyzeReview(payload);
  const name = firstName(payload.reviewerName) || "there";
  const business = payload.businessName || "our business";
  const platform = payload.platform || "Google";
  const seoPhrase = buildSeoPhrase(payload);
  const detail = extractReviewDetail(payload.reviewText, analysis.topics);

  const variants = [
    buildDraft({ payload, analysis, name, business, platform, seoPhrase, detail, style: "balanced" }),
    buildDraft({ payload, analysis, name, business, platform, seoPhrase, detail, style: "specific" }),
    buildDraft({ payload, analysis, name, business, platform, seoPhrase, detail, style: "short" })
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
    const closer = cta === "Ask for update" ? "We hope to see you again soon." : "We look forward to welcoming you back.";
    return compact([opener, middle, isShort ? "" : seo, closer].join(" "));
  }

  if (rating === 3) {
    const opener = `Hi ${name}, thank you for sharing this feedback about your visit to ${business}.`;
    const middle = analysis.positiveHits.length
      ? `We are glad ${analysis.positiveHits[0]} worked well, and we also hear where the experience could have been better.`
      : "We appreciate the honest note and understand there were parts of the experience that could have been better.";
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
  if (category && city) return `${category} in ${city}`;
  if (category) return category;
  if (city) return `local business in ${city}`;
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
  return sentence.length > 90 ? sentence.slice(0, 87).trim() : sentence.replace(/[.!?]+$/g, "");
}

function setActiveButton(selector, activeButton) {
  document.querySelectorAll(selector).forEach(button => {
    button.classList.toggle("active", button === activeButton);
  });
}

function setLoading(isLoading) {
  els.generateBtn.classList.toggle("loading", isLoading);
  els.generateBtn.disabled = isLoading;
  els.generateBtn.innerHTML = isLoading
    ? '<i data-lucide="loader-2"></i> Generating'
    : '<i data-lucide="sparkles"></i> Generate responses';
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function setAiStatus(text, isReady) {
  els.aiStatus.classList.toggle("ready", isReady);
  els.aiStatus.innerHTML = `<i data-lucide="${isReady ? "sparkles" : "cpu"}"></i><span>${escapeHtml(text)}</span>`;
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function renderChips(container, items, className) {
  container.innerHTML = "";
  items.forEach(item => {
    const chip = document.createElement("span");
    chip.className = className;
    chip.textContent = item;
    container.appendChild(chip);
  });
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 2600);
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem("review_response_history_v1")) || [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem("review_response_history_v1", JSON.stringify(state.history));
}

function cleanField(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function slugify(value) {
  return String(value || "review-response")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "review-response";
}
