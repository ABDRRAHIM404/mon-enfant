import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { notFound } from 'next/navigation';
import { requireApprovedDoctor } from '@/lib/auth';
import { DoctorNav } from '@/components/registry/doctor-nav';
import { EntryCard } from '@/components/clinical/entry-card';
import { ClinicalForm } from '@/components/clinical/entry-form';
import type { ClinicalEntry } from '@/lib/clinical/types';
import { uuidPattern,type Facility } from '@/lib/registry/types';
export const dynamic='force-dynamic';
export default async function ClinicalHistory({params}:{params:Promise<{id:string;root:string}>}){
 const {supabase}=await requireApprovedDoctor();const {id,root}=await params;if(!uuidPattern.test(id)||!uuidPattern.test(root))notFound();
 const [history,facilities,capabilities]=await Promise.all([supabase.rpc('clinical_entry_history',{p_child_id:id,p_root_id:root}),supabase.rpc('my_facilities'),supabase.rpc('my_clinical_capabilities')]);
 if(history.error?.code==='42501')notFound();if(history.error||facilities.error||capabilities.error)throw new Error('Impossible de charger l’historique clinique.');const entries=history.data as ClinicalEntry[];if(!entries.length)notFound();const latest=entries[entries.length-1];const allowed=(capabilities.data as string[]).includes(latest.kind);const places=facilities.data as Facility[];
 return <main className="account-page wide"><DoctorNav/><div className="page-heading"><h1>Historique de la saisie</h1><p className="muted">L’original et chaque correction restent attribués à leur auteur. Dernière version : {latest.revision}.</p></div><Link className="text-link" href={`/patients/${id}/records`}>Retour au dossier clinique</Link>{entries.map(entry=><EntryCard key={entry.id} entry={entry} link={false}/>)}<section className="panel"><h2>Corriger / retirer la dernière version</h2>{allowed&&places.length?<ClinicalForm childId={id} operationId={randomUUID()} kind={latest.kind} facilities={places} previous={latest}/>:<p className="notice">Une habilitation active pour ce type de soin et un lieu d’exercice déclaré sont nécessaires pour ajouter une révision.</p>}</section></main>;
}
