"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import {
  NEON_PINK, NEON_CYAN, NEON_YELLOW, NEON_GREEN, NEON_PURPLE, DARK_BG,
  powerUps, marketplaceAgents, builderBullets,
} from "@/lib/landing-data";
import Scanlines from "@/components/landing/Scanlines";
import Stars from "@/components/landing/Stars";
import GridFloor from "@/components/landing/GridFloor";
import GlowText from "@/components/landing/GlowText";
import HeroChatDemo from "@/components/landing/HeroChatDemo";
import PowerUpCard from "@/components/landing/PowerUpCard";
import Ticker from "@/components/landing/Ticker";
import MarketplaceCard from "@/components/landing/MarketplaceCard";
import AgentBuilderDemo from "@/components/landing/AgentBuilderDemo";
import ReportsDemo from "@/components/landing/ReportsDemo";
import SchedulerDemo from "@/components/landing/SchedulerDemo";

export default function LandingPage() {
  const [heroVisible, setHeroVisible] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(0);

  useEffect(() => {
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "auto";

    setTimeout(() => setHeroVisible(true), 200);

    // Track page view
    try {
      let visitorId = localStorage.getItem("visitor_id");
      if (!visitorId) {
        visitorId = crypto.randomUUID();
        localStorage.setItem("visitor_id", visitorId);
      }
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: window.location.pathname + window.location.hash,
          referrer: document.referrer || null,
          visitor_id: visitorId,
        }),
      }).catch(() => {});
    } catch {
      // Tracking is non-critical
    }

    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);

  const sel = marketplaceAgents[selectedAgent];

  return (
    <div
      className="min-h-screen text-white overflow-x-hidden relative"
      style={{ backgroundColor: DARK_BG }}
    >
      <style>{landingKeyframes}</style>
      <Scanlines />
      <Stars />

      {/* ═══ NAV ═══ */}
      <nav
        className="fixed top-0 left-0 w-full z-[100] px-6 py-5 md:px-10 flex justify-between items-center backdrop-blur-lg"
        style={{ background: `linear-gradient(to bottom, ${DARK_BG}, transparent)` }}
      >
        <div className="flex items-center gap-2">
          <span
            className="font-['Press_Start_2P'] text-sm tracking-[2px]"
            style={{
              background: `linear-gradient(135deg, ${NEON_PINK}, ${NEON_CYAN})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            OFFLOADED
          </span>
          <span
            className="font-['Space_Mono'] text-[9px] px-1.5 py-0.5 rounded-sm"
            style={{
              color: NEON_GREEN,
              border: `1px solid ${NEON_GREEN}60`,
              textShadow: `0 0 6px ${NEON_GREEN}80`,
            }}
          >
            BETA
          </span>
        </div>
        <div className="hidden md:flex gap-8 items-center font-['Space_Mono'] text-xs">
          <a
            href="#features"
            className="text-white/50 tracking-[2px] no-underline transition-colors duration-300 hover:text-[#00f0ff]"
          >
            FEATURES
          </a>
          <a
            href="#marketplace"
            className="text-white/50 tracking-[2px] no-underline transition-colors duration-300 hover:text-[#00f0ff]"
          >
            MARKETPLACE
          </a>
          <a
            href="#pricing"
            className="text-white/50 tracking-[2px] no-underline transition-colors duration-300 hover:text-[#00f0ff]"
          >
            PRICING
          </a>
          <Link
            href="/auth"
            className="tracking-[2px] no-underline transition-all duration-300 px-4 py-2 rounded-sm"
            style={{
              color: NEON_CYAN,
              border: `1px solid ${NEON_CYAN}60`,
              textShadow: `0 0 6px ${NEON_CYAN}80`,
            }}
          >
            LOG IN
          </Link>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="min-h-screen flex items-center justify-center relative px-6 pt-[120px] pb-20 md:px-10">
        <GridFloor />

        <div className="max-w-[1100px] w-full grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-[60px] items-center relative z-[1]">
          {/* Left: Copy */}
          <div
            className="transition-all duration-800"
            style={{
              opacity: heroVisible ? 1 : 0,
              transform: heroVisible ? "translateY(0)" : "translateY(40px)",
              transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <div
              className="font-['Press_Start_2P'] text-[10px] mb-5 tracking-[4px]"
              style={{ color: NEON_PINK, textShadow: `0 0 10px ${NEON_PINK}80` }}
            >
              &#9654; INSERT COIN TO BEGIN
            </div>

            <h1
              className="font-['Press_Start_2P'] text-xl sm:text-2xl md:text-[30px] leading-[1.6] mb-6"
              style={{ animation: "chromatic 4s ease-in-out infinite" }}
            >
              <span className="text-white">YOUR TEAM.</span>
              <br />
              <span style={{ color: NEON_CYAN, textShadow: `0 0 20px ${NEON_CYAN}, 0 0 40px ${NEON_CYAN}60` }}>
                AI + HUMANS.
              </span>
            </h1>

            <p className="font-['Space_Mono'] text-base text-white/65 leading-[1.8] mb-9 max-w-[440px]">
              Build a crew of AI agents. Invite your teammates. Talk in a group chat. Get work done — together.
              <br /><br />
              <span className="text-white/40 text-sm">No code. No complexity. Just results.</span>
            </p>

            <WaitlistForm id="hero" />

            <div className="font-['Space_Mono'] text-[11px] text-white/30 mt-3.5 tracking-wider">
              Free to play. No credit card required.
            </div>
          </div>

          {/* Right: Chat demo */}
          <div
            className="transition-all duration-800"
            style={{
              opacity: heroVisible ? 1 : 0,
              transform: heroVisible ? "translateY(0)" : "translateY(40px)",
              transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
              transitionDelay: "0.3s",
            }}
          >
            <HeroChatDemo />
          </div>
        </div>
      </section>

      {/* ═══ TICKER ═══ */}
      <div className="border-t border-b border-white/[0.04]">
        <div className="max-w-[1100px] mx-auto py-2">
          <div className="font-['Press_Start_2P'] text-[8px] text-white/20 text-center mb-1 tracking-[4px]">
            BUILT FOR
          </div>
          <Ticker />
        </div>
      </div>

      {/* ═══ POWER-UPS: ALL 6 FEATURES ═══ */}
      <section id="features" className="max-w-[1100px] mx-auto px-6 py-20 md:px-10 md:py-[120px] scroll-mt-20">
        <div className="text-center mb-16">
          <div
            className="font-['Press_Start_2P'] text-[10px] mb-4 tracking-[4px]"
            style={{ color: NEON_GREEN, textShadow: `0 0 10px ${NEON_GREEN}80` }}
          >
            &#9654; SELECT YOUR POWER-UPS
          </div>
          <h2 className="font-['Press_Start_2P'] text-lg md:text-[22px] leading-[1.6]">
            <span className="text-white">SIX WAYS TO </span>
            <GlowText color={NEON_YELLOW} className="text-lg md:text-[22px]">LEVEL UP</GlowText>
          </h2>
          <p className="font-['Space_Mono'] text-sm text-white/45 leading-7 max-w-[520px] mx-auto mt-3">
            Everything you need to build, run, and scale your AI-powered team.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {powerUps.map((item, i) => (
            <PowerUpCard key={i} item={item} />
          ))}
        </div>
      </section>

      {/* ═══ AGENT MARKETPLACE ═══ */}
      <section id="marketplace" className="max-w-[1100px] mx-auto px-6 pt-10 pb-20 md:px-10 md:pb-[120px] scroll-mt-20">
        <div className="text-center mb-14">
          <div
            className="font-['Press_Start_2P'] text-[10px] mb-4 tracking-[4px]"
            style={{ color: NEON_YELLOW, textShadow: `0 0 10px ${NEON_YELLOW}80` }}
          >
            &#9654; CHARACTER SELECT
          </div>
          <h2 className="font-['Press_Start_2P'] text-lg md:text-xl leading-[1.6] mb-3">
            <span className="text-white">THE </span>
            <GlowText color={NEON_PINK} className="text-lg md:text-xl">AGENT MARKETPLACE</GlowText>
          </h2>
          <p className="font-['Space_Mono'] text-sm text-white/45 leading-7 max-w-[520px] mx-auto">
            Browse pre-built agents ready to join your crew. Install in one click.
            Or build your own from scratch.
          </p>
        </div>

        {/* Top row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {marketplaceAgents.slice(0, 3).map((agent, i) => (
            <MarketplaceCard key={i} agent={agent} index={i} selected={selectedAgent} onSelect={setSelectedAgent} />
          ))}
        </div>

        {/* Selected agent detail strip */}
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-sm px-6 py-4 my-4 gap-4 transition-all duration-300"
          style={{
            background: `linear-gradient(90deg, ${sel.color}08, transparent, ${sel.color}08)`,
            border: `1px solid ${sel.color}30`,
          }}
        >
          <div className="flex items-center gap-4">
            <span className="text-2xl">{sel.icon}</span>
            <div>
              <div
                className="font-['Press_Start_2P'] text-[9px] mb-1.5 tracking-wider"
                style={{ color: sel.color, textShadow: `0 0 6px ${sel.color}60` }}
              >
                {sel.name}
              </div>
              <div className="font-['Space_Mono'] text-[13px] text-white/60">
                {sel.desc}
              </div>
            </div>
          </div>
          <button
            className="font-['Press_Start_2P'] text-[8px] px-4 py-2.5 rounded-sm cursor-pointer tracking-wider whitespace-nowrap transition-all duration-300 shrink-0"
            style={{
              background: `${sel.color}20`,
              color: sel.color,
              border: `1px solid ${sel.color}60`,
              textShadow: `0 0 6px ${sel.color}80`,
            }}
          >
            + ADD TO CREW
          </button>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {marketplaceAgents.slice(3, 6).map((agent, i) => (
            <MarketplaceCard key={i + 3} agent={agent} index={i + 3} selected={selectedAgent} onSelect={setSelectedAgent} />
          ))}
        </div>

        <div className="text-center mt-10">
          <span className="font-['Press_Start_2P'] text-[10px] text-white/30 tracking-[2px]">
            + DOZENS MORE IN THE ARCADE
          </span>
        </div>
      </section>

      {/* ═══ CUSTOM AGENT BUILDER ═══ */}
      <section className="max-w-[1100px] mx-auto px-6 pt-10 pb-20 md:px-10 md:pb-[120px]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-[60px] items-center">
          {/* Left: Copy */}
          <div>
            <div
              className="font-['Press_Start_2P'] text-[10px] mb-4 tracking-[4px]"
              style={{ color: NEON_CYAN, textShadow: `0 0 10px ${NEON_CYAN}80` }}
            >
              &#9654; CREATE-A-CHARACTER
            </div>
            <h2 className="font-['Press_Start_2P'] text-lg md:text-xl leading-[1.6] mb-5">
              <span className="text-white">CAN&apos;T FIND IT?</span>
              <br />
              <GlowText color={NEON_GREEN} className="text-lg md:text-xl">BUILD IT.</GlowText>
            </h2>
            <p className="font-['Space_Mono'] text-[15px] text-white/55 leading-[1.8] mb-7">
              The marketplace is just the starting roster. Describe what you need in plain
              English — name it, give it a role, connect your tools — and your custom agent
              is live in under a minute.
            </p>
            <div className="flex flex-col gap-3">
              {builderBullets.map((item, i) => (
                <div key={i} className="flex items-center gap-3 font-['Space_Mono'] text-[13px] text-white/60">
                  <span className="text-base">{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Builder demo */}
          <AgentBuilderDemo />
        </div>
      </section>

      {/* ═══ REPORTS + SCHEDULER: BONUS ROUNDS ═══ */}
      <section className="max-w-[1100px] mx-auto px-6 pt-10 pb-20 md:px-10 md:pb-[120px]">
        <div className="text-center mb-14">
          <div
            className="font-['Press_Start_2P'] text-[10px] mb-4 tracking-[4px]"
            style={{ color: NEON_PURPLE, textShadow: `0 0 10px ${NEON_PURPLE}80` }}
          >
            &#9654; BONUS ROUNDS
          </div>
          <h2 className="font-['Press_Start_2P'] text-lg md:text-xl leading-[1.6] mb-3">
            <span className="text-white">WORK </span>
            <GlowText color={NEON_YELLOW} className="text-lg md:text-xl">WHILE YOU SLEEP</GlowText>
          </h2>
          <p className="font-['Space_Mono'] text-sm text-white/45 leading-7 max-w-[520px] mx-auto">
            Save any conversation as a polished report. Set agents to run on autopilot. Your crew never clocks out.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Reports */}
          <div>
            <div
              className="font-['Press_Start_2P'] text-[9px] mb-4 tracking-[2px]"
              style={{ color: NEON_YELLOW, textShadow: `0 0 8px ${NEON_YELLOW}60` }}
            >
              &#128196; SAVED REPORTS
            </div>
            <p className="font-['Space_Mono'] text-[13px] text-white/45 leading-relaxed mb-5">
              Say &ldquo;save as report&rdquo; and your agent compiles, formats, and stores the output.
              Every report is searchable, shareable, and ready when you need it.
            </p>
            <ReportsDemo />
          </div>

          {/* Scheduler */}
          <div>
            <div
              className="font-['Press_Start_2P'] text-[9px] mb-4 tracking-[2px]"
              style={{ color: NEON_PURPLE, textShadow: `0 0 8px ${NEON_PURPLE}60` }}
            >
              &#9200; SCHEDULED TASKS
            </div>
            <p className="font-['Space_Mono'] text-[13px] text-white/45 leading-relaxed mb-5">
              Set any agent to run on a schedule. Morning briefs, weekly reports, pipeline
              updates — they fire automatically and drop results in your chat or reports.
            </p>
            <SchedulerDemo />
          </div>
        </div>
      </section>

      {/* ═══ CLOSING CTA ═══ */}
      <section id="pricing" className="max-w-[800px] mx-auto px-6 pt-20 pb-20 md:pb-[120px] text-center scroll-mt-20">
        <div
          className="font-['Press_Start_2P'] text-[9px] mb-6 tracking-[4px]"
          style={{ color: NEON_PINK, textShadow: `0 0 10px ${NEON_PINK}80` }}
        >
          &#9654; FINAL BOSS: YOUR TO-DO LIST
        </div>
        <h2 className="font-['Press_Start_2P'] text-lg md:text-xl leading-[1.8] mb-6">
          <span className="text-white/90">STOP DOING EVERYTHING.</span>
          <br />
          <GlowText color={NEON_CYAN} className="text-lg md:text-xl" delay={1}>START OFFLOADING.</GlowText>
        </h2>
        <p className="font-['Space_Mono'] text-[15px] text-white/50 leading-[1.8] max-w-[560px] mx-auto mb-12">
          You didn&apos;t start your business to write content calendars and chase invoices.
          Build an AI crew that handles the work you keep putting off — so you can
          focus on the work that actually matters.
        </p>

        <WaitlistForm id="cta" ctaLabel="PLAY NOW" />
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-white/[0.04] py-10 px-6 text-center">
        <div
          className="font-['Press_Start_2P'] text-[10px] mb-3"
          style={{
            background: `linear-gradient(135deg, ${NEON_PINK}, ${NEON_CYAN})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          OFFLOADED
        </div>
        <div className="font-['Space_Mono'] text-[11px] text-white/25 tracking-wider">
          &copy; 2026 OFFLOADED.LIFE — ALL RIGHTS RESERVED
        </div>
        <div className="font-['Space_Mono'] text-[9px] text-white/15 mt-2 tracking-[2px]">
          GAME OVER? NEVER. &#9670; PRESS START TO CONTINUE
        </div>
        <Link
          href="/auth"
          className="inline-block font-['Space_Mono'] text-[10px] text-white/20 mt-4 tracking-wider no-underline hover:text-white/40 transition-colors"
        >
          Already have access? Log in
        </Link>
      </footer>
    </div>
  );
}

function WaitlistForm({ id, ctaLabel }: { id: string; ctaLabel?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "already" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "landing" }),
      });
      const data = await res.json();

      if (res.status === 201) {
        setStatus("success");
        setMessage(data.message);
      } else if (res.ok) {
        setStatus("already");
        setMessage(data.message);
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  if (status === "success" || status === "already") {
    return (
      <div id={`waitlist-${id}`}>
        <div
          className="font-['Space_Mono'] text-sm px-6 py-3.5 rounded-sm border text-center max-w-[420px] mx-auto"
          style={{
            color: NEON_GREEN,
            background: `${NEON_GREEN}10`,
            borderColor: `${NEON_GREEN}30`,
            textShadow: `0 0 8px ${NEON_GREEN}60`,
          }}
        >
          {message}
        </div>
      </div>
    );
  }

  return (
    <div id={`waitlist-${id}`}>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 items-center">
        <input
          type="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="font-['Space_Mono'] text-sm py-3.5 px-5 bg-white/[0.04] border border-white/10 rounded-sm text-white w-full sm:w-[260px] outline-none transition-colors duration-300 focus:border-[#00f0ff80] placeholder:text-white/30"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="font-['Press_Start_2P'] text-[10px] py-4 px-6 border-none rounded-sm cursor-pointer tracking-wider whitespace-nowrap transition-transform duration-200 hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{
            background: `linear-gradient(135deg, ${NEON_PINK}, ${NEON_PINK}cc)`,
            color: "#fff",
            animation: "pulseGlow 2s ease-in-out infinite",
          }}
        >
          {status === "loading" ? "JOINING..." : (ctaLabel || "START GAME")}
        </button>
      </form>
      {status === "error" && (
        <p className="font-['Space_Mono'] text-xs mt-2.5 text-center" style={{ color: NEON_PINK }}>
          {message}
        </p>
      )}
    </div>
  );
}

const landingKeyframes = `
  @keyframes flicker {
    0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { opacity: 1; }
    20%, 24%, 55% { opacity: 0.85; }
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  @keyframes scroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-33.33%); }
  }
  @keyframes twinkle {
    0% { opacity: 0.2; }
    100% { opacity: 1; }
  }
  @keyframes pulseGlow {
    0%, 100% { box-shadow: 0 0 20px rgba(255,45,123,0.3), 0 0 40px rgba(255,45,123,0.1); }
    50% { box-shadow: 0 0 30px rgba(255,45,123,0.5), 0 0 60px rgba(255,45,123,0.2); }
  }
  @keyframes chromatic {
    0% { text-shadow: -2px 0 #ff2d7b, 2px 0 #00f0ff; }
    50% { text-shadow: 2px 0 #ff2d7b, -2px 0 #00f0ff; }
    100% { text-shadow: -2px 0 #ff2d7b, 2px 0 #00f0ff; }
  }
  ::selection { background: ${NEON_PINK}40; color: #fff; }
`;
