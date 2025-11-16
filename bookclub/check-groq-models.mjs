#!/usr/bin/env node

/**
 * Check available Groq models
 * Usage: node check-groq-models.mjs
 */

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  console.error("❌ GROQ_API_KEY not found in environment variables");
  console.error("Set it with: export GROQ_API_KEY=your-key");
  process.exit(1);
}

const url = "https://api.groq.com/openai/v1/models";

console.log("Fetching available Groq models...\n");

try {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Error: ${response.status} ${response.statusText}`);
    console.error(errorText);
    process.exit(1);
  }

  const data = await response.json();
  
  console.log("✅ Available models:\n");
  data.data.forEach((model) => {
    console.log(`  - ${model.id}`);
    if (model.owned_by) {
      console.log(`    (owned by: ${model.owned_by})`);
    }
  });
  
  console.log("\n📝 Recommended models for book recommendations:");
  const recommended = data.data
    .filter((m) => 
      m.id.includes("llama") && 
      (m.id.includes("70b") || m.id.includes("8b"))
    )
    .map((m) => m.id);
  
  if (recommended.length > 0) {
    recommended.forEach((id) => console.log(`  - ${id}`));
  } else {
    console.log("  (none found matching criteria)");
  }
} catch (error) {
  console.error("❌ Error:", error.message);
  process.exit(1);
}

