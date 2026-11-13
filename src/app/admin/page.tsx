import { redirect } from "next/navigation";
import { requireReviewer } from "@/lib/auth";
export default async function Admin() { await requireReviewer(); redirect("/admin/verifications"); }
