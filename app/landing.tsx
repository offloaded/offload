"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function LandingPage() {
  useEffect(() => {
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "auto";

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
        <Link href="/" className="nav-logo">Offloaded</Link>
        <div className="nav-links">
          <a href="#how" className="hide-mobile">How it works</a>
          <a href="#features" className="hide-mobile">Features</a>
          <Link href="/auth" className="btn btn-primary btn-small">Get started</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-badge">Now in early access</div>
        <h1>Your AI team,<br />ready to <em>work</em></h1>
        <p>Create a team of AI agents, give them your documents, and chat with them like any remote worker. They read your policies, answer your questions, and get things done.</p>
        <div className="hero-ctas">
          <Link href="/auth" className="btn btn-primary">Get started free</Link>
          <a href="#how" className="btn btn-secondary">See how it works</a>
        </div>
      </section>

      {/* CHAT DEMO */}
      <section className="demo-section">
        <div className="demo-window">
          <div className="demo-header">
            <div className="demo-header-dot" />
            <span># Team Chat</span>
            <small>3 agents</small>
          </div>
          <div className="demo-messages">
            <div className="msg msg-user">
              <div className="msg-bubble">Can we hire someone who lives in Brisbane but would work remotely?</div>
            </div>
            <div className="msg msg-agent">
              <div className="msg-tag msg-tag-blue">HR Advisor</div>
              <div className="msg-bubble">Based on our hiring policy, candidates need to be Australian residents — which a Brisbane-based person would be. They&apos;d be eligible as long as they also meet the English language requirement. I&apos;d recommend checking if your remote work policy covers interstate arrangements too.</div>
            </div>
            <div className="msg msg-agent">
              <div className="msg-tag msg-tag-amber">Legal Advisor</div>
              <div className="msg-bubble">Good call on the remote work policy. From a compliance perspective, you&apos;ll also want to check your workers compensation coverage extends to Queensland — it varies by state. I can review your current policy if you&apos;d like.</div>
            </div>
            <div className="msg msg-user">
              <div className="msg-bubble">Yes please, and can you draft a remote work agreement?</div>
            </div>
            <div className="msg msg-agent">
              <div className="msg-tag msg-tag-amber">Legal Advisor</div>
              <div className="msg-bubble">On it. I&apos;ll base it on our contract template and include clauses for interstate WHS obligations, equipment provisions, and communication expectations. I&apos;ll have a draft ready in this chat shortly.</div>
            </div>
            <div className="msg msg-agent">
              <div className="msg-tag msg-tag-green">Bookkeeper</div>
              <div className="msg-bubble">Just a heads up — if they&apos;re in Queensland, payroll tax thresholds are different. I&apos;ll flag the relevant details when you&apos;re ready to set up their payroll.</div>
            </div>
          </div>
          <div className="demo-input">
            <span className="demo-input-field">Message your team...</span>
            <div className="demo-send">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5"><path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" /></svg>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="how-section" id="how">
        <div className="how-inner">
          <h2>Three steps to your new team</h2>
          <div className="how-steps">
            <div className="how-step">
              <div className="how-step-num">1</div>
              <h3>Create your agents</h3>
              <p>Give each agent a name, a purpose, and a personality. An HR advisor, a bookkeeper, a legal analyst — whatever your business needs.</p>
            </div>
            <div className="how-step">
              <div className="how-step-num">2</div>
              <h3>Upload your knowledge</h3>
              <p>Add your policies, templates, financial data, and reference documents. Each agent learns from the documents you give them.</p>
            </div>
            <div className="how-step">
              <div className="how-step-num">3</div>
              <h3>Chat with your team</h3>
              <p>Ask questions in a group chat or DM an agent directly. They reference your actual documents, collaborate with each other, and get work done.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="features-section" id="features">
        <div className="features-inner">
          <h2>Everything a team should do</h2>
          <p>Your agents don&apos;t just answer questions. They collaborate, search, schedule, and produce real work.</p>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon feature-icon-blue">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              </div>
              <h3>Group chat</h3>
              <p>Ask a question and the right agents respond. They tag each other, build on answers, and collaborate like a real team.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon feature-icon-green">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              </div>
              <h3>Document knowledge</h3>
              <p>Upload your policies, legislation, templates, and data. Agents reference your actual documents — not generic advice.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon feature-icon-amber">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              </div>
              <h3>Scheduled tasks</h3>
              <p>Tell an agent &quot;give me a daily brief at 8am&quot; and it happens. Web search, document review, reporting — all on autopilot.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon feature-icon-purple">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
              </div>
              <h3>Integrations</h3>
              <p>Connect Asana, search the web, and more. Each agent gets access only to the tools they need.</p>
            </div>
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section className="usecases-section" id="usecases">
        <div className="usecases-inner">
          <h2>One platform, any team</h2>
          <p>Configure agents for your industry. Same platform, completely different teams.</p>
          <div className="usecases-grid">
            <div className="usecase-card">
              <div className="usecase-emoji">🏢</div>
              <h3>Small business</h3>
              <div className="usecase-agents">
                <span className="usecase-agent" style={{ background: "var(--landing-accent-soft)", color: "var(--landing-accent)" }}>HR Advisor</span>
                <span className="usecase-agent" style={{ background: "var(--landing-green-soft)", color: "var(--landing-green)" }}>Bookkeeper</span>
                <span className="usecase-agent" style={{ background: "var(--landing-amber-soft)", color: "var(--landing-amber)" }}>Legal</span>
              </div>
              <p>Upload your policies and legislation. Get compliant advice grounded in your actual documents.</p>
            </div>
            <div className="usecase-card">
              <div className="usecase-emoji">💪</div>
              <h3>Fitness coaching</h3>
              <div className="usecase-agents">
                <span className="usecase-agent" style={{ background: "var(--landing-green-soft)", color: "var(--landing-green)" }}>Nutrition</span>
                <span className="usecase-agent" style={{ background: "var(--landing-accent-soft)", color: "var(--landing-accent)" }}>Training</span>
                <span className="usecase-agent" style={{ background: "var(--landing-purple-soft)", color: "var(--landing-purple)" }}>Mindset</span>
              </div>
              <p>Coaches scale their practice. Clients get 24/7 access to a team that follows their coach&apos;s methodology.</p>
            </div>
            <div className="usecase-card">
              <div className="usecase-emoji">📊</div>
              <h3>Executive ops</h3>
              <div className="usecase-agents">
                <span className="usecase-agent" style={{ background: "var(--landing-amber-soft)", color: "var(--landing-amber)" }}>Analyst</span>
                <span className="usecase-agent" style={{ background: "var(--landing-accent-soft)", color: "var(--landing-accent)" }}>Writer</span>
                <span className="usecase-agent" style={{ background: "var(--landing-green-soft)", color: "var(--landing-green)" }}>PM</span>
              </div>
              <p>Connect Asana and your documents. Get project updates, draft reports, and daily briefs on demand.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-inner">
          <h2>Build your team<br />in five minutes</h2>
          <p>No setup fees. No training required. Create your first agent, upload a document, and start chatting.</p>
          <Link href="/auth" className="btn btn-primary">Get started free</Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <span>&copy; 2026 Offloaded</span>
        <span style={{ fontSize: 13, color: "var(--landing-text-ter)" }}>offloaded.life</span>
      </footer>
    </>
  );
}

const landingStyles = `
  :root {
    --landing-bg: #FAFAF8;
    --landing-bg-warm: #F4F3EF;
    --landing-surface: #FFFFFF;
    --landing-text: #111111;
    --landing-text-sec: #555555;
    --landing-text-ter: #888888;
    --landing-border: #E2E1DC;
    --landing-accent: #2C5FF6;
    --landing-accent-soft: rgba(44,95,246,0.08);
    --landing-green: #16A34A;
    --landing-green-soft: rgba(22,163,74,0.08);
    --landing-amber: #D97706;
    --landing-amber-soft: rgba(217,119,6,0.08);
    --landing-purple: #7C3AED;
    --landing-purple-soft: rgba(124,58,237,0.08);
    --landing-serif: 'Instrument Serif', Georgia, serif;
    --landing-sans: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
  }

  [data-theme="dark"] {
    --landing-bg: #0F1012;
    --landing-bg-warm: #161719;
    --landing-surface: #1A1B1E;
    --landing-text: #E8E9EC;
    --landing-text-sec: #9D9EA5;
    --landing-text-ter: #6B6C73;
    --landing-border: #2A2B2F;
    --landing-accent: #4B7BF5;
    --landing-accent-soft: rgba(75,123,245,0.15);
    --landing-green: #22C55E;
    --landing-green-soft: rgba(34,197,94,0.15);
    --landing-amber: #F59E0B;
    --landing-amber-soft: rgba(245,158,11,0.15);
    --landing-purple: #A78BFA;
    --landing-purple-soft: rgba(167,139,250,0.15);
  }

  body {
    font-family: var(--landing-sans);
    color: var(--landing-text);
    background: var(--landing-bg);
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
  }

  /* NAV */
  .landing-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    padding: 20px 40px;
    display: flex; align-items: center; justify-content: space-between;
    background: color-mix(in srgb, var(--landing-bg) 85%, transparent);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid transparent;
    transition: border-color 0.3s ease;
  }
  .landing-nav.scrolled { border-bottom-color: var(--landing-border); }

  .nav-logo {
    font-family: var(--landing-serif); font-size: 22px; font-weight: 400;
    color: var(--landing-text); text-decoration: none; letter-spacing: -0.02em;
  }
  .nav-links { display: flex; align-items: center; gap: 32px; }
  .nav-links a {
    font-size: 14px; font-weight: 500; color: var(--landing-text-sec);
    text-decoration: none; transition: color 0.2s;
  }
  .nav-links a:hover { color: var(--landing-text); }
  .nav-links a.btn-primary { color: #FFFFFF; }
  .nav-links a.btn-primary:hover { color: #FFFFFF; }

  .btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 12px 24px; border-radius: 10px; font-size: 15px;
    font-weight: 600; font-family: var(--landing-sans); text-decoration: none;
    transition: all 0.2s ease; cursor: pointer; border: none;
  }
  .btn-primary {
    background: var(--landing-accent); color: #FFFFFF;
  }
  .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
  .btn-secondary {
    background: var(--landing-surface); color: var(--landing-text);
    border: 1px solid var(--landing-border);
  }
  .btn-secondary:hover { border-color: var(--landing-text-ter); }
  .btn-small { padding: 9px 18px; font-size: 13px; }

  /* HERO */
  .hero {
    padding: 160px 40px 80px; text-align: center;
    max-width: 900px; margin: 0 auto;
  }
  .hero-badge {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 16px; border-radius: 100px;
    background: var(--landing-accent-soft); color: var(--landing-accent);
    font-size: 13px; font-weight: 600; margin-bottom: 28px;
  }
  .hero-badge::before {
    content: ''; width: 6px; height: 6px; border-radius: 50%;
    background: var(--landing-accent); animation: landing-pulse 2s ease infinite;
  }
  @keyframes landing-pulse {
    0%, 100% { opacity: 1; } 50% { opacity: 0.4; }
  }
  .hero h1 {
    font-family: var(--landing-serif); font-size: clamp(44px, 7vw, 72px);
    font-weight: 400; line-height: 1.08; letter-spacing: -0.03em;
    margin-bottom: 24px; color: var(--landing-text);
  }
  .hero h1 em {
    font-style: italic; color: var(--landing-accent);
  }
  .hero p {
    font-size: 18px; line-height: 1.6; color: var(--landing-text-sec);
    max-width: 540px; margin: 0 auto 40px;
  }
  .hero-ctas { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

  /* CHAT DEMO */
  .demo-section {
    padding: 40px 40px 100px; max-width: 720px; margin: 0 auto;
  }
  .demo-window {
    background: var(--landing-surface); border: 1px solid var(--landing-border);
    border-radius: 16px; overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 40px rgba(0,0,0,0.06);
  }
  .demo-header {
    padding: 16px 20px; border-bottom: 1px solid var(--landing-border);
    display: flex; align-items: center; gap: 10px;
  }
  .demo-header-dot {
    width: 8px; height: 8px; border-radius: 50%; background: var(--landing-accent);
  }
  .demo-header span { font-size: 14px; font-weight: 600; }
  .demo-header small { font-size: 12px; color: var(--landing-text-ter); }
  .demo-messages { padding: 24px 20px; display: flex; flex-direction: column; gap: 16px; }

  .msg { max-width: 85%; animation: landing-msgIn 0.5s ease both; }
  .msg-user { align-self: flex-end; }
  .msg-agent { align-self: flex-start; }
  .msg:nth-child(1) { animation-delay: 0.3s; }
  .msg:nth-child(2) { animation-delay: 0.7s; }
  .msg:nth-child(3) { animation-delay: 1.2s; }
  .msg:nth-child(4) { animation-delay: 1.8s; }
  .msg:nth-child(5) { animation-delay: 2.4s; }
  .msg:nth-child(6) { animation-delay: 3.0s; }

  @keyframes landing-msgIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .msg-tag {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; font-weight: 600; padding: 3px 8px;
    border-radius: 20px; margin-bottom: 6px;
  }
  .msg-tag::before {
    content: ''; width: 5px; height: 5px; border-radius: 50%;
  }
  .msg-tag-blue { color: var(--landing-accent); background: var(--landing-accent-soft); }
  .msg-tag-blue::before { background: var(--landing-accent); }
  .msg-tag-green { color: var(--landing-green); background: var(--landing-green-soft); }
  .msg-tag-green::before { background: var(--landing-green); }
  .msg-tag-amber { color: var(--landing-amber); background: var(--landing-amber-soft); }
  .msg-tag-amber::before { background: var(--landing-amber); }

  .msg-bubble {
    padding: 12px 16px; font-size: 14px; line-height: 1.6;
    border-radius: 16px;
  }
  .msg-user .msg-bubble {
    background: var(--landing-bg-warm); border-radius: 16px 16px 4px 16px;
    color: var(--landing-text);
  }
  .msg-agent .msg-bubble {
    background: var(--landing-surface); border: 1px solid var(--landing-border);
    border-radius: 16px 16px 16px 4px; color: var(--landing-text);
  }

  .demo-input {
    padding: 12px 20px; border-top: 1px solid var(--landing-border);
    display: flex; align-items: center; gap: 10px;
  }
  .demo-input-field {
    flex: 1; padding: 10px 0; font-size: 14px; color: var(--landing-text-ter);
    font-family: var(--landing-sans);
  }
  .demo-send {
    width: 34px; height: 34px; border-radius: 8px;
    background: var(--landing-bg-warm); display: flex; align-items: center; justify-content: center;
  }

  /* HOW IT WORKS */
  .how-section {
    padding: 100px 40px; background: var(--landing-bg-warm);
  }
  .how-inner { max-width: 900px; margin: 0 auto; }
  .how-section h2 {
    font-family: var(--landing-serif); font-size: clamp(32px, 5vw, 48px);
    font-weight: 400; letter-spacing: -0.02em;
    text-align: center; margin-bottom: 64px;
  }
  .how-steps {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px;
  }
  .how-step {
    background: var(--landing-surface); border: 1px solid var(--landing-border);
    border-radius: 14px; padding: 32px 28px;
  }
  .how-step-num {
    font-family: var(--landing-serif); font-size: 36px; font-style: italic;
    color: var(--landing-accent); margin-bottom: 16px; line-height: 1;
  }
  .how-step h3 {
    font-size: 17px; font-weight: 600; margin-bottom: 10px; color: var(--landing-text);
  }
  .how-step p {
    font-size: 14px; line-height: 1.6; color: var(--landing-text-sec);
  }

  /* FEATURES */
  .features-section {
    padding: 100px 40px;
  }
  .features-inner { max-width: 900px; margin: 0 auto; }
  .features-section h2 {
    font-family: var(--landing-serif); font-size: clamp(32px, 5vw, 48px);
    font-weight: 400; letter-spacing: -0.02em;
    text-align: center; margin-bottom: 20px;
  }
  .features-inner > p {
    text-align: center; font-size: 17px; color: var(--landing-text-sec);
    max-width: 500px; margin: 0 auto 64px; line-height: 1.6;
  }
  .features-grid {
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;
  }
  .feature-card {
    background: var(--landing-surface); border: 1px solid var(--landing-border);
    border-radius: 14px; padding: 28px;
  }
  .feature-icon {
    width: 40px; height: 40px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 16px; font-size: 18px;
  }
  .feature-icon-blue { background: var(--landing-accent-soft); color: var(--landing-accent); }
  .feature-icon-green { background: var(--landing-green-soft); color: var(--landing-green); }
  .feature-icon-amber { background: var(--landing-amber-soft); color: var(--landing-amber); }
  .feature-icon-purple { background: var(--landing-purple-soft); color: var(--landing-purple); }

  .feature-card h3 {
    font-size: 16px; font-weight: 600; margin-bottom: 8px; color: var(--landing-text);
  }
  .feature-card p {
    font-size: 14px; line-height: 1.6; color: var(--landing-text-sec);
  }

  /* USE CASES */
  .usecases-section {
    padding: 100px 40px; background: var(--landing-bg-warm);
  }
  .usecases-inner { max-width: 900px; margin: 0 auto; }
  .usecases-section h2 {
    font-family: var(--landing-serif); font-size: clamp(32px, 5vw, 48px);
    font-weight: 400; letter-spacing: -0.02em;
    text-align: center; margin-bottom: 20px;
  }
  .usecases-inner > p {
    text-align: center; font-size: 17px; color: var(--landing-text-sec);
    max-width: 500px; margin: 0 auto 64px; line-height: 1.6;
  }
  .usecases-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
  }
  .usecase-card {
    background: var(--landing-surface); border: 1px solid var(--landing-border);
    border-radius: 14px; padding: 28px; text-align: center;
  }
  .usecase-emoji { font-size: 32px; margin-bottom: 16px; }
  .usecase-card h3 {
    font-size: 16px; font-weight: 600; margin-bottom: 8px; color: var(--landing-text);
  }
  .usecase-agents {
    display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; margin-bottom: 12px;
  }
  .usecase-agent {
    font-size: 11px; font-weight: 600; padding: 3px 10px;
    border-radius: 20px;
  }
  .usecase-card p {
    font-size: 13px; line-height: 1.6; color: var(--landing-text-sec);
  }

  /* CTA */
  .cta-section {
    padding: 120px 40px; text-align: center;
  }
  .cta-inner { max-width: 600px; margin: 0 auto; }
  .cta-section h2 {
    font-family: var(--landing-serif); font-size: clamp(36px, 5vw, 52px);
    font-weight: 400; letter-spacing: -0.02em; margin-bottom: 20px;
  }
  .cta-section p {
    font-size: 17px; color: var(--landing-text-sec); margin-bottom: 36px; line-height: 1.6;
  }

  /* FOOTER */
  .landing-footer {
    padding: 40px; border-top: 1px solid var(--landing-border);
    display: flex; justify-content: space-between; align-items: center;
    max-width: 980px; margin: 0 auto;
  }
  .landing-footer span { font-size: 13px; color: var(--landing-text-ter); }

  /* MOBILE */
  @media (max-width: 768px) {
    .landing-nav { padding: 16px 20px; }
    .nav-links { gap: 20px; }
    .nav-links a.hide-mobile { display: none; }
    .hero { padding: 120px 20px 60px; }
    .hero p { font-size: 16px; }
    .demo-section { padding: 20px 20px 80px; }
    .how-section, .features-section, .usecases-section, .cta-section { padding: 80px 20px; }
    .how-steps { grid-template-columns: 1fr; gap: 16px; }
    .features-grid { grid-template-columns: 1fr; gap: 16px; }
    .usecases-grid { grid-template-columns: 1fr; gap: 16px; }
    .landing-footer { flex-direction: column; gap: 12px; text-align: center; }
  }
`;
