/* The hand-checked certificate list behind the Certifications page.
   The AI can only recommend ids from CERTS, and the cost, validity and links people see come from this file, never from the AI.

   To update it, about every three months:
   1. Open each `url` and fix anything that changed.
   2. Move any closed certificate to RETIRED, so job ads that still ask for it get flagged.
   3. Set CHECKED to the current month. The page shows this date to visitors. */

export const CHECKED = "2026-11";

const MICROSOFT_COST = "Varies by country";
const MICROSOFT = "https://learn.microsoft.com/en-us/credentials/certifications";
const AWS = "https://aws.amazon.com/certification";
const GOOGLE = "https://cloud.google.com/learn/certification";
const DATABRICKS = "https://www.databricks.com/learn/certification";
const LINUX_FOUNDATION = "https://training.linuxfoundation.org/certification";

export const CERTS = [
  // AWS
  { id: "aws-cloud-practitioner", name: "AWS Certified Cloud Practitioner", provider: "AWS", code: "CLF-C02", level: "Beginner", skills: ["AWS basics", "cloud concepts"], cost: "$100", valid: "3 years", url: `${AWS}/certified-cloud-practitioner/` },
  { id: "aws-ai-practitioner", name: "AWS Certified AI Practitioner", provider: "AWS", code: "AIF-C01", level: "Beginner", skills: ["AI concepts", "generative AI basics", "AWS"], cost: "$100", valid: "3 years", url: `${AWS}/certified-ai-practitioner/` },
  { id: "aws-solutions-architect-associate", name: "AWS Certified Solutions Architect - Associate", provider: "AWS", code: "SAA-C03", level: "Associate", skills: ["AWS architecture", "cloud design"], cost: "$150", valid: "3 years", url: `${AWS}/certified-solutions-architect-associate/` },
  { id: "aws-developer-associate", name: "AWS Certified Developer - Associate", provider: "AWS", level: "Associate", skills: ["AWS development", "serverless", "APIs"], cost: "$150", valid: "3 years", url: `${AWS}/certified-developer-associate/` },
  { id: "aws-data-engineer-associate", name: "AWS Certified Data Engineer - Associate", provider: "AWS", code: "DEA-C01", level: "Associate", skills: ["data pipelines", "ETL", "data engineering on AWS"], cost: "$150", valid: "3 years", url: `${AWS}/certified-data-engineer-associate/` },
  { id: "aws-ml-engineer-associate", name: "AWS Certified Machine Learning Engineer - Associate", provider: "AWS", code: "MLA-C02", level: "Associate", skills: ["machine learning on AWS", "SageMaker", "MLOps"], cost: "$75 during beta", valid: "3 years", url: `${AWS}/certified-machine-learning-engineer-associate/`, note: "The English exam moved to a new version in September 2026 and is in beta, so check the official page before you book." },
  { id: "aws-genai-developer-professional", name: "AWS Certified Generative AI Developer - Professional", provider: "AWS", code: "AIP-C01", level: "Professional", skills: ["generative AI apps", "Amazon Bedrock", "AWS"], cost: "$300", valid: "3 years", url: `${AWS}/certified-generative-ai-developer-professional/` },

  // Google Cloud
  { id: "gcp-genai-leader", name: "Google Cloud Generative AI Leader", provider: "Google Cloud", level: "Beginner", skills: ["generative AI strategy", "non-technical AI roles"], cost: "$99", valid: "3 years", url: `${GOOGLE}/generative-ai-leader` },
  { id: "gcp-data-practitioner", name: "Google Cloud Associate Data Practitioner", provider: "Google Cloud", level: "Associate", skills: ["data on Google Cloud", "BigQuery", "data pipelines"], cost: "$125", valid: "See official page", url: `${GOOGLE}/data-practitioner` },
  { id: "gcp-cloud-engineer", name: "Google Cloud Associate Cloud Engineer", provider: "Google Cloud", level: "Associate", skills: ["Google Cloud operations", "deployment"], cost: "$125", valid: "3 years", url: `${GOOGLE}/cloud-engineer` },
  { id: "gcp-cloud-architect", name: "Google Cloud Professional Cloud Architect", provider: "Google Cloud", level: "Professional", skills: ["Google Cloud architecture", "cloud design"], cost: "$200", valid: "2 years", url: `${GOOGLE}/cloud-architect` },
  { id: "gcp-data-engineer", name: "Google Cloud Professional Data Engineer", provider: "Google Cloud", level: "Professional", skills: ["data engineering on Google Cloud", "BigQuery", "data pipelines"], cost: "$200", valid: "2 years", url: `${GOOGLE}/data-engineer` },
  { id: "gcp-ml-engineer", name: "Google Cloud Professional Machine Learning Engineer", provider: "Google Cloud", level: "Professional", skills: ["machine learning on Google Cloud", "Vertex AI", "MLOps", "generative AI"], cost: "$200", valid: "2 years", url: `${GOOGLE}/machine-learning-engineer` },

  // Microsoft
  { id: "ms-azure-fundamentals", name: "Microsoft Certified: Azure Fundamentals", provider: "Microsoft", code: "AZ-900", level: "Beginner", skills: ["Azure basics", "cloud concepts"], cost: MICROSOFT_COST, valid: "No renewal listed", url: `${MICROSOFT}/azure-fundamentals/` },
  { id: "ms-ai-fundamentals", name: "Microsoft Certified: Azure AI Fundamentals", provider: "Microsoft", code: "AI-901", level: "Beginner", skills: ["AI concepts", "Azure AI"], cost: MICROSOFT_COST, valid: "See official page", url: `${MICROSOFT}/azure-ai-fundamentals/` },
  { id: "ms-azure-administrator", name: "Microsoft Certified: Azure Administrator Associate", provider: "Microsoft", code: "AZ-104", level: "Associate", skills: ["Azure administration", "networking", "identity"], cost: MICROSOFT_COST, valid: "Renew free every 12 months", url: `${MICROSOFT}/azure-administrator/` },
  { id: "ms-mlops", name: "Microsoft Certified: Machine Learning Operations Engineer Associate", provider: "Microsoft", code: "AI-300", level: "Associate", skills: ["MLOps", "GenAIOps", "Azure Machine Learning", "Microsoft Foundry"], cost: MICROSOFT_COST, valid: "See official page", url: `${MICROSOFT}/operationalizing-machine-learning-and-generative-ai-solutions/` },
  { id: "ms-ai-apps-agents", name: "Microsoft Certified: Azure AI Apps and Agents Developer Associate", provider: "Microsoft", code: "AI-103", level: "Associate", skills: ["generative AI apps", "AI agents", "Microsoft Foundry", "Python"], cost: MICROSOFT_COST, valid: "See official page", url: `${MICROSOFT}/azure-ai-apps-and-agents-developer-associate/` },
  { id: "ms-ai-cloud-dev", name: "Microsoft Certified: Azure AI Cloud Developer Associate", provider: "Microsoft", code: "AI-200", level: "Associate", skills: ["Azure back-end development", "containers", "vector databases"], cost: MICROSOFT_COST, valid: "See official page", url: `${MICROSOFT}/azure-ai-cloud-developer-associate/` },
  { id: "ms-cloud-ai-security", name: "Microsoft Certified: Cloud and AI Security Engineer Associate", provider: "Microsoft", code: "SC-500", level: "Associate", skills: ["Azure security", "identity", "AI security"], cost: MICROSOFT_COST, valid: "See official page", url: `${MICROSOFT}/cloud-and-ai-security-engineer-associate/`, note: "This exam replaced AZ-500 recently, so check on the official page that it's open before you book." },
  { id: "ms-solutions-architect", name: "Microsoft Certified: Azure Solutions Architect Expert", provider: "Microsoft", code: "AZ-305", level: "Expert", skills: ["Azure architecture", "cloud design"], cost: MICROSOFT_COST, valid: "Renew free online", needs: "Azure Administrator Associate first", url: `${MICROSOFT}/azure-solutions-architect/` },
  { id: "ms-devops-expert", name: "Microsoft Certified: DevOps Engineer Expert", provider: "Microsoft", code: "AZ-400", level: "Expert", skills: ["DevOps", "CI/CD", "GitHub", "Azure DevOps"], cost: MICROSOFT_COST, valid: "Renew free online", needs: "Azure Administrator Associate first", url: `${MICROSOFT}/devops-engineer/` },
  { id: "ms-fabric-data-engineer", name: "Microsoft Certified: Fabric Data Engineer Associate", provider: "Microsoft", code: "DP-700", level: "Associate", skills: ["Microsoft Fabric", "data engineering", "PySpark", "SQL"], cost: MICROSOFT_COST, valid: "Renew free online", url: `${MICROSOFT}/fabric-data-engineer-associate/` },
  { id: "ms-fabric-analytics", name: "Microsoft Certified: Fabric Analytics Engineer Associate", provider: "Microsoft", code: "DP-600", level: "Associate", skills: ["Microsoft Fabric", "semantic models", "SQL", "DAX"], cost: MICROSOFT_COST, valid: "Renew free every 12 months", url: `${MICROSOFT}/fabric-analytics-engineer-associate/` },
  { id: "ms-power-bi", name: "Microsoft Certified: Power BI Data Analyst Associate", provider: "Microsoft", code: "PL-300", level: "Associate", skills: ["Power BI", "data analysis", "DAX", "dashboards"], cost: MICROSOFT_COST, valid: "Renew free every 12 months", url: `${MICROSOFT}/data-analyst-associate/` },

  // Containers and infrastructure
  { id: "cka", name: "Certified Kubernetes Administrator", provider: "Linux Foundation", code: "CKA", level: "Professional", skills: ["Kubernetes administration", "clusters"], cost: "$445", valid: "2 years", url: `${LINUX_FOUNDATION}/certified-kubernetes-administrator-cka/` },
  { id: "ckad", name: "Certified Kubernetes Application Developer", provider: "Linux Foundation", code: "CKAD", level: "Professional", skills: ["Kubernetes", "deploying applications"], cost: "$445", valid: "2 years", url: `${LINUX_FOUNDATION}/certified-kubernetes-application-developer-ckad/` },
  { id: "terraform-associate", name: "HashiCorp Certified: Terraform Associate", provider: "HashiCorp", code: "004", level: "Associate", skills: ["Terraform", "infrastructure as code"], cost: "$70.50", valid: "2 years", url: "https://developer.hashicorp.com/certifications/terraform-associate" },

  // Data platforms
  { id: "databricks-data-engineer", name: "Databricks Certified Data Engineer Associate", provider: "Databricks", level: "Associate", skills: ["Databricks", "Spark", "data engineering"], cost: "$200", valid: "2 years", url: `${DATABRICKS}/data-engineer-associate` },
  { id: "databricks-ml", name: "Databricks Certified Machine Learning Associate", provider: "Databricks", level: "Associate", skills: ["Databricks", "machine learning", "MLflow"], cost: "$200", valid: "2 years", url: `${DATABRICKS}/machine-learning-associate` },

  // Security
  { id: "comptia-security-plus", name: "CompTIA Security+", provider: "CompTIA", code: "SY0-701", level: "Associate", skills: ["cybersecurity basics", "security operations"], cost: "See official page", valid: "See official page", url: "https://www.comptia.org/en-us/certifications/security/", note: "A new version is expected around 17 November 2026, so check which one to book." },
  { id: "cissp", name: "CISSP", provider: "ISC2", level: "Expert", skills: ["security leadership", "security architecture", "risk management"], cost: "$749", valid: "3-year cycle, plus $135 a year", needs: "5 years of relevant work experience", url: "https://www.isc2.org/certifications/cissp", note: "A new exam outline starts on 15 April 2027." },

  // Agile
  { id: "psm-1", name: "Professional Scrum Master I", provider: "Scrum.org", code: "PSM I", level: "Associate", skills: ["Scrum", "agile delivery"], cost: "$200", valid: "Does not expire", url: "https://www.scrum.org/assessments/professional-scrum-master-i-certification" },
];

// Closed certificates that job ads and CVs still mention. `match` lists how people write them, in lowercase.
// Keep each one specific: "azure data engineer" alone is also an ordinary job title.
export const RETIRED = [
  { name: "Azure Data Engineer Associate", code: "DP-203", closed: "31 March 2025", match: ["dp-203", "azure data engineer associate"], replacedBy: "ms-fabric-data-engineer" },
  { name: "AWS Certified Machine Learning - Specialty", code: "MLS-C01", closed: "31 March 2026", match: ["mls-c01", "machine learning - specialty", "machine learning specialty", "ml specialty"], replacedBy: "aws-ml-engineer-associate" },
  { name: "Azure Data Scientist Associate", code: "DP-100", closed: "1 June 2026", match: ["dp-100", "azure data scientist associate"], replacedBy: "ms-mlops" },
  { name: "Azure AI Fundamentals (old exam)", code: "AI-900", closed: "30 June 2026", match: ["ai-900"], replacedBy: "ms-ai-fundamentals" },
  { name: "Azure AI Engineer Associate", code: "AI-102", closed: "30 June 2026", match: ["ai-102", "azure ai engineer associate"], replacedBy: "ms-ai-apps-agents" },
  { name: "Azure Developer Associate", code: "AZ-204", closed: "31 July 2026", match: ["az-204", "azure developer associate"], replacedBy: "ms-ai-cloud-dev" },
  { name: "Azure Security Engineer Associate", code: "AZ-500", closed: "31 August 2026", match: ["az-500", "azure security engineer associate"], replacedBy: "ms-cloud-ai-security" },
];

const byId = new Map(CERTS.map((cert) => [cert.id, cert]));

// One line per certificate, so a request stays small.
export const catalogueForAI = () =>
  CERTS.map(({ id, name, level, skills, needs }) => [id, name, level, skills.join(", "), needs].filter(Boolean).join(" | ")).join("\n");

export const retiredForAI = () => RETIRED.map(({ name, code }) => `${name} (${code})`).join("\n");

const squash = (text) => text.toLowerCase().replace(/\s+/g, " ").trim();
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mentions = (text, { match }) => match.some((name) => new RegExp(`(?<![a-z0-9])${escapeRegex(name)}(?![a-z0-9])`).test(text));

// Plain text matching, not AI, so a job ad's retired certificate is flagged the same way every time.
function retiredMentions(cv, ad) {
  return RETIRED.flatMap(({ replacedBy, match, ...item }) => {
    const inAd = mentions(ad, { match });
    const inCv = mentions(cv, { match });
    return inAd || inCv ? [{ ...item, inAd, inCv, replacement: byId.get(replacedBy) }] : [];
  });
}

// Turns the AI's answer into what the page shows. Anything the list or the job ad can't back up is removed here.
export function buildPlan(raw, { cv, jobDescription }) {
  const ad = squash(jobDescription);
  const advice = raw.advice
    .filter(({ certId }) => byId.has(certId))
    .map(({ skill, why, adQuote, certId, cvLine }) => {
      const quote = adQuote.trim();
      return { skill, why, quote: quote && ad.includes(squash(quote)) ? quote : "", cert: byId.get(certId), cvLine };
    })
    .slice(0, 4);
  return { summary: raw.summary, advice, retired: retiredMentions(squash(cv), ad), hasAd: Boolean(ad) };
}

// The sample on the page before anyone runs a check. It goes through buildPlan, so its details stay in step with the list.
const EXAMPLE_INPUT = {
  cv: "Arjun Mehta. Backend engineer, five years of AWS services in Python.",
  jobDescription: "Build ML pipelines on Google Cloud. Google Professional Machine Learning Engineer or AWS Machine Learning Specialty preferred. Kubernetes experience is a plus.",
};

const EXAMPLE_PLAN = {
  summary: "Two certificates would help with this job. The ad names the first one, and the second backs up the Kubernetes experience it asks for.",
  advice: [
    {
      skill: "Machine learning on Google Cloud",
      why: "The ad prefers this certificate, and your CV has no Google Cloud work yet. It's the quickest way to show you're ready for their platform.",
      adQuote: "Google Professional Machine Learning Engineer or AWS Machine Learning Specialty preferred",
      certId: "gcp-ml-engineer",
      cvLine: "Google Cloud Professional Machine Learning Engineer, [month year]",
    },
    {
      skill: "Kubernetes",
      why: "The ad asks for Kubernetes experience, and your CV doesn't show it yet. This certificate is a clear way to show you can deploy applications on it.",
      adQuote: "Kubernetes experience is a plus",
      certId: "ckad",
      cvLine: "Certified Kubernetes Application Developer, [month year]",
    },
  ],
};

export const example = () => ({ ...buildPlan(EXAMPLE_PLAN, EXAMPLE_INPUT), count: CERTS.length, checked: CHECKED });
