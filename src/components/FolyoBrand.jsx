export default function FolyoBrand({ size = "md", showTagline = false, className = "" }) {
    const cfg = {
        xs: { wrap: "px-2.5 py-1 rounded-lg",   folyo: "text-sm",   sup: "text-[8px]",  sub: "text-[8px]",  tracking: "tracking-[0.18em]" },
        sm: { wrap: "px-3 py-1.5 rounded-xl",    folyo: "text-base", sup: "text-[9px]",  sub: "text-[9px]",  tracking: "tracking-[0.2em]"  },
        md: { wrap: "px-4 py-2 rounded-xl",       folyo: "text-xl",   sup: "text-[10px]", sub: "text-[10px]", tracking: "tracking-[0.22em]" },
        lg: { wrap: "px-5 py-2.5 rounded-2xl",    folyo: "text-3xl",  sup: "text-xs",     sub: "text-xs",     tracking: "tracking-[0.25em]" },
        xl: { wrap: "px-7 py-4 rounded-2xl",      folyo: "text-5xl",  sup: "text-sm",     sub: "text-sm",     tracking: "tracking-[0.3em]"  },
    }[size];

    return (
        <div className={`inline-flex flex-col items-center ${className}`}>
            <div className={`flex items-start gap-0.5 border border-amber-500/50 ${cfg.wrap}
                             bg-gradient-to-br from-slate-900 to-slate-800/80
                             shadow-[0_0_24px_rgba(251,191,36,0.1)]`}>
                <span
                    className={`text-white ${cfg.folyo} ${cfg.tracking} leading-none`}
                    style={{ fontFamily: "'Cinzel', serif", fontWeight: 400 }}>
                    FOLYO
                </span>
                <span className={`font-bold text-amber-400 ${cfg.sup} self-start mt-0.5 leading-none`}
                      style={{ fontFamily: "system-ui" }}>
                    915
                </span>
            </div>
            <span className={`text-cyan-400 tracking-[0.2em] uppercase mt-1.5 ${cfg.sub}`}
                  style={{ fontFamily: "'Cinzel', serif", fontWeight: 400 }}>
                915 CREATION
            </span>
            {showTagline && (
                <p className="text-slate-400 text-sm mt-3 tracking-wider text-center italic">
                    Portfolio tracking, the way it should be.
                </p>
            )}
        </div>
    );
}