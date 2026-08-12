type BrandLogoProps = {
  compact?: boolean;
  tone?: "default" | "light";
};

export default function BrandLogo({ compact = false, tone = "default" }: BrandLogoProps) {
  return (
    <span className={`brand-logo brand-logo--${tone} ${compact ? "is-compact" : ""}`.trim()} aria-label="CADENSY">
      <span className="brand-logo-layer brand-logo-layer--default" aria-hidden={tone === "light"}>
        <img className="brand-logo-mark" src="/images/cadensy-mark.png" alt="" />
        {!compact && <img className="brand-logo-wordmark" src="/images/cadensy-wordmark.png" alt="CADENSY" />}
      </span>
      <span className="brand-logo-layer brand-logo-layer--light" aria-hidden={tone !== "light"}>
        <span className="brand-logo-mark brand-logo-mask" />
        {!compact && <span className="brand-logo-wordmark brand-logo-mask" />}
      </span>
    </span>
  );
}
