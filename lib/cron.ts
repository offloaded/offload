// Minimal cron expression parser: "minute hour day-of-month month day-of-week"
// Supports: numbers, ranges (1-5), lists (1,3,5), steps (*/15), wildcards (*)

interface CronFields {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}

function parseField(field: string, min: number, max: number): number[] {
  const values = new Set<number>();

  for (const part of field.split(",")) {
    if (part === "*") {
      for (let i = min; i <= max; i++) values.add(i);
    } else if (part.includes("/")) {
      const [range, stepStr] = part.split("/");
      const step = parseInt(stepStr, 10);
      let start = min;
      let end = max;
      if (range !== "*") {
        if (range.includes("-")) {
          [start, end] = range.split("-").map(Number);
        } else {
          start = parseInt(range, 10);
        }
      }
      for (let i = start; i <= end; i += step) values.add(i);
    } else if (part.includes("-")) {
      const [a, b] = part.split("-").map(Number);
      for (let i = a; i <= b; i++) values.add(i);
    } else {
      values.add(parseInt(part, 10));
    }
  }

  return [...values].sort((a, b) => a - b);
}

export function parseCron(expression: string): CronFields {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: expected 5 fields, got ${parts.length}`);
  }

  return {
    minute: parseField(parts[0], 0, 59),
    hour: parseField(parts[1], 0, 23),
    dayOfMonth: parseField(parts[2], 1, 31),
    month: parseField(parts[3], 1, 12),
    dayOfWeek: parseField(parts[4], 0, 6),
  };
}

// Check if a given Date matches a cron expression
export function cronMatches(expression: string, date: Date): boolean {
  const fields = parseCron(expression);
  return (
    fields.minute.includes(date.getMinutes()) &&
    fields.hour.includes(date.getHours()) &&
    fields.dayOfMonth.includes(date.getDate()) &&
    fields.month.includes(date.getMonth() + 1) &&
    fields.dayOfWeek.includes(date.getDay())
  );
}

// Get the next run time after a given date
export function getNextRun(expression: string, after: Date): Date {
  const fields = parseCron(expression);
  const next = new Date(after);
  // Start from the next minute
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1);

  // Search up to 366 days ahead
  const limit = 366 * 24 * 60;
  for (let i = 0; i < limit; i++) {
    if (
      fields.minute.includes(next.getMinutes()) &&
      fields.hour.includes(next.getHours()) &&
      fields.dayOfMonth.includes(next.getDate()) &&
      fields.month.includes(next.getMonth() + 1) &&
      fields.dayOfWeek.includes(next.getDay())
    ) {
      return next;
    }
    next.setMinutes(next.getMinutes() + 1);
  }

  throw new Error("Could not find next run time within 366 days");
}

// Human-readable description of a cron expression
export function describeCron(expression: string): string {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return expression;

  const [min, hour, dom, mon, dow] = parts;

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  let desc = "";

  // Time
  if (min !== "*" && hour !== "*") {
    const h = parseInt(hour, 10);
    const m = parseInt(min, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    desc += `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
  } else if (min.includes("/")) {
    desc += `every ${min.split("/")[1]} minutes`;
  } else if (hour.includes("/")) {
    desc += `every ${hour.split("/")[1]} hours`;
  }

  // Day of week
  if (dow !== "*") {
    if (dow === "1-5") {
      desc += " weekdays";
    } else if (dow === "0,6") {
      desc += " weekends";
    } else {
      const days = parseField(dow, 0, 6).map((d) => dayNames[d]);
      desc += ` on ${days.join(", ")}`;
    }
  }

  // Day of month
  if (dom !== "*") {
    desc += ` on day ${dom}`;
  }

  // Month
  if (mon !== "*") {
    const months = parseField(mon, 1, 12).map((m) => monthNames[m]);
    desc += ` in ${months.join(", ")}`;
  }

  return desc.trim() || expression;
}
