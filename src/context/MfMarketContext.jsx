import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getMfNavHistory } from "../api/portfolio";

// ── Kept in sync with MfMarketPage ─────────────────────────────────────────
export const POPULAR_MF = [
    { code: "120503", name: "Mirae Asset Large Cap Fund",       house: "Mirae",  cat: "Large Cap" },
    { code: "119551", name: "Axis Bluechip Fund",               house: "Axis",   cat: "Large Cap" },
    { code: "118989", name: "HDFC Mid-Cap Opportunities Fund",  house: "HDFC",   cat: "Mid Cap"   },
    { code: "120843", name: "Nippon India Growth Fund",         house: "Nippon", cat: "Mid Cap"   },
    { code: "125354", name: "Nippon India Small Cap Fund",      house: "Nippon", cat: "Small Cap" },
    { code: "120828", name: "SBI Small Cap Fund",               house: "SBI",    cat: "Small Cap" },
    { code: "120716", name: "Parag Parikh Flexi Cap Fund",      house: "PPFAS",  cat: "Flexi Cap" },
    { code: "118825", name: "HDFC Flexi Cap Fund",              house: "HDFC",   cat: "Flexi Cap" },
    { code: "120586", name: "Mirae Asset ELSS Tax Saver Fund",  house: "Mirae",  cat: "ELSS"      },
    { code: "119598", name: "Axis Long Term Equity Fund",       house: "Axis",   cat: "ELSS"      },
    { code: "120625", name: "UTI Nifty 50 Index Fund",          house: "UTI",    cat: "Index"     },
    { code: "120841", name: "Nippon India Index Fund - Nifty",  house: "Nippon", cat: "Index"     },
];

const MfMarketContext = createContext(null);

export function MfMarketProvider({ children }) {
    const [navs,    setNavs]    = useState({});
    const [loading, setLoading] = useState(true);
    const fetchedRef = useRef(false); // prevent double-fetch in React StrictMode

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;

        const fetchAll = async () => {
            setLoading(true);
            const fetched = {};

            // Chunked parallel fetch — 4 at a time so mfapi.in isn't hammered
            const chunks = [];
            for (let i = 0; i < POPULAR_MF.length; i += 4)
                chunks.push(POPULAR_MF.slice(i, i + 4));

            for (const chunk of chunks) {
                await Promise.allSettled(
                    chunk.map(async (mf) => {
                        try {
                            const res = await getMfNavHistory(mf.code, "1Y");
                            fetched[mf.code] = res.data;
                            // Progressive update — page renders data as it arrives
                            setNavs(prev => ({ ...prev, [mf.code]: res.data }));
                        } catch {}
                    })
                );
            }
            setLoading(false);
        };

        fetchAll();
    }, []);

    const refresh = () => {
        fetchedRef.current = false;
        setNavs({});
        setLoading(true);
        // re-trigger useEffect by bumping a key externally isn't possible,
        // so we re-run the fetch inline here
        const fetchAll = async () => {
            const fetched = {};
            const chunks = [];
            for (let i = 0; i < POPULAR_MF.length; i += 4)
                chunks.push(POPULAR_MF.slice(i, i + 4));
            for (const chunk of chunks) {
                await Promise.allSettled(
                    chunk.map(async (mf) => {
                        try {
                            const res = await getMfNavHistory(mf.code, "1Y");
                            fetched[mf.code] = res.data;
                            setNavs(prev => ({ ...prev, [mf.code]: res.data }));
                        } catch {}
                    })
                );
            }
            setLoading(false);
            fetchedRef.current = true;
        };
        fetchAll();
    };

    return (
        <MfMarketContext.Provider value={{ navs, loading, refresh }}>
            {children}
        </MfMarketContext.Provider>
    );
}

export function useMfMarket() {
    const ctx = useContext(MfMarketContext);
    if (!ctx) throw new Error("useMfMarket must be used inside MfMarketProvider");
    return ctx;
}