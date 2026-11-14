import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { uuidPattern } from "@/lib/registry/types";
import { reportOperationalEvent } from "@/lib/operational-events";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { supabase } = await requireUser();
  const { id } = await params;
  if (!uuidPattern.test(id))
    return NextResponse.json(
      { error: "Carnet indisponible." },
      { status: 404, headers },
    );
  const { data, error } = await supabase.rpc("parent_child_export", {
    p_child_id: id,
  });
  if (error?.code === "42501")
    return NextResponse.json(
      { error: "Carnet indisponible." },
      { status: 404, headers },
    );
  if (error?.code === "54000")
    return NextResponse.json(
      {
        error:
          "La limite interactive est dépassée. Contactez le professionnel pour un export autorisé.",
      },
      { status: 413, headers },
    );
  if (error || !data) {
    const reference = reportOperationalEvent("clinical_export_failed");
    return NextResponse.json(
      { error: `Export indisponible. Référence : ${reference}` },
      { status: 503, headers },
    );
  }
  return new Response(JSON.stringify(data), {
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="mon-enfant-carnet.json"',
    },
  });
}
