import { useDestination, type Destination } from "../context/DestinationContext";

const options: { key: Destination; label: string }[] = [
  { key: "queenstown", label: "Queenstown" },
  { key: "venice", label: "Venice" },
];

export function DestinationToggle() {
  const { destination, setDestination } = useDestination();
  return (
    <div
      style={{
        display: "inline-flex",
        background: "var(--gx-surface)",
        border: "1px solid var(--gx-border)",
        borderRadius: 999,
        padding: 3,
        gap: 2,
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        boxShadow: "inset 0 1px 0 var(--gx-highlight)",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
      }}
    >
      {options.map((opt) => {
        const active = opt.key === destination;
        return (
          <button
            key={opt.key}
            onClick={() => setDestination(opt.key)}
            aria-pressed={active}
            aria-label={`Switch to ${opt.label}`}
            style={{
              padding: "7px 14px",
              borderRadius: 999,
              border: 0,
              background: active ? "linear-gradient(180deg, #fde7a3, #d4b87a)" : "transparent",
              color: active ? "#3d2f12" : "var(--gx-text-1)",
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 600,
              fontSize: "inherit",
              letterSpacing: "inherit",
              textTransform: "inherit",
              boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.55)" : "none",
              transition: "background 180ms ease, color 180ms ease",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
