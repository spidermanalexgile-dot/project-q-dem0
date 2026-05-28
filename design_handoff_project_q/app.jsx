/* Root composition + tweaks wiring. */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "showBuckets": true,
  "curveStyle": "gradient"
}/*EDITMODE-END*/;

function applyTweaks(t) {
  document.body.classList.toggle("theme-dark", t.theme === "dark");
  document.body.classList.toggle("hide-buckets", !t.showBuckets);
  document.body.dataset.curveStyle = t.curveStyle || "gradient";
}

function TweaksUI() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  React.useEffect(() => applyTweaks(t), [t.theme, t.showBuckets, t.curveStyle]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Surface" />
      <TweakRadio
        label="Theme"
        value={t.theme}
        options={[
          { value: "light", label: "Stone" },
          { value: "dark", label: "Earth" },
        ]}
        onChange={(v) => setTweak("theme", v)}
      />

      <TweakSection label="Curve" />
      <TweakRadio
        label="Stroke"
        value={t.curveStyle}
        options={[
          { value: "gradient", label: "Gradient" },
          { value: "warm", label: "Warm" },
          { value: "ink", label: "Ink" },
        ]}
        onChange={(v) => setTweak("curveStyle", v)}
      />

      <TweakSection label="Detail" />
      <TweakToggle
        label="Decile strip"
        value={t.showBuckets}
        onChange={(v) => setTweak("showBuckets", v)}
      />
    </TweaksPanel>
  );
}

function App() {
  return (
    <React.Fragment>
      <window.TopBar />
      <main className="main">
        <window.CurvePanel />
        <div className="right-rail">
          <window.RevenuePanel />
          <window.LeversPanel />
        </div>
      </main>
      <TweaksUI />
    </React.Fragment>
  );
}

// ---- Boot ----
window.ProjectQ.loadPayload(window.PAYLOAD_VENICE);
applyTweaks(TWEAK_DEFAULTS);

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
