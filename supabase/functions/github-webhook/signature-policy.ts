export function enforceSignaturePolicy(
  webhookSecret: string | undefined,
  environment: string | undefined,
): { allowed: boolean; errorMsg?: string; warnMsg?: string } {
  if (!webhookSecret) {
    if (environment === "production") {
      return {
        allowed: false,
        errorMsg:
          "GITHUB_WEBHOOK_SECRET is required in production environments",
      };
    }
    return {
      allowed: true,
      warnMsg:
        "GITHUB_WEBHOOK_SECRET not set, bypassing signature check (INSECURE)",
    };
  }
  return { allowed: true };
}
