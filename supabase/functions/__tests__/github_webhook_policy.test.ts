import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { enforceSignaturePolicy } from "../github-webhook/signature-policy.ts";

Deno.test("enforceSignaturePolicy - production + missing secret -> rejects", () => {
  const policy = enforceSignaturePolicy(undefined, "production");
  assertEquals(policy.allowed, false);
  assertEquals(
    policy.errorMsg,
    "GITHUB_WEBHOOK_SECRET is required in production environments",
  );
});

Deno.test("enforceSignaturePolicy - development + missing secret -> warns and proceeds", () => {
  const policy = enforceSignaturePolicy(undefined, "development");
  assertEquals(policy.allowed, true);
  assertEquals(
    policy.warnMsg,
    "GITHUB_WEBHOOK_SECRET not set, bypassing signature check (INSECURE)",
  );
});

Deno.test("enforceSignaturePolicy - production + with secret -> proceeds", () => {
  const policy = enforceSignaturePolicy("my-secret", "production");
  assertEquals(policy.allowed, true);
  assertEquals(policy.errorMsg, undefined);
  assertEquals(policy.warnMsg, undefined);
});

Deno.test("enforceSignaturePolicy - development + with secret -> proceeds", () => {
  const policy = enforceSignaturePolicy("my-secret", "development");
  assertEquals(policy.allowed, true);
  assertEquals(policy.errorMsg, undefined);
  assertEquals(policy.warnMsg, undefined);
});
