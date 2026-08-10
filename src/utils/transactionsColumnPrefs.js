// src/utils/transactionsColumnPrefs.js
// Column customization for the per-stock transaction rows inside
// TransactionsPage's StockGroupCard. Type stays fixed as the leading
// column (it's the natural row identifier here, parallel to "Stock" in
// the other tables — this table is already grouped under one stock, so
// there's no separate name column to anchor on). Checkbox and the
// Add/Delete actions column stay fixed too.

import { createColumnPrefs } from "./columnPrefsFactory";

export const COLUMN_CANDIDATES = [
    { id: "qty",   label: "Qty" },
    { id: "price", label: "Price" },
    { id: "total", label: "Total" },
    { id: "date",  label: "Date" },
];

const prefs = createColumnPrefs("folyo_transactions_columns_v1", COLUMN_CANDIDATES);

export const getColumnPrefs = prefs.getColumnPrefs;
export const setColumnPrefs = prefs.setColumnPrefs;
export const TRANSACTIONS_COLUMNS_EVENT = prefs.EVENT;