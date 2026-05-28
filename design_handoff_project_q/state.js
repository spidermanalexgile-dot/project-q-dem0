/* Project Q — single state store + deterministic calc engine.
 *
 * Exposes window.ProjectQ:
 *   loadPayload(payload)
 *   setLever(id, value)
 *   setDayType(id)
 *   setPhase(year)
 *   setRebate(enabled)            // bonus — useful for live demos
 *   getState()
 *   subscribe(fn)                 // returns unsubscribe
 *   compute()                     // returns derived { fee(pct), revenue, qcash(pct) ... }
 *
 * Both the on-screen sliders and any external live agent are equal writers
 * to this single store. Every mutation -> instant deterministic recompute.
 */
(function () {
  const listeners = new Set();
  let state = null;
  let prevDayRev = 0;
  let prevAnnualRev = 0;
  let deltaTimer = null;

  function notify() {
    for (const fn of listeners) fn(state);
  }

  function leverValue(id) {
    const l = state.levers.find((x) => x.id === id);
    return l ? l.value : undefined;
  }

  // ---- deterministic curve & money ----
  function feeAtPct(pct, snap = state) {
    const rebate = snap.shoulder_rebate;
    if (rebate && rebate.enabled && pct < rebate.applies_below_pct) {
      // credit zone — fee is negative (recirculation, not "we pay you")
      return -rebate.credit;
    }
    const base = snap.levers.find((l) => l.id === "base_fee").value;
    const cap = snap.levers.find((l) => l.id === "max_fee_cap").value;
    const ceiling = snap.levers.find((l) => l.id === "ceiling_pct").value;
    const plateauEnd = snap.curve.shape.plateau_end_pct;
    const exp = snap.curve.shape.exponent;

    if (pct <= plateauEnd) return base;
    if (pct >= ceiling) return cap;

    const t = (pct - plateauEnd) / (ceiling - plateauEnd); // 0..1
    const tp = Math.pow(t, exp);
    return base + (cap - base) * tp;
  }

  // What the visitor actually pays out-of-pocket vs. Q-Cash credit
  function payAtPct(pct, snap = state) {
    const f = feeAtPct(pct, snap);
    if (f < 0) return f; // credit zone — they receive credit, no out-of-pocket
    const realCap = snap.phase.real_pay_cap;
    return Math.min(f, realCap);
  }
  function qcashAtPct(pct, snap = state) {
    const f = feeAtPct(pct, snap);
    if (f < 0) return 0;
    return Math.max(0, f - snap.phase.real_pay_cap);
  }

  function dayRevenue(demand_pct, snap = state) {
    const tc = snap.levers.find((l) => l.id === "target_capacity").value;
    const visitors = tc * (demand_pct / 100);
    return visitors * feeAtPct(demand_pct, snap);
  }

  function annualRevenue(snap = state) {
    let total = 0;
    for (const s of snap.seasonal) {
      total += s.days * dayRevenue(s.demand_pct, snap);
    }
    return total;
  }

  function activeDayType(snap = state) {
    return (
      snap.day_types.find((d) => d.id === snap.activeDay) || snap.day_types[0]
    );
  }

  // ---- mutations ----
  function bumpDeltas() {
    // Capture pre-mutation revenue so the UI can show ▲ +€xxx after re-render.
    prevDayRev = state.__lastDayRev ?? dayRevenue(activeDayType().demand_pct);
    prevAnnualRev = state.__lastAnnualRev ?? annualRevenue();
    clearTimeout(deltaTimer);
    state.__deltaSeq = (state.__deltaSeq || 0) + 1;
  }
  function commitDeltas() {
    state.__lastDayRev = dayRevenue(activeDayType().demand_pct);
    state.__lastAnnualRev = annualRevenue();
    state.__prevDayRev = prevDayRev;
    state.__prevAnnualRev = prevAnnualRev;
    // Auto-clear delta indicator after 3.5s for calm
    clearTimeout(deltaTimer);
    deltaTimer = setTimeout(() => {
      state.__prevDayRev = state.__lastDayRev;
      state.__prevAnnualRev = state.__lastAnnualRev;
      notify();
    }, 3500);
  }

  function loadPayload(payload) {
    // Defensive deep clone so we don't mutate a caller's object.
    state = JSON.parse(JSON.stringify(payload));
    if (!state.activeDay) state.activeDay = state.day_types[0].id;
    if (!state.phase) state.phase = { year: 1, real_pay_cap: 20 };
    state.__lastDayRev = dayRevenue(activeDayType().demand_pct);
    state.__lastAnnualRev = annualRevenue();
    state.__prevDayRev = state.__lastDayRev;
    state.__prevAnnualRev = state.__lastAnnualRev;
    notify();
  }

  function setLever(id, value) {
    const l = state.levers.find((x) => x.id === id);
    if (!l) return;
    const v = Math.max(l.min, Math.min(l.max, Number(value)));
    if (l.value === v) return;
    bumpDeltas();
    l.value = v;
    commitDeltas();
    notify();
  }

  function setDayType(id) {
    if (state.activeDay === id) return;
    bumpDeltas();
    state.activeDay = id;
    commitDeltas();
    notify();
  }

  function setPhase(year) {
    if (state.phase.year === year) return;
    bumpDeltas();
    state.phase.year = year;
    // Year 1 = capped & gentle; later years escalate.
    state.phase.real_pay_cap = year === 1 ? 20 : year === 2 ? 60 : 150;
    commitDeltas();
    notify();
  }

  function setRebate(enabled) {
    if (state.shoulder_rebate.enabled === enabled) return;
    bumpDeltas();
    state.shoulder_rebate.enabled = enabled;
    commitDeltas();
    notify();
  }

  function getState() {
    return state;
  }
  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
  function compute() {
    const dt = activeDayType();
    return {
      activeDay: dt,
      dayRevenue: dayRevenue(dt.demand_pct),
      annualRevenue: annualRevenue(),
      prevDayRev: state.__prevDayRev,
      prevAnnualRev: state.__prevAnnualRev,
      fee: feeAtPct,
      pay: payAtPct,
      qcash: qcashAtPct,
    };
  }

  window.ProjectQ = {
    loadPayload,
    setLever,
    setDayType,
    setPhase,
    setRebate,
    getState,
    subscribe,
    compute,
    // exposed helpers (handy in console / for the live agent reading back)
    feeAtPct,
    payAtPct,
    qcashAtPct,
    dayRevenue,
    annualRevenue,
  };
})();
