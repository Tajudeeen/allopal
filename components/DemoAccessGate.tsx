"use client";
import { ReactNode } from "react";

/**
 * DemoAccessGate - Bypassed/commented out to view the build directly.
 * Original access key form is preserved commented out below.
 */
export function DemoAccessGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/*
// Original gate code:
// export function DemoAccessGate({ children }: { children: ReactNode }) {
//   const [state, setState] = useState<"checking" | "locked" | "ready">("checking");
//   ...
// }
*/
