// src/utils/watchlistColumnPrefs.js
// Column customization for the Stocks Watchlist table. The color-dot,
// Stock name, and Remove action stay fixed — Price & Change, Chart, Since
// Added, Added On, and Exchange are the toggleable/reorderable columns.
// This table in particular mixes purposes more than the others (per-user
// "Since Added"/"Added On" are the kind of thing half of users will never
// want visible), so it's a good customize-columns case beyond just crowding.

import { createColumnPrefs } from "./columnPrefsFactory";

export const COLUMN_CANDIDATES = [
    { id: "priceChange", label: "Price & Change" },
    { id: "chart",       label: "Chart" },
    { id: "sinceAdded",  label: "Since Added" },
    { id: "addedOn",     label: "Added On" },
    { id: "exchange",    label: "Exchange" },
];

const prefs = createColumnPrefs("folyo_watchlist_columns_v1", COLUMN_CANDIDATES);

export const getColumnPrefs = prefs.getColumnPrefs;
export const setColumnPrefs = prefs.setColumnPrefs;
export const WATCHLIST_COLUMNS_EVENT = prefs.EVENT;