import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireApprovedDoctor } from '@/lib/auth';
import { DoctorNav } from '@/components/registry/doctor-nav';
import { EntryCard } from '@/components/clinical/entry-card';
import { PrintButton } from '@/components/clinical/print-button';
import type { ClinicalEntry } from '@/lib/clinical/types';
import { uuidPattern,patientName,birthLabel,type ChildProfile } from '@/lib/registry/types';
export const dynamic='force-dynamic';
export default async function Summary({params}:{params:Promise<{id:string}>}){
 const{supabase}=await requireApprovedDoctor();const{id}=await params;if(!uuidPattern.test(id))notFound();const[profile,ledger]=await Promise.all([supabase.rpc('get_child_profile',{p_child_id:id}),supabase.rpc('clinical_export',{p_child_id:id})]);if(profile.error?.code==='42501'||ledger.error?.code==='42501')notFound();if(ledger.error?.code==='54000')return <main className="account-page wide"><DoctorNav/><section className="panel"><h1>Résumé volumineux</h1><p>La limite interactive de 5 000 révisions est dépassée. Utilisez une procédure d’export autorisée avec un périmètre convenu. Aucun résumé partiel n’a été généré.</p></section></main>;if(profile.error||ledger.error)throw new Error('Impossible de générer le résumé.');const child=profile.data as ChildProfile,entries=ledger.data as ClinicalEntry[];
 return <main className="account-page wide print-summary"><DoctorNav/><div className="page-heading"><span className="eyebrow">RÉSUMÉ CLINIQUE — DONNÉES FICTIVES</span><h1>{patientName(child)}</h1><p>{birthLabel(child)} · {child.universal_id}</p><p className="fine">Généré le {new Date().toISOString()} · contient l’original et toutes les corrections des soins enregistrés, y compris les retraits. Le module vaccinal n’est pas encore inclus.</p></div><div className="tabs no-print"><PrintButton/><a href={`/patients/${id}/export`} download>Télécharger le relevé JSON</a><Link href={`/patients/${id}/records`}>Retour au dossier</Link></div><p className="notice">Une absence de saisie ne prouve pas l’absence de soin. Vérifiez la provenance, la date et la dernière révision de chaque événement. Les valeurs de croissance n’ont pas d’interprétation automatique.</p>{entries.length?entries.map(entry=><EntryCard key={entry.id} entry={entry} link={false}/>):<p className="empty-state">Aucun soin documenté dans ce module.</p>}</main>;
}
