import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { parseAndValidateExternalUrl } from "./external-url-policy.ts";

Deno.test("External URL Policy - Standard SaaS allowlist", () => {
  const policy = { allowedHostSuffixes: [".atlassian.net"] };

  // Valid
  const valid = "https://mycompany.atlassian.net/rest/api/3/search";
  assertEquals(parseAndValidateExternalUrl(valid, policy), valid);

  // Wrong host
  assertThrows(
    () => parseAndValidateExternalUrl("https://example.com", policy),
    Error,
    "not in the allowlist",
  );
});

Deno.test("External URL Policy - Protocol and Security blocks", () => {
  const policy = { allowAnyHost: true };

  // Block HTTP by default
  assertThrows(
    () => parseAndValidateExternalUrl("http://example.com", policy),
    Error,
    "http not allowed",
  );

  // Block Credentials
  assertThrows(
    () => parseAndValidateExternalUrl("https://user:pass@example.com", policy),
    Error,
    "embedded credentials",
  );

  // Block Non-HTTP
  assertThrows(
    () => parseAndValidateExternalUrl("file:///etc/passwd", policy),
    Error,
    "unsupported protocol",
  );

  // Block non-standard ports
  assertThrows(
    () => parseAndValidateExternalUrl("https://example.com:8443", policy),
    Error,
    "port 8443 is not in the allowlist",
  );
});

Deno.test("External URL Policy - Private Network blocks", () => {
  const policy = { ["allowAnyHost"]: true, disallowPrivateIPs: true };

  // Localhost
  assertThrows(
    () => parseAndValidateExternalUrl("https://localhost/api", policy),
    Error,
    "forbidden",
  );
  assertThrows(
    () => parseAndValidateExternalUrl("https://127.0.0.1/api", policy),
    Error,
    "forbidden",
  );

  // Private IPs (regex check)
  assertThrows(
    () => parseAndValidateExternalUrl("https://192.168.1.1/api", policy),
    Error,
    "forbidden",
  );
  assertThrows(
    () => parseAndValidateExternalUrl("https://10.5.5.5/api", policy),
    Error,
    "forbidden",
  );

  // Metadata (link-local)
  assertThrows(
    () =>
      parseAndValidateExternalUrl(
        "https://169.254.169.254/latest/meta-data",
        policy,
      ),
    Error,
    "forbidden",
  );
});

Deno.test("External URL Policy - IP Literals REJECTED by default", () => {
  const policy = { allowAnyHost: false }; // Standard behavior
  assertThrows(
    () => parseAndValidateExternalUrl("https://1.1.1.1", policy),
    Error,
    "raw IP literals are not allowed",
  );
});
