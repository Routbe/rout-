import { CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { checkVersion1Canvas } from "@/lib/studio-limits";

/**
 * Strikte 21×21-canvas-indicator.
 *
 * Toont of de payload nog in een QR Version 1 (21×21 modules) past — de
 * scherpste, snelst scanbare code. Zodra hij niet meer past, zeggen we
 * waarom, zodat je meteen weet wat te korten of te uppercasen.
 */
export function CanvasIndicator({
  payload,
  className,
}: {
  payload: string;
  className?: string;
}) {
  const check = checkVersion1Canvas(payload);
  const Icon = check.fits ? CheckCircle2 : AlertTriangle;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3 py-2 text-xs",
        check.fits
          ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
          : "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className="font-medium">
          {check.fits ? "21×21 modules (Version 1)" : "Groter dan 21×21"}
        </span>
        <span className="mt-0.5 block font-mono text-[11px] opacity-80">
          {check.length}/{check.capacity} tekens
        </span>
        {check.reason ? <span className="mt-0.5 block opacity-90">{check.reason}</span> : null}
      </span>
    </div>
  );
}
