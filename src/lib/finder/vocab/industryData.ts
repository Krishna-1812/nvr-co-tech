/**
 * Apollo's industry vocabulary, written down because Apollo will not tell you it.
 *
 * There is no industry filter and no endpoint that enumerates the industries, so
 * the values have to live somewhere. They are the LinkedIn taxonomy: lowercase,
 * "&" rather than "and", and slashes preserved in the compound names. A picker
 * offering a value Apollo does not use sends a search that quietly matches
 * nothing, which is the failure this file exists to prevent.
 *
 * Data only. The matching and the picker live in ./industries.
 *
 * Generated from the source module rather than retyped: 147 industries, 21
 * families and 63 aliases is more than anyone transcribes without dropping one,
 * and a dropped industry is invisible until somebody searches for it.
 */

/** Apollo's own values, verbatim. */
export const SEED_INDUSTRIES: readonly string[] = [
  "accounting", "airlines/aviation", "alternative dispute resolution", "alternative medicine",
  "animation", "apparel & fashion", "architecture & planning", "arts & crafts", "automotive",
  "aviation & aerospace", "banking", "biotechnology", "broadcast media", "building materials",
  "business supplies & equipment", "capital markets", "chemicals",
  "civic & social organization", "civil engineering", "commercial real estate",
  "computer & network security", "computer games", "computer hardware", "computer networking",
  "computer software", "construction", "consumer electronics", "consumer goods",
  "consumer services", "cosmetics", "dairy", "defense & space", "design", "e-learning",
  "education management", "electrical/electronic manufacturing", "entertainment",
  "environmental services", "events services", "executive office", "facilities services",
  "farming", "financial services", "fine art", "fishery", "food & beverages", "food production",
  "fund-raising", "furniture", "gambling & casinos", "glass, ceramics & concrete",
  "government administration", "government relations", "graphic design",
  "health, wellness & fitness", "higher education", "hospital & health care", "hospitality",
  "human resources", "import & export", "individual & family services", "industrial automation",
  "information services", "information technology & services", "insurance",
  "international affairs", "international trade & development", "internet",
  "investment banking", "investment management", "judiciary", "law enforcement", "law practice",
  "legal services", "legislative office", "leisure, travel & tourism", "libraries",
  "logistics & supply chain", "luxury goods & jewelry", "machinery", "management consulting",
  "maritime", "market research", "marketing & advertising",
  "mechanical or industrial engineering", "media production", "medical devices",
  "medical practice", "mental health care", "military", "mining & metals",
  "motion pictures & film", "museums & institutions", "music", "nanotechnology", "newspapers",
  "nonprofit organization management", "oil & energy", "online media", "outsourcing/offshoring",
  "package/freight delivery", "packaging & containers", "paper & forest products",
  "performing arts", "pharmaceuticals", "philanthropy", "photography", "plastics",
  "political organization", "primary/secondary education", "printing",
  "professional training & coaching", "program development", "public policy",
  "public relations & communications", "public safety", "publishing", "railroad manufacture",
  "ranching", "real estate", "recreational facilities & services", "religious institutions",
  "renewables & environment", "research", "restaurants", "retail", "security & investigations",
  "semiconductors", "shipbuilding", "sporting goods", "sports", "staffing & recruiting",
  "supermarkets", "telecommunications", "textiles", "think tanks", "tobacco",
  "translation & localization", "transportation/trucking/railroad", "utilities",
  "venture capital & private equity", "veterinary", "warehousing", "wholesale",
  "wine & spirits", "wireless", "writing & editing",
];

/**
 * What people type, mapped onto the values they mean.
 *
 * Nobody types "hospital & health care"; they type "healthcare", which appears
 * nowhere in the taxonomy. Without this the honest strict filter returns nothing
 * and reads as broken. A family is a search aid, not a claim that its industries
 * are the same thing, so the picker names every value a family selects.
 *
 * No family may be named after a real Apollo value. Four once were, which put
 * two identical-looking rows in the picker meaning different things, the broad
 * one shadowing the precise one.
 */
export const FAMILIES: Readonly<Record<string, readonly string[]>> = {
  "healthcare": [
    "hospital & health care", "medical practice", "medical devices", "pharmaceuticals",
    "biotechnology", "mental health care", "health, wellness & fitness", "veterinary",
    "alternative medicine",
  ],
  "technology": [
    "computer software", "information technology & services", "internet",
    "computer & network security", "computer hardware", "computer networking", "semiconductors",
    "nanotechnology", "consumer electronics", "information services",
  ],
  "software": [
    "computer software", "internet", "information technology & services", "computer games",
  ],
  "telecom": [
    "telecommunications", "wireless",
  ],
  "finance": [
    "financial services", "banking", "insurance", "investment banking", "investment management",
    "capital markets", "venture capital & private equity", "accounting",
  ],
  "retail & consumer": [
    "retail", "consumer goods", "consumer services", "apparel & fashion",
    "luxury goods & jewelry", "supermarkets", "wholesale", "consumer electronics", "cosmetics",
    "furniture", "sporting goods",
  ],
  "manufacturing": [
    "industrial automation", "machinery", "electrical/electronic manufacturing", "automotive",
    "aviation & aerospace", "chemicals", "building materials", "plastics",
    "packaging & containers", "textiles", "mechanical or industrial engineering",
    "shipbuilding", "glass, ceramics & concrete", "paper & forest products",
  ],
  "education": [
    "education management", "higher education", "e-learning", "primary/secondary education",
    "professional training & coaching", "libraries",
  ],
  "marketing": [
    "marketing & advertising", "public relations & communications", "market research", "design",
    "graphic design",
  ],
  "media": [
    "media production", "broadcast media", "publishing", "online media", "entertainment",
    "music", "motion pictures & film", "newspapers", "animation", "photography",
    "writing & editing", "printing",
  ],
  "real estate & construction": [
    "real estate", "commercial real estate", "construction", "architecture & planning",
    "civil engineering", "building materials",
  ],
  "energy": [
    "oil & energy", "renewables & environment", "utilities", "mining & metals",
    "environmental services",
  ],
  "logistics": [
    "transportation/trucking/railroad", "logistics & supply chain", "package/freight delivery",
    "maritime", "airlines/aviation", "warehousing", "import & export",
  ],
  "hospitality & food": [
    "hospitality", "restaurants", "food & beverages", "leisure, travel & tourism",
    "recreational facilities & services", "food production", "wine & spirits",
    "gambling & casinos", "events services",
  ],
  "legal": [
    "law practice", "legal services", "alternative dispute resolution", "judiciary",
  ],
  "government": [
    "government administration", "public policy", "government relations", "military",
    "political organization", "legislative office", "public safety", "law enforcement",
    "executive office", "judiciary",
  ],
  "nonprofit": [
    "nonprofit organization management", "philanthropy", "civic & social organization",
    "international affairs", "religious institutions", "fund-raising",
    "individual & family services", "think tanks", "program development",
  ],
  "staffing": [
    "staffing & recruiting", "human resources", "professional training & coaching",
  ],
  "consulting": [
    "management consulting", "outsourcing/offshoring", "business supplies & equipment",
    "research",
  ],
  "agriculture": [
    "farming", "ranching", "dairy", "fishery", "food production", "tobacco",
  ],
  "sports & recreation": [
    "sports", "sporting goods", "recreational facilities & services", "performing arts",
  ],
};

/**
 * Aliases OF A FAMILY, so FAMILIES stays a list of industries rather than
 * doubling as a thesaurus.
 *
 * Nothing here may be an exact Apollo industry. "banking", "farming" and
 * "utilities" are all real Apollo values that were once aliased to broad
 * families, so asking for banks returned insurers and accountants: the same
 * over-broad match this module exists to prevent, one level up.
 */
export const ALIASES: Readonly<Record<string, string>> = {
  "health": "healthcare",
  "health care": "healthcare",
  "medical": "healthcare",
  "healthtech": "healthcare",
  "health tech": "healthcare",
  "pharma": "healthcare",
  "biotech": "healthcare",
  "life sciences": "healthcare",
  "hospitals": "healthcare",
  "tech": "technology",
  "it": "technology",
  "information technology": "technology",
  "saas": "software",
  "b2b software": "software",
  "cloud": "software",
  "telecommunication": "telecom",
  "telco": "telecom",
  "fintech": "finance",
  "financial": "finance",
  "financial technology": "finance",
  "insurance tech": "finance",
  "insurtech": "finance",
  "ecommerce": "retail & consumer",
  "e-commerce": "retail & consumer",
  "consumer": "retail & consumer",
  "cpg": "retail & consumer",
  "fmcg": "retail & consumer",
  "fashion": "retail & consumer",
  "industrial": "manufacturing",
  "factory": "manufacturing",
  "advertising": "marketing",
  "adtech": "marketing",
  "martech": "marketing",
  "agency": "marketing",
  "pr": "marketing",
  "edtech": "education",
  "schools": "education",
  "universities": "education",
  "proptech": "real estate & construction",
  "property": "real estate & construction",
  "supply chain": "logistics",
  "transportation": "logistics",
  "shipping": "logistics",
  "freight": "logistics",
  "travel": "hospitality & food",
  "food": "hospitality & food",
  "restaurant": "hospitality & food",
  "hotels": "hospitality & food",
  "tourism": "hospitality & food",
  "non-profit": "nonprofit",
  "ngo": "nonprofit",
  "charity": "nonprofit",
  "public sector": "government",
  "govtech": "government",
  "recruiting": "staffing",
  "hr": "staffing",
  "hrtech": "staffing",
  "agritech": "agriculture",
  "agtech": "agriculture",
  "renewable": "energy",
  "cleantech": "energy",
  "oil": "energy",
  "mining": "energy",
};
