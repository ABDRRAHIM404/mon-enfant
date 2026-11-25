import { ChildProfileWorkspace } from "@/components/clinician/care-workspace";
import { readAuthorizedChild } from "@/lib/registry/read-child";

export default async function ChildLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const child = await readAuthorizedChild(id);
  return (
    <ChildProfileWorkspace key={id} child={child}>
      {children}
    </ChildProfileWorkspace>
  );
}
