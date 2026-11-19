import { requireUser } from "@/lib/auth";
import { WorkspaceShell } from "@/components/workspace-shell";
import { BetaGuide } from "@/components/beta-guide";

export const dynamic = "force-dynamic";
export default async function ParentGuide() {
  await requireUser();
  return (
    <WorkspaceShell area="parent" active="guide">
      <BetaGuide audience="parent" />
    </WorkspaceShell>
  );
}
