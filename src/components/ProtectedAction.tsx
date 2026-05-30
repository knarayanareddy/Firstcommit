import { ReactNode } from "react";
import { useRole, PackAccessLevel } from "@/hooks/useRole";

interface ProtectedActionProps {
  requiredLevel: PackAccessLevel;
  children: ReactNode;
  fallback?: ReactNode;
}

export function ProtectedAction({ requiredLevel, children, fallback }: ProtectedActionProps) {
  const { hasPackPermission } = useRole();

  if (!hasPackPermission(requiredLevel)) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}
