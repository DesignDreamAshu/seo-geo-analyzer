import { checkBrowserCapability } from "../fetcher";

async function runCapabilityTest() {
  console.log("==================================================");
  console.log("   PRODUCTION BROWSER CAPABILITY DIAGNOSTIC       ");
  console.log("==================================================");

  const result = await checkBrowserCapability();
  console.log(`Capability Status: ${result.capability.toUpperCase()}`);
  console.log(`Details: ${result.details}`);

  if (result.capability === "unavailable") {
    console.error("FAIL: Browser capability unavailable.");
    process.exit(1);
  } else {
    console.log("PASS: Browser capability verified.");
    process.exit(0);
  }
}

runCapabilityTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
