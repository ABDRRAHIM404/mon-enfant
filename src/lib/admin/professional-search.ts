import type { Professional } from "@/lib/authorization";

export type ProfessionalSearchResult = Professional & {
  email: string | null;
  display_name: string | null;
  created_at: string;
};
