import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireApprovedDoctor } from "@/lib/auth";
import { uuidPattern, type ChildProfile } from "./types";

// Share the scoped read within one server request, including calls by a page and its layout.
export const readAuthorizedChild = cache(
  async (id: string): Promise<ChildProfile> => {
    if (!uuidPattern.test(id)) notFound();
    const { supabase } = await requireApprovedDoctor();
    const { data, error } = await supabase.rpc("get_child_profile", {
      p_child_id: id,
    });
    if (error?.code === "42501" || (!data && !error)) notFound();
    if (error) throw new Error("Impossible de charger ce dossier.");
    return data as ChildProfile;
  },
);
