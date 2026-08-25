import { verifyLinkTarget } from "../fetcher";

async function run() {
  const targetUrl = "https://store.servicenow.com/store/app/9333749c1b56a2100ffacaa6624bcb77";
  console.log(`\n==================================================`);
  console.log(`  RUNNING PRODUCTION EXTERNAL LINK VERIFICATION`);
  console.log(`  Target URL: ${targetUrl}`);
  console.log(`==================================================\n`);

  const result = await verifyLinkTarget(targetUrl, targetUrl, "", 15000);
  console.log("Verification Result:");
  console.log(JSON.stringify(result, null, 2));
}

run().catch(console.error);
