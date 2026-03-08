"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";

export default function LandingPage() {
  useEffect(() => {
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "auto";

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

    const nav = document.getElementById("landing-nav");
    if (!nav) return;
    const onScroll = () => {
      nav.classList.toggle("scrolled", window.scrollY > 20);
    };
    window.addEventListener("scroll", onScroll);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).style.animationPlayState = "running";
          }
        });
      },
      { threshold: 0.3 }
    );
    document.querySelectorAll(".msg").forEach((msg) => {
      (msg as HTMLElement).style.animationPlayState = "paused";
      observer.observe(msg);
    });

    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <style>{landingStyles}</style>

      {/* NAV */}
      <nav id="landing-nav" className="landing-nav">
        <Link href="/" className="nav-logo">offloaded</Link>
        <div className="nav-right">
          <a href="#features" className="hide-mobile">Features</a>
          <a href="#teams" className="hide-mobile">Teams</a>
          <Link href="/auth" className="nav-login">Log in</Link>
          <a href="#waitlist" className="btn btn-glow btn-small">Join waitlist</a>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-kicker">
          <div className="hero-kicker-dot" />
          Early access opening soon
        </div>
        <h1><span className="dim">Everyone&apos;s customizing agents.</span><br />We let them <em>work together.</em></h1>
        <p>Build custom AI agents with real knowledge, real personalities, and real tools. Then put them in a group chat and watch them collaborate. One agent is a chatbot. A team is a back office.</p>
        <WaitlistForm id="hero" />
      </section>

      {/* PROVOCATION */}
      <section className="provoke">
        <div className="provoke-grid">
          <div className="provoke-card them">
            <div className="provoke-label dim">Custom agents elsewhere</div>
            <ul className="provoke-list">
              <li><span className="x">&#x2715;</span><span>Name and instructions. That&apos;s it</span></li>
              <li><span className="x">&#x2715;</span><span>No document knowledge — just a prompt</span></li>
              <li><span className="x">&#x2715;</span><span>One agent at a time, in isolation</span></li>
              <li><span className="x">&#x2715;</span><span>Passive. Waits for you to ask</span></li>
              <li><span className="x">&#x2715;</span><span>No integrations. No actions. No tools</span></li>
              <li><span className="x">&#x2715;</span><span>A smarter chatbot. You&apos;re still doing the work</span></li>
            </ul>
          </div>
          <div className="provoke-card us">
            <div className="provoke-label lit">Custom agents on Offloaded</div>
            <ul className="provoke-list">
              <li><span className="check">&#x2713;</span><span>Name, role, purpose, working style, personality</span></li>
              <li><span className="check">&#x2713;</span><span>Grounded in your documents — cites with verbatim quotes</span></li>
              <li><span className="check">&#x2713;</span><span>Put agents together and they collaborate in group chat</span></li>
              <li><span className="check">&#x2713;</span><span>Proactive. Daily briefs, scheduled tasks, alerts</span></li>
              <li><span className="check">&#x2713;</span><span>Connected to Asana, Google Drive, web search, and more</span></li>
              <li><span className="check">&#x2713;</span><span>An actual team. You delegate, they deliver</span></li>
            </ul>
          </div>
        </div>
      </section>

      {/* CHAT DEMO */}
      <section className="demo-section">
        <div className="demo-label">Your team in action</div>
        <div className="demo-window">
          <div className="demo-header">
            <span className="demo-header-hash">#</span> Team Chat
            <small>4 agents</small>
          </div>
          <div className="demo-msgs">
            <div className="msg msg-r">
              <div className="msg-bubble">We&apos;re hiring a remote worker in Brisbane. What do I need to know?</div>
            </div>
            <div className="msg msg-l">
              <div className="msg-tag tag-blue">HR Advisor</div>
              <div className="msg-bubble">They&apos;re an Australian resident so they&apos;re eligible under our hiring policy. Check your remote work policy covers interstate arrangements — I can review it if you upload it.</div>
            </div>
            <div className="msg msg-l">
              <div className="msg-tag tag-amber">Legal Advisor</div>
              <div className="msg-bubble">Workers comp coverage varies by state. Your current policy may not extend to Queensland. I&apos;ll review and flag if you need an update. I can also draft a remote work agreement.</div>
            </div>
            <div className="msg msg-l">
              <div className="msg-tag tag-green">Bookkeeper</div>
              <div className="msg-bubble">Heads up — Queensland payroll tax thresholds are different. I&apos;ll flag the details when you&apos;re ready to set up their payroll.</div>
            </div>
            <div className="msg msg-l">
              <div className="msg-tag tag-purple">Scrum Master</div>
              <div className="msg-bubble">I&apos;ll create an onboarding task in Asana and schedule a welcome standup. What team are they joining?</div>
            </div>
          </div>
          <div className="demo-input">
            <span>Message your team...</span>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="feat-section" id="features">
        <div className="feat-inner">
          <h2>Agents that actually do things</h2>
          <p>Build custom agents with deep knowledge, real tools, and distinct personalities. Then let them work together.</p>
          <div className="feat-grid">
            <div className="feat-card">
              <div className="feat-icon" style={{ background: "rgba(59,130,246,0.12)", color: "var(--v2-accent2)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              </div>
              <h3>Document knowledge</h3>
              <p>Upload policies, contracts, financials. Agents cite your actual documents with verbatim quotes.</p>
            </div>
            <div className="feat-card">
              <div className="feat-icon" style={{ background: "rgba(34,197,94,0.12)", color: "var(--v2-green)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
              </div>
              <h3>Live integrations</h3>
              <p>Connected to Asana, Google Drive, web search. Agents create tasks, save docs, and pull real-time data.</p>
            </div>
            <div className="feat-card">
              <div className="feat-icon" style={{ background: "rgba(245,158,11,0.12)", color: "var(--v2-amber)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              </div>
              <h3>Scheduled tasks</h3>
              <p>&quot;Give me a news brief at 8am.&quot; Agents work on autopilot — research, report, and deliver on schedule.</p>
            </div>
            <div className="feat-card">
              <div className="feat-icon" style={{ background: "rgba(167,139,250,0.12)", color: "var(--v2-purple)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              </div>
              <h3>Team channels</h3>
              <p>Group agents into channels — #scrum, #marketing, #health. Like Slack, but everyone&apos;s an AI expert.</p>
            </div>
            <div className="feat-card">
              <div className="feat-icon" style={{ background: "rgba(244,114,182,0.12)", color: "var(--v2-pink)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              </div>
              <h3>Real personalities</h3>
              <p>Working style, communication style, tone of voice. Agents develop soft skills through use.</p>
            </div>
            <div className="feat-card">
              <div className="feat-icon" style={{ background: "rgba(250,250,250,0.06)", color: "var(--v2-text2)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </div>
              <h3>Source citations</h3>
              <p>Every claim is backed by your documents. Expandable sources with verbatim quotes you can verify.</p>
            </div>
          </div>
        </div>
      </section>

      {/* TEAMS */}
      <section className="teams-section" id="teams">
        <div className="teams-inner">
          <h2>Start from a template, make it yours</h2>
          <p>Pre-configured agent teams you can customise. Upload your docs and they&apos;re working in minutes.</p>
          <div className="teams-grid">
            <div className="team-card">
              <div className="team-emoji">🏢</div>
              <h3>Executive Ops</h3>
              <div className="team-agents">
                <span className="team-agent" style={{ color: "var(--v2-accent2)" }}>EA</span>
                <span className="team-agent" style={{ color: "var(--v2-amber)" }}>Analyst</span>
                <span className="team-agent" style={{ color: "var(--v2-green)" }}>PM</span>
              </div>
              <p>Daily briefs, project status, document drafting from your connected tools.</p>
            </div>
            <div className="team-card">
              <div className="team-emoji">🔄</div>
              <h3>Scrum</h3>
              <div className="team-agents">
                <span className="team-agent" style={{ color: "var(--v2-accent2)" }}>Scrum Master</span>
                <span className="team-agent" style={{ color: "var(--v2-green)" }}>Product</span>
                <span className="team-agent" style={{ color: "var(--v2-amber)" }}>QA</span>
              </div>
              <p>Standups, sprint tracking, backlog reviews, and Asana task management.</p>
            </div>
            <div className="team-card">
              <div className="team-emoji">📢</div>
              <h3>Marketing</h3>
              <div className="team-agents">
                <span className="team-agent" style={{ color: "var(--v2-purple)" }}>Strategist</span>
                <span className="team-agent" style={{ color: "var(--v2-pink)" }}>Content</span>
                <span className="team-agent" style={{ color: "var(--v2-accent2)" }}>Research</span>
              </div>
              <p>Market research, content drafts, competitive analysis with live web search.</p>
            </div>
            <div className="team-card">
              <div className="team-emoji">💪</div>
              <h3>Health &amp; Fitness</h3>
              <div className="team-agents">
                <span className="team-agent" style={{ color: "var(--v2-green)" }}>Coach</span>
                <span className="team-agent" style={{ color: "var(--v2-accent2)" }}>Recovery</span>
                <span className="team-agent" style={{ color: "var(--v2-amber)" }}>Nutrition</span>
              </div>
              <p>Training analysis from Hevy, recovery insights from Garmin, nutrition tracking.</p>
            </div>
          </div>
        </div>
      </section>

      {/* QUOTE */}
      <section className="quote-section">
        <div className="quote-inner">
          <blockquote>&ldquo;The professionals who figure this out early are going to have an enormous advantage over the ones who wait for someone to package it into a SaaS product.&rdquo;</blockquote>
          <cite>— Viral post on building an AI chief of staff, March 2026</cite>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="cta-section">
        <div className="cta-glow" />
        <div className="cta-inner">
          <h2>Build your agents.<br />Watch them team up.</h2>
          <p>Create custom agents in minutes. Connect your documents and tools. First 200 get early access.</p>
          <WaitlistForm id="cta" />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <span>&copy; 2026 Offloaded</span>
        <Link href="/auth" className="footer-login">Already have access? Log in</Link>
        <span style={{ fontSize: 13, color: "var(--v2-text3)" }}>offloaded.life</span>
      </footer>
    </>
  );
}

function WaitlistForm({ id }: { id: string }) {
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
        // 200 = already on the list
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
        <div className="waitlist-success" style={{ display: "block" }}>{message}</div>
      </div>
    );
  }

  return (
    <div id={`waitlist-${id}`}>
      <form className="waitlist-form" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit" className="btn btn-glow" disabled={status === "loading"}>
          {status === "loading" ? "Joining..." : "Join the waitlist"}
        </button>
      </form>
      {status === "error" && <p className="waitlist-error">{message}</p>}
      <p className="waitlist-note">No spam. Early access for the first 200 signups.</p>
    </div>
  );
}

const landingStyles = `
  :root {
    --v2-bg: #09090B;
    --v2-bg2: #111113;
    --v2-surface: #18181B;
    --v2-surface2: #1F1F23;
    --v2-border: #27272A;
    --v2-border2: #3F3F46;
    --v2-text: #FAFAFA;
    --v2-text2: #A1A1AA;
    --v2-text3: #71717A;
    --v2-accent: #3B82F6;
    --v2-accent2: #60A5FA;
    --v2-green: #22C55E;
    --v2-amber: #F59E0B;
    --v2-purple: #A78BFA;
    --v2-pink: #F472B6;
    --v2-serif: 'Instrument Serif', Georgia, serif;
    --v2-sans: 'Outfit', -apple-system, sans-serif;
  }

  body {
    font-family: var(--v2-sans);
    color: var(--v2-text);
    background: var(--v2-bg);
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
  }

  /* Grain overlay */
  body::after {
    content: ''; position: fixed; inset: 0; z-index: 9999;
    background: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
    pointer-events: none; opacity: 0.4;
  }

  /* NAV */
  .landing-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    padding: 18px 32px; display: flex; align-items: center; justify-content: space-between;
    background: rgba(9,9,11,0.8); backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border-bottom: 1px solid transparent; transition: border-color 0.3s;
  }
  .landing-nav.scrolled { border-bottom-color: var(--v2-border); }
  .nav-logo {
    font-family: var(--v2-sans); font-size: 18px; font-weight: 600;
    color: var(--v2-text); text-decoration: none; letter-spacing: -0.02em;
  }
  .nav-right { display: flex; align-items: center; gap: 24px; }
  .nav-right a { font-size: 14px; color: var(--v2-text3); text-decoration: none; transition: color 0.2s; }
  .nav-right a:hover { color: var(--v2-text); }
  .nav-right a.btn-glow, .nav-right a.btn-glow:hover { color: #FFFFFF; }
  .nav-login { font-size: 14px; color: var(--v2-text3); }

  /* BUTTONS */
  .btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 12px 28px; border-radius: 8px; font-size: 15px;
    font-weight: 500; font-family: var(--v2-sans); text-decoration: none;
    transition: all 0.2s ease; cursor: pointer; border: none;
  }
  .btn-glow {
    background: var(--v2-accent); color: #fff;
    box-shadow: 0 0 20px rgba(59,130,246,0.3), 0 0 60px rgba(59,130,246,0.1);
  }
  .btn-glow:hover { box-shadow: 0 0 30px rgba(59,130,246,0.5), 0 0 80px rgba(59,130,246,0.2); transform: translateY(-1px); }
  .btn-glow:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
  .btn-small { padding: 9px 20px; font-size: 13px; }

  /* HERO */
  .hero {
    padding: 180px 32px 80px; text-align: center;
    max-width: 800px; margin: 0 auto; position: relative;
  }
  .hero-kicker {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 14px 6px 10px; border-radius: 100px;
    border: 1px solid var(--v2-border); background: var(--v2-surface);
    font-size: 13px; color: var(--v2-text2); margin-bottom: 32px;
  }
  .hero-kicker-dot {
    width: 6px; height: 6px; border-radius: 50%; background: var(--v2-green);
    animation: v2-blink 2s ease infinite;
  }
  @keyframes v2-blink { 0%,100%{opacity:1} 50%{opacity:0.3} }

  .hero h1 {
    font-family: var(--v2-serif); font-size: clamp(42px, 7vw, 76px);
    font-weight: 400; line-height: 1.05; letter-spacing: -0.03em;
    margin-bottom: 28px; color: var(--v2-text);
  }
  .hero h1 .dim { color: var(--v2-text3); }
  .hero h1 em { font-style: italic; color: var(--v2-accent2); }
  .hero p {
    font-size: 18px; line-height: 1.7; color: var(--v2-text2);
    max-width: 520px; margin: 0 auto 44px;
  }

  /* WAITLIST */
  .waitlist-form {
    display: flex; gap: 10px; max-width: 420px; margin: 0 auto;
    justify-content: center; flex-wrap: wrap;
  }
  .waitlist-form input {
    flex: 1; min-width: 220px; padding: 14px 18px; border-radius: 8px;
    background: var(--v2-surface); border: 1px solid var(--v2-border);
    color: var(--v2-text); font-size: 15px; font-family: var(--v2-sans);
    outline: none; transition: border-color 0.2s;
  }
  .waitlist-form input::placeholder { color: var(--v2-text3); }
  .waitlist-form input:focus { border-color: var(--v2-accent); }
  .waitlist-note {
    font-size: 13px; color: var(--v2-text3); margin-top: 14px; text-align: center;
  }
  .waitlist-error {
    font-size: 13px; color: #EF4444; margin-top: 10px; text-align: center;
  }
  .waitlist-success {
    padding: 14px 24px; border-radius: 8px;
    background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2);
    color: var(--v2-green); font-size: 15px; text-align: center;
    max-width: 420px; margin: 0 auto;
  }

  /* PROVOCATION */
  .provoke {
    padding: 100px 32px; max-width: 900px; margin: 0 auto;
  }
  .provoke-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 2px;
    border-radius: 16px; overflow: hidden;
  }
  .provoke-card { padding: 36px 32px; }
  .provoke-card.them { background: var(--v2-surface); }
  .provoke-card.us { background: var(--v2-bg2); }
  .provoke-label {
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.08em; margin-bottom: 20px;
  }
  .provoke-label.dim { color: var(--v2-text3); }
  .provoke-label.lit { color: var(--v2-accent2); }
  .provoke-list {
    list-style: none; display: flex; flex-direction: column; gap: 12px;
    padding: 0; margin: 0;
  }
  .provoke-list li {
    font-size: 15px; line-height: 1.5; display: flex; align-items: flex-start; gap: 10px;
  }
  .provoke-list .x { color: var(--v2-text3); font-size: 14px; flex-shrink: 0; margin-top: 2px; }
  .provoke-list .check { color: var(--v2-green); font-size: 14px; flex-shrink: 0; margin-top: 2px; }
  .provoke-list li span:last-child { color: var(--v2-text2); }
  .provoke-card.us .provoke-list li span:last-child { color: var(--v2-text); }

  /* CHAT DEMO */
  .demo-section { padding: 40px 32px 100px; max-width: 680px; margin: 0 auto; }
  .demo-label {
    font-size: 13px; color: var(--v2-text3); text-transform: uppercase;
    letter-spacing: 0.06em; font-weight: 500; margin-bottom: 16px; text-align: center;
  }
  .demo-window {
    background: var(--v2-surface); border: 1px solid var(--v2-border);
    border-radius: 14px; overflow: hidden;
  }
  .demo-header {
    padding: 14px 20px; border-bottom: 1px solid var(--v2-border);
    display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500;
  }
  .demo-header-hash { color: var(--v2-text3); }
  .demo-header small { color: var(--v2-text3); font-weight: 400; margin-left: auto; font-size: 12px; }
  .demo-msgs { padding: 20px; display: flex; flex-direction: column; gap: 14px; }

  .msg { max-width: 88%; animation: v2-msgUp 0.5s ease both; }
  .msg-r { align-self: flex-end; }
  .msg-l { align-self: flex-start; }
  .msg:nth-child(1) { animation-delay: 0.5s; }
  .msg:nth-child(2) { animation-delay: 1.1s; }
  .msg:nth-child(3) { animation-delay: 1.8s; }
  .msg:nth-child(4) { animation-delay: 2.6s; }
  .msg:nth-child(5) { animation-delay: 3.4s; }
  @keyframes v2-msgUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

  .msg-tag {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; font-weight: 600; padding: 3px 8px;
    border-radius: 20px; margin-bottom: 5px;
  }
  .msg-tag::before { content:''; width:5px; height:5px; border-radius:50%; }
  .tag-blue { color: var(--v2-accent2); background: rgba(59,130,246,0.15); }
  .tag-blue::before { background: var(--v2-accent2); }
  .tag-green { color: var(--v2-green); background: rgba(34,197,94,0.12); }
  .tag-green::before { background: var(--v2-green); }
  .tag-amber { color: var(--v2-amber); background: rgba(245,158,11,0.12); }
  .tag-amber::before { background: var(--v2-amber); }
  .tag-purple { color: var(--v2-purple); background: rgba(167,139,250,0.15); }
  .tag-purple::before { background: var(--v2-purple); }

  .msg-bubble {
    padding: 11px 15px; font-size: 14px; line-height: 1.6; border-radius: 14px;
  }
  .msg-r .msg-bubble { background: var(--v2-surface2); color: var(--v2-text); border-radius: 14px 14px 4px 14px; }
  .msg-l .msg-bubble { background: var(--v2-bg2); border: 1px solid var(--v2-border); color: var(--v2-text2); border-radius: 14px 14px 14px 4px; }

  .demo-input {
    padding: 12px 16px; border-top: 1px solid var(--v2-border);
    display: flex; align-items: center; gap: 10px;
  }
  .demo-input span { font-size: 14px; color: var(--v2-text3); }

  /* FEATURES */
  .feat-section { padding: 100px 32px; }
  .feat-inner { max-width: 900px; margin: 0 auto; }
  .feat-section h2 {
    font-family: var(--v2-serif); font-size: clamp(32px, 5vw, 48px);
    font-weight: 400; letter-spacing: -0.02em;
    text-align: center; margin-bottom: 16px; color: var(--v2-text);
  }
  .feat-inner > p {
    text-align: center; font-size: 17px; color: var(--v2-text2);
    max-width: 480px; margin: 0 auto 56px; line-height: 1.6;
  }
  .feat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; border-radius: 14px; overflow: hidden; }
  .feat-card { background: var(--v2-surface); padding: 32px 28px; }
  .feat-icon {
    width: 36px; height: 36px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 16px; font-size: 16px;
  }
  .feat-card h3 { font-size: 16px; font-weight: 600; margin-bottom: 8px; color: var(--v2-text); }
  .feat-card p { font-size: 14px; line-height: 1.6; color: var(--v2-text2); }

  /* TEAMS */
  .teams-section { padding: 100px 32px; background: var(--v2-bg2); }
  .teams-inner { max-width: 900px; margin: 0 auto; }
  .teams-section h2 {
    font-family: var(--v2-serif); font-size: clamp(32px, 5vw, 48px);
    font-weight: 400; text-align: center; margin-bottom: 16px; color: var(--v2-text);
  }
  .teams-inner > p {
    text-align: center; font-size: 17px; color: var(--v2-text2);
    max-width: 480px; margin: 0 auto 56px; line-height: 1.6;
  }
  .teams-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; border-radius: 14px; overflow: hidden; }
  .team-card { background: var(--v2-surface); padding: 28px 24px; }
  .team-emoji { font-size: 28px; margin-bottom: 14px; }
  .team-card h3 { font-size: 15px; font-weight: 600; margin-bottom: 6px; color: var(--v2-text); }
  .team-agents { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px; }
  .team-agent {
    font-size: 10px; font-weight: 600; padding: 2px 8px;
    border-radius: 20px; border: 1px solid var(--v2-border);
  }
  .team-card p { font-size: 13px; line-height: 1.5; color: var(--v2-text3); }

  /* QUOTE */
  .quote-section { padding: 100px 32px; text-align: center; }
  .quote-inner { max-width: 640px; margin: 0 auto; }
  .quote-section blockquote {
    font-family: var(--v2-serif); font-size: clamp(22px, 3.5vw, 32px);
    font-weight: 400; font-style: italic; line-height: 1.5;
    color: var(--v2-text2); margin-bottom: 20px;
  }
  .quote-section cite {
    font-style: normal; font-size: 14px; color: var(--v2-text3);
    font-family: var(--v2-sans);
  }

  /* BOTTOM CTA */
  .cta-section { padding: 120px 32px; text-align: center; position: relative; }
  .cta-inner { max-width: 560px; margin: 0 auto; position: relative; z-index: 1; }
  .cta-section h2 {
    font-family: var(--v2-serif); font-size: clamp(36px, 5vw, 52px);
    font-weight: 400; margin-bottom: 20px; letter-spacing: -0.02em; color: var(--v2-text);
  }
  .cta-section p { font-size: 17px; color: var(--v2-text2); margin-bottom: 40px; line-height: 1.6; }
  .cta-glow {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 500px; height: 500px; border-radius: 50%;
    background: radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%);
    pointer-events: none;
  }

  /* FOOTER */
  .landing-footer {
    padding: 32px; border-top: 1px solid var(--v2-border);
    display: flex; justify-content: space-between; align-items: center;
    max-width: 940px; margin: 0 auto;
  }
  .landing-footer span { font-size: 13px; color: var(--v2-text3); }
  .footer-login {
    font-size: 13px; color: var(--v2-text3); text-decoration: none;
    transition: color 0.2s;
  }
  .footer-login:hover { color: var(--v2-text2); }

  /* MOBILE */
  @media (max-width: 768px) {
    .landing-nav { padding: 14px 20px; }
    .nav-right { gap: 16px; }
    .nav-right a.hide-mobile { display: none; }
    .hero { padding: 140px 20px 60px; }
    .hero p { font-size: 16px; }
    .provoke { padding: 80px 20px; }
    .provoke-grid { grid-template-columns: 1fr; }
    .demo-section { padding: 20px 20px 80px; }
    .feat-section, .teams-section, .quote-section, .cta-section { padding: 80px 20px; }
    .feat-grid { grid-template-columns: 1fr; }
    .teams-grid { grid-template-columns: 1fr 1fr; }
    .waitlist-form { flex-direction: column; }
    .waitlist-form input { min-width: unset; }
    .landing-footer { flex-direction: column; gap: 8px; text-align: center; }
  }
  @media (max-width: 480px) {
    .teams-grid { grid-template-columns: 1fr; }
  }
`;
