import { it,expect } from "vitest";
import { sessionCookieOptions } from "../src/lib/supabase/config";
it("keeps production sessions HTTP-only and secure",()=>expect(sessionCookieOptions("production")).toEqual({httpOnly:true,secure:true,sameSite:"lax",path:"/"}));
it("permits local HTTP development while keeping tokens inaccessible to JS",()=>expect(sessionCookieOptions("development")).toEqual({httpOnly:true,secure:false,sameSite:"lax",path:"/"}));
