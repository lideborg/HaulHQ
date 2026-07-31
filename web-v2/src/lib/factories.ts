// Pure grouping for the Factories page. sellers.name and seller_brand_links
// .seller use different naming conventions, so the join key is the Yupoo
// subdomain on each side's URL.
import { yupooSubdomain } from "./sourceLink.ts";
import type { Seller } from "./types";

export interface FactoryLink {
  brand: string;
  alias: string | null;
  url: string;
}

export interface FactoryCard {
  displayName: string;
  yupooUrl: string | null;
  brands: string[];
  links: FactoryLink[];
}

export function displaySellerName(name: string): string {
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}

export function groupFactories(
  sellers: Seller[],
  links: Array<{ brand: string; alias: string | null; url: string }>,
  term: string,
): FactoryCard[] {
  const q = term.trim().toLowerCase();
  const bySub = new Map<string, FactoryLink[]>();
  for (const l of links) {
    const sub = yupooSubdomain(l.url);
    if (!sub) continue;
    const list = bySub.get(sub) ?? [];
    list.push({ brand: l.brand, alias: l.alias, url: l.url });
    bySub.set(sub, list);
  }

  const cards: FactoryCard[] = [];
  const claimed = new Set<string>();
  for (const s of sellers) {
    const sub = yupooSubdomain(s.yupoo_url);
    const myLinks = (sub ? bySub.get(sub) : undefined) ?? [];
    if (sub) claimed.add(sub);
    const brandHit = q !== "" && s.brands.some((b) => b.toLowerCase().includes(q));
    if (q === "" || brandHit || myLinks.length > 0) {
      cards.push({
        displayName: displaySellerName(s.name),
        yupooUrl: s.yupoo_url,
        brands: s.brands,
        links: myLinks,
      });
    }
  }
  // Crawled shops we never added to `sellers` still deserve a card on search.
  for (const [sub, subLinks] of bySub) {
    if (claimed.has(sub)) continue;
    cards.push({
      displayName: displaySellerName(sub),
      yupooUrl: `https://${sub}.x.yupoo.com`,
      brands: [],
      links: subLinks,
    });
  }

  cards.sort(
    (a, b) =>
      (b.links.length > 0 ? 1 : 0) - (a.links.length > 0 ? 1 : 0) ||
      a.displayName.localeCompare(b.displayName),
  );
  return cards;
}
