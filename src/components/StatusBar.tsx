type Props = {
  time?: string;
  dark?: boolean;
};

export function StatusBar({ time = "9:41", dark = false }: Props) {
  const c = dark ? "#fff" : "#14241f";
  return (
    <div
      style={{
        height: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        fontSize: 14,
        fontWeight: 600,
        color: c,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span>{time}</span>
      <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
        <svg width="17" height="11" viewBox="0 0 17 11" fill={c}>
          <path d="M1 8h2v2H1zM5 6h2v4H5zM9 4h2v6H9zM13 1h2v9h-2z" />
        </svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none" stroke={c} strokeWidth="1.2">
          <path d="M7.5 9.2 a4 4 0 0 0 5.6 0 M5 6.7 a7.5 7.5 0 0 1 10.6 0 M2.4 4.2 a11 11 0 0 1 15.6 0" />
        </svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
          <rect x="0.5" y="0.5" width="22" height="11" rx="2.5" stroke={c} />
          <rect x="2" y="2" width="16" height="8" rx="1.5" fill={c} />
          <rect x="23" y="4" width="1.5" height="4" rx="0.75" fill={c} />
        </svg>
      </span>
    </div>
  );
}
