// Shared Claude API caller for all AI features in ASA Destination Travel
export async function callClaude(systemPrompt, userPrompt, maxTokens = 1000) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message || "AI request failed")
  }
  const data = await response.json()
  return data.content?.[0]?.text || ""
}
