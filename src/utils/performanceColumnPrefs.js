// src/utils/performanceColumnPrefs.js
// Thin wrapper over the shared factory — kept as its own file (rather than
// every page importing createColumnPrefs directly and building its own
// candidate list inline) so each table's column definitions live in one
// obvious, greppable place.

import { createColumnPrefs } from "./columnPrefsFactory";

export const COLUMN_CANDIDATES = [
    { id: "qty",       label: "Qty" },
    { id: "avgPrice",  label: "Avg. price" },
    { id: "ltp",       label: "LTP" },
    { id: "dayChange", label: "Day change" },
    { id: "value",     label: "Value" },
    { id: "gainLoss",  label: "Total gain/loss" },
];

const prefs = createColumnPrefs("folyo_performance_columns_v1", COLUMN_CANDIDATES);

export const getColumnPrefs = prefs.getColumnPrefs;
export const setColumnPrefs = prefs.setColumnPrefs;
export const PERFORMANCE_COLUMNS_EVENT = prefs.EVENT;