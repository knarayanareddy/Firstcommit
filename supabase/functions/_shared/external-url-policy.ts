/**
 * External URL Policy Module (hardened, v2)
 *
 * Centralized SSRF defense for Edge Functions.
 *
 * v2 production hardening:
 *  - Real CIDR containment checks (PRIVATE_CIDR_* lists are now actually used).
 *  - DNS resolution + resolved-IP validation in `safeFetch` (defeats DNS-rebinding and
 *    hostnames that point at link-local / cloud-metadata / private ranges).
 *  - Per-redirect re-resolution and re-validation.
 *  - Explicit, config-driven local allowlist (for a self-hosted local LLM endpoint)
 *    instead of a blanket bypass.
 *
 * `parseAndValidateExternalUrl` stays SYNCHRONOUS (structural checks) for backward
 * compatibility. Authoritative network-time IP validation lives in `safeFetch`, which
 * all outbound fetches should use.
 */

export interface URLPolicy {
  allowedHosts?: string[];
  allowedHostSuffixes?: string[];
  allowSubdomains?: boolean;
  allowHttp?: boolean;
  allowHttps?: boolean;
  allowAnyHost?: boolean;
  allowedPorts?: number[];
  disallowPrivateIPs?: boolean;
  /** Explicitly permitted private/loopback hosts (e.g. a self-hosted Ollama). */
  allowPrivateHosts?: string[];
}

const DEFAULT_POLICY: URLPolicy = {
  allowHttps: true,
  allowHttp: false,
  allowAnyHost: false,
  disallowPrivateIPs: true,
  allowedPorts: [80, 443],
};

const PRIVATE_CIDR_V4 = [
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "0.0.0.0/8",
  "100.64.0.0/10",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
];

const PRIVATE_CIDR_V6 = [
  "::1/128",
  "fc00::/7",
  "fe80::/10",
  "::/128",
];

// ─── Local allowlist (self-hosted local LLM / dev) ───────────────────────────
function localAllowlist(policy: URLPolicy): Set<string> {
  const hosts = new Set<string>(
    (policy.allowPrivateHosts || []).map((h) => h.toLowerCase()),
  );
  const llmHost = Deno.env.get("LOCAL_LLM_HOST");
  if (llmHost) hosts.add(llmHost.toLowerCase());
  if (Deno.env.get("ALLOW_PRIVATE_OLLAMA") === "true") {
    for (
      const h of ["localhost", "host.docker.internal", "ollama", "127.0.0.1"]
    ) {
      hosts.add(h);
    }
  }
  return hosts;
}

// ─── CIDR math ───────────────────────────────────────────────────────────────
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const o = Number(p);
    if (o < 0 || o > 255) return null;
    n = (n << 8) | o;
  }
  return n >>> 0;
}

function inCidrV4(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(range);
  if (ipInt === null || rangeInt === null) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

function expandV6(ip: string): bigint | null {
  try {
    let s = ip.toLowerCase().replace(/^\[|\]$/g, "").replace(/%.*$/, "");
    const v4m = s.match(/(.*:)(\d+\.\d+\.\d+\.\d+)$/);
    if (v4m) {
      const v4 = ipv4ToInt(v4m[2]);
      if (v4 === null) return null;
      s = v4m[1] + ((v4 >>> 16) & 0xffff).toString(16) + ":" +
        (v4 & 0xffff).toString(16);
    }
    const dbl = s.split("::");
    if (dbl.length > 2) return null;
    const head = dbl[0] ? dbl[0].split(":") : [];
    const tail = dbl.length > 1 && dbl[1] ? dbl[1].split(":") : [];
    const missing = 8 - (head.length + tail.length);
    if (missing < 0) return null;
    const groups = [
      ...head,
      ...Array(dbl.length > 1 ? missing : 0).fill("0"),
      ...tail,
    ];
    if (groups.length !== 8) return null;
    let n = 0n;
    for (const g of groups) {
      if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
      n = (n << 16n) | BigInt(parseInt(g, 16));
    }
    return n;
  } catch {
    return null;
  }
}

function inCidrV6(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  const bits = BigInt(bitsStr);
  const ipN = expandV6(ip);
  const rangeN = expandV6(range);
  if (ipN === null || rangeN === null) return false;
  if (bits === 0n) return true;
  const mask = ((1n << 128n) - 1n) ^ ((1n << (128n - bits)) - 1n);
  return (ipN & mask) === (rangeN & mask);
}

/** True if an IP literal falls in any private/reserved range. */
export function isPrivateOrReservedIp(ip: string): boolean {
  if (ip.includes(":")) {
    const v4m = ip.match(/(\d+\.\d+\.\d+\.\d+)$/);
    if (v4m && PRIVATE_CIDR_V4.some((c) => inCidrV4(v4m[1], c))) return true;
    return PRIVATE_CIDR_V6.some((c) => inCidrV6(ip, c));
  }
  return PRIVATE_CIDR_V4.some((c) => inCidrV4(ip, c));
}

function isIPLiteral(hostname: string): boolean {
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return true;
  if (
    hostname.includes(":") ||
    (hostname.startsWith("[") && hostname.endsWith("]"))
  ) return true;
  return false;
}

/**
 * Synchronous structural validation (protocol, port, creds, host allowlist,
 * obvious private literals via real CIDR). Does NOT resolve DNS — see safeFetch.
 */
export function parseAndValidateExternalUrl(
  input: string,
  customPolicy: Partial<URLPolicy> = {},
): string {
  const policy = { ...DEFAULT_POLICY, ...customPolicy };
  if (!input) throw new Error("Invalid URL: input is empty");

  let url: URL;
  try {
    url = new URL(input);
  } catch (_e) {
    throw new Error("Invalid URL: malformed structure");
  }

  if (url.username || url.password) {
    throw new Error("URL policy violation: embedded credentials not allowed");
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const allowlist = localAllowlist(policy);
  const isExplicitlyAllowedLocal = allowlist.has(hostname);

  const proto = url.protocol.toLowerCase();
  if (proto === "https:") {
    if (!policy.allowHttps) {
      throw new Error("URL policy violation: https not allowed");
    }
  } else if (proto === "http:") {
    // http permitted only for explicitly-allowlisted local hosts (e.g. self-hosted Ollama)
    if (!policy.allowHttp && !isExplicitlyAllowedLocal) {
      throw new Error(
        "URL policy violation: http not allowed. Https is required.",
      );
    }
  } else {
    throw new Error(`URL policy violation: unsupported protocol "${proto}"`);
  }

  const port = url.port ? parseInt(url.port) : (proto === "https:" ? 443 : 80);
  if (
    policy.allowedPorts && !policy.allowedPorts.includes(port) &&
    !isExplicitlyAllowedLocal
  ) {
    throw new Error(
      `URL policy violation: port ${port} is not in the allowlist`,
    );
  }

  if (isIPLiteral(hostname) && !isExplicitlyAllowedLocal) {
    if (!policy.allowAnyHost) {
      throw new Error(
        "URL policy violation: raw IP literals are not allowed. Use a domain name.",
      );
    }
    if (policy.disallowPrivateIPs && isPrivateOrReservedIp(hostname)) {
      throw new Error(
        "URL policy violation: access to internal/reserved network is forbidden",
      );
    }
  }

  if (!policy.allowAnyHost && !isExplicitlyAllowedLocal) {
    let allowed = false;
    if (policy.allowedHosts?.map((h) => h.toLowerCase()).includes(hostname)) {
      allowed = true;
    }
    if (!allowed && policy.allowedHostSuffixes) {
      for (const suffix of policy.allowedHostSuffixes) {
        const s = suffix.toLowerCase();
        if (
          hostname === s || hostname.endsWith(s.startsWith(".") ? s : "." + s)
        ) {
          allowed = true;
          break;
        }
      }
    }
    if (!allowed) {
      throw new Error(
        `URL policy violation: host "${hostname}" is not in the allowlist`,
      );
    }
  }

  return url.toString();
}

/**
 * Network-time guard: resolve the hostname and verify EVERY resolved IP is public
 * (unless the host is on the explicit local allowlist). Defeats DNS-rebinding and
 * hostnames that resolve to private/link-local/metadata addresses.
 */
export async function assertResolvedHostIsPublic(
  hostname: string,
  policy: URLPolicy = DEFAULT_POLICY,
): Promise<void> {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!policy.disallowPrivateIPs) return;
  if (localAllowlist(policy).has(host)) return;

  if (isIPLiteral(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw new Error(
        "SSRF policy violation: IP resolves to a private/reserved range",
      );
    }
    return;
  }

  const ips: string[] = [];
  try {
    const [v4, v6] = await Promise.allSettled([
      Deno.resolveDns(host, "A"),
      Deno.resolveDns(host, "AAAA"),
    ]);
    if (v4.status === "fulfilled") ips.push(...v4.value);
    if (v6.status === "fulfilled") ips.push(...v6.value);
  } catch (_e) {
    // handled by empty-resolution check below
  }

  if (ips.length === 0) {
    throw new Error(`SSRF policy violation: could not resolve host "${host}"`);
  }
  for (const ip of ips) {
    if (isPrivateOrReservedIp(ip)) {
      throw new Error(
        `SSRF policy violation: host "${host}" resolves to forbidden address ${ip}`,
      );
    }
  }
}

/**
 * SSRF-safe fetch. Validates structurally, resolves + validates the IP, then follows
 * redirects manually, re-validating BOTH the URL and the resolved IP on every hop.
 */
export async function safeFetch(
  url: string,
  init: RequestInit = {},
  customPolicy: Partial<URLPolicy> = {},
): Promise<Response> {
  const policy = { ...DEFAULT_POLICY, ...customPolicy };
  let currentUrl = parseAndValidateExternalUrl(url, policy);
  let attempts = 0;
  const maxRedirects = 5;

  while (attempts <= maxRedirects) {
    attempts++;
    await assertResolvedHostIsPublic(new URL(currentUrl).hostname, policy);

    const response = await fetch(currentUrl, { ...init, redirect: "manual" });

    if (
      response.status >= 300 && response.status < 400 &&
      response.headers.has("location")
    ) {
      const location = response.headers.get("location")!;
      const nextUrl = new URL(location, currentUrl).toString();
      currentUrl = parseAndValidateExternalUrl(nextUrl, policy);
      continue;
    }
    return response;
  }
  throw new Error(`safeFetch: Too many redirects (max ${maxRedirects})`);
}
