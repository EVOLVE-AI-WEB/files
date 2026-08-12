/**
 * BrandLogo (Task 17.2; R22.1, R22.2, R21.4).
 *
 * Renders the Evolve Fitness brand mark in the navigation header: the JPEG
 * logo asset (`3D_mobile_.jpeg`) alongside the wordmark — "EVOLVE" in bold
 * navy (#1C2038) and "FITNESS" in tracked slate gray.
 *
 * IMPORTANT (R22.2): the Logo_Asset MUST be referenced as the JPEG
 * `3D_mobile_.jpeg`, never a PNG. The file is served from `public/` at the
 * site root, so the `src` is `/3D_mobile_.jpeg`. Alt text is "Evolve Fitness".
 * In dark mode the "EVOLVE" text is lightened via the index.css mirror layer.
 */

/** Root-served path to the JPEG brand logo (copied into public/). */
export const LOGO_SRC = '/3D_mobile_.jpeg';

type BrandLogoProps = {
  /** Hide the wordmark and show only the logo image (e.g. tight headers). */
  iconOnly?: boolean;
  className?: string;
};

export function BrandLogo({ iconOnly = false, className }: BrandLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <img
        src={LOGO_SRC}
        alt="Evolve Fitness"
        width={36}
        height={36}
        className="h-9 w-9 rounded-xl object-cover shadow-sm"
      />
      {!iconOnly ? (
        <span className="text-lg font-bold leading-none">
          <span className="text-brand-navy">EVOLVE</span>{' '}
          <span className="tracking-[0.2em] text-slate-500">FITNESS</span>
        </span>
      ) : null}
    </div>
  );
}
