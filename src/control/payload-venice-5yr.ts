/**
 * Venice 5-year DPM bundle (2024–2028), loaded at boot.
 *
 * The four CSVs are imported VERBATIM via Vite's `?raw` suffix (string contents),
 * then handed to loadBundle() exactly as a folder/drag-drop would — so boot uses
 * the same parse + validate path as a runtime upload. 2024–2026-06-05 are
 * confirmed actuals (locked); 2026-06-06 onward are lever-influenced projections.
 */

import daily from "../../dpm-payloads/venice-5yr/ProjectQ_Venice_Daily_Dataset_2024_2028.csv?raw";
import monthly from "../../dpm-payloads/venice-5yr/ProjectQ_Venice_Monthly_Summary_2024_2028.csv?raw";
import shocks from "../../dpm-payloads/venice-5yr/ProjectQ_Venice_Shock_Scenarios.csv?raw";
import assumptions from "../../dpm-payloads/venice-5yr/ProjectQ_Venice_Assumptions_And_Parameters.csv?raw";

export const VENICE_5YR_BUNDLE: { name: string; text: string }[] = [
  { name: "ProjectQ_Venice_Daily_Dataset_2024_2028.csv", text: daily },
  { name: "ProjectQ_Venice_Monthly_Summary_2024_2028.csv", text: monthly },
  { name: "ProjectQ_Venice_Shock_Scenarios.csv", text: shocks },
  { name: "ProjectQ_Venice_Assumptions_And_Parameters.csv", text: assumptions },
];
