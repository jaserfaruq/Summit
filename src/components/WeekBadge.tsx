export default function WeekBadge({ type }: { type: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    test: { bg: "bg-test-blue/10", text: "text-test-blue", label: "Test Week" },
    recovery: { bg: "bg-recovery-green/10", text: "text-recovery-green", label: "Recovery" },
    regular: { bg: "bg-sage/10", text: "text-sage", label: "Regular" },
    taper: { bg: "bg-taper-amber/10", text: "text-taper-amber", label: "Taper" },
  };
  const { bg, text, label } = config[type] || config.regular;
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${bg} ${text}`}>
      {label}
    </span>
  );
}
