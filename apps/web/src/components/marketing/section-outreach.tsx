"use client";

import { useEffect, useRef, useState } from "react";
import { Mail, Phone, Instagram, FileText, Copy, Check } from "lucide-react";

const TABS = [
  { id: "email", label: "EMAIL", icon: Mail },
  { id: "instagram", label: "INSTAGRAM", icon: Instagram },
  { id: "call", label: "CALL", icon: Phone },
  { id: "audit", label: "AUDIT", icon: FileText },
];

const EMAIL_TEXT = `Hi Bella Vista team,

I noticed your restaurant has strong local reviews but currently doesn't have a dedicated website. With 238 reviews averaging 4.7 stars, you're leaving significant client acquisition on the table.

I help restaurants like yours build high-converting websites that turn search traffic into reservations.

Would you be open to a quick 15-minute conversation about how we could help you capture more of the Miami dining market?

Best regards`;

export function OutreachSection() {
  const [inView, setInView] = useState(false);
  const [activeTab, setActiveTab] = useState("email");
  const [typedText, setTypedText] = useState("");
  const [typingDone, setTypingDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold: 0.15 }
    );
    obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || activeTab !== "email") return;
    let i = 0;
    setTypedText("");
    setTypingDone(false);
    const timer = setInterval(() => {
      if (i < EMAIL_TEXT.length) {
        setTypedText(EMAIL_TEXT.slice(0, i + 1));
        i++;
      } else {
        clearInterval(timer);
        setTypingDone(true);
      }
    }, 12);
    return () => clearInterval(timer);
  }, [inView, activeTab]);

  return (
    <section ref={sectionRef} className="relative border-t border-white/[0.04] py-24">
      <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:gap-20">
        {/* LEFT: Editorial text */}
        <div data-reveal className="flex flex-col justify-center">
          <span className="label-caps text-primary">04 / Outreach Engine</span>
          <h2 className="mt-5 text-[clamp(2rem,5vw,4rem)] font-bold leading-[0.95] tracking-[-0.03em] text-white">
            TURN<br />INSIGHT<br />INTO CONTACT.
          </h2>
          <p className="mt-6 max-w-sm text-[13px] leading-relaxed text-white/30">
            LeadForge generates personalized outreach based on each business&apos;s
            specific situation. Every message is unique because every
            opportunity is different.
          </p>
          <div className="mt-8 flex items-center gap-4 text-[8px] font-semibold uppercase tracking-[0.18em] text-white/15">
            <span>[OUTREACH_AI]</span>
            <span className="h-px w-3 bg-white/8" />
            <span>[PERSONALIZED]</span>
          </div>
        </div>

        {/* RIGHT: Outreach interface */}
        <div data-reveal>
          <div className="glass-card-static overflow-hidden rounded-xl border border-white/[0.05] bg-[#070707]/90 backdrop-blur-xl">
            {/* Tabs */}
            <div className="flex border-b border-white/[0.04]">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 text-[9px] font-semibold uppercase tracking-[0.12em] transition-all duration-300 ${
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-white/20 hover:text-white/35"
                  }`}
                >
                  <tab.icon className="h-3 w-3" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="p-5">
              {activeTab === "email" && (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/20">
                      AI-Generated Message
                    </span>
                    {typingDone && (
                      <span className="flex items-center gap-1 text-[8px] text-primary/60" style={{ animation: "cinematic-in 0.3s ease forwards" }}>
                        <span className="h-1 w-1 rounded-full bg-primary" />
                        OUTREACH READY
                      </span>
                    )}
                  </div>
                  <div className="min-h-[200px] rounded-lg border border-white/[0.04] bg-white/[0.015] p-4">
                    <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-white/50">
                      {typedText}
                      {!typingDone && (
                        <span
                          className="ml-0.5 inline-block h-3.5 w-0.5 bg-primary/60"
                          style={{ animation: "typing-cursor 0.8s step-end infinite" }}
                        />
                      )}
                    </p>
                  </div>
                  {/* Actions */}
                  <div
                    className="mt-3 flex gap-2"
                    style={{
                      opacity: typingDone ? 1 : 0.3,
                      transition: "opacity 0.3s ease",
                    }}
                  >
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(EMAIL_TEXT);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="flex items-center gap-1.5 rounded border border-white/[0.06] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/40 transition-all hover:border-white/10 hover:text-white/60"
                    >
                      {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                    <button className="flex items-center gap-1.5 rounded border border-white/[0.06] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/40 transition-all hover:border-white/10 hover:text-white/60">
                      Edit
                    </button>
                    <button className="flex items-center gap-1.5 rounded border border-primary/20 bg-primary/[0.04] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-primary/70 transition-all hover:bg-primary/[0.08]">
                      Save
                    </button>
                  </div>
                </div>
              )}

              {activeTab !== "email" && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.03]">
                    {(() => {
                      const TabIcon = TABS.find((t) => t.id === activeTab)?.icon || Mail;
                      return <TabIcon className="h-5 w-5 text-white/20" />;
                    })()}
                  </div>
                  <p className="mt-3 text-[11px] text-white/25">
                    {activeTab === "instagram" && "Instagram DM generation available in workspace"}
                    {activeTab === "call" && "Call script generation available in workspace"}
                    {activeTab === "audit" && "Website audit generation available in workspace"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
