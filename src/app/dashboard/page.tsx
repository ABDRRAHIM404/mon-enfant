import Link from 'next/link';
import { requireApprovedDoctor } from '@/lib/auth';
import { DoctorNav } from '@/components/registry/doctor-nav';
export const dynamic='force-dynamic';
export default async function Dashboard() {
  const {supabase}=await requireApprovedDoctor();
  const {data,error}=await supabase.rpc('registry_summary');
  if(error) throw new Error('Impossible de charger le tableau de bord.');
  const counts=data as {patients:number;uncertain_history:number;pending_requests:number;facilities:number};
  return <main className="account-page wide"><DoctorNav/><div className="page-heading"><span className="eyebrow">ESPACE MÉDECIN</span><h1>Votre registre de soins.</h1><p className="muted">Les dossiers auxquels vous avez actuellement accès.</p></div><div className="stat-grid">{[[counts.patients,'Enfants de mon registre','/patients'],[counts.uncertain_history,'Historiques inconnus ou partiels','/patients'],[counts.pending_requests,'Demandes à examiner','/access-requests'],[counts.facilities,'Lieux d’exercice déclarés','/practices']].map(([count,label,href])=><Link className="panel stat-card" href={String(href)} key={String(label)}><strong>{count}</strong><span>{label}</span></Link>)}</div><section className="panel"><h2>Continuer votre travail</h2><div className="tabs"><Link href="/patients/new">Inscrire un enfant</Link><Link href="/patients/new?source=paper">Transcrire un dossier papier</Link><Link href="/patients/link">Rattacher un dossier existant</Link></div><p className="fine">Les modules cliniques et de rendez-vous sont en cours de développement. Aucun statut vaccinal n’est déduit d’un historique manquant.</p></section></main>;
}
