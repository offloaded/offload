/**
 * Downloads all Ordinary Council Meeting minutes PDFs from the AMR Shire website.
 * Uses the internal search API directly — no browser automation needed.
 *
 * Usage: npx tsx scripts/download-council-minutes.ts
 */

import { mkdirSync, createWriteStream, existsSync } from "fs";
import { join } from "path";
import https from "https";

const API_URL = "https://www.amrshire.wa.gov.au/v1/aapi/search/htmlresult";
const OUTPUT_DIR = join(process.cwd(), "council-minutes");
const PAGE_SIZE = 50;
const YEARS = Array.from({ length: 11 }, (_, i) => String(2025 - i)); // 2025..2015

interface SearchResult {
  html: string;
  totalCount: number;
}

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

async function searchPage(
  year: string,
  page: number
): Promise<{ links: { url: string; label: string }[]; total: number }> {
  const body = JSON.stringify(buildPayload(year, page));

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as SearchResult;

  // Parse PDF links from the returned HTML
  // Links look like: <a href="...url..." ...>Label - Minutes</a>
  const linkRegex = /<a\s+[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi;
  const links: { url: string; label: string }[] = [];
  let match;
  while ((match = linkRegex.exec(data.html)) !== null) {
    const url = match[1];
    const label = match[2].trim();
    // Only keep Minutes links (not Agenda, Attachments, etc.)
    if (
      label.toLowerCase().includes("minutes") &&
      !label.toLowerCase().includes("agenda") &&
      (url.includes(".pdf") || url.includes("getmedia"))
    ) {
      links.push({ url, label });
    }
  }

  return { links, total: data.totalCount };
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const fullUrl = url.startsWith("http")
      ? url
      : `https://www.amrshire.wa.gov.au${url}`;

    const makeRequest = (requestUrl: string) => {
      https
        .get(requestUrl, (res) => {
          // Follow redirects
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            makeRequest(res.headers.location);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} for ${requestUrl}`));
            return;
          }
          const file = createWriteStream(dest);
          res.pipe(file);
          file.on("finish", () => {
            file.close();
            resolve();
          });
          file.on("error", reject);
        })
        .on("error", reject);
    };

    makeRequest(fullUrl);
  });
}

function extractDate(label: string): string {
  // Try to extract date from labels like "Ordinary Council Meeting - 26 November 2025 - Minutes"
  const dateMatch = label.match(
    /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i
  );
  if (dateMatch) {
    const months: Record<string, string> = {
      january: "01",
      february: "02",
      march: "03",
      april: "04",
      may: "05",
      june: "06",
      july: "07",
      august: "08",
      september: "09",
      october: "10",
      november: "11",
      december: "12",
    };
    const day = dateMatch[1].padStart(2, "0");
    const month = months[dateMatch[2].toLowerCase()];
    const year = dateMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Fallback: try DD-Month-YYYY from URL
  const urlMatch = label.match(/(\d{1,2})-(\w+)-(\d{4})/);
  if (urlMatch) {
    return `${urlMatch[3]}-${urlMatch[2]}-${urlMatch[1]}`;
  }

  return label.replace(/[^a-zA-Z0-9-]/g, "_").slice(0, 60);
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`Downloading OCM minutes to: ${OUTPUT_DIR}\n`);

  let totalDownloaded = 0;
  let totalSkipped = 0;

  for (const year of YEARS) {
    console.log(`\n--- ${year} ---`);

    let page = 1;
    let allLinks: { url: string; label: string }[] = [];

    // Paginate through all results for this year
    while (true) {
      const { links, total } = await searchPage(year, page);
      allLinks.push(...links);

      if (page === 1) {
        console.log(`  Found ${total} total results for ${year}`);
      }

      // Check if there are more pages
      if (page * PAGE_SIZE >= total) break;
      page++;
    }

    if (allLinks.length === 0) {
      console.log(`  No minutes PDFs found for ${year}`);
      continue;
    }

    console.log(`  ${allLinks.length} minutes PDF(s) to download`);

    for (const link of allLinks) {
      const date = extractDate(link.label);
      const fileName = `${date}-OCM-Minutes.pdf`;
      const dest = join(OUTPUT_DIR, fileName);

      if (existsSync(dest)) {
        console.log(`  SKIP (exists): ${fileName}`);
        totalSkipped++;
        continue;
      }

      try {
        process.stdout.write(`  Downloading: ${fileName}...`);
        await downloadFile(link.url, dest);
        console.log(" done");
        totalDownloaded++;
      } catch (err) {
        console.log(` FAILED: ${err instanceof Error ? err.message : err}`);
      }

      // Small delay to be polite
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(
    `\nDone! Downloaded: ${totalDownloaded}, Skipped: ${totalSkipped}`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
