/**
 * Logo Meetopia — konsep 7 "Minimalist": dua daun pintu (satu terbuka, hijau; satu tertutup, hijau tua)
 * melambangkan pintu ke ruang kerja virtual. Tagline: Work • Talk • Together.
 */
export function LogoMark({ size = 32, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path
        d="M5 13.5c0-2.6 1.7-4.2 4-4.9L23.4 4.3C26 3.5 28 5 28 7.7v48.6c0 2.7-2 4.2-4.6 3.4L9 55.4c-2.3-.7-4-2.3-4-4.9z"
        fill="var(--logo-green, #3f9a55)"
      />
      <rect x="32" y="6" width="27" height="52" rx="5.5" fill="var(--logo-ink, #1b3a2a)" />
      <circle cx="38.5" cy="33" r="2.8" fill="var(--logo-knob, #f7f5ec)" />
    </svg>
  );
}

export function Logo({
  size = 32,
  tagline = false,
  className,
}: {
  size?: number;
  tagline?: boolean;
  className?: string;
}) {
  return (
    <span className={`logo ${className ?? ""}`} style={{ ["--logo-size" as string]: `${size}px` }}>
      <LogoMark size={size * (tagline ? 1.5 : 1)} />
      <span className="logo-text">
        <span className="logo-word">Meetopia</span>
        {tagline && (
          <span className="logo-tagline">
            Work <i>•</i> Talk <i>•</i> Together
          </span>
        )}
      </span>
    </span>
  );
}
