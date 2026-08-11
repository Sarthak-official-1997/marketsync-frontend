// src/utils/mfHoldingsColumnPrefs.js
// Column customization for MF Holdings — Scheme stays fixed as the leading
// column (parallel to "Stock"/"Symbol" elsewhere), everything else is
// toggleable/reorderable, same pattern as every other table this session.

import { createColumnPrefs } from "./columnPrefsFactory";

export const COLUMN_CANDIDATES = [
    { id: "chart",     label: "Chart" },
    { id: "units",     label: "Units" },
    { id: "avgNav",    label: "Avg NAV" },
    { id: "currentNav",label: "Current NAV" },
    { id: "dayChange", label: "Day Change" },
    { id: "invested",  label: "Invested" },
    { id: "value",     label: "Value" },
    { id: "pl",        label: "P&L" },
    { id: "xirr",      label: "XIRR" },
    { id: "weightage", label: "% of Portfolio" },
];

const prefs = createColumnPrefs("folyo_mf_holdings_columns_v1", COLUMN_CANDIDATES);

export const getColumnPrefs = prefs.getColumnPrefs;
export const setColumnPrefs = prefs.setColumnPrefs;
export const MF_HOLDINGS_COLUMNS_EVENT = prefs.EVENT;