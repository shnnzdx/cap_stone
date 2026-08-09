type BrandLogoProps = {
  compact?: boolean;
};

export default function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <span className={`brand-logo ${compact ? "is-compact" : ""}`} aria-label="CADENSY">
      <img className="brand-logo-mark" src="/images/cadensy-mark.png" alt="" />
      {!compact && <img className="brand-logo-wordmark" src="/images/cadensy-wordmark.png" alt="CADENSY" />}
    </span>
  );
}
