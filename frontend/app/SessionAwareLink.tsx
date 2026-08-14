"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSessionRuntime } from "../../shared/session-runtime/index.js";

const sessionRuntime = createSessionRuntime();

type SessionAwareLinkProps = {
  fallbackHref: string;
  fallbackLabel: string;
  signedInHref?: string;
  signedInLabel?: string;
  className?: string;
  onClick?: () => void;
};

export default function SessionAwareLink({
  fallbackHref,
  fallbackLabel,
  signedInHref = "/trip",
  signedInLabel = fallbackLabel,
  className,
  onClick,
}: SessionAwareLinkProps) {
  const [resolved, setResolved] = useState({
    href: fallbackHref,
    label: fallbackLabel,
  });

  useEffect(() => {
    const restored = sessionRuntime.restoreTechnicalSession();
    if (restored.facts.kind === "account") {
      setResolved({
        href: signedInHref,
        label: signedInLabel,
      });
      return;
    }

    setResolved({
      href: fallbackHref,
      label: fallbackLabel,
    });
  }, [fallbackHref, fallbackLabel, signedInHref, signedInLabel]);

  return (
    <Link className={className} href={resolved.href} onClick={onClick}>
      {resolved.label}
    </Link>
  );
}
