// Agent answer logic for the hosted app. KB is stored as a markdown string
// (filled in by the seller via the form), so we don't read files here.

export function retrieve(kbText, query, topN = 4) {
  const q = query.toLowerCase();
  const qWords = new Set(q.split(/\W+/).filter((w) => w.length > 2));
  const blocks = (kbText || "").split(/\n\s*\n/).filter((b) => b.trim().length > 0);
  const scored = blocks
    .map((b) => {
      const lower = b.toLowerCase();
      let score = 0;
      for (const w of qWords) if (lower.includes(w)) score += 1;
      return { b, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((x) => x.b);
  return scored.length ? scored.join("\n\n") : "";
}

export async function answerFromKB(card, kbText, query, locale = "en") {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (apiKey) {
    try {
      const system = [
        `You are the sales agent for ${card.name} (${card.owner}).`,
        `Answer ONLY from the knowledge base below. If the answer is not in it, say you will confirm with a human and give the contact: ${card.contact}.`,
        `Reply in the buyer's language (detected: ${locale}).`,
        `Do not invent prices, HS codes, or lead times that are not in the knowledge base.`,
        `If the buyer asks about price negotiation, contracts, or payment terms, mark it as needing a human.`,
        "",
        "KNOWLEDGE BASE:",
        kbText,
      ].join("\n");
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: query },
          ],
          temperature: 0.2,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim() || "";
        const needsHuman = /price|negotiat|contract|payment|deposit|discount/i.test(query);
        return { text, needsHuman, sources: needsHuman ? [] : ["knowledge-base"] };
      } else {
        console.error(`[agent] live LLM call returned ${res.status} (check key / OPENAI_BASE_URL)`);
      }
    } catch (e) {
      console.error(`[agent] live LLM call failed: ${e.message} (falling back to offline stub)`);
    }
  }
  return offlineReply(card, kbText, query);
}

function offlineReply(card, kbText, query) {
  const ctx = retrieve(kbText, query);
  const needsHuman = /price|negotiat|contract|payment|deposit|discount/i.test(query);
  let text;
  if (ctx) {
    text = `【auto-reply from ${card.name}】\n${ctx}\n\n(offline stub — set OPENAI_API_KEY for a real LLM answer)`;
  } else {
    text = `Thanks for your inquiry. I don't have that detail yet. Please contact ${card.contact} and a human will follow up.`;
  }
  return { text, needsHuman: needsHuman || !ctx, sources: ctx ? ["kb (offline)"] : [] };
}
