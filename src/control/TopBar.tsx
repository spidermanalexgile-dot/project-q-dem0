import { useStore } from "./useStore";
import { setDayType, setPhase } from "./state";

export function TopBar() {
  const state = useStore();
  if (!state) return null;
  const activeDay =
    state.day_types.find((d) => d.id === state.activeDay) || state.day_types[0];
  const year = state.phase.year;

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true" />
        <div>
          <div className="brand-name">Project Q</div>
          <div className="brand-sub">Authority Control · v0.4</div>
        </div>
      </div>

      <div className="tb-context">
        <div className="tb-field">
          <div className="tb-label">Location</div>
          <div className="tb-select">
            <select
              value={state.location.id}
              onChange={() => {
                /* placeholder for loadPayload(otherCity) */
              }}
            >
              <option value={state.location.id}>{state.location.label}</option>
              <option value="dubrovnik" disabled>
                Dubrovnik (load payload)
              </option>
              <option value="barcelona" disabled>
                Barcelona (load payload)
              </option>
            </select>
          </div>
        </div>

        <div className="tb-divider" />

        <div className="tb-field">
          <div className="tb-label">Modelling day</div>
          <div className="tb-select">
            <select
              value={state.activeDay}
              onChange={(e) => setDayType(e.target.value)}
            >
              {state.day_types.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label} · {d.date}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="tb-divider" />

        <div className="tb-field">
          <div className="tb-label">Demand</div>
          <div className="tb-demand-chip">{activeDay.demand_pct}%</div>
        </div>
      </div>

      <div className="tb-field tb-field-right">
        <div className="tb-label">Deployment phase</div>
        <div className="phase-toggle" role="tablist" aria-label="Deployment year">
          {[1, 2, 3].map((y) => (
            <button
              key={y}
              className={y === year ? "on" : ""}
              onClick={() => setPhase(y as 1 | 2 | 3)}
              aria-pressed={y === year}
            >
              YR&nbsp;{y}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
