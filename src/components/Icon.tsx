type IconProps = { size?: number; color?: string };

export const Icon = {
  Q: ({ size = 22, color = "#0a4d3c" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="14" stroke={color} strokeWidth="2" />
      <path d="M22 22 L26 26" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="16" cy="16" r="6" fill={color} />
    </svg>
  ),
  Back: ({ size = 22, color = "#14241f" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M15 6 L9 12 L15 18" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Close: ({ size = 22, color = "#14241f" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 6 L18 18 M18 6 L6 18" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  Send: ({ size = 18, color = "#fff" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 12 L21 4 L17 21 L11 13 L3 12Z" stroke={color} strokeWidth="2" strokeLinejoin="round" fill={color} />
    </svg>
  ),
  Mic: ({ size = 18, color = "#0a4d3c" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="9" y="3" width="6" height="12" rx="3" stroke={color} strokeWidth="2" />
      <path d="M5 11 a7 7 0 0 0 14 0 M12 18 v3" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  Map: ({ size = 18, color = "#0a4d3c" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 6 L9 4 L15 6 L21 4 V18 L15 20 L9 18 L3 20 Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 4 V18 M15 6 V20" stroke={color} strokeWidth="2" />
    </svg>
  ),
  Home: ({ size = 18, color = "#0a4d3c" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 11 L12 4 L20 11 V20 H4 Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  Sparkle: ({ size = 14, color = "#d4b87a" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" fill={color} />
    </svg>
  ),
  Wallet: ({ size = 18, color = "#0a4d3c" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="13" rx="2" stroke={color} strokeWidth="2" />
      <path d="M3 10 H21 M16 14 h2" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  Trip: ({ size = 18, color = "#0a4d3c" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="9" r="3" stroke={color} strokeWidth="2" />
      <path d="M12 21 C5 14 5 9 12 3 C19 9 19 14 12 21 Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  Check: ({ size = 14, color = "#3d7a5a" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 12 L10 17 L19 7" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Cloud: ({ size = 16, color = "#4d5a55" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M7 18 a4 4 0 1 1 1-7.9 a5 5 0 0 1 9.5 1.4 a3.5 3.5 0 0 1 -1 6.5 H7 Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  Rain: ({ size = 16, color = "#4d5a55" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M7 14 a4 4 0 1 1 1-7.9 a5 5 0 0 1 9.5 1.4 a3.5 3.5 0 0 1 -1 6.5 H7 Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 18 v3 M13 18 v3 M17 18 v3" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  Sun: ({ size = 16, color = "#c4a14d" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" stroke={color} strokeWidth="2" />
      <path d="M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5L19 19 M5 19l1.5-1.5 M17.5 6.5L19 5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
};
