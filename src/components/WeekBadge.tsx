export default function WeekBadge({ type }: { type: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    test: { bg: "bg-test-blue/20", text: "text-blue-300", label: "Test Week" },
    regular: { bg: "bg-dark-border", text: "text-dark-muted", label: "Regular" },
    taper: { bg: "bg-taper-amber/20", text: "text-amber-300", label: "Taper" },
  };
  const { bg, text, label } = config[type] || config.regular;
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${bg} ${text}`}>
      {label}
    </span>
  );
}
