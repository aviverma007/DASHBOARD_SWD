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
  const banner = {
    title: mode === "digital" ? "Digital Leads" : "Gallery Footfall",
    sub: mode === "digital" ? "Enquiries by source, campaign and conversion" : "Site-visit footfall and channel-partner visits",
    right: TABS.length > 0 ? (
      <div className="pb-tabs">
        {TABS.map(t => (
          <button key={t.key} className={`pb-tab${tab === t.key ? " on" : ""}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>
    ) : undefined,
  };

  return (
    <div className="sw-inv" style={{ minHeight: "100vh" }}>
      {/* The banner itself is rendered by the active section (its filters
          live inside it); the page supplies the title and tabs. */}
      <div className="tv-zoom-desktop">
      <div className="wrap">
        {tab === "footfall" && <FootfallSection banner={banner} />}
        {tab === "cpvisits" && <CpVisitsSection banner={banner} />}
        {tab === "digital" && <DigitalSection banner={banner} />}
      </div>
      </div>
    </div>
  );
}
