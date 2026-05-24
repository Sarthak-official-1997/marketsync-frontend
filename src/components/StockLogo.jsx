// src/components/StockLogo.jsx
//
// Renders a company logo or a beautiful gradient fallback badge.
// Strategy:
//   1. Look up the company's domain from NSE_DOMAINS map
//   2. Load via Clearbit Logo API (free, no key needed)
//   3. On 404 / error → show branded gradient badge with stock initials
//
// Usage:
//   <StockLogo symbol="RELIANCE" size={40} />
//   <StockLogo symbol="TCS" name="Tata Consultancy" size={32} className="..." />

import { useState } from "react";

// ── NSE symbol → Clearbit-compatible domain ───────────────────────────────────
// Add more as needed. Clearbit covers most listed .com domains automatically.
const NSE_DOMAINS = {
    RELIANCE:   "ril.com",          TCS:        "tcs.com",
    HDFCBANK:   "hdfcbank.com",     INFY:       "infosys.com",
    ICICIBANK:  "icicibank.com",    HINDUNILVR: "hul.co.in",
    ITC:        "itcportal.com",    BHARTIARTL: "airtel.in",
    SBIN:       "sbi.co.in",        BAJFINANCE: "bajajfinserv.in",
    HCLTECH:    "hcltech.com",
    KOTAKBANK:  "kotak.com",        ASIANPAINT: "asianpaints.com",
    AXISBANK:   "axisbank.com",     MARUTI:     "marutisuzuki.com",
    SUNPHARMA:  "sunpharma.com",    TITAN:      "titancompany.in",
    ONGC:       "ongcindia.com",    ADANIENT:   "adani.com",
    POWERGRID:  "powergridindia.com", NTPC:     "ntpcindia.com",
    COALINDIA:  "coalindia.in",     JSWSTEEL:   "jsw.in",
    TATAMOTORS: "tatamotors.com",   TATASTEEL:  "tatasteel.com",
    HINDALCO:   "hindalco.com",     TECHM:      "techmahindra.com",
    CIPLA:      "cipla.com",        DRREDDY:    "drreddys.com",
    DIVISLAB:   "divislaboratories.com",
    APOLLOHOSP: "apollohospitals.com",
    HDFCLIFE:   "hdfclife.com",     SBILIFE:    "sbilife.co.in",
    NESTLEIND:  "nestle.in",        BRITANNIA:  "britannia.co.in",
    DABUR:      "dabur.com",        MARICO:     "marico.com",
    PIDILITIND: "pidilite.com",     BERGEPAINT: "bergerpaints.com",
    HEROMOTOCO: "heromotocorp.com", EICHERMOT:  "eichergroup.com",
    TVSMOTOR:   "tvsmotor.com",     BAJAJFINSV: "bajajfinserv.in",
    INDUSINDBK: "indusind.com",     FEDERALBNK: "federalbank.co.in",
    BANDHANBNK: "bandhanbank.com",  CHOLAFIN:   "cholamandalam.in",
    MUTHOOTFIN: "muthootfinance.com",
    TORNTPHARM: "torrentpharma.com",
    BIOCON:     "biocon.com",       LAURUSLABS: "lauruslabs.com",
    AUROPHARMA: "aurobindo.com",    LUPIN:      "lupin.com",
    ZOMATO:     "zomato.com",       NYKAA:      "nykaa.com",
    PAYTM:      "paytm.com",        IRCTC:      "irctc.co.in",
    HAL:        "hal-india.co.in",  DLF:        "dlf.in",
    GODREJPROP: "godrejproperties.com",
    SOBHA:      "sobha.com",
    OBEROIRLTY: "oberoirealty.com",
    METROPOLIS: "metropolisindia.com",
    LALPATHLAB: "lalpathlabs.com",  FORTIS:     "fortishealthcare.com",
    MAXHEALTH:  "maxhealthcare.in",
    WIPRO:      "wipro.com",        VEDL:       "vedantalimited.com",
    SAIL:       "sail.co.in",       NMDC:       "nmdc.co.in",
    HINDCOPPER: "hindustancopper.com",
    AMBUJACEM:  "ambujacement.com", SHREECEM:   "shreecement.com",
    GRASIM:     "grasim.com",       ULTRACEMCO: "ultratechcement.com",
    COFORGE:    "coforge.com",      MPHASIS:    "mphasis.com",
    LTTS:       "ltts.com",         PERSISTENT: "persistent.com",
    OFSS:       "oracle.com",       KPIT:       "kpit.com",
    NAUKRI:     "naukri.com",       JUSTDIAL:   "justdial.com",
    ZEEL:       "zee.com",          PVR:        "pvrcinemas.com",
    INOXLEISUR: "inoxmovies.com",   BPCL:       "bharatpetroleum.com",
    IOC:        "iocl.com",         HPCL:       "hindustanpetroleum.com",
    GAIL:       "gailonline.com",
    ASTEC:      "astecls.com",      NETWEB:     "netwebindia.com",
    SAILIFE:    "sailifesciences.com",
    VIJAYA:     "vijayadiagnostic.com",
};

// ── Deterministic gradient from symbol ───────────────────────────────────────
const GRADIENTS = [
    ["#3b82f6", "#1e40af"],   // blue
    ["#10b981", "#065f46"],   // emerald
    ["#8b5cf6", "#4c1d95"],   // violet
    ["#f59e0b", "#78350f"],   // amber
    ["#06b6d4", "#0e4f6e"],   // cyan
    ["#ef4444", "#7f1d1d"],   // red
    ["#ec4899", "#831843"],   // pink
    ["#f97316", "#7c2d12"],   // orange
    ["#14b8a6", "#0f3d37"],   // teal
    ["#84cc16", "#365314"],   // lime
    ["#a855f7", "#4a044e"],   // purple
    ["#0ea5e9", "#0c3e5e"],   // sky
];

function getGradient(sym = "") {
    const h = sym.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return GRADIENTS[h % GRADIENTS.length];
}

// Abbreviate symbol for the badge (max 4 chars)
function abbrev(sym = "", name = "") {
    if (sym.length <= 4) return sym;
    // Try initials of company name
    const words = (name || sym).split(/[\s\-&.]/);
    if (words.length >= 2) {
        const ini = words.slice(0, 3).map(w => w[0] || "").join("").toUpperCase();
        if (ini.length >= 2) return ini.slice(0, 3);
    }
    return sym.slice(0, 4);
}

// ── Gradient badge fallback ───────────────────────────────────────────────────
function LogoBadge({ symbol, name, size }) {
    const [from, to] = getGradient(symbol);
    const text       = abbrev(symbol, name);
    const fontSize   = size <= 28 ? size * 0.35 : size * 0.32;

    return (
        <div
            style={{
                width:          size,
                height:         size,
                borderRadius:   size * 0.22,
                background:     `linear-gradient(135deg, ${from}, ${to})`,
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                flexShrink:     0,
                boxShadow:      `0 2px 8px ${from}55`,
            }}>
            <span style={{
                color:      "#fff",
                fontSize:   fontSize,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                lineHeight: 1,
            }}>
                {text}
            </span>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StockLogo({ symbol = "", name = "", size = 40, className = "" }) {
    const domain  = NSE_DOMAINS[symbol.toUpperCase()];
    const [failed, setFailed] = useState(false);

    if (domain && !failed) {
        return (
            <img
                src={`https://logo.uplead.com/${domain}`}
                alt={symbol}
                onError={() => setFailed(true)}
                style={{
                    width:        size,
                    height:       size,
                    borderRadius: size * 0.22,
                    objectFit:    "contain",
                    background:   "rgba(255,255,255,0.05)",
                    flexShrink:   0,
                }}
                className={className}
            />
        );
    }

    return <LogoBadge symbol={symbol} name={name} size={size} />;
}