import Link from "next/link";
import { Brand } from "@/components/brand";
export function AdminNav() { return <header className="workspace-header"><Brand/><nav aria-label="Administration"><Link href="/admin/verifications">Demandes</Link><Link href="/admin/professionals">Professionnels</Link><Link href="/account">Mon compte</Link></nav></header>; }
