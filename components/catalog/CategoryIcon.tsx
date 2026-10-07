import { Building2, ClipboardList, FileText, Laptop, Settings, ShieldCheck, Users, Wallet, Wrench, type LucideIcon } from "lucide-react";

/** Icon keys a catalog category can use. Unknown keys fall back to a document icon. */
const ICONS: Record<string, LucideIcon> = {
  building: Building2,
  clipboard: ClipboardList,
  document: FileText,
  finance: Wallet,
  laptop: Laptop,
  settings: Settings,
  shield: ShieldCheck,
  users: Users,
  wrench: Wrench,
};

export function CategoryIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ICONS[icon] ?? FileText;
  return <Icon className={className} aria-hidden="true" strokeWidth={1.75} />;
}
