"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireApprovedDoctor } from "@/lib/auth";
import { reportOperationalEvent } from "@/lib/operational-events";
import { parseAppointmentDate } from "@/lib/appointments/calendar";
import { uuidPattern } from "@/lib/registry/types";
export type RegistryState = {
  error?: string;
  success?: boolean;
  duplicate?: boolean;
  registrationState?: "needs_details" | "need_qr" | "needs_review";
  reviewSubmitted?: boolean;
};
export async function registryAction(
  _: RegistryState,
  form: FormData,
): Promise<RegistryState> {
  const { supabase } = await requireApprovedDoctor();
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const kind = text("kind");
  const operation = text("operationId");
  const mutations = ["facility", "register", "link", "request"];
  if (mutations.includes(kind) && !uuidPattern.test(operation))
    return { error: "Identifiant d’opération invalide. Rechargez la page." };
  let rpc: string;
  let args: Record<string, unknown>;
  if (kind === "facility") {
    rpc = "create_facility";
    args = {
      p_operation_id: operation,
      p_name: text("name"),
      p_city: text("city"),
    };
  } else if (kind === "register") {
    if (text("syntheticOnly") !== "on")
      return { error: "Confirmez l’utilisation de données fictives." };
    const fields = [
      "facility_id",
      "register_book",
      "local_number",
      "given_name",
      "family_name",
      "name_status",
      "birth_date",
      "birth_date_precision",
      "sex",
      "history_status",
      "source_type",
      "paper_reference",
      "provenance_note",
      "guardian_name",
      "guardian_phone",
      "duplicate_override_reason",
      "smi_reference",
    ];
    const quick = text("quickRegistration") === "on";
    const payload: Record<string, unknown> = Object.fromEntries(
      (quick ? ["given_name", "family_name", "sex"] : fields).map((key) => [
        key,
        text(key),
      ]),
    );
    if (quick) {
      try {
        payload.birth_date = parseAppointmentDate(text("birth_date"));
      } catch {
        return {
          error: "Indiquez une date de naissance valide au format JJ/MM/AAAA.",
        };
      }
      payload.quick_registration = true;
    } else {
      payload.register_year = Number(text("register_year"));
    }
    if (!quick && text("parentDraft") === "on") {
      if (text("draftIdentityChecked") !== "on")
        return {
          error: "Confirmez l’identité et la date de naissance de l’enfant.",
        };
      payload.parent_draft_identity_checked = true;
    }
    const prepared = await supabase.rpc("prepare_child_registration", {
      p_operation_id: operation,
      p_payload: payload,
      p_mother_name: text("mother_name") || null,
      p_birthplace: text("birthplace") || null,
      p_request_review: text("requestReview") === "on",
    });
    if (prepared.error) {
      if (prepared.error.code === "PT409")
        return {
          error:
            "Cette inscription a expiré. Rechargez le formulaire pour recommencer.",
        };
      if (prepared.error.code === "42501")
        return {
          error:
            "Votre session ou votre lieu d’exercice ne permet pas cette inscription.",
        };
      if (
        ["22023", "22007", "22P02", "23514"].includes(prepared.error.code ?? "")
      )
        return {
          error:
            "Vérifiez les informations et le contexte de l’inscription. Les deux champs supplémentaires doivent rester identiques après leur comparaison.",
        };
      const reference = reportOperationalEvent("registry_action_failed");
      return { error: `Contrôle indisponible. Référence : ${reference}` };
    }
    const phase = prepared.data?.state as string;
    if (phase === "rate_limited")
      return {
        error:
          "La limite des contrôles d’inscription est atteinte. Réessayez plus tard.",
      };
    if (["needs_details", "need_qr", "needs_review"].includes(phase))
      return {
        duplicate: true,
        registrationState: phase as
          "needs_details" | "need_qr" | "needs_review",
      };
    if (!["ready", "committed"].includes(phase))
      return { error: "Contrôle d’inscription indisponible." };
    rpc = "register_child";
    args = { p_operation_id: operation, p_payload: payload };
  } else if (kind === "link" || kind === "request") {
    if (
      !uuidPattern.test(text("universal_id")) ||
      !uuidPattern.test(text("facility_id"))
    )
      return { error: "Identifiant universel ou lieu d’exercice invalide." };
    rpc = kind === "link" ? "link_child" : "request_child_access";
    args = {
      p_operation_id: operation,
      p_universal_id: text("universal_id"),
      p_facility_id: text("facility_id"),
      p_year: Number(text("register_year")),
      p_book: text("register_book"),
      p_number: text("local_number"),
    };
    if (kind === "request") args.p_reason = text("reason");
  } else if (kind === "decide") {
    rpc = "decide_child_access";
    args = {
      p_request_id: text("requestId"),
      p_approve: text("decision") === "approve",
      p_reason: text("reason"),
      p_authorization_checked: text("authorizationChecked") === "on",
      p_delegate: text("delegate") === "on",
    };
    if (!["approve", "reject"].includes(text("decision")))
      return { error: "Choisissez une décision." };
  } else if (kind === "withdraw") {
    rpc = "withdraw_child_access";
    args = { p_request_id: text("requestId"), p_reason: text("reason") };
  } else if (kind === "revoke") {
    rpc = "revoke_child_access";
    args = {
      p_child_id: text("childId"),
      p_professional_id: text("professionalId"),
      p_reason: text("reason"),
    };
  } else return { error: "Action inconnue." };
  const { data, error } = await supabase.rpc(rpc, args);
  if (error) {
    if (error.code === "PT409")
      return {
        duplicate: true,
        registrationState: "needs_review",
        error:
          "La situation de l’inscription a changé. Relancez le contrôle avec les mêmes informations avant de poursuivre.",
      };
    if (error.code === "P0002")
      return { duplicate: true, registrationState: "needs_review" };
    if (error.code === "23505")
      return {
        error:
          "Ce numéro est déjà utilisé dans ce registre, ou une demande est déjà en attente. Vérifiez avant de réessayer.",
      };
    if (
      ["23514", "23502", "22023", "22007", "22P02"].includes(error.code ?? "")
    )
      return {
        error:
          "Vérifiez les champs, les degrés de certitude, le motif et la référence papier. La saisie n’a pas été enregistrée.",
      };
    if (error.code === "42501")
      return {
        error:
          "Votre autorisation actuelle ne permet pas cette action. Vérifiez votre session, le lieu d’exercice et les accès du dossier.",
      };
    const ref = reportOperationalEvent("registry_action_failed");
    return {
      error: `L’opération n’a pas abouti. Réessayez avec les mêmes champs. Référence : ${ref}`,
    };
  }
  for (const path of [
    "/dashboard",
    "/patients",
    "/practices",
    "/access-requests",
  ])
    revalidatePath(path);
  if (text("childId") && uuidPattern.test(text("childId")))
    revalidatePath(`/patients/${text("childId")}`);
  if (
    (kind === "register" || kind === "link") &&
    typeof data === "string" &&
    uuidPattern.test(data)
  ) {
    if (kind === "register" && text("parentDraft") === "on") {
      revalidatePath("/parent/add-child");
      return redirect(`/patients/${data}/guardians`);
    }
    if (kind === "register" && text("quickRegistration") === "on")
      return redirect(`/patients/${data}/vaccinations?registered=1`);
    redirect(`/patients/${data}`);
  }
  return { success: true };
}

export async function reviewRegistration(
  _: RegistryState,
  form: FormData,
): Promise<RegistryState> {
  const { supabase } = await requireApprovedDoctor();
  const text = (key: string) => String(form.get(key) ?? "").trim();
  if (
    !uuidPattern.test(text("actorId")) ||
    !uuidPattern.test(text("operationId")) ||
    !["distinct", "existing_qr", "unresolved"].includes(text("decision"))
  )
    return { error: "Décision ou dossier de revue invalide." };
  const { error } = await supabase.rpc("review_child_registration", {
    p_actor_id: text("actorId"),
    p_operation_id: text("operationId"),
    p_expected_revision: Number(text("revision")),
    p_decision: text("decision"),
    p_authority_reference: text("authorityReference"),
    p_reason: text("reason"),
    p_identity_checked: text("identityChecked") === "on",
  });
  if (error) {
    if (error.code === "PT409")
      return { error: "Cette revue a changé ou a expiré. Actualisez la page." };
    if (error.code === "42501")
      return {
        error:
          "Une revue indépendante nécessite la gestion actuelle de tous les dossiers concernés.",
      };
    return {
      error:
        "Vérifiez la base de la décision, le motif et les contrôles requis.",
    };
  }
  revalidatePath("/registration-reviews");
  return { success: true };
}

export async function resumeRegistration(
  _: RegistryState,
  form: FormData,
): Promise<RegistryState> {
  const { supabase } = await requireApprovedDoctor();
  const operation = String(form.get("operationId") ?? "");
  if (!uuidPattern.test(operation))
    return { error: "Inscription indisponible." };
  const own = await supabase.rpc("my_registration_cases", {
    p_operation_id: operation,
  });
  const item = own.data?.items?.[0];
  if (own.error || !item) return { error: "Inscription indisponible." };
  const prepare = await supabase.rpc("prepare_child_registration", {
    p_operation_id: operation,
    p_payload: item.payload,
    p_mother_name: String(form.get("mother_name") ?? "").trim() || null,
    p_birthplace: String(form.get("birthplace") ?? "").trim() || null,
    p_request_review: form.get("requestReview") === "on",
  });
  if (prepare.error)
    return {
      error:
        prepare.error.code === "PT409"
          ? "Ce contrôle a expiré. Recommencez une inscription."
          : "Les informations ont changé ou votre autorisation est insuffisante.",
    };
  const phase = prepare.data?.state as string;
  if (["needs_details", "needs_review", "need_qr"].includes(phase))
    return {
      duplicate: true,
      registrationState: phase as "needs_details" | "needs_review" | "need_qr",
    };
  if (phase === "rate_limited")
    return { error: "Limite des contrôles atteinte. Réessayez plus tard." };
  const result = await supabase.rpc("finish_child_registration", {
    p_operation_id: operation,
  });
  if (result.error)
    return {
      error:
        result.error.code === "PT409"
          ? "La situation a changé. Une nouvelle revue peut être nécessaire."
          : "Inscription indisponible : vérifiez votre contexte et votre autorisation.",
    };
  revalidatePath("/patients");
  revalidatePath("/dashboard");
  revalidatePath("/registration-reviews");
  if (item.payload.parent_draft_identity_checked === true) {
    revalidatePath("/parent/add-child");
    return redirect(`/patients/${result.data}/guardians`);
  }
  if (item.payload.quick_registration === true)
    return redirect(`/patients/${result.data}/vaccinations?registered=1`);
  redirect(`/patients/${result.data}`);
}

export async function updateChildInformation(
  _: RegistryState,
  form: FormData,
): Promise<RegistryState> {
  const { supabase } = await requireApprovedDoctor();
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const child = text("childId");
  const operation = text("operationId");
  const revision = text("revision");
  if (
    !uuidPattern.test(child) ||
    !uuidPattern.test(operation) ||
    !/^\d+$/.test(revision)
  )
    return { error: "Rechargez le dossier avant de poursuivre." };

  const details = Object.fromEntries(
    [
      "given_name",
      "family_name",
      "name_status",
      "birth_date",
      "birth_date_precision",
      "sex",
      "history_status",
      "paper_reference",
      "provenance_note",
      "guardian_name",
      "guardian_phone",
    ].map((key) => [key, text(key)]),
  );
  if (details.birth_date) {
    try {
      details.birth_date = parseAppointmentDate(details.birth_date);
    } catch {
      return {
        error: "Indiquez une date de naissance valide au format JJ/MM/AAAA.",
      };
    }
  }
  const register = {
    id: text("registerId"),
    facility_id: text("facility_id"),
    year: text("register_year"),
    book: text("register_book"),
    number: text("local_number"),
    smi_reference: text("smi_reference"),
  };
  const hasRegister = Object.values(register).some(Boolean);
  if (
    hasRegister &&
    (!uuidPattern.test(register.facility_id) ||
      !register.year ||
      !register.book ||
      !register.number)
  )
    return {
      error:
        "Pour enregistrer le registre, renseignez le lieu, l’année, la série et le numéro local.",
    };

  const { error } = await supabase.rpc("update_child_information", {
    p_operation_id: operation,
    p_child_id: child,
    p_expected_revision: revision,
    p_details: details,
    p_register: hasRegister ? register : null,
  });
  if (error) {
    switch (error.code) {
      case "PT409":
        return {
          error:
            "Le dossier a été modifié. Rechargez-le avant de reprendre la saisie.",
        };
      case "PT422":
        return {
          error:
            "La date de naissance est postérieure à un soin documenté. Vérifiez la date saisie.",
        };
      case "42501":
        return {
          error:
            "Vérifiez votre autorisation de gestion et le lieu d’exercice sélectionné.",
        };
      case "23505":
        return {
          error:
            "Cette référence existe déjà dans ce registre. Vérifiez la série et le numéro.",
        };
      case "22023":
      case "22007":
      case "22008":
      case "22P02":
      case "23514":
        return {
          error:
            "Vérifiez les noms, les degrés de certitude, la date et les coordonnées saisies.",
        };
      default:
        return {
          error: `Enregistrement indisponible. Référence : ${reportOperationalEvent("registry_action_failed")}`,
        };
    }
  }
  revalidatePath("/dashboard");
  revalidatePath("/patients");
  revalidatePath(`/patients/${child}`, "layout");
  return redirect(`/patients/${child}?saved=1`);
}
