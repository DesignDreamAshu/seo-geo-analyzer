import axios from "axios";
import got from "got";
import { fetchPageHtml } from "../fetcher";

const testUrls = [
  "https://www.botconsulting.io/",
  "https://www.botconsulting.io/about-us",
  "https://www.botconsulting.io/solutions",
  "https://www.botconsulting.io/blogs",
  "https://www.botconsulting.io/post/why-bot-consulting-the-500m-blueprint-for-venture-scale-gdcs",
  "https://www.botconsulting.io/solution-snowflake",
  "https://www.botconsulting.io/jobopenings/121722000005997850",
];

async function runTest() {
  console.log("==================================================================");
  console.log("   COMPRESSION INVESTIGATION ON LIVE BOT CONSULTING URLS          ");
  console.log("==================================================================\n");

  for (const url of testUrls) {
    console.log(`\nTesting URL: ${url}`);

    // Test with fetchPageHtml (Dream SEO Crawler Core Fetcher)
    try {
      const fetchResult = await fetchPageHtml(url);
      console.log(`  [fetchPageHtml - Dream SEO Engine Result]`);
      console.log(`    Status: ${fetchResult.statusCode}`);
      console.log(`    Content-Encoding: ${fetchResult.headers["content-encoding"] || "UNDEFINED"}`);
      console.log(`    Server: ${fetchResult.headers["server"] || "N/A"}`);
      console.log(`    Vary: ${fetchResult.headers["vary"] || "N/A"}`);
      console.log(`    HTML Byte Length: ${fetchResult.byteSize} bytes (${(fetchResult.byteSize / 1024).toFixed(1)} KB)`);
    } catch (e: any) {
      console.error(`  fetchPageHtml error on ${url}:`, e.message);
    }
  }
}

runTest().catch(console.error);
