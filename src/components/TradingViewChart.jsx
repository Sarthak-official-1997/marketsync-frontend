import { useEffect, useRef } from "react";

/**
 * Embeds TradingView's Advanced Chart Widget.
 *
 * Completely free — TradingView pulls its own real-time data.
 * No API key needed. Works for NSE, BSE, NASDAQ, NYSE.
 *
 * Symbol format:
 *   NSE:RELIANCE, NSE:TCS, NASDAQ:AAPL, NYSE:MSFT
 *
 * How it works:
 * TradingView publishes a JS widget library at s3.tradingview.com.
 * We dynamically create a <script> tag that loads it, then it
 * renders a full chart into our container div.
 * useEffect cleans up the script and container when unmounted.
 */
export default function TradingViewChart({ symbol, exchange, theme = "dark" }) {
    const containerRef = useRef(null);
    const scriptRef    = useRef(null);

    // Convert our DB exchange + symbol → TradingView format
    const tvSymbol = toTradingViewSymbol(symbol, exchange);

    useEffect(() => {
        if (!containerRef.current) return;

        // Clear any previous chart
        containerRef.current.innerHTML = "";

        // TradingView widget config
        const widgetConfig = {
            autosize:          true,
            symbol:            tvSymbol,
            interval:          "D",           // default: daily candles
            timezone:          "Asia/Kolkata",
            theme:             theme,
            style:             "1",           // 1 = candlestick
            locale:            "en",
            toolbar_bg:        "#1e293b",
            enable_publishing: false,
            hide_top_toolbar:  false,
            hide_legend:       false,
            save_image:        true,
            container_id:      `tv_chart_${symbol}`,
            // These make it feel native to your dark UI
            backgroundColor:   "rgba(15, 23, 42, 0)",
            gridColor:         "rgba(51, 65, 85, 0.5)",
        };

        // Create inner div with the container id TradingView needs
        const innerDiv = document.createElement("div");
        innerDiv.id = widgetConfig.container_id;
        innerDiv.style.width  = "100%";
        innerDiv.style.height = "100%";
        containerRef.current.appendChild(innerDiv);

        // Dynamically load TradingView's widget script
        const script = document.createElement("script");
        script.src   = "https://s3.tradingview.com/tv.js";
        script.async = true;
        script.onload = () => {
            // Script loaded — instantiate the widget
            if (window.TradingView) {
                new window.TradingView.widget(widgetConfig);
            }
        };

        containerRef.current.appendChild(script);
        scriptRef.current = script;

        // Cleanup when component unmounts or symbol changes
        return () => {
            if (containerRef.current) {
                containerRef.current.innerHTML = "";
            }
        };
    }, [tvSymbol, theme]);

    return (
        <div
            ref={containerRef}
            style={{ width: "100%", height: "100%" }}
        />
    );
}

/**
 * Maps your DB symbol + exchange to TradingView's format.
 *
 * TradingView exchange prefixes:
 *   NSE    → NSE:SYMBOL
 *   BSE    → BSE:SYMBOL
 *   NASDAQ → NASDAQ:SYMBOL
 *   NYSE   → NYSE:SYMBOL
 */
function toTradingViewSymbol(symbol, exchange) {
    const exchangeMap = {
        "NSE":    "NSE",
        "BSE":    "BSE",
        "NASDAQ": "NASDAQ",
        "NYSE":   "NYSE",
    };

    const tvExchange = exchangeMap[exchange?.toUpperCase()] || "NSE";
    return `${tvExchange}:${symbol?.toUpperCase()}`;
}