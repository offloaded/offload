import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Intercept network requests to find the API
  const apiCalls: { url: string; method: string; postData?: string }[] = [];
  page.on("request", (req) => {
    if (req.url().includes("SmartSearch") || req.url().includes("search") || req.url().includes("api")) {
      apiCalls.push({
        url: req.url(),
        method: req.method(),
        postData: req.postData() || undefined,
      });
    }
  });

  await page.goto(
    "https://www.amrshire.wa.gov.au/shire-and-council/council/council-meeting-agendas-and-minutes",
    { waitUntil: "networkidle" }
  );

  console.log("=== API CALLS ON LOAD ===");
  apiCalls.forEach((c) => console.log(`${c.method} ${c.url}\n${c.postData || ""}\n`));

  // Clear and re-track
  apiCalls.length = 0;

  // Check the checkboxes programmatically via JS, then expand dropdown and click
  await page.evaluate(() => {
    // Check OCM
    const ocm = document.getElementById("chkMeetingType_OrdinaryCouncilMeeting") as HTMLInputElement;
    if (ocm) { ocm.checked = true; ocm.dispatchEvent(new Event("change", { bubbles: true })); }
    // Check 2024
    const yr = document.getElementById("chkYear_2024") as HTMLInputElement;
    if (yr) { yr.checked = true; yr.dispatchEvent(new Event("change", { bubbles: true })); }
  });

  // Click Search button
  await page.click("#applyFilterBtn");

  // Wait for results to load
  await page.waitForTimeout(5000);

  console.log("=== API CALLS AFTER SEARCH ===");
  apiCalls.forEach((c) => console.log(`${c.method} ${c.url}\nPOST: ${c.postData?.slice(0, 500) || "(none)"}\n`));

  // Get results
  const results = await page.evaluate(() => {
    const html = document.querySelector(".search-results-wrapper, .smartSearchResults, [class*='search-result']");
    if (html) return html.innerHTML.slice(0, 3000);

    // Try broader search
    const allLinks = document.querySelectorAll("a[href]");
    const pdfLinks = Array.from(allLinks)
      .filter((a) => {
        const href = (a as HTMLAnchorElement).href;
        const text = a.textContent?.toLowerCase() || "";
        return href.includes(".pdf") || href.includes("getmedia") || text.includes("minute");
      })
      .map((a) => `${(a as HTMLAnchorElement).href} | ${a.textContent?.trim()?.slice(0, 80)}`);

    if (pdfLinks.length > 0) return "PDF Links:\n" + pdfLinks.join("\n");

    // Show the full page text to find results
    return "PAGE TEXT (after search):\n" + document.body.innerText.slice(0, 3000);
  });

  console.log("\n=== RESULTS ===");
  console.log(results);

  await browser.close();
})();
