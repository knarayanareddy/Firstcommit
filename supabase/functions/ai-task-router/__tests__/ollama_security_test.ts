import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { parseAndValidateExternalUrl } from "../../_shared/external-url-policy.ts";

/**
 * These tests replicate the logic used in ai-task-router/index.ts
 * for validating the OLLAMA_ENDPOINT.
 */

Deno.test("Ollama Security - Cloud Mode Restrictions", () => {
  // Simulate Cloud Mode (isLocalMode = false)
  const isLocalMode = false;
  const ollamaPolicy = isLocalMode
    ? {
      allowHttp: true,
      allowedHosts: ["localhost", "host.docker.internal"],
      disallowPrivateIPs: false, // assuming ALLOW_PRIVATE_OLLAMA=true for local
      allowedPorts: [11434, 8080, 80, 443],
    }
    : {
      allowHttp: false,
      disallowPrivateIPs: true,
      allowAnyHost: false, // In cloud, we must be explicit
    };

  // 1. Cloud mode must reject HTTP
  assertThrows(
    () =>
      parseAndValidateExternalUrl(
        "http://ollama.mycorp.com/v1/chat/completions",
        ollamaPolicy,
      ),
    Error,
    "http not allowed",
  );

  // 2. Cloud mode must reject private IP literals
  assertThrows(
    () =>
      parseAndValidateExternalUrl(
        "https://192.168.1.10:11434/v1/chat/completions",
        ollamaPolicy,
      ),
    Error,
    "raw IP literals are not allowed",
  );

  // 3. Cloud mode must reject localhost/internal hosts
  assertThrows(
    () =>
      parseAndValidateExternalUrl(
        "https://localhost:11434/v1/chat/completions",
        ollamaPolicy,
      ),
    Error,
    "not in the allowlist",
  );
});

Deno.test("Ollama Security - Local Mode Flexibility", () => {
  // Simulate Local Mode (isLocalMode = true)
  const isLocalMode = true;
  const allowPrivate = true;
  const ollamaPolicy = isLocalMode
    ? {
      allowHttp: true,
      allowedHosts: ["localhost", "host.docker.internal"],
      disallowPrivateIPs: !allowPrivate,
      allowedPorts: [11434, 8080, 80, 443],
    }
    : {
      allowHttp: false,
      disallowPrivateIPs: true,
      allowAnyHost: false,
    };

  // 1. Local mode allows host.docker.internal over HTTP
  const dockerUrl = "http://host.docker.internal:11434/v1/chat/completions";
  assertEquals(parseAndValidateExternalUrl(dockerUrl, ollamaPolicy), dockerUrl);

  // 2. Local mode allows localhost over HTTP
  const localUrl = "http://localhost:11434/v1/chat/completions";
  assertEquals(parseAndValidateExternalUrl(localUrl, ollamaPolicy), localUrl);

  // 3. Local mode blocks private IP literal if !allowPrivate
  const privateIp = "http://192.168.1.10:11434/v1/chat/completions";
  assertThrows(
    () =>
      parseAndValidateExternalUrl(privateIp, {
        ...ollamaPolicy,
        disallowPrivateIPs: true,
      }),
    Error,
    "raw IP literals are not allowed",
  );
});
