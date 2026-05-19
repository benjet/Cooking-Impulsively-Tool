import * as cheerio from "cheerio";
import type { ExtractedRecipe } from "./options";

type LdNode = Record<string, unknown> | LdNode[];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export type ExtractResult =
  | { ok: true; recipe: ExtractedRecipe }
  | { ok: false; reason: "fetch_failed" | "no_recipe_found" };

export async function extractRecipeFromUrl(url: string): Promise<ExtractResult> {
  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!res.ok) return { ok: false, reason: "fetch_failed" };
    html = await res.text();
  } catch {
    return { ok: false, reason: "fetch_failed" };
  }

  const $ = cheerio.load(html);

  const jsonLd = collectJsonLd($);
  const recipeNode = findRecipeNode(jsonLd);
  if (recipeNode) {
    const recipe = nodeToRecipe(recipeNode, $, url);
    if (recipe && recipe.ingredients.length && recipe.instructions.length) {
      return { ok: true, recipe };
    }
  }

  const micro = parseMicrodata($, url);
  if (micro && micro.ingredients.length && micro.instructions.length) {
    return { ok: true, recipe: micro };
  }

  return { ok: false, reason: "no_recipe_found" };
}

function collectJsonLd($: cheerio.CheerioAPI): LdNode[] {
  const out: LdNode[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text().trim();
    if (!raw) return;
    try {
      out.push(JSON.parse(raw));
    } catch {
      // Some sites embed multiple JSON objects or have trailing commas. Try a permissive grab.
      try {
        const repaired = raw.replace(/,\s*([}\]])/g, "$1");
        out.push(JSON.parse(repaired));
      } catch {
        // skip
      }
    }
  });
  return out;
}

function findRecipeNode(nodes: LdNode[]): Record<string, unknown> | null {
  const stack: LdNode[] = [...nodes];
  while (stack.length) {
    const cur = stack.pop()!;
    if (Array.isArray(cur)) {
      stack.push(...cur);
      continue;
    }
    if (cur && typeof cur === "object") {
      const t = (cur as Record<string, unknown>)["@type"];
      if (isRecipeType(t)) return cur as Record<string, unknown>;
      const graph = (cur as Record<string, unknown>)["@graph"];
      if (Array.isArray(graph)) stack.push(...(graph as LdNode[]));
    }
  }
  return null;
}

function isRecipeType(t: unknown): boolean {
  if (typeof t === "string") return t === "Recipe";
  if (Array.isArray(t)) return t.some((x) => x === "Recipe");
  return false;
}

function nodeToRecipe(
  node: Record<string, unknown>,
  $: cheerio.CheerioAPI,
  sourceUrl: string
): ExtractedRecipe | null {
  const title = asString(node["name"]) ?? "";
  const yieldText = firstString(node["recipeYield"]);

  const rawIngredients = node["recipeIngredient"] ?? node["ingredients"];
  const ingredients = asStringArray(rawIngredients);

  const rawInstructions = node["recipeInstructions"];
  const instructions = parseInstructions(rawInstructions);

  if (!title || !ingredients.length || !instructions.length) return null;

  const author = node["author"];
  const authorName =
    typeof author === "string"
      ? author
      : Array.isArray(author)
      ? asString((author[0] as Record<string, unknown>)?.["name"])
      : asString((author as Record<string, unknown>)?.["name"]);

  const sourceName =
    authorName ??
    $('meta[property="og:site_name"]').attr("content") ??
    safeHostname(sourceUrl);

  return {
    title,
    sourceName: sourceName ?? null,
    sourceUrl,
    yieldText: yieldText ?? null,
    ingredients,
    instructions,
  };
}

function parseInstructions(raw: unknown): string[] {
  if (!raw) return [];
  if (typeof raw === "string") {
    return raw
      .split(/\r?\n+|(?<=\.)\s+(?=[A-Z])/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(raw)) return [];

  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const s = item.trim();
      if (s) out.push(s);
      continue;
    }
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const type = obj["@type"];
      if (type === "HowToSection") {
        const sectionName = asString(obj["name"]);
        const steps = obj["itemListElement"];
        const children = parseInstructions(steps);
        for (const c of children) {
          out.push(sectionName ? `${sectionName}: ${c}` : c);
        }
      } else {
        const text = asString(obj["text"]) ?? asString(obj["name"]);
        if (text) out.push(text.trim());
      }
    }
  }
  return out;
}

function parseMicrodata(
  $: cheerio.CheerioAPI,
  sourceUrl: string
): ExtractedRecipe | null {
  const root = $('[itemtype*="schema.org/Recipe"]').first();
  if (!root.length) return null;
  const title =
    root.find('[itemprop="name"]').first().text().trim() ||
    $("h1").first().text().trim();
  const ingredients: string[] = [];
  root.find('[itemprop="recipeIngredient"], [itemprop="ingredients"]').each(
    (_, el) => {
      const t = $(el).text().trim();
      if (t) ingredients.push(t);
    }
  );
  const instructions: string[] = [];
  root.find('[itemprop="recipeInstructions"]').each((_, el) => {
    const t = $(el).text().trim();
    if (t) instructions.push(t);
  });
  const yieldText =
    root.find('[itemprop="recipeYield"]').first().text().trim() || null;
  if (!title || !ingredients.length || !instructions.length) return null;
  return {
    title,
    sourceName:
      $('meta[property="og:site_name"]').attr("content") ??
      safeHostname(sourceUrl),
    sourceUrl,
    yieldText,
    ingredients,
    instructions,
  };
}

function asString(v: unknown): string | undefined {
  if (typeof v === "string") return v.trim() || undefined;
  return undefined;
}

function firstString(v: unknown): string | undefined {
  if (Array.isArray(v)) {
    for (const x of v) {
      const s = asString(x);
      if (s) return s;
    }
    return undefined;
  }
  return asString(v);
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const s = asString(item);
    if (s) out.push(s);
  }
  return out;
}

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
