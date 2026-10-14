import { useState } from "react";
import { FootfallSection } from "../../components/leads/FootfallSection";
import { CpVisitsSection } from "../../components/leads/CpVisitsSection";
import { DigitalSection } from "../../components/leads/DigitalSection";
import { useLiveDigitalKey } from "../../components/leads/digitalShared";
import "../../components/inventory/smartworldInventory.css";
import { BannerPills } from "../../components/layout/PageBanner";

/** Live Salesforce enquiries: re-checked every 5 min; a change remounts the section so all memos recompute. */
function DigitalLive({ banner }: { banner: React.ComponentProps<typeof DigitalSection>["banner"] }) {
  const liveKey = useLiveDigitalKey("http://192.168.66.28:5002");
  return <DigitalSection key={liveKey} banner={banner} />;
}

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
    center: TABS.length > 0 ? (
      <BannerPills size="lg" items={TABS.map(t => [t.key, t.label] as const)} value={tab} onChange={setTab} />
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
        {tab === "digital" && <DigitalLive banner={banner} />}
      </div>
      </div>
    </div>
  );
}
