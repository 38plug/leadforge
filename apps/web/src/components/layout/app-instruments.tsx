"use client";

/**
 * Dashboard visual system — wrappers around existing functional components.
 *
 * AppFrame: outer viewport inset with thin border
 * CommandBar: replaces topbar chrome — ultra-thin, editorial
 * InstrumentPanel: floating dark panel (replaces Card styling)
 * MetricInstrument: large editorial number with label
 * StatusLine: live system status strip
 * DataChrome: wraps existing tables with frame language
 *
 * ALL data binding, queries, mutations, handlers stay in existing components.
 * These wrappers ONLY add visual chrome.
 */

/* ------------------------------------------------------------------ */
/*  App Frame                                                          */
/* ------------------------------------------------------------------ */

export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-frame hidden h-full flex-col md:flex">
      {children}
    </div>
  );
}

export function AppFrameMobile({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col md:hidden">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Instrument Panel                                                   */
/* ------------------------------------------------------------------ */

export function InstrumentPanel({
  children,
  className = "",
  label,
  rightLabel,
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
  rightLabel?: string;
}) {
  return (
    <div className={`instrument-panel ${className}`}>
      {(label || rightLabel) && (
        <div className="instrument-header">
          {label && <span className="instrument-label">{label}</span>}
          {rightLabel && <span className="instrument-right-label">{rightLabel}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Metric Instrument                                                  */
/* ------------------------------------------------------------------ */

export function MetricInstrument({
  value,
  label,
  annotation,
  className = "",
}: {
  value: string | number;
  label: string;
  annotation?: string;
  className?: string;
}) {
  return (
    <div className={`metric-instrument ${className}`}>
      <span className="metric-value">{value}</span>
      <span className="metric-label">{label}</span>
      {annotation && <span className="metric-annotation">{annotation}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status Line                                                        */
/* ------------------------------------------------------------------ */

export function StatusLine({ items }: { items: { label: string; active?: boolean }[] }) {
  return (
    <div className="status-line">
      {items.map((item, i) => (
        <span key={i} className="status-item">
          <span
            className={`status-dot ${item.active ? "status-dot--active" : ""}`}
          />
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section Index                                                      */
/* ------------------------------------------------------------------ */

export function SectionIndex({
  number,
  title,
  right,
}: {
  number: string;
  title: string;
  right?: string;
}) {
  return (
    <div className="section-index">
      <span className="section-index-number">{number}</span>
      <span className="section-index-title">{title}</span>
      {right && <span className="section-index-right">{right}</span>}
    </div>
  );
}
