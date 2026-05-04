// Shapes from data/notes/*.json. Liberal optionality because these files
// have grown organically.

export type SellerVerdict = "trusted" | "use-via-agent" | "avoid" | "unknown";

export interface Seller {
  name: string;
  yupoo?: string;
  contact?: Record<string, string | string[] | Record<string, unknown> | null>;
  specialty?: string;
  verdict?: SellerVerdict;
  notes?: string;
  reachable?: string | null;
  yupoo_password?: string;
}

export interface SellersFile {
  updated: string;
  verdict_legend: Record<SellerVerdict, string>;
  sellers: Seller[];
}

export interface AbbreviationEntry {
  abbr: string;
  brand: string;
  category?: string;
  notes?: string;
}

export interface TerminologyEntry {
  term: string;
  meaning: string;
}

export interface GlossaryFile {
  updated: string;
  abbreviations: AbbreviationEntry[];
  terminology: TerminologyEntry[];
}

export interface GuideEntry {
  slug: string;
  title: string;
  file: string; // relative to data/notes/, but resolves into research/
}

export interface NotesIndex {
  guides: GuideEntry[];
}

export interface RenderedGuide {
  slug: string;
  title: string;
  html: string;
}

export interface SellerMessageTemplate {
  key: string;
  label: string;
  seller_name_pattern: string; // case-insensitive substring match against item.seller
  intro: string;
  line_format: string;
  closing: string;
}

export interface SellerMessagesFile {
  _note?: string;
  templates: SellerMessageTemplate[];
}
