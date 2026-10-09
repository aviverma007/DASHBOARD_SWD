import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { ANALYTICS, PROJECT_MODS, WORKSPACE, visible } from "../nav";
import { Ico, List, Row, Section } from "../ui";
import { ProfileCard, AccountActions } from "./Account";

export default function More() {
  const nav = useNavigate();
  const access = useAuthStore(s => s.access);
  const groups = [...ANALYTICS, { title: "Projects", items: PROJECT_MODS }, { title: "Workspace", items: WORKSPACE.filter(w => w.path !== "/settings") }]
    .map(g => ({ ...g, items: visible(g.items, access) })).filter(g => g.items.length);
  return (
    <div className="m-stack">
      <ProfileCard />
      {groups.map(g => (
        <div key={g.title} className="m-stack">
          <Section title={g.title} />
          <List>{g.items.map(m => <Row key={m.path} icon={<Ico n={m.icon} size={18} />} title={m.label} sub={m.blurb} onClick={() => nav(m.path)} />)}</List>
        </div>
      ))}
      <Section title="Account" />
      <AccountActions />
    </div>
  );
}
