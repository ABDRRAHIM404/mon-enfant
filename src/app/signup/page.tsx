import { AuthShell } from "@/components/auth-shell";
export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ audience?: string; next?: string }>;
}) {
  const q = await searchParams;
  return (
    <AuthShell
      mode="signup"
      parent={q.audience === "parent"}
      invitation={q.next === "invitation"}
    />
  );
}
