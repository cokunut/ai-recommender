#!/usr/bin/env node

/**
 * Test script for the readingRounds.generateBookRecommendations endpoint
 * 
 * Usage:
 *   node test-book-recommendations.mjs <groupId>
 *   node test-book-recommendations.mjs <groupId> <model>
 * 
 * Example:
 *   node test-book-recommendations.mjs "clx123abc"
 *   node test-book-recommendations.mjs "clx123abc" "llama-3.3-70b-versatile"
 */

const [groupId, model] = process.argv.slice(2);

if (!groupId) {
  console.error("Usage: node test-book-recommendations.mjs <groupId> [model]");
  console.error('Example: node test-book-recommendations.mjs "clx123abc"');
  console.error('Example: node test-book-recommendations.mjs "clx123abc" "mixtral-8x7b-32768"');
  console.error("\nTo get a groupId:");
  console.error("  1. Start your dev server: npm run dev");
  console.error("  2. Visit http://localhost:3000/clubs");
  console.error("  3. Create a club or use an existing one");
  console.error("  4. Copy the club ID from the URL or database");
  process.exit(1);
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const endpoint = `${baseUrl}/api/trpc/readingRounds.generateBookRecommendations`;

// tRPC uses a specific format for mutations (POST requests)
const input = {
  json: {
    groupId,
    ...(model && { model }),
  },
};

console.log(`Testing book recommendations for group: ${groupId}`);
if (model) {
  console.log(`Using model: ${model}`);
}
console.log(`URL: ${endpoint}\n`);

try {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`❌ Error: ${response.status} ${response.statusText}`);
    console.error(text);
    process.exit(1);
  }

  const data = await response.json();
  
  if (data.result?.data?.json) {
    const result = data.result.data.json;
    console.log("✅ Success!\n");
    console.log("=".repeat(60));
    console.log("BOOK RECOMMENDATIONS");
    console.log("=".repeat(60));
    console.log(`\nGroup: ${result.context.groupName}`);
    console.log(`Members: ${result.context.memberCount}`);
    console.log(`Model: ${result.context.model}\n`);
    
    result.recommendations.forEach((book, idx) => {
      console.log(`${idx + 1}. ${book.title}`);
      console.log(`   by ${book.author}`);
      if (book.reasoning) {
        console.log(`   ${book.reasoning}`);
      }
      console.log();
    });
    
    console.log("=".repeat(60));
    console.log("\nFull JSON response:");
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.error("❌ Unexpected response format:");
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }
} catch (error) {
  console.error("❌ Error:", error.message);
  console.error("\nMake sure:");
  console.error("  1. Your Next.js dev server is running: npm run dev");
  console.error("  2. GROQ_API_KEY is set in your .env file");
  console.error("  3. The groupId exists and has members");
  process.exit(1);
}

