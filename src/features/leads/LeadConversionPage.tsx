import { useState } from "react";
import { FootfallSection } from "../../components/leads/FootfallSection";
import { CpVisitsSection } from "../../components/leads/CpVisitsSection";
import { DigitalSection } from "../../components/leads/DigitalSection";
import "../../components/inventory/smartworldInventory.css";

type Tab = "footfall" | "cpvisits" | "digital";

const FOOTFALL_TABS: { key: Tab; label: string }[] = [
  { key: "footfall", label: "Footfall" },
  { key: "cpvisits", label: "CP Visits" },
];

/** Gallery Footfall (footfall + CP visits tabs) and Digital Leads
 * are now separate nav pages sharing this component via `mode`. */
export function LeadConversionPage({ mode = "footfall" }: { mode?: "footfall" | "digital" }) {
  const TABS = mode === "digital" ? [] : FOOTFALL_TABS;
  const [tab, setTab] = useState<Tab>(mode === "digital" ? "digital" : "footfall");

  return (
    <div className="sw-inv" style={{ minHeight: "100vh" }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(115deg,#111C36 0%,#1E3163 55%,#2A4488 100%)",
        padding: "18px 24px 16px",
        borderBottom: "3px solid var(--gold)",
      }}>
        <div style={{ fontFamily: "Georgia,serif", fontSize: 20, color: "#fff", fontWeight: 700, marginBottom: TABS.length ? 12 : 0 }}>
          {mode === "digital" ? "Digital Leads" : "Gallery Footfall"}
        </div>
        {TABS.length > 0 && (
        <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.08)", borderRadius: 999, padding: 4 }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                border: "none",
                background: tab === t.key ? "#B8893C" : "transparent",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13.5,
                padding: "9px 22px",
                borderRadius: 999,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "background 0.15s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        )}
      </div>

      <div className="wrap">
        {tab === "footfall" && <FootfallSection />}
        {tab === "cpvisits" && <CpVisitsSection />}
        {tab === "digital" && <DigitalSection />}
      </div>
    </div>
  );
}
