import { ProfileCard, AccountActions } from "./Account";
export default function Settings() {
  return (
    <div className="m-stack">
      <div><h1 className="m-h1">Settings</h1></div>
      <ProfileCard />
      <AccountActions />
    </div>
  );
}
