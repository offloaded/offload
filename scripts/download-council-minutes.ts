/**
 * Downloads all Ordinary Council Meeting minutes PDFs from the AMR Shire website.
 * Calls the internal search API directly — no browser needed.
 *
 * Usage: npx tsx scripts/download-council-minutes.ts
 */

import { mkdirSync, createWriteStream, existsSync } from "fs";
import { join } from "path";
import https from "https";

const API_URL = "https://www.amrshire.wa.gov.au/v1/aapi/search/htmlresult";
const BASE_URL = "https://www.amrshire.wa.gov.au";
const OUTPUT_DIR = join(process.cwd(), "council-minutes");
const PAGE_SIZE = 50;
const YEARS = Array.from({ length: 11 }, (_, i) => String(2025 - i)); // 2025..2015

function buildPayload(year: string, page: number) {
  return {
    SI: "MinutesAgenda",
    OB: "DocMeetingDate DESC",
    Q: "",
    PS: PAGE_SIZE,
    FS: PAGE_SIZE,
    PG: page,
    PR: [
      {
        key: "transformationname",
        values: [{ value: "AWPT.MeetingDocument.SmartSearchItem" }],
      },
      {
        key: "headertransformationname",
        values: [{ value: "AWPT.MeetingDocument.SmartSearchHeader" }],
      },
      {
        key: "footertransformationname",
        values: [{ value: "AWPT.MeetingDocument.SmartSearchFooter" }],
      },
      {
        key: "classname",
        values: [{ value: "AWPT.MeetingDocument" }],
      },
      {
        key: "searchindexes",
        values: [{ value: "MinutesAgenda" }],
      },
      { key: "keyword", values: [{ value: "" }] },
      {
        OR: true,
        key: "DocMeetingDateYear",
        operater: "like",
        values: [{ value: year }],
      },
      {
        OR: true,
        key: "DocMeetingDateMonth",
        operater: "like",
        values: [],
      },
      {
        OR: true,
        key: "MeetingTypeCode",
        operater: "like",
        values: [{ value: "OrdinaryCouncilMeeting" }],
      },
    ],
    IncludeFirst: false,
  };
}

async function fetchResults(year: string, page: number): Promise<string> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildPayload(year, page)),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.htmlResult || "";
}

function extractMinutesLinks(
  html: string
): { url: string; label: string }[] {
  // Links have: href="..." download="Label - Minutes"
  // The download attribute contains the clean label
  const regex =
    /<a\s+[^>]*href="([^"]+)"[^>]*download="([^"]*Minutes[^"]*)"[^>]*>/gi;
  const links: { url: string; label: string }[] = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    const url = match[1];
    const label = match[2].trim();
    // Only "Minutes" not "Agenda" or "Attachments"
    if (
      label.toLowerCase().includes("minutes") &&
      !label.toLowerCase().includes("agenda")
    ) {
      const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;
      links.push({ url: fullUrl, label });
    }
  }
  return links;
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const makeRequest = (requestUrl: string, redirects = 0) => {
      if (redirects > 5) {
        reject(new Error("Too many redirects"));
        return;
      }
      const urlObj = new URL(requestUrl);
      https
        .get(
          {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            headers: {
              "User-Agent": "Mozilla/5.0 (council-minutes-downloader)",
            },
          },
          (res) => {
            if (
              res.statusCode &&
              res.statusCode >= 300 &&
              res.statusCode < 400 &&
              res.headers.location
            ) {
              const redirect = res.headers.location.startsWith("http")
                ? res.headers.location
                : `${BASE_URL}${res.headers.location}`;
              makeRequest(redirect, redirects + 1);
              return;
            }
            if (res.statusCode !== 200) {
              reject(new Error(`HTTP ${res.statusCode}`));
              return;
            }
            const file = createWriteStream(dest);
            res.pipe(file);
            file.on("finish", () => {
              file.close();
              resolve();
            });
            file.on("error", reject);
          }
        )
        .on("error", reject);
    };

    makeRequest(url);
  });
}

function labelToFilename(label: string): string {
  // Extract date from "Ordinary Council Meeting - 26 November 2025 - Minutes"
  const months: Record<string, string> = {
    january: "01", february: "02", march: "03", april: "04",
    may: "05", june: "06", july: "07", august: "08",
    september: "09", october: "10", november: "11", december: "12",
  };

  const dateMatch = label.match(
    /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i
  );

  if (dateMatch) {
    const day = dateMatch[1].padStart(2, "0");
    const month = months[dateMatch[2].toLowerCase()];
    const year = dateMatch[3];
    return `${year}-${month}-${day}-OCM-Minutes.pdf`;
  }

  // Fallback: sanitize the label
  return label.replace(/[^a-zA-Z0-9-]/g, "_").slice(0, 80) + ".pdf";
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`Downloading OCM minutes to: ${OUTPUT_DIR}\n`);

  let totalDownloaded = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const year of YEARS) {
    process.stdout.write(`${year}: `);

    let page = 1;
    const allLinks: { url: string; label: string }[] = [];

    // Paginate through all results
    while (true) {
      const html = await fetchResults(year, page);
      if (!html) break;

      const links = extractMinutesLinks(html);
      allLinks.push(...links);

      // Check if there are more accordion items — if we got a full page, fetch next
      const accordionCount = (html.match(/accordion-item/g) || []).length;
      if (accordionCount >= PAGE_SIZE) {
        page++;
      } else {
        break;
      }
    }

    if (allLinks.length === 0) {
      console.log("no minutes found");
      continue;
    }

    console.log(`${allLinks.length} minutes found`);

    for (const link of allLinks) {
      const fileName = labelToFilename(link.label);
      const dest = join(OUTPUT_DIR, fileName);

      if (existsSync(dest)) {
        process.stdout.write(`  SKIP: ${fileName}\n`);
        totalSkipped++;
        continue;
      }

      try {
        process.stdout.write(`  ${fileName}...`);
        await downloadFile(link.url, dest);
        console.log(" ok");
        totalDownloaded++;
      } catch (err) {
        console.log(` FAILED (${err instanceof Error ? err.message : err})`);
        totalFailed++;
      }

      // Be polite
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  console.log(
    `\nDone! Downloaded: ${totalDownloaded} | Skipped: ${totalSkipped} | Failed: ${totalFailed}`
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
