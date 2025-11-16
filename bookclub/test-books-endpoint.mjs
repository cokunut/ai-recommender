#!/usr/bin/env node

/**
 * Test script for the books.getThumbnail endpoint
 * 
 * Usage:
 *   node test-books-endpoint.mjs "The Great Gatsby" "F. Scott Fitzgerald"
 *   node test-books-endpoint.mjs "1984" "George Orwell"
 */

const [title, author] = process.argv.slice(2);

if (!title || !author) {
  console.error("Usage: node test-books-endpoint.mjs <title> <author>");
  console.error('Example: node test-books-endpoint.mjs "The Great Gatsby" "F. Scott Fitzgerald"');
  process.exit(1);
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const endpoint = `${baseUrl}/api/trpc/books.getThumbnail`;

// tRPC uses a specific format for GET requests
const input = JSON.stringify({
  json: {
    title,
    author,
  },
});

const url = new URL(endpoint);
url.searchParams.set("input", input);

console.log(`Testing: ${title} by ${author}`);
console.log(`URL: ${url.toString()}\n`);

try {
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
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
    console.log("Result:", JSON.stringify(result, null, 2));
    
    if (result.thumbnail) {
      console.log(`\n📖 Thumbnail URL: ${result.thumbnail}`);
    } else if (result.found) {
      console.log("\n⚠️  Book found but no thumbnail available");
    } else {
      console.log("\n⚠️  Book not found");
    }
  } else {
    console.error("❌ Unexpected response format:");
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }
} catch (error) {
  console.error("❌ Error:", error.message);
  console.error("\nMake sure your Next.js dev server is running:");
  console.error("  npm run dev");
  process.exit(1);
}

