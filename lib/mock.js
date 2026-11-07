export const mockEnabled = () => process.env.MOCK_AI === "1" && !process.env.VERCEL_ENV;

export const MOCK_AUDIT = {
  profile: { name: "Test Candidate", headline: "Mock report", years: "Not stated", location: "Not stated", stack: ["Testing"], domains: ["Testing"], strengths: ["Mock data"], summary: "This report came from local mock mode. No AI was called." },
  fit: {
    score: 62, verdict: "Mock verdict for checking the page.", breakdown: { skills: 60, seniority: 70, domain: 50, impact: 40 },
    strong: [{ point: "Mock match", evidence: "Mock evidence" }], gaps: [{ gap: "Mock gap", severity: "high", fix: "Mock fix" }],
    missingKeywords: ["mock"], rewrites: [{ before: "Before", after: "After with [X%]", why: "Mock reason" }], headline: "Mock headline",
  },
  market: [{ title: "Mock role", company: "Mock company type", requirements: ["Mock skill"], rationale: "Mock rationale", fit: 60, query: "Mock role" }],
  pivots: [{ title: "Mock pivot", fit: 80, why: "Mock reason", adjustment: "Mock change", headline: "Mock headline", keywords: ["mock pivot"] }],
};
