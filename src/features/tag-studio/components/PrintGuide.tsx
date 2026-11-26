import { Printer } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { isDefaultLabel, labelName, type LabelSpec } from '@/core/tags';

/** Printing instruction from docs/03 (for the chosen label), always visible next to the print buttons. */
export function PrintGuide({ label }: { label: LabelSpec }) {
  const { printer } = siteConfig;
  const paper = labelName(label);
  const orientation = label.lengthMm >= label.widthMm ? 'portrait' : 'landscape';
  return (
    <details open className="group rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-950">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-semibold select-none">
        <Printer className="size-4" aria-hidden />
        How to print
        <span className="ml-auto text-xs font-normal text-amber-700 group-open:hidden">Show</span>
        <span className="ml-auto hidden text-xs font-normal text-amber-700 group-open:inline">Hide</span>
      </summary>
      <div className="space-y-2 px-4 pb-4">
        <p>
          Print on the <strong>{printer.model}</strong> with <strong>Actual size / 100%</strong> (never &ldquo;Fit to
          page&rdquo;), paper <strong>{paper}</strong>, <strong>{orientation}</strong>.
        </p>
        {!isDefaultLabel(label) && (
          <p className="text-amber-900">
            Load the {paper} roll, set the same paper size in the Zebra printer settings, and calibrate the printer after changing
            rolls.
          </p>
        )}
        <ol className="list-decimal space-y-1 pl-5 text-amber-900">
          <li>
            <strong>Test print (1 each)</strong>, print it and scan every tag at the POS.
          </li>
          <li>
            If all scan, <strong>Download print PDF</strong> (one page per copy) and print it.
          </li>
          <li>Do not print the Preview PDF; it is for checking on screen.</li>
        </ol>
      </div>
    </details>
  );
}
