"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  NEON_PINK, NEON_CYAN, NEON_YELLOW, NEON_GREEN, DARK_BG,
  featureBlocks, marketplaceAgents, workflowSteps, useCases,
} from "@/lib/landing-data";
import Scanlines from "@/components/landing/Scanlines";
import Stars from "@/components/landing/Stars";
import GridFloor from "@/components/landing/GridFloor";
import GlowText from "@/components/landing/GlowText";
import HeroChatDemo from "@/components/landing/HeroChatDemo";
import FeatureCard from "@/components/landing/FeatureCard";
import WorkflowStep from "@/components/landing/WorkflowStep";
import ReportEditDemo from "@/components/landing/ReportEditDemo";
import MarketplaceMiniCard from "@/components/landing/MarketplaceMiniCard";

export default function LandingPage({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    document.documentElement.style.overflow = "auto";
    document.documentElement.style.scrollBehavior = "smooth";
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
      document.documentElement.style.scrollBehavior = "";
      document.body.style.overflow = "";
    };
  }, []);

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
        <div className="flex gap-6 md:gap-8 items-center font-['Space_Mono'] text-xs">
          <a
            href="#features"
            className="hidden md:inline text-white/50 tracking-[2px] no-underline transition-colors duration-300 hover:text-[#00f0ff]"
          >
            FEATURES
          </a>
          <a
            href="#marketplace"
            className="hidden md:inline text-white/50 tracking-[2px] no-underline transition-colors duration-300 hover:text-[#00f0ff]"
          >
            MARKETPLACE
          </a>
          <Link
            href={isAuthenticated ? "/chat" : "/auth"}
            className="font-['Press_Start_2P'] text-[9px] tracking-wider no-underline transition-all duration-300 px-4 py-2 rounded-sm hover:shadow-[0_0_16px_rgba(0,240,255,0.4)]"
            style={{
              color: NEON_CYAN,
              border: `1px solid ${NEON_CYAN}60`,
              textShadow: `0 0 6px ${NEON_CYAN}80`,
            }}
          >
            {isAuthenticated ? "OPEN APP" : "LOG IN"}
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
              &#9654; AI FOR PRODUCTIVE WORK
            </div>

            <h1
              className="font-['Press_Start_2P'] text-xl sm:text-2xl md:text-[28px] leading-[1.6] mb-6"
              style={{ animation: "chromatic 4s ease-in-out infinite" }}
            >
              <span className="text-white">AGENTS THAT</span>
              <br />
              <span style={{ color: NEON_CYAN, textShadow: `0 0 20px ${NEON_CYAN}, 0 0 40px ${NEON_CYAN}60` }}>
                PRODUCE WORK
              </span>
              <br />
              <span className="text-white text-lg sm:text-xl">NOT JUST ANSWERS</span>
            </h1>

            <p className="font-['Space_Mono'] text-[15px] text-white/60 leading-[1.8] mb-9 max-w-[460px]">
              Build a team of AI agents with real roles. They collaborate, produce structured reports, and learn from your feedback. The more you work with them, the better they get.
            </p>

            <Link
              href="/auth"
              className="inline-block font-['Press_Start_2P'] text-[10px] py-4 px-6 border-none rounded-sm cursor-pointer tracking-wider no-underline text-white transition-transform duration-200 hover:scale-105"
              style={{
                background: `linear-gradient(135deg, ${NEON_PINK}, ${NEON_PINK}cc)`,
                animation: "pulseGlow 2s ease-in-out infinite",
              }}
            >
              GET EARLY ACCESS
            </Link>
            <div className="font-['Space_Mono'] text-[11px] text-white/30 mt-3.5 tracking-wider">
              Free beta. No credit card.
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

      {/* ═══ THE LOOP ═══ */}
      <section className="max-w-[1100px] mx-auto px-6 py-20 md:px-10 md:py-[100px]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20 items-center">
          <div>
            <div
              className="font-['Press_Start_2P'] text-[10px] mb-4 tracking-[4px]"
              style={{ color: NEON_GREEN, textShadow: `0 0 10px ${NEON_GREEN}80` }}
            >
              &#9654; THE LOOP
            </div>
            <h2 className="font-['Press_Start_2P'] text-lg md:text-xl leading-[1.6] mb-5">
              <span className="text-white">AGENTS THAT GET</span>
              <br />
              <GlowText color={NEON_GREEN} className="text-lg md:text-xl">BETTER OVER TIME</GlowText>
            </h2>
            <p className="font-['Space_Mono'] text-sm text-white/50 leading-[1.8] mb-10">
              Most AI gives you a one-shot answer and moves on. Offloaded creates a feedback loop — you define what good looks like, agents produce work, you refine it, and they learn from your edits. Every cycle makes the next output better.
            </p>
            {workflowSteps.map((step, i) => (
              <WorkflowStep key={i} step={step} />
            ))}
          </div>

          <div>
            <div className="font-['Press_Start_2P'] text-[9px] text-white/20 tracking-[2px] mb-3 text-center">
              LIVE EDITING DEMO
            </div>
            <ReportEditDemo />
            <div className="font-['Space_Mono'] text-[11px] text-white/25 text-center mt-3 tracking-wider">
              Edit the report. Agent reviews. Approve changes. Report updates live.
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="features" className="max-w-[1100px] mx-auto px-6 py-20 md:px-10 scroll-mt-20">
        <div className="text-center mb-14">
          <div
            className="font-['Press_Start_2P'] text-[10px] mb-4 tracking-[4px]"
            style={{ color: NEON_YELLOW, textShadow: `0 0 10px ${NEON_YELLOW}80` }}
          >
            &#9654; WHAT&apos;S INSIDE
          </div>
          <h2 className="font-['Press_Start_2P'] text-lg md:text-xl leading-[1.6]">
            <span className="text-white">NOT ANOTHER </span>
            <GlowText color={NEON_YELLOW} className="text-lg md:text-xl">CHATBOT</GlowText>
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {featureBlocks.map((f, i) => (
            <FeatureCard key={i} feature={f} />
          ))}
        </div>
      </section>

      {/* ═══ MARKETPLACE ═══ */}
      <section id="marketplace" className="max-w-[1100px] mx-auto px-6 py-20 md:px-10 scroll-mt-20">
        <div className="text-center mb-12">
          <div
            className="font-['Press_Start_2P'] text-[10px] mb-4 tracking-[4px]"
            style={{ color: NEON_PINK, textShadow: `0 0 10px ${NEON_PINK}80` }}
          >
            &#9654; AGENT MARKETPLACE
          </div>
          <h2 className="font-['Press_Start_2P'] text-lg md:text-[18px] leading-[1.6] mb-3">
            <GlowText color={NEON_PINK} className="text-lg md:text-[18px]">20+ AGENTS</GlowText>
            <span className="text-white"> READY TO WORK</span>
          </h2>
          <p className="font-['Space_Mono'] text-sm text-white/45 leading-7 max-w-[500px] mx-auto">
            Pre-built agents with roles, templates, and report structures. Install in one click, customise to fit your workflow, or build your own from scratch.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
          {marketplaceAgents.map((agent, i) => (
            <MarketplaceMiniCard key={i} agent={agent} />
          ))}
        </div>
        <div className="text-center mt-8">
          <span className="font-['Space_Mono'] text-xs text-white/30 tracking-wider">
            Operations &bull; Marketing &bull; Strategy &bull; Sales &bull; Fitness &bull; Finance &bull; HR &bull; and more
          </span>
        </div>
      </section>

      {/* ═══ USE CASES ═══ */}
      <section className="max-w-[900px] mx-auto px-6 py-20 md:px-10">
        <div className="text-center mb-12">
          <div
            className="font-['Press_Start_2P'] text-[10px] mb-4 tracking-[4px]"
            style={{ color: NEON_CYAN, textShadow: `0 0 10px ${NEON_CYAN}80` }}
          >
            &#9654; BUILT FOR REAL WORK
          </div>
          <h2 className="font-['Press_Start_2P'] text-lg md:text-[18px] leading-[1.6]">
            <span className="text-white">WHAT PEOPLE </span>
            <GlowText color={NEON_CYAN} className="text-lg md:text-[18px]">ACTUALLY USE IT FOR</GlowText>
          </h2>
        </div>
        <div className="flex flex-col gap-4">
          {useCases.map((uc, i) => (
            <div
              key={i}
              className="flex gap-4 items-start px-5 py-5 md:px-6 bg-white/[0.02] border border-white/[0.04] rounded-sm"
            >
              <span className="text-2xl shrink-0">{uc.emoji}</span>
              <div>
                <div className="font-['Press_Start_2P'] text-[9px] text-white/80 mb-1.5 tracking-wider">
                  {uc.title.toUpperCase()}
                </div>
                <div className="font-['Space_Mono'] text-[13px] text-white/50 leading-7">
                  {uc.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ CLOSING CTA ═══ */}
      <section className="max-w-[800px] mx-auto px-6 pt-20 pb-20 md:pb-[120px] text-center">
        <div
          className="font-['Press_Start_2P'] text-[9px] mb-6 tracking-[4px]"
          style={{ color: NEON_PINK, textShadow: `0 0 10px ${NEON_PINK}80` }}
        >
          &#9654; READY?
        </div>
        <h2 className="font-['Press_Start_2P'] text-lg md:text-xl leading-[1.8] mb-6">
          <span className="text-white/90">I BUILT THIS FOR MYSELF.</span>
          <br />
          <GlowText color={NEON_CYAN} className="text-lg md:text-xl" delay={1}>TURNS OUT IT WORKS.</GlowText>
        </h2>
        <p className="font-['Space_Mono'] text-[15px] text-white/50 leading-[1.8] max-w-[560px] mx-auto mb-10">
          Offloaded started as a personal tool to search council documents. It turned into a platform where AI agents produce real work and get better every time. It&apos;s in beta, it&apos;s free, and I&apos;m looking for people who want to see if it works for them too.
        </p>
        <Link
          href="/auth"
          className="inline-block font-['Press_Start_2P'] text-xs py-5 px-10 rounded-sm cursor-pointer tracking-[2px] no-underline transition-all duration-300"
          style={{
            background: "transparent",
            color: NEON_CYAN,
            border: `2px solid ${NEON_CYAN}`,
            textShadow: `0 0 10px ${NEON_CYAN}80`,
            boxShadow: `0 0 20px ${NEON_CYAN}20`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `${NEON_CYAN}15`;
            e.currentTarget.style.boxShadow = `0 0 30px ${NEON_CYAN}40`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.boxShadow = `0 0 20px ${NEON_CYAN}20`;
          }}
        >
          TRY THE BETA &rarr;
        </Link>
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
          &copy; 2026 OFFLOADED.LIFE
        </div>
      </footer>
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
