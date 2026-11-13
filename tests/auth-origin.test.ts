import { describe,it,expect } from "vitest";
import { authOrigin } from "../src/lib/auth-origin";
describe("same-browser confirmation origins",()=>{
  const site="https://mon-enfant.vercel.app";
  it("uses the canonical origin when no Origin is supplied",()=>expect(authOrigin(null,site)).toBe(site));
  it("accepts the canonical origin",()=>expect(authOrigin(site,site)).toBe(site));
  it("uses the exact trusted preview origin to retain the verifier cookie",()=>{
    const host="mon-enfant-abc-abdrrahim404s-projects.vercel.app";
    expect(authOrigin(`https://${host}`,site,[host])).toBe(`https://${host}`);
  });
  it("does not accept arbitrary or similar-looking hosts",()=>{
    expect(()=>authOrigin("https://mon-enfant.vercel.app.attacker.invalid",site)).toThrow();
    expect(()=>authOrigin("https://attacker.invalid",site,["mon-enfant-abc.vercel.app"])).toThrow();
    expect(()=>authOrigin("https://mon-enfant.vercel.app/path",site)).toThrow();
  });
  it("allows localhost only in the development configuration",()=>{
    expect(authOrigin("http://localhost:3000",site,[],true)).toBe("http://localhost:3000");
    expect(()=>authOrigin("http://localhost:3000",site)).toThrow();
  });
});
