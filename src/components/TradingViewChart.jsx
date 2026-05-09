import { useEffect, useRef } from "react";

/**
 * TradingView Advanced Chart — FREE embed widget.
 *
 * Critical: use embed-widget-advanced-chart.js NOT tv.js
 * tv.js = paid Charting Library (requires private GitHub access)
 * embed-widget-advanced-chart.js = free public widget (supports NSE)
 *
 * NSE symbol format: NSE:TCS, NSE:RELIANCE, NSE:INFY
 * US symbol format:  NASDAQ:AAPL, NYSE:MSFT
 */
export default function TradingViewChart({ symbol, exchange }) {
    const containerRef = useRef(null);

    const tvSymbol = toTradingViewSymbol(symbol, exchange);

    useEffect(() => {
        if (!containerRef.current) return;

        // Clear previous widget
        containerRef.current.innerHTML = "";

        // TradingView requires this exact structure:
        // outer div → inner widget div + script with JSON as innerHTML
        const widgetDiv = document.createElement("div");
        widgetDiv.className = "tradingview-widget-container__widget";
        widgetDiv.style.height = "100%";
        widgetDiv.style.width  = "100%";
        containerRef.current.appendChild(widgetDiv);

        const script = document.createElement("script");
        script.type  = "text/javascript";
        script.src   = "https://s3.tradingview.com/external-embedding/" +
            "embed-widget-advanced-chart.js";
        script.async = true;

        // Config goes as script innerHTML — this is how TradingView's
        // free widgets work (different from tv.js approach)
        script.innerHTML = JSON.stringify({
            autosize:              true,
            symbol:                tvSymbol,
            interval:              "D",
            timezone:              "Asia/Kolkata",
            theme:                 "dark",
            style:                 "1",          // 1 = candlestick
            locale:                "en",
            allow_symbol_change:   false,        // lock to our symbol
            calendar:              false,
            support_host:          "https://www.tradingview.com",
            hide_top_toolbar:      false,
            hide_legend:           false,
            save_image:            true,
            backgroundColor:       "rgba(15, 23, 42, 1)",
        });

        containerRef.current.appendChild(script);

        return () => {
            if (containerRef.current) {
                containerRef.current.innerHTML = "";
            }
        };
    }, [tvSymbol]);

    return (
        <div
            ref={containerRef}
            className="tradingview-widget-container"
            style={{ width: "100%", height: "100%" }}
        />
    );
}

function toTradingViewSymbol(symbol, exchange) {
    const map = {
        "NSE":    "NSE",
        "BSE":    "BSE",
        "NASDAQ": "NASDAQ",
        "NYSE":   "NYSE",
    };
    const tvExchange = map[exchange?.toUpperCase()] || "NSE";
    return `${tvExchange}:${symbol?.toUpperCase()}`;
}