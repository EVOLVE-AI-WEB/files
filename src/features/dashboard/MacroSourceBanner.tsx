/**
 * Macro-source banner (Task 14.3; R12.8).
 *
 * Distinguishes baseline-sourced macros from 7-day-average-sourced macros with
 * the exact messaging from the design/requirements, and exposes the full set of
 * weight-source facts: baseline weight, active macro weight, latest 7-day
 * average, effective date, and the status reason. Status is conveyed in text,
 * not by color alone (R20.6).
 */
import { Info } from 'lucide-react';
import type { ActiveWeightSource } from '../../state/activeWeightSelector';
import { buildMacroSourceMessage } from '../shared/macroDerivation';
import { formatKg } from '../shared/format';

type MacroSourceBannerProps = {
  source: ActiveWeightSource;
  activeWeightKg: number;
  baselineWeightKg: number;
  latestAverageKg: number | null;
  effectiveDate: string;
  status: string;
};

export function MacroSourceBanner({
  source,
  activeWeightKg,
  baselineWeightKg,
  latestAverageKg,
  effectiveDate,
  status,
}: MacroSourceBannerProps) {
  const message = buildMacroSourceMessage(source, activeWeightKg);

  return (
    <section
      aria-label="Macro source"
      className="flex flex-col gap-3 rounded-card bg-white p-5 shadow-card"
    >
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-500" aria-hidden="true" />
        <p className="text-sm font-semibold text-brand-navy">{message}</p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-500">
        <div className="flex flex-col">
          <dt>Baseline</dt>
          <dd className="font-medium text-brand-navy">
            {formatKg(baselineWeightKg)}
          </dd>
        </div>
        <div className="flex flex-col">
          <dt>Active macro weight</dt>
          <dd className="font-medium text-brand-navy">
            {formatKg(activeWeightKg)}
          </dd>
        </div>
        <div className="flex flex-col">
          <dt>Latest 7-day average</dt>
          <dd className="font-medium text-brand-navy">
            {latestAverageKg === null ? 'Not enough data' : formatKg(latestAverageKg)}
          </dd>
        </div>
        <div className="flex flex-col">
          <dt>Effective date</dt>
          <dd className="font-medium text-brand-navy">{effectiveDate}</dd>
        </div>
      </dl>

      <p className="text-xs text-slate-500">{status}</p>
    </section>
  );
}
