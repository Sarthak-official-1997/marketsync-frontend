// src/utils/stocksHoldingsColumnPrefs.js
// Column customization for the Stocks Holdings table. Stock (name/symbol)
// and the BUY/SELL action buttons stay fixed — everything else here is a
// data column the user might want to hide or reorder, same as Performance.

import { createColumnPrefs } from "./columnPrefsFactory";

export const COLUMN_CANDIDATES = [
    { id: "qty",     label: "Qty" },
    { id: "avgBuy",  label: "Avg Buy" },
    { id: "current", label: "Current" },
    { id: "chart",   label: "Chart" },
    { id: "day",     label: "Day" },
    { id: "value",   label: "Value" },
    { id: "pl",      label: "P&L" },
    { id: "plPct",   label: "P&L %" },
    { id: "weightage", label: "% of Portfolio" },
];

const prefs = createColumnPrefs("folyo_stocks_holdings_columns_v1", COLUMN_CANDIDATES);

export const getColumnPrefs = prefs.getColumnPrefs;
export const setColumnPrefs = prefs.setColumnPrefs;
export const STOCKS_HOLDINGS_COLUMNS_EVENT = prefs.EVENT;