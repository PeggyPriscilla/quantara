import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScatterChart, Scatter,
  LineChart, Line, CartesianGrid,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, ZAxis,
} from "recharts";

const API = "http://127.0.0.1:10001";

const C = {
  bg:       "#000000",
  surface:  "rgba(255,255,255,0.04)",
  surface2: "rgba(255,255,255,0.07)",
  border:   "rgba(255,255,255,0.08)",
  blue:     "#0071e3",
  blueGlow: "rgba(0,113,227,0.25)",
  blueSoft: "rgba(0,113,227,0.12)",
  green:    "#34d399",
  amber:    "#f59e0b",
  red:      "#ef4444",
  purple:   "#a78bfa",
  textPrim: "#f5f5f7",
  textSec:  "rgba(245,245,247,0.60)",
  textTer:  "rgba(245,245,247,0.35)",
  mono:     "'JetBrains Mono', monospace",
  display:  "'Syne', sans-serif",
  body:     "'Outfit', sans-serif",
};

function validateOxide(formula) {
  if (!formula || !formula.trim()) return null;
  const f = formula.trim();
  if (/[A-Za-z]0(\d|[A-Z]|$)/.test(f)) {
    const suggestion = f.replace(/(?<=[A-Za-z])0/g, 'O');
    return `"${f}" — did you use the digit 0 instead of the letter O? Try: ${suggestion}`;
  }
  const tokens = f.match(/[A-Z][a-z]?/g) || [];
  const VALID_ELEMENTS = new Set([
    "H","He","Li","Be","B","C","N","O","F","Ne","Na","Mg","Al","Si","P","S",
    "Cl","Ar","K","Ca","Sc","Ti","V","Cr","Mn","Fe","Co","Ni","Cu","Zn","Ga",
    "Ge","As","Se","Br","Kr","Rb","Sr","Y","Zr","Nb","Mo","Tc","Ru","Rh","Pd",
    "Ag","Cd","In","Sn","Sb","Te","I","Xe","Cs","Ba","La","Ce","Pr","Nd","Pm",
    "Sm","Eu","Gd","Tb","Dy","Ho","Er","Tm","Yb","Lu","Hf","Ta","W","Re","Os",
    "Ir","Pt","Au","Hg","Tl","Pb","Bi","Po","At","Rn","Fr","Ra","Ac","Th","Pa",
    "U","Np","Pu","Am","Cm","Bk","Cf","Es","Fm","Md","No","Lr","Rf","Db","Sg",
    "Bh","Hs","Mt","Ds","Rg","Cn","Nh","Fl","Mc","Lv","Ts","Og"
  ]);
  for (const token of tokens) {
    if (!VALID_ELEMENTS.has(token)) {
      return `"${token}" in "${f}" is not a recognised chemical element. Try: TiO2, Fe2O3, ZnO, SiO2, Al2O3.`;
    }
  }
  if (!tokens.includes("O")) {
    return `"${f}" does not appear to be an oxide (no oxygen found). This system only supports oxide materials. Try: TiO2, Fe2O3, ZnO, SiO2, Al2O3.`;
  }
  return null;
}

function MeshBg() {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:"-20%", left:"-10%", width:"60vw", height:"60vw", borderRadius:"50%",
        background:"radial-gradient(circle,rgba(0,113,227,0.08) 0%,transparent 70%)" }}/>
      <div style={{ position:"absolute", bottom:"-20%", right:"-10%", width:"50vw", height:"50vw", borderRadius:"50%",
        background:"radial-gradient(circle,rgba(52,211,153,0.05) 0%,transparent 70%)" }}/>
      <div style={{ position:"absolute", inset:0,
        backgroundImage:"radial-gradient(rgba(255,255,255,0.04) 1px,transparent 1px)",
        backgroundSize:"40px 40px" }}/>
    </div>
  );
}

const NAV_ITEMS = [
  { id:"home",     label:"Home"     },
  { id:"analyzer", label:"Analyzer" },
  { id:"nlquery",  label:"AI Search"},
  { id:"batch",    label:"Batch"    },
  { id:"compare",  label:"Compare"  },
  { id:"mixer",    label:"Mixer"    },
  { id:"map",      label:"Map"      },
  { id:"parity",   label:"Parity"   },
];

function Navbar({ page, setPage }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <motion.nav initial={{ y:-60, opacity:0 }} animate={{ y:0, opacity:1 }}
      transition={{ duration:0.6, ease:[0.16,1,0.3,1] }}
      style={{ position:"fixed", top:16, left:0, right:0, margin:"0 auto", width:"fit-content",
        zIndex:1000, display:"flex", alignItems:"center", gap:4,
        background: scrolled ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.4)",
        backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
        border:`1px solid ${C.border}`, borderRadius:999,
        padding:"8px 16px", transition:"background 0.3s" }}>
      <span onClick={() => setPage("home")} style={{ fontFamily:C.display, fontWeight:800,
        fontSize:15, letterSpacing:"0.12em", color:C.textPrim, cursor:"pointer", marginRight:16 }}>Q</span>
      {NAV_ITEMS.map(({ id, label }) => (
        <button key={id} onClick={() => setPage(id)} style={{
          background: page===id ? C.blueSoft : "transparent",
          border:"none", color: page===id ? C.blue : C.textSec,
          fontFamily:C.body, fontWeight:500, fontSize:13,
          padding:"6px 12px", borderRadius:999, cursor:"pointer", transition:"all 0.2s" }}>{label}</button>
      ))}
    </motion.nav>
  );
}

function PrimaryButton({ children, onClick, disabled, small }) {
  return (
    <motion.button whileHover={!disabled?{scale:1.03}:{}} whileTap={!disabled?{scale:0.97}:{}}
      onClick={onClick} disabled={disabled}
      style={{ padding:small?"10px 18px":"14px 26px", borderRadius:999,
        background:disabled?"rgba(0,113,227,0.35)":C.blue,
        border:"none", color:"#fff", fontFamily:C.body, fontWeight:600,
        fontSize:small?13:14, cursor:disabled?"not-allowed":"pointer",
        display:"flex", alignItems:"center", gap:8, whiteSpace:"nowrap",
        boxShadow:disabled?"none":`0 0 24px ${C.blueGlow}`,
        transition:"background 0.2s, box-shadow 0.2s" }}>{children}</motion.button>
  );
}

function GhostButton({ children, onClick, small }) {
  return (
    <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}} onClick={onClick}
      style={{ padding:small?"10px 18px":"14px 26px", borderRadius:999,
        background:"transparent", border:`1px solid ${C.border}`,
        color:C.textSec, fontFamily:C.body, fontWeight:500,
        fontSize:small?13:14, cursor:"pointer", whiteSpace:"nowrap" }}>{children}</motion.button>
  );
}

function Spinner() {
  return (
    <motion.div animate={{rotate:360}} transition={{duration:0.8,repeat:Infinity,ease:"linear"}}
      style={{width:14,height:14,border:"2px solid rgba(255,255,255,0.3)",
        borderTopColor:"#fff",borderRadius:"50%"}}/>
  );
}

function GlassCard({ title, children, style={} }) {
  return (
    <div style={{ padding:24, borderRadius:18, border:`1px solid ${C.border}`,
      background:C.surface, backdropFilter:"blur(10px)", ...style }}>
      {title && <p style={{ fontFamily:C.mono, fontSize:10, color:C.textTer,
        letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:16 }}>{title}</p>}
      {children}
    </div>
  );
}

function MetricCard({ label, value, accent, sub }) {
  return (
    <div style={{ padding:20, borderRadius:16, border:`1px solid ${C.border}`,
      background:C.surface, backdropFilter:"blur(10px)" }}>
      <p style={{ fontFamily:C.mono, fontSize:10, color:C.textTer,
        letterSpacing:"0.1em", marginBottom:8 }}>{label.toUpperCase()}</p>
      <p style={{ fontFamily:C.display, fontWeight:700, fontSize:22,
        color:accent||C.textPrim, marginBottom:sub?4:0 }}>{value}</p>
      {sub && <p style={{ fontFamily:C.mono, fontSize:11, color:C.textTer }}>{sub}</p>}
    </div>
  );
}

function PageShell({ eyebrow, title, subtitle, children }) {
  return (
    <motion.section initial={{opacity:0,x:60}} animate={{opacity:1,x:0}}
      exit={{opacity:0,x:-60}} transition={{duration:0.45,ease:[0.16,1,0.3,1]}}
      style={{ minHeight:"100vh", padding:"160px 24px 80px", maxWidth:980, margin:"0 auto" }}>
      <p style={{ fontFamily:C.mono, fontSize:11, letterSpacing:"0.2em",
        color:C.blue, textTransform:"uppercase", marginBottom:16 }}>{eyebrow}</p>
      <h2 style={{ fontFamily:C.display, fontWeight:800,
        fontSize:"clamp(2.2rem,5vw,3.8rem)", lineHeight:1.05,
        marginBottom:subtitle?16:48, color:C.textPrim }}>{title}</h2>
      {subtitle && <p style={{ fontSize:17, color:C.textSec, maxWidth:600,
        lineHeight:1.7, marginBottom:48, fontWeight:300 }}>{subtitle}</p>}
      {children}
    </motion.section>
  );
}

function ErrorBox({ msg }) {
  return (
    <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}}
      style={{ padding:"14px 18px", borderRadius:12, marginBottom:24,
        background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)",
        color:C.red, fontSize:13, fontFamily:C.mono }}>⚠ {msg}</motion.div>
  );
}

function OxideHint({ formula }) {
  if (!formula || !formula.trim()) return null;
  const err = validateOxide(formula);
  if (!err) return null;
  return (
    <motion.p initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}}
      style={{ fontFamily:C.mono, fontSize:11, color:C.amber, marginTop:6 }}>
      ⚠ {err}
    </motion.p>
  );
}

function HistorySidebar({ history, onClear }) {
  if (!history.length) return null;
  return (
    <motion.div initial={{opacity:0,x:20}} animate={{opacity:1,x:0}}
      style={{ position:"fixed", right:20, top:"50%", transform:"translateY(-50%)",
        zIndex:500, width:190, background:"rgba(0,0,0,0.85)",
        backdropFilter:"blur(16px)", border:`1px solid ${C.border}`,
        borderRadius:16, padding:16, maxHeight:"60vh", overflowY:"auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <p style={{ fontFamily:C.mono, fontSize:9, color:C.textTer, letterSpacing:"0.1em" }}>RECENT</p>
        <button onClick={onClear} style={{ background:"none", border:"none",
          color:C.textTer, fontSize:10, cursor:"pointer", fontFamily:C.mono }}>clear</button>
      </div>
      {history.map((h,i) => (
        <div key={i} style={{ padding:"10px 12px", borderRadius:10,
          background:C.surface, border:`1px solid ${C.border}`, marginBottom:8 }}>
          <p style={{ fontFamily:C.mono, fontSize:12, color:C.textPrim, marginBottom:3 }}>{h.formula}</p>
          <p style={{ fontFamily:C.mono, fontSize:10, color:C.blue }}>{h.bandgap} eV</p>
          <p style={{ fontFamily:C.mono, fontSize:9, color:C.textTer }}>{h.material_type}</p>
        </div>
      ))}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   SHAP TABLE
═══════════════════════════════════════════════════ */
function ShapTable({ data }) {
  const [sortMode, setSortMode] = useState("abs");
  const features = data || [];
  const maxAbs = Math.max(...features.map(f => Math.abs(f.value)), 0.0001);

  const sorted = [...features].sort((a, b) => {
    if (sortMode === "abs")  return Math.abs(b.value) - Math.abs(a.value);
    if (sortMode === "val")  return b.value - a.value;
    if (sortMode === "name") return a.name.localeCompare(b.name);
    return 0;
  });

  const col = v => v >= 0 ? "#185FA5" : "#A32D2D";

  return (
    <div>
      <div style={{ display:"flex", gap:6, marginBottom:14 }}>
        {[["abs","By impact"],["val","By value"],["name","By name"]].map(([m,l]) => (
          <button key={m} onClick={() => setSortMode(m)}
            style={{ padding:"5px 12px", borderRadius:6, fontSize:12, cursor:"pointer",
              fontFamily:C.mono, border:`1px solid ${sortMode===m ? "rgba(255,255,255,0.3)" : C.border}`,
              background: sortMode===m ? "rgba(255,255,255,0.08)" : "transparent",
              color: sortMode===m ? C.textPrim : C.textSec }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ display:"flex", gap:16, marginBottom:12 }}>
        <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:C.textSec, fontFamily:C.mono }}>
          <span style={{ display:"inline-block", width:10, height:10, borderRadius:2, background:"#185FA5" }}/>
          raises band gap
        </span>
        <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:C.textSec, fontFamily:C.mono }}>
          <span style={{ display:"inline-block", width:10, height:10, borderRadius:2, background:"#A32D2D" }}/>
          lowers band gap
        </span>
      </div>

      <div style={{ borderRadius:12, border:`1px solid ${C.border}`, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"24px 1fr 80px 82px 130px 76px",
          padding:"9px 14px", background:"rgba(255,255,255,0.03)",
          borderBottom:`1px solid ${C.border}` }}>
          {["#","Feature","Raw value","SHAP","Impact","Effect"].map(h => (
            <span key={h} style={{ fontFamily:C.mono, fontSize:10, color:C.textTer }}>{h}</span>
          ))}
        </div>

        {sorted.map((f, i) => {
          const pct = Math.abs(f.value) / maxAbs * 100;
          const isPos = f.value >= 0;
          const barColor = col(f.value);
          const rawStr = typeof f.raw === "number" ? f.raw.toFixed(3) : "—";

          return (
            <div key={f.name}
              style={{ display:"grid", gridTemplateColumns:"24px 1fr 80px 82px 130px 76px",
                padding:"11px 14px", alignItems:"center",
                borderBottom: i < sorted.length - 1 ? `1px solid ${C.border}` : "none",
                transition:"background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

              <span style={{ fontFamily:C.mono, fontSize:11, color:C.textTer }}>{i + 1}</span>
              <span style={{ fontFamily:C.mono, fontSize:12, color:C.textPrim, paddingRight:8 }}>{f.name}</span>
              <span style={{ fontFamily:C.mono, fontSize:12, color:C.textSec }}>{rawStr}</span>
              <span style={{ fontFamily:C.mono, fontSize:13, fontWeight:600, color:barColor }}>
                {f.value >= 0 ? "+" : ""}{f.value.toFixed(4)}
              </span>

              <div style={{ position:"relative", height:16, display:"flex", alignItems:"center" }}>
                <div style={{ position:"absolute", left:"50%", top:2, width:"0.5px",
                  height:12, background:"rgba(255,255,255,0.15)" }}/>
                {isPos
                  ? <div style={{ position:"absolute", left:"50%", top:4,
                      width:`${pct / 2}%`, height:8,
                      background:barColor, borderRadius:"0 3px 3px 0", minWidth:2 }}/>
                  : <div style={{ position:"absolute", right:"50%", top:4,
                      width:`${pct / 2}%`, height:8,
                      background:barColor, borderRadius:"3px 0 0 3px", minWidth:2 }}/>
                }
              </div>

              <span style={{ fontFamily:C.mono, fontSize:11, color:barColor, textAlign:"right" }}>
                {isPos ? "▲ raises" : "▼ lowers"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ElementChip({ el }) {
  const color = {"Transition Metal":C.blue,"Metal":C.amber,"Oxygen":C.red,
    "Metalloid":C.green,"Non-metal":C.textSec}[el.category]||C.textSec;
  return (
    <div style={{ padding:"12px 16px", borderRadius:12, border:`1px solid ${C.border}`,
      background:C.surface, minWidth:76, textAlign:"center" }}>
      <div style={{ fontFamily:C.display, fontWeight:800, fontSize:22, color, lineHeight:1 }}>{el.symbol}</div>
      <div style={{ fontFamily:C.mono, fontSize:9, color:C.textTer, marginTop:2 }}>Z={el.number}</div>
      <div style={{ fontFamily:C.mono, fontSize:9, color:C.textSec, marginTop:1 }}>
        ×{el.amount%1===0?el.amount:el.amount.toFixed(1)}</div>
    </div>
  );
}

function SimilarMaterials({ data }) {
  return (
    <GlassCard title="Structurally Similar Materials">
      {data.map((m,i) => (
        <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
          padding:"11px 0", borderBottom:i<data.length-1?`1px solid ${C.border}`:"none" }}>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <span style={{ fontFamily:C.mono, fontSize:11, color:C.textTer }}>#{i+1}</span>
            {m.formula
              ? <span style={{ fontFamily:C.mono, fontSize:13, color:C.textPrim }}>{m.formula}</span>
              : <span style={{ fontSize:13, color:C.textSec }}>{m.is_metallic?"Metal":"Non-metal"}</span>}
          </div>
          <div style={{ display:"flex", gap:18, alignItems:"center" }}>
            <span style={{ fontFamily:C.mono, fontSize:13, color:m.is_metallic?C.amber:C.blue }}>{m.band_gap} eV</span>
            <span style={{ fontFamily:C.mono, fontSize:11, color:C.textTer }}>dist {m.distance}</span>
          </div>
        </div>
      ))}
    </GlassCard>
  );
}

/* ═══════════════════════════════════════════════════
   BAND GAP CARD — shows ML prediction + MP DFT ref
═══════════════════════════════════════════════════ */
function BandGapCard({ result }) {
  const hasMpRef = result.mp_bandgap != null;
  // Warn if ML and MP DFT disagree by more than 1 eV
  const bigDiff = hasMpRef && Math.abs(result.bandgap - result.mp_bandgap) > 1.0;

  return (
    <div style={{ padding:20, borderRadius:16, border:`1px solid ${C.border}`, background:C.surface }}>
      <p style={{ fontFamily:C.mono, fontSize:10, color:C.textTer, letterSpacing:"0.1em", marginBottom:8 }}>
        BAND GAP
      </p>
      <p style={{ fontFamily:C.display, fontWeight:700, fontSize:22, color:C.blue }}>
        {result.bandgap} eV
      </p>

      {/* CI range */}
      {result.ci_low != null && (
        <p style={{ fontFamily:C.mono, fontSize:10, color:C.textTer, marginTop:4 }}>
          80% CI: {result.ci_low}–{result.ci_high} eV
        </p>
      )}

      {/* Material type */}
      <p style={{ fontFamily:C.mono, fontSize:11, color:C.textTer, marginTop:2 }}>
        {result.material_type}
      </p>

      {/* MP DFT reference */}
      {hasMpRef && (
        <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${C.border}` }}>
          <p style={{ fontFamily:C.mono, fontSize:9, color:C.textTer, letterSpacing:"0.08em", marginBottom:4 }}>
            MP DFT REFERENCE (PBE)
          </p>
          <p style={{ fontFamily:C.mono, fontSize:13, color: bigDiff ? C.amber : C.textSec }}>
            {result.mp_bandgap} eV
            {bigDiff && <span style={{ fontSize:10, marginLeft:6 }}>⚠ large gap from ML</span>}
          </p>
          <p style={{ fontFamily:C.mono, fontSize:9, color:C.textTer, marginTop:3 }}>
            PBE underestimates — exp. values are typically higher
          </p>
        </div>
      )}
    </div>
  );
}

function exportPDF(result) {
  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html><html><head>
<meta charset="UTF-8"><title>Quantara Report — ${result.formula}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Outfit',sans-serif;background:#fff;color:#111;padding:48px;max-width:720px;margin:0 auto}
  h1{font-size:2.8rem;font-weight:700;margin-bottom:6px}
  .sub{color:#666;font-size:14px;margin-bottom:36px}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:32px}
  .card{border:1px solid #e5e5e5;border-radius:12px;padding:16px}
  .card-label{font-size:10px;letter-spacing:0.1em;color:#999;text-transform:uppercase;margin-bottom:6px}
  .card-val{font-size:22px;font-weight:700}
  .card-sub{font-size:11px;color:#999;margin-top:4px}
  .card-ref{font-size:11px;color:#666;margin-top:8px;padding-top:8px;border-top:1px solid #eee}
  .section{margin-bottom:28px}
  .section-title{font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#999;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid #eee}
  .insight{display:flex;gap:10px;margin-bottom:10px;font-size:14px;color:#444;line-height:1.6}
  .similar-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px}
  .shap-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
  .shap-name{width:160px;font-size:12px;color:#666}
  .shap-bar-wrap{flex:1;background:#f0f0f0;border-radius:4px;height:8px;overflow:hidden}
  .shap-bar{height:8px;border-radius:4px}
  .shap-val{width:70px;text-align:right;font-size:12px;font-family:monospace}
  .el-chips{display:flex;gap:10px;flex-wrap:wrap}
  .el-chip{border:1px solid #e5e5e5;border-radius:10px;padding:10px 14px;text-align:center;min-width:64px}
  footer{margin-top:48px;font-size:11px;color:#bbb;border-top:1px solid #eee;padding-top:16px}
</style></head><body>
<h1>${result.formula}</h1>
<p class="sub">Quantara Materials Intelligence · ${new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</p>
<div class="grid">
  <div class="card">
    <div class="card-label">Band Gap (ML)</div>
    <div class="card-val" style="color:#0071e3">${result.bandgap} eV</div>
    ${result.ci_low!=null?`<div class="card-sub">80% CI: ${result.ci_low}–${result.ci_high} eV</div>`:""}
    <div class="card-sub">${result.material_type}</div>
    ${result.mp_bandgap!=null?`<div class="card-ref">MP DFT (PBE): ${result.mp_bandgap} eV</div>`:""}
  </div>
  <div class="card"><div class="card-label">Conductivity</div><div class="card-val">${result.is_metallic?"Metallic":"Non-metallic"}</div></div>
  <div class="card"><div class="card-label">Stability</div><div class="card-val">${result.stability}</div>
    ${result.e_above_hull!=null?`<div class="card-sub">${result.e_above_hull} eV/atom</div>`:""}</div>
</div>
${result.insights?.length?`<div class="section"><div class="section-title">AI Insights</div>
  ${result.insights.map(i=>`<div class="insight"><span style="color:#0071e3;margin-right:4px">→</span>${i}</div>`).join("")}</div>`:""}
${result.elements?.length?`<div class="section"><div class="section-title">Elemental Composition</div>
  <div class="el-chips">${result.elements.map(e=>`<div class="el-chip"><div style="font-weight:700;font-size:20px">${e.symbol}</div><div style="font-size:10px;color:#999">Z=${e.number}</div></div>`).join("")}</div></div>`:""}
${result.shap?.length?`<div class="section"><div class="section-title">Feature Impact (SHAP)</div>
  ${result.shap.slice(0,11).map(s=>{const max=Math.max(...result.shap.map(x=>Math.abs(x.value)));const pct=Math.round(Math.abs(s.value)/max*100);const col=s.value>=0?"#185FA5":"#A32D2D";
    return `<div class="shap-row"><div class="shap-name">${s.name}</div><div class="shap-bar-wrap"><div class="shap-bar" style="width:${pct}%;background:${col}"></div></div><div class="shap-val" style="color:${col}">${s.value>=0?"+":""}${s.value.toFixed(4)}</div></div>`;}).join("")}</div>`:""}
${result.similar?.length?`<div class="section"><div class="section-title">Structurally Similar Materials</div>
  ${result.similar.map((m,i)=>`<div class="similar-row"><span>${m.formula||`Neighbour #${i+1}`}</span><span style="color:#0071e3">${m.band_gap} eV</span><span style="color:#999">dist ${m.distance}</span></div>`).join("")}</div>`:""}
<footer>Generated by Quantara v4.0 · ML prediction trained on PBE DFT data · PBE values typically underestimate experimental band gaps by 0.5–1.5 eV · Not a substitute for DFT or experimental measurement</footer>
</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

function ResultPanel({ result }) {
  const stabColor = {Stable:C.green,Metastable:C.amber,Unstable:C.red,Unknown:C.textSec}[result.stability]||C.textSec;
  const typeColor = result.is_metallic?C.amber:result.material_type==="Insulator"?C.textSec:C.blue;
  return (
    <motion.div initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} transition={{duration:0.5,ease:[0.16,1,0.3,1]}}>
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:28,flexWrap:"wrap"}}>
        <h3 style={{fontFamily:C.display,fontWeight:800,fontSize:"clamp(1.8rem,4vw,3rem)",color:C.textPrim}}>{result.formula}</h3>
        {result.source&&<span style={{fontFamily:C.mono,fontSize:10,color:C.blue,background:C.blueSoft,padding:"3px 8px",borderRadius:999}}>{result.source}</span>}
        <button onClick={()=>exportPDF(result)} style={{marginLeft:"auto",padding:"9px 16px",borderRadius:999,
          background:"rgba(255,255,255,0.06)",border:`1px solid ${C.border}`,
          color:C.textSec,fontFamily:C.mono,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>↓ Export PDF</button>
      </div>

      {/* ── Metric cards — BandGapCard replaces inline div ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(165px,1fr))",gap:12,marginBottom:20}}>
        <BandGapCard result={result}/>
        <MetricCard label="Conductivity" value={result.is_metallic?"Metallic":"Non-metallic"} accent={typeColor}/>
        <MetricCard label="Stability" value={result.stability} accent={stabColor}
          sub={result.e_above_hull!=null?`${result.e_above_hull} eV/atom`:""}/>
      </div>

      {/* ── DFT underestimation disclaimer ── */}
      {!result.is_metallic && (
        <div style={{marginBottom:16,padding:"10px 16px",borderRadius:10,
          background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.18)",
          display:"flex",alignItems:"flex-start",gap:10}}>
          <span style={{color:C.amber,fontSize:14,flexShrink:0}}>⚠</span>
          <p style={{fontFamily:C.mono,fontSize:11,color:C.textSec,lineHeight:1.6}}>
            ML prediction trained on PBE DFT data.
            PBE systematically underestimates band gaps — experimental values are typically <strong style={{color:C.textPrim}}>0.5–1.5 eV higher</strong> than reported here.
            {result.mp_bandgap != null && ` MP DFT reference: ${result.mp_bandgap} eV.`}
          </p>
        </div>
      )}

      {/* ── SHAP Table ── */}
      <GlassCard title="Feature Impact (SHAP)" style={{marginBottom:16}}>
        <ShapTable data={result.shap}/>
      </GlassCard>

      {result.elements?.length>0&&<GlassCard title="Elemental Composition" style={{marginBottom:16}}>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{result.elements.map(el=><ElementChip key={el.symbol} el={el}/>)}</div>
      </GlassCard>}
      {result.similar?.length>0&&<div style={{marginBottom:16}}><SimilarMaterials data={result.similar}/></div>}
      {result.insights?.length>0&&<GlassCard title="AI Insights">
        {result.insights.map((ins,i)=>(
          <div key={i} style={{display:"flex",gap:12,marginBottom:i<result.insights.length-1?14:0}}>
            <span style={{color:C.blue,flexShrink:0,marginTop:3}}>→</span>
            <p style={{fontSize:15,color:C.textSec,lineHeight:1.7}}>{ins}</p>
          </div>
        ))}
      </GlassCard>}
    </motion.div>
  );
}

function Home({ setPage }) {
  return (
    <motion.section key="home" initial={{opacity:0}} animate={{opacity:1}}
      exit={{opacity:0,y:-30}} transition={{duration:0.5}}
      style={{minHeight:"100vh",display:"flex",flexDirection:"column",
  alignItems:"center",justifyContent:"center",textAlign:"center",padding:"0 24px",paddingTop:"100px"}}>
      <motion.p initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.1,duration:0.7}}
        style={{fontFamily:C.mono,fontSize:11,letterSpacing:"0.2em",textTransform:"uppercase",color:C.blue,marginBottom:24}}>
        Materials Intelligence Platform</motion.p>
      <motion.h1 initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} transition={{delay:0.2,duration:0.9}}
        style={{fontFamily:C.display,fontWeight:800,fontSize:"clamp(4rem,12vw,9rem)",lineHeight:0.95,
          letterSpacing:"-0.02em",background:"linear-gradient(160deg,#fff 40%,rgba(255,255,255,0.4))",
          WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:32}}>QUANTARA</motion.h1>
      <motion.p initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.35,duration:0.7}}
        style={{fontSize:"clamp(1.1rem,2.5vw,1.35rem)",color:C.textSec,maxWidth:580,lineHeight:1.7,marginBottom:52,fontWeight:400}}>
        Structure-aware AI that predicts band gaps, classifies conductivity,
        and explores hypothetical oxide compositions — in seconds.</motion.p>
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.5,duration:0.7}}
        style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center"}}>
        <PrimaryButton onClick={()=>setPage("analyzer")}>Launch Analyzer</PrimaryButton>
        <GhostButton onClick={()=>setPage("nlquery")}>Try AI Search →</GhostButton>
      </motion.div>
      <motion.div initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} transition={{delay:0.7,duration:0.8}}
        style={{display:"flex",gap:16,marginTop:88,flexWrap:"wrap",justifyContent:"center"}}>
        {[["8,000+","Oxides covered"],["11","Features extracted"],["3","Models compared"],["∞","Compositions explorable"],["AI","Natural language search"]].map(([v,l])=>(
          <div key={l} style={{padding:"14px 22px",borderRadius:12,border:`1px solid ${C.border}`,background:C.surface,backdropFilter:"blur(10px)"}}>
            <div style={{fontFamily:C.display,fontSize:24,fontWeight:700,color:C.textPrim,marginBottom:4}}>{v}</div>
            <div style={{fontSize:13,color:C.textSec,fontWeight:400}}>{l}</div>
          </div>
        ))}
      </motion.div>
    </motion.section>
  );
}

function Analyzer({ history, setHistory }) {
  const [tab,setTab]=useState("formula");
  const [formula,setFormula]=useState("");
  const [cifFile,setCifFile]=useState(null);
  const [result,setResult]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(null);
  const inputRef=useRef(null);
  useEffect(()=>{ if(tab==="formula") inputRef.current?.focus(); },[tab]);

  const analyze=useCallback(async()=>{
    setLoading(true); setError(null); setResult(null);
    try {
      let res;
      if(tab==="formula"){
        const oxErr = validateOxide(formula.trim());
        if (oxErr) { setError(oxErr); setLoading(false); return; }
        res=await fetch(`${API}/predict`,{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({material:formula.trim()})});
      } else {
        const fd=new FormData(); fd.append("file",cifFile);
        res=await fetch(`${API}/predict/cif`,{method:"POST",body:fd});
      }
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"Unknown error");
      setResult(data);
      setHistory(prev=>{
        const entry={formula:data.formula,bandgap:data.bandgap,material_type:data.material_type};
        return [entry,...prev.filter(h=>h.formula!==entry.formula)].slice(0,10);
      });
    } catch(e){ setError(e.message); }
    finally  { setLoading(false); }
  },[tab,formula,cifFile,setHistory]);

  const canSubmit=tab==="formula"?formula.trim().length>0:!!cifFile;
  const inputStyle=(active)=>({flex:1,padding:"16px 20px",borderRadius:14,
    border:`1px solid ${active?C.blue:C.border}`,background:C.surface,color:C.textPrim,
    fontFamily:C.mono,fontSize:16,outline:"none",transition:"border-color 0.2s",backdropFilter:"blur(10px)"});

  return (
    <PageShell eyebrow="Material Analyzer" title="Decode any oxide">
      <div style={{display:"flex",gap:4,marginBottom:32,background:C.surface,borderRadius:12,padding:4,width:"fit-content",border:`1px solid ${C.border}`}}>
        {[["formula","Formula"],["cif","CIF File"]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:"8px 20px",borderRadius:8,border:"none",
            background:tab===t?"rgba(255,255,255,0.08)":"transparent",
            color:tab===t?C.textPrim:C.textSec,fontFamily:C.body,fontWeight:500,fontSize:14,cursor:"pointer"}}>{l}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:8}}>
        {tab==="formula"?(
          <input ref={inputRef} value={formula} onChange={e=>setFormula(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&canSubmit&&analyze()}
            placeholder="e.g. TiO2, Fe2O3, SiO2" style={inputStyle(formula.length>0)}/>
        ):(
          <label style={{...inputStyle(!!cifFile),display:"flex",alignItems:"center",gap:12,cursor:"pointer",borderStyle:"dashed",color:cifFile?C.textPrim:C.textSec}}>
            <input type="file" accept=".cif" style={{display:"none"}} onChange={e=>setCifFile(e.target.files[0])}/>
            {cifFile?`✓  ${cifFile.name}`:"Click to upload a .cif file"}
          </label>
        )}
        <PrimaryButton onClick={analyze} disabled={loading||!canSubmit}>{loading?<Spinner/>:"Analyze"}</PrimaryButton>
      </div>
      {tab==="formula"&&<div style={{marginBottom:24}}><OxideHint formula={formula}/></div>}
      {tab==="formula"&&!result&&!loading&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.2}}>
          <p style={{fontSize:13,color:C.textTer,marginBottom:12}}>Quick examples</p>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {["TiO2","Fe2O3","ZnO","SiO2","Al2O3","MnO2","SnO2"].map(f=>(
              <button key={f} onClick={()=>setFormula(f)} style={{fontFamily:C.mono,fontSize:12,color:C.textSec,
                background:C.surface,border:`1px solid ${C.border}`,padding:"7px 14px",borderRadius:8,cursor:"pointer"}}>{f}</button>
            ))}
          </div>
        </motion.div>
      )}
      <AnimatePresence>
        {error&&<ErrorBox msg={error} key="err"/>}
        {result&&<ResultPanel result={result} key="res"/>}
      </AnimatePresence>
    </PageShell>
  );
}

function NLQuery() {
  const [query,setQuery]=useState("");
  const [result,setResult]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(null);

  const EXAMPLES=[
    "Find stable semiconductors with band gap between 2 and 3 eV",
    "Show me metallic oxides",
    "Wide band gap insulators above 5 eV",
    "Oxides suitable for visible-light photocatalysis",
  ];

  const run=async(q)=>{
    const text=(q||query).trim();
    if(!text) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res=await fetch(`${API}/nlquery`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({query:text}),
      });
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"Query failed");
      setResult(data);
    } catch(e){ setError(e.message); }
    finally  { setLoading(false); }
  };

  const isFallback = result?.mode === "fallback";
  const typeColor=t=>({Metal:C.amber,Semiconductor:C.blue,Insulator:C.textSec}[t]||C.textSec);

  return (
    <PageShell eyebrow="AI Search" title="Describe. Discover."
      subtitle="Describe what you're looking for. The AI interprets your query, filters 8,000+ oxides, and summarises what it found.">
      <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:24}}>
        <textarea value={query} onChange={e=>setQuery(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();run();} }}
          placeholder="e.g. stable semiconductor with band gap around 2.5 eV" rows={2}
          style={{flex:1,padding:"16px 20px",borderRadius:14,
            border:`1px solid ${query?C.blue:C.border}`,background:C.surface,color:C.textPrim,
            fontFamily:C.body,fontSize:15,outline:"none",resize:"none",lineHeight:1.6,backdropFilter:"blur(10px)"}}/>
        <PrimaryButton onClick={()=>run()} disabled={loading||!query.trim()}>{loading?<Spinner/>:"Search"}</PrimaryButton>
      </div>
      {!result&&!loading&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.2}}>
          <p style={{fontSize:13,color:C.textTer,marginBottom:12}}>Try an example</p>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {EXAMPLES.map(ex=>(
              <button key={ex} onClick={()=>{setQuery(ex);run(ex);}}
                style={{padding:"12px 16px",borderRadius:12,textAlign:"left",
                  background:C.surface,border:`1px solid ${C.border}`,
                  color:C.textSec,fontFamily:C.body,fontSize:13,cursor:"pointer"}}>{ex}</button>
            ))}
          </div>
        </motion.div>
      )}
      <AnimatePresence>{error&&<ErrorBox msg={error}/>}</AnimatePresence>
      {result&&(
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.5}}>
          <div style={{padding:24,borderRadius:18,marginBottom:20,
            border:`1px solid ${isFallback?"rgba(245,158,11,0.25)":"rgba(167,139,250,0.25)"}`,
            background:isFallback?"rgba(245,158,11,0.05)":"rgba(167,139,250,0.06)"}}>
            <p style={{fontFamily:C.mono,fontSize:10,
              color:isFallback?C.amber:C.purple,
              letterSpacing:"0.12em",marginBottom:10}}>
              {isFallback?"KEYWORD SEARCH":"AI SUMMARY"} · {result.total_matches} MATCHES
            </p>
            <p style={{fontSize:15,color:C.textSec,lineHeight:1.7}}>{result.summary}</p>
          </div>
          {result.criteria&&(
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
              {(result.criteria.band_gap_min??result.criteria.bandgap_min)!=null&&
                <span style={{fontFamily:C.mono,fontSize:11,color:C.blue,background:C.blueSoft,padding:"5px 10px",borderRadius:8}}>
                  ≥ {result.criteria.band_gap_min??result.criteria.bandgap_min} eV</span>}
              {(result.criteria.band_gap_max??result.criteria.bandgap_max)!=null&&
                <span style={{fontFamily:C.mono,fontSize:11,color:C.blue,background:C.blueSoft,padding:"5px 10px",borderRadius:8}}>
                  ≤ {result.criteria.band_gap_max??result.criteria.bandgap_max} eV</span>}
              {result.criteria.material_type&&
                <span style={{fontFamily:C.mono,fontSize:11,color:C.green,background:"rgba(52,211,153,0.08)",padding:"5px 10px",borderRadius:8}}>
                  {result.criteria.material_type}</span>}
            </div>
          )}
          <div style={{borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden",background:C.surface}}>
            <div style={{display:"grid",gridTemplateColumns:"1.8fr 1fr 1.2fr",padding:"12px 20px",
              borderBottom:`1px solid ${C.border}`,background:"rgba(255,255,255,0.03)"}}>
              {["Formula","Band Gap","Type"].map(h=>(
                <span key={h} style={{fontFamily:C.mono,fontSize:10,color:C.textTer,letterSpacing:"0.08em"}}>{h.toUpperCase()}</span>
              ))}
            </div>
            {result.results.map((r,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"1.8fr 1fr 1.2fr",padding:"13px 20px",
                borderBottom:i<result.results.length-1?`1px solid ${C.border}`:"none"}}>
                <span style={{fontFamily:C.mono,fontSize:13,color:C.textPrim}}>{r.formula||"—"}</span>
                <span style={{fontFamily:C.mono,fontSize:13,color:C.blue}}>{r.bandgap} eV</span>
                <span style={{fontSize:13,color:typeColor(r.material_type)}}>{r.material_type}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </PageShell>
  );
}

function Batch() {
  const [csvFile,setCsvFile]=useState(null);
  const [results,setResults]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(null);

  const run=async()=>{
    setLoading(true); setError(null); setResults(null);
    try {
      const fd=new FormData(); fd.append("file",csvFile);
      const res=await fetch(`${API}/predict/batch`,{method:"POST",body:fd});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"Unknown error");
      setResults(data.results);
    } catch(e){ setError(e.message); }
    finally  { setLoading(false); }
  };

  const downloadCSV=()=>{
    const headers=["formula","bandgap","mp_bandgap","ci_low","ci_high","material_type","stability","e_above_hull","error"];
    const rows=results.map(r=>headers.map(h=>r[h]??"").join(","));
    const blob=new Blob([headers.join(",")+"\n"+rows.join("\n")],{type:"text/csv"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download="quantara_batch.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const typeColor=t=>({Metal:C.amber,Semiconductor:C.blue,Insulator:C.textSec}[t]||C.textSec);
  const stabColor=s=>({Stable:C.green,Metastable:C.amber,Unstable:C.red}[s]||C.textSec);

  return (
    <PageShell eyebrow="Batch Prediction" title="Screen hundreds. Instantly."
      subtitle="Upload a CSV with a formula column. Get band gap, MP DFT reference, confidence interval, material type, and stability for up to 100 oxides.">
      <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:32}}>
        <label style={{flex:1,padding:"16px 20px",borderRadius:14,
          border:`1px dashed ${csvFile?C.blue:C.border}`,background:C.surface,color:csvFile?C.textPrim:C.textSec,
          fontFamily:C.mono,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",gap:12,backdropFilter:"blur(10px)"}}>
          <input type="file" accept=".csv" style={{display:"none"}} onChange={e=>setCsvFile(e.target.files[0])}/>
          {csvFile?`✓  ${csvFile.name}`:"Click to upload a .csv file"}
        </label>
        <PrimaryButton onClick={run} disabled={loading||!csvFile}>{loading?<Spinner/>:"Run Batch"}</PrimaryButton>
        {results&&<GhostButton onClick={downloadCSV}>↓ Export CSV</GhostButton>}
      </div>
      <AnimatePresence>{error&&<ErrorBox msg={error}/>}</AnimatePresence>
      {results&&(
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.5}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <p style={{fontFamily:C.mono,fontSize:11,color:C.textTer}}>{results.length} RESULTS</p>
            <p style={{fontFamily:C.mono,fontSize:11,color:C.green}}>{results.filter(r=>!r.error).length} successful</p>
          </div>
          <div style={{borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden",background:C.surface}}>
            <div style={{display:"grid",gridTemplateColumns:"1.4fr 1.2fr 0.8fr 1fr 1fr 1fr",
              padding:"12px 20px",borderBottom:`1px solid ${C.border}`,background:"rgba(255,255,255,0.03)"}}>
              {["Formula","Band Gap (CI)","MP DFT","Type","Stability","E/atom"].map(h=>(
                <span key={h} style={{fontFamily:C.mono,fontSize:10,color:C.textTer,letterSpacing:"0.08em"}}>{h.toUpperCase()}</span>
              ))}
            </div>
            {results.map((r,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"1.4fr 1.2fr 0.8fr 1fr 1fr 1fr",
                padding:"14px 20px",borderBottom:i<results.length-1?`1px solid ${C.border}`:"none",
                background:r.error?"rgba(239,68,68,0.04)":"transparent"}}>
                <span style={{fontFamily:C.mono,fontSize:13,color:C.textPrim}}>{r.formula}</span>
                {r.error?(
                  <span style={{fontSize:12,color:C.red,gridColumn:"span 5"}}>{r.error}</span>
                ):(
                  <>
                    <div>
                      <span style={{fontFamily:C.mono,fontSize:13,color:C.blue}}>{r.bandgap} eV</span>
                      {r.ci_low!=null&&<p style={{fontFamily:C.mono,fontSize:9,color:C.textTer,marginTop:2}}>{r.ci_low}–{r.ci_high}</p>}
                    </div>
                    <span style={{fontFamily:C.mono,fontSize:12,color:C.textSec}}>
                      {r.mp_bandgap!=null?`${r.mp_bandgap} eV`:"—"}
                    </span>
                    <span style={{fontSize:13,color:typeColor(r.material_type)}}>{r.material_type}</span>
                    <span style={{fontSize:13,color:stabColor(r.stability)}}>{r.stability}</span>
                    <span style={{fontFamily:C.mono,fontSize:12,color:C.textSec}}>{r.e_above_hull!=null?r.e_above_hull:"—"}</span>
                  </>
                )}
              </div>
            ))}
          </div>
          <p style={{fontFamily:C.mono,fontSize:10,color:C.textTer,marginTop:10}}>
            ⚠ Band Gap (ML) is trained on PBE DFT data. Experimental values are typically 0.5–1.5 eV higher. MP DFT column shows the Materials Project PBE reference.
          </p>
        </motion.div>
      )}
    </PageShell>
  );
}

function Compare() {
  const [a,setA]=useState(""); const [b,setB]=useState("");
  const [results,setResults]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(null);

  const run=async()=>{
    const errA = validateOxide(a.trim());
    const errB = validateOxide(b.trim());
    if (errA) { setError(errA); return; }
    if (errB) { setError(errB); return; }
    setLoading(true); setError(null); setResults(null);
    try {
      const res=await fetch(`${API}/compare`,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({material_a:a.trim(),material_b:b.trim()})});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"Unknown error");
      setResults(data);
    } catch(e){ setError(e.message); }
    finally  { setLoading(false); }
  };

  const inputStyle=(val)=>({flex:1,padding:"16px 20px",borderRadius:14,
    border:`1px solid ${val?C.blue:C.border}`,background:C.surface,color:C.textPrim,
    fontFamily:C.mono,fontSize:15,outline:"none",transition:"border-color 0.2s",backdropFilter:"blur(10px)"});

  return (
    <PageShell eyebrow="Material Comparison" title="Head-to-head property analysis"
      subtitle="Side-by-side band gap, stability, confidence intervals, and SHAP feature impact.">
      <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:8,flexWrap:"wrap"}}>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:6}}>
          <input value={a} onChange={e=>setA(e.target.value)} placeholder="Material A — e.g. TiO2" style={inputStyle(a)}/>
          <OxideHint formula={a}/>
        </div>
        <span style={{color:C.textTer,fontFamily:C.display,fontSize:20,flexShrink:0,paddingTop:16}}>vs</span>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:6}}>
          <input value={b} onChange={e=>setB(e.target.value)} placeholder="Material B — e.g. ZnO" style={inputStyle(b)}/>
          <OxideHint formula={b}/>
        </div>
        <div style={{paddingTop:4}}>
          <PrimaryButton onClick={run} disabled={loading||!a.trim()||!b.trim()}>{loading?<Spinner/>:"Compare"}</PrimaryButton>
        </div>
      </div>
      <div style={{marginBottom:32}}/>
      <AnimatePresence>{error&&<ErrorBox msg={error}/>}</AnimatePresence>
      {results&&(
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.5}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
            {[["a","Material A"],["b","Material B"]].map(([key,label])=>{
              const r=results[key];
              const stabColor={Stable:C.green,Metastable:C.amber,Unstable:C.red,Unknown:C.textSec}[r.stability]||C.textSec;
              const typeColor=r.is_metallic?C.amber:r.material_type==="Insulator"?C.textSec:C.blue;
              return (
                <GlassCard key={key} title={label}>
                  <div style={{fontFamily:C.display,fontWeight:800,fontSize:24,color:C.textPrim,marginBottom:18}}>{r.formula}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:11}}>
                    <Row label="Band Gap (ML)" val={`${r.bandgap} eV`} color={C.blue}/>
                    {r.mp_bandgap!=null&&<Row label="MP DFT Ref." val={`${r.mp_bandgap} eV`} color={C.textSec}/>}
                    {r.ci_low!=null&&<Row label="80% CI" val={`${r.ci_low}–${r.ci_high} eV`} color={C.textTer}/>}
                    <Row label="Type" val={r.material_type} color={typeColor}/>
                    <Row label="Stability" val={r.stability} color={stabColor}/>
                    <Row label="E above hull" val={r.e_above_hull!=null?`${r.e_above_hull} eV/atom`:"—"} color={C.textSec}/>
                  </div>
                </GlassCard>
              );
            })}
          </div>

          <div style={{marginBottom:16,padding:"10px 16px",borderRadius:10,
            background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.18)",
            display:"flex",gap:10,alignItems:"flex-start"}}>
            <span style={{color:C.amber,fontSize:14}}>⚠</span>
            <p style={{fontFamily:C.mono,fontSize:11,color:C.textSec,lineHeight:1.6}}>
              Band gap values are ML predictions trained on PBE DFT data and typically underestimate experimental values by 0.5–1.5 eV. Use MP DFT Ref. as a cross-check.
            </p>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            {["a","b"].map(key=>(
              <GlassCard key={key} title={`${results[key].formula} — Feature Impact`}>
                <ShapTable data={results[key].shap}/>
              </GlassCard>
            ))}
          </div>
        </motion.div>
      )}
    </PageShell>
  );
}

function Row({ label, val, color }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <span style={{fontSize:14,color:C.textSec}}>{label}</span>
      <span style={{fontFamily:C.mono,fontSize:14,color}}>{val}</span>
    </div>
  );
}

function Mixer() {
  const [a,setA]=useState(""); const [b,setB]=useState("");
  const [target,setTarget]=useState("");
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(null);

  const run=async()=>{
    const errA = validateOxide(a.trim());
    const errB = validateOxide(b.trim());
    if (errA) { setError(errA); return; }
    if (errB) { setError(errB); return; }
    setLoading(true); setError(null); setData(null);
    try {
      const res=await fetch(`${API}/composition`,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({formula_a:a.trim(),formula_b:b.trim()})});
      const json=await res.json();
      if(!res.ok) throw new Error(json.error||"Unknown error");
      setData(json);
    } catch(e){ setError(e.message); }
    finally  { setLoading(false); }
  };

  const targetVal=parseFloat(target);
  const closestPoint=data&&!isNaN(targetVal)
    ?data.curve.reduce((best,pt)=>Math.abs(pt.bandgap-targetVal)<Math.abs(best.bandgap-targetVal)?pt:best)
    :null;

  const exportCurveCSV=()=>{
    if(!data) return;
    const headers=["pct_a","pct_b","bandgap","ci_low","ci_high","is_metallic","label"];
    const rows=data.curve.map(p=>headers.map(h=>p[h]??"").join(","));
    const blob=new Blob([headers.join(",")+"\n"+rows.join("\n")],{type:"text/csv"});
    const url=URL.createObjectURL(blob);
    const a2=document.createElement("a"); a2.href=url;
    a2.download=`quantara_curve_${data.formula_a}_${data.formula_b}.csv`; a2.click();
    URL.revokeObjectURL(url);
  };

  const CustomDot=(props)=>{
    const {cx,cy,payload}=props;
    if(closestPoint&&payload.pct_a===closestPoint.pct_a)
      return <g><circle cx={cx} cy={cy} r={8} fill={C.green} fillOpacity={0.3}/><circle cx={cx} cy={cy} r={5} fill={C.green}/></g>;
    if(payload.pct_a===100||payload.pct_a===0)
      return <circle cx={cx} cy={cy} r={4} fill={C.blue}/>;
    return <circle cx={cx} cy={cy} r={2} fill={C.blue} fillOpacity={0.8}/>;
  };

  const CIBand=(props)=>{
    const {xAxisMap,yAxisMap}=props;
    if(!data||!xAxisMap||!yAxisMap) return null;
    const xAxis=Object.values(xAxisMap)[0];
    const yAxis=Object.values(yAxisMap)[0];
    if(!xAxis?.scale||!yAxis?.scale) return null;
    const pts=data.curve.filter(d=>d.ci_low!=null&&d.ci_high!=null);
    if(pts.length<2) return null;
    const upper=pts.map((d,i)=>`${i===0?"M":"L"}${xAxis.scale(d.pct_a)},${yAxis.scale(d.ci_high)}`).join(" ");
    const lower=[...pts].reverse().map(d=>`L${xAxis.scale(d.pct_a)},${yAxis.scale(d.ci_low)}`).join(" ");
    return <path d={`${upper} ${lower} Z`} fill={C.blue} fillOpacity={0.10} stroke="none"/>;
  };

  const CurveTooltip=({active,payload})=>{
    if(!active||!payload?.length) return null;
    const d=payload[0]?.payload;
    if(!d) return null;
    return (
      <div style={{background:"#111",border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 16px",minWidth:200}}>
        <p style={{fontFamily:C.mono,fontSize:10,color:C.textTer,marginBottom:6}}>COMPOSITION</p>
        <p style={{fontSize:13,color:C.textSec,marginBottom:10}}>{d.label}</p>
        <p style={{fontFamily:C.display,fontWeight:700,fontSize:20,color:d.is_metallic?C.amber:C.blue}}>{d.bandgap} eV</p>
        {d.ci_low!=null&&<p style={{fontFamily:C.mono,fontSize:10,color:C.textTer,marginTop:4}}>80% CI: {d.ci_low}–{d.ci_high} eV</p>}
        {closestPoint&&d.pct_a===closestPoint.pct_a&&<p style={{fontFamily:C.mono,fontSize:10,color:C.green,marginTop:4}}>← closest to target</p>}
      </div>
    );
  };

  const inputStyle=(val)=>({flex:1,padding:"16px 20px",borderRadius:14,
    border:`1px solid ${val?C.blue:C.border}`,background:C.surface,color:C.textPrim,
    fontFamily:C.mono,fontSize:15,outline:"none",transition:"border-color 0.2s",backdropFilter:"blur(10px)"});

  return (
    <PageShell eyebrow="Composition Explorer" title="Hypothetical alloy screening"
      subtitle="Sweep the full composition axis between two oxides. Shaded band shows the 80% prediction interval. Export as CSV for further analysis.">
      <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:8,flexWrap:"wrap"}}>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:6}}>
          <input value={a} onChange={e=>setA(e.target.value)} placeholder="Oxide A — e.g. TiO2" style={inputStyle(a)}/>
          <OxideHint formula={a}/>
        </div>
        <span style={{color:C.textTer,fontFamily:C.display,fontSize:18,flexShrink:0,paddingTop:16}}>→</span>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:6}}>
          <input value={b} onChange={e=>setB(e.target.value)} placeholder="Oxide B — e.g. VO2" style={inputStyle(b)}/>
          <OxideHint formula={b}/>
        </div>
        <div style={{paddingTop:4}}>
          <PrimaryButton onClick={run} disabled={loading||!a.trim()||!b.trim()}>{loading?<Spinner/>:"Generate Curve"}</PrimaryButton>
        </div>
        {data&&<GhostButton onClick={exportCurveCSV} small>↓ CSV</GhostButton>}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:40,marginTop:16}}>
        <span style={{fontSize:14,color:C.textSec,whiteSpace:"nowrap"}}>Target band gap</span>
        <input value={target} onChange={e=>setTarget(e.target.value)} placeholder="e.g. 2.5"
          style={{width:120,padding:"10px 14px",borderRadius:10,
            border:`1px solid ${target?C.green:C.border}`,
            background:C.surface,color:C.textPrim,fontFamily:C.mono,fontSize:14,outline:"none"}}/>
        <span style={{fontSize:14,color:C.textTer}}>eV</span>
        {data&&!isNaN(targetVal)&&closestPoint&&(
          <span style={{fontFamily:C.mono,fontSize:12,color:C.green,
            background:"rgba(52,211,153,0.08)",border:"1px solid rgba(52,211,153,0.2)",
            padding:"6px 12px",borderRadius:8}}>
            closest: {closestPoint.pct_a}% {data.formula_a} = {closestPoint.bandgap} eV
          </span>
        )}
      </div>
      <AnimatePresence>{error&&<ErrorBox msg={error}/>}</AnimatePresence>
      {data&&(
        <motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:0.6,ease:[0.16,1,0.3,1]}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:12,marginBottom:24}}>
            <MetricCard label={`Pure ${data.formula_a}`} value={`${data.bandgap_a} eV`} accent={C.blue}/>
            <MetricCard label={`Pure ${data.formula_b}`} value={`${data.bandgap_b} eV`} accent={C.blue}/>
            <MetricCard label="Peak band gap" value={`${data.max_bandgap.value} eV`} accent={C.green}
              sub={`${data.max_bandgap.pct_a}% ${data.formula_a}`}/>
            <MetricCard label="Lowest band gap" value={`${data.min_bandgap.value} eV`} accent={C.amber}
              sub={`${data.min_bandgap.pct_a}% ${data.formula_a}`}/>
            <MetricCard label="Bowing" value={`${data.bowing>0?"+":""}${data.bowing} eV`}
              accent={Math.abs(data.bowing)>0.1?C.green:C.textSec}
              sub={Math.abs(data.bowing)>0.1?"non-linear mixing":"near-linear mixing"}/>
          </div>
          <GlassCard title={`Band Gap vs Composition — ${data.formula_a} → ${data.formula_b}`} style={{marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,paddingLeft:50}}>
              <span style={{fontFamily:C.mono,fontSize:11,color:C.blue}}>← 100% {data.formula_a}</span>
              <span style={{fontFamily:C.mono,fontSize:11,color:C.blue}}>100% {data.formula_b} →</span>
            </div>
            <div style={{height:400}}>
              <ResponsiveContainer>
                <LineChart data={data.curve} margin={{top:10,right:20,bottom:30,left:10}}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3"/>
                  <XAxis dataKey="pct_a" type="number" domain={[0,100]}
                    label={{value:`% ${data.formula_a}`,position:"insideBottom",offset:-14,fill:C.textTer,fontSize:12,fontFamily:C.mono}}
                    stroke="rgba(255,255,255,0.15)" tick={{fill:C.textTer,fontSize:10,fontFamily:C.mono}}
                    axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
                  <YAxis label={{value:"Band Gap (eV)",angle:-90,position:"insideLeft",offset:20,fill:C.textTer,fontSize:12,fontFamily:C.mono}}
                    stroke="rgba(255,255,255,0.15)" tick={{fill:C.textTer,fontSize:10,fontFamily:C.mono}}
                    axisLine={false} tickLine={false}/>
                  <Tooltip content={<CurveTooltip/>} cursor={{stroke:"rgba(255,255,255,0.1)",strokeWidth:1}}/>
                  {!isNaN(targetVal)&&targetVal>0&&(
                    <ReferenceLine y={targetVal} stroke={C.green} strokeDasharray="5 5" strokeWidth={1.5}
                      label={{value:`target: ${targetVal} eV`,position:"insideTopRight",fill:C.green,fontSize:11,fontFamily:C.mono}}/>
                  )}
                  <CIBand/>
                  <Line type="monotone" dataKey="bandgap"
                    stroke={C.blue} strokeWidth={3} strokeOpacity={1}
                    dot={<CustomDot/>} activeDot={{r:6,fill:C.blue}}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:20,marginTop:12,
              borderTop:`1px solid ${C.border}`,paddingTop:12,flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:24,height:3,background:C.blue,borderRadius:2}}/>
                <span style={{fontFamily:C.mono,fontSize:10,color:C.textTer}}>Predicted band gap</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:14,height:10,background:C.blue,opacity:0.15,borderRadius:2}}/>
                <span style={{fontFamily:C.mono,fontSize:10,color:C.textTer}}>80% confidence interval</span>
              </div>
              <span style={{fontFamily:C.mono,fontSize:10,color:C.textTer,marginLeft:"auto"}}>⚠ Hypothetical — not synthesised</span>
            </div>
          </GlassCard>
          {closestPoint&&!isNaN(targetVal)&&(
            <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.2}}
              style={{padding:"20px 24px",borderRadius:16,
                border:"1px solid rgba(52,211,153,0.25)",background:"rgba(52,211,153,0.05)"}}>
              <p style={{fontFamily:C.mono,fontSize:10,color:C.green,letterSpacing:"0.12em",marginBottom:10}}>
                OPTIMAL COMPOSITION FOR {targetVal} eV TARGET</p>
              <p style={{fontFamily:C.display,fontWeight:700,fontSize:22,color:C.textPrim,marginBottom:6}}>
                {closestPoint.pct_a}% {data.formula_a} + {closestPoint.pct_b}% {data.formula_b}</p>
              <p style={{fontFamily:C.mono,fontSize:14,color:C.green}}>
                Predicted: {closestPoint.bandgap} eV
                <span style={{color:C.textTer,marginLeft:12}}>({Math.abs(closestPoint.bandgap-targetVal).toFixed(3)} eV from target)</span>
              </p>
            </motion.div>
          )}
        </motion.div>
      )}
    </PageShell>
  );
}

function MaterialsMap() {
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(null);
  const [filter,setFilter]=useState("all");

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try {
        const res=await fetch(`${API}/pca`);
        const json=await res.json();
        if(!res.ok||json.error) throw new Error(json.error||"Failed to load PCA data");
        setData(json);
      } catch(e){ setError(e.message); }
      finally  { setLoading(false); }
    })();
  },[]);

  const MapTooltip=({active,payload})=>{
    if(!active||!payload?.length) return null;
    const d=payload[0].payload;
    return (
      <div style={{background:"#111",border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px"}}>
        {d.formula&&<p style={{fontFamily:C.mono,fontSize:12,color:C.textPrim,marginBottom:4}}>{d.formula}</p>}
        <p style={{fontFamily:C.mono,fontSize:11,color:C.blue}}>{d.bandgap} eV</p>
        <p style={{fontFamily:C.mono,fontSize:10,color:C.textTer}}>{d.material_type}</p>
      </div>
    );
  };

  const filtered=data?.points.filter(p=>filter==="all"||p.material_type===filter)||[];
  const getColor=p=>({Metal:C.amber,Semiconductor:C.blue,Insulator:"rgba(245,245,247,0.45)"}[p.material_type]||C.textSec);

  return (
   <PageShell eyebrow="Materials Map" title="Navigate oxide space"
      subtitle="PCA projection of all 8,000+ oxides onto 2 dimensions. Each point is a material colored by type. Proximity = structural similarity.">
      {loading&&<div style={{display:"flex",justifyContent:"center",paddingTop:60}}><Spinner/></div>}
      <AnimatePresence>{error&&<ErrorBox msg={error}/>}</AnimatePresence>
      {data&&(
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.5}}>
          <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
            {[["all","All"],["Semiconductor","Semiconductors"],["Metal","Metals"],["Insulator","Insulators"]].map(([v,l])=>(
              <button key={v} onClick={()=>setFilter(v)} style={{padding:"8px 16px",borderRadius:999,
                fontFamily:C.body,fontWeight:500,fontSize:13,cursor:"pointer",
                background:filter===v?C.blueSoft:"transparent",color:filter===v?C.blue:C.textSec,
                border:`1px solid ${filter===v?C.blue:C.border}`}}>{l}</button>
            ))}
          </div>
          <div style={{display:"flex",gap:20,marginBottom:16}}>
            {[["Semiconductor",C.blue],["Metal",C.amber],["Insulator","rgba(245,245,247,0.45)"]].map(([t,col])=>(
              <div key={t} style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:col}}/>
                <span style={{fontFamily:C.mono,fontSize:11,color:C.textSec}}>{t}</span>
              </div>
            ))}
          </div>
          <GlassCard title={`Materials Space — PC1 (${(data.variance[0]*100).toFixed(1)}%) vs PC2 (${(data.variance[1]*100).toFixed(1)}%)`}>
            <div style={{height:520}}>
              <ResponsiveContainer>
                <ScatterChart margin={{top:10,right:20,bottom:30,left:10}}>
                  <XAxis type="number" dataKey="x" name="PC1"
                    label={{value:"PC1",position:"insideBottom",offset:-14,fill:C.textTer,fontSize:12,fontFamily:C.mono}}
                    stroke="rgba(255,255,255,0.15)" tick={{fill:C.textTer,fontSize:10,fontFamily:C.mono}}
                    axisLine={false} tickLine={false}/>
                  <YAxis type="number" dataKey="y" name="PC2"
                    label={{value:"PC2",angle:-90,position:"insideLeft",offset:20,fill:C.textTer,fontSize:12,fontFamily:C.mono}}
                    stroke="rgba(255,255,255,0.15)" tick={{fill:C.textTer,fontSize:10,fontFamily:C.mono}}
                    axisLine={false} tickLine={false}/>
                  <ZAxis range={[12,12]}/>
                  <Tooltip content={<MapTooltip/>} cursor={{strokeDasharray:"3 3",stroke:"rgba(255,255,255,0.1)"}}/>
                  <Scatter data={filtered}
                    shape={(props)=>{
                      const {cx,cy,payload}=props;
                      return <circle cx={cx} cy={cy} r={3} fill={getColor(payload)} fillOpacity={0.6}/>;
                    }}/>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <p style={{fontFamily:C.mono,fontSize:10,color:C.textTer,marginTop:12,
              borderTop:`1px solid ${C.border}`,paddingTop:12}}>
              Showing {filtered.length.toLocaleString()} materials · Variance explained: PC1 {(data.variance[0]*100).toFixed(1)}% + PC2 {(data.variance[1]*100).toFixed(1)}%
            </p>
          </GlassCard>
        </motion.div>
      )}
    </PageShell>
  );
}

function ParityPlot() {
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(null);

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try {
        const res=await fetch(`${API}/parity`);
        const json=await res.json();
        if(!res.ok) throw new Error(json.error||"Failed");
        setData(json);
      } catch(e){ setError(e.message); }
      finally  { setLoading(false); }
    })();
  },[]);

  const ParityTooltip=({active,payload})=>{
    if(!active||!payload?.length) return null;
    const d=payload[0].payload;
    return (
      <div style={{background:"#111",border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px"}}>
        <p style={{fontFamily:C.mono,fontSize:11,color:C.textSec}}>Actual: {d.actual} eV</p>
        <p style={{fontFamily:C.mono,fontSize:11,color:C.blue}}>Predicted: {d.predicted} eV</p>
        <p style={{fontFamily:C.mono,fontSize:10,color:C.textTer,marginTop:2}}>Error: {(d.predicted-d.actual).toFixed(3)} eV</p>
      </div>
    );
  };

  return (
    <PageShell eyebrow="Model Performance" title="Ground truth vs prediction"
      subtitle="Actual vs predicted band gap on the held-out test set. Points along the dashed line are perfect predictions.">
      {loading&&<div style={{display:"flex",justifyContent:"center",paddingTop:60}}><Spinner/></div>}
      <AnimatePresence>{error&&<ErrorBox msg={error}/>}</AnimatePresence>
      {data&&(
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.5}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12,marginBottom:24}}>
            <MetricCard label="R² Score" value={data.r2.toFixed(4)} accent={C.green}/>
            <MetricCard label="RMSE" value={`${data.rmse} eV`} accent={C.blue}/>
            <MetricCard label="Test Samples" value={data.n.toLocaleString()} accent={C.textPrim}/>
          </div>
          <GlassCard title="Actual vs Predicted Band Gap">
            <div style={{height:460}}>
              <ResponsiveContainer>
                <ScatterChart margin={{top:10,right:20,bottom:30,left:10}}>
                  <XAxis type="number" dataKey="actual" name="Actual"
                    label={{value:"Actual (eV)",position:"insideBottom",offset:-14,fill:C.textTer,fontSize:12,fontFamily:C.mono}}
                    stroke="rgba(255,255,255,0.15)" tick={{fill:C.textTer,fontSize:10,fontFamily:C.mono}}
                    axisLine={false} tickLine={false}/>
                  <YAxis type="number" dataKey="predicted" name="Predicted"
                    label={{value:"Predicted (eV)",angle:-90,position:"insideLeft",offset:20,fill:C.textTer,fontSize:12,fontFamily:C.mono}}
                    stroke="rgba(255,255,255,0.15)" tick={{fill:C.textTer,fontSize:10,fontFamily:C.mono}}
                    axisLine={false} tickLine={false}/>
                  <Tooltip content={<ParityTooltip/>} cursor={{strokeDasharray:"3 3",stroke:"rgba(255,255,255,0.1)"}}/>
                  <ReferenceLine segment={[{x:0,y:0},{x:12,y:12}]} stroke="rgba(255,255,255,0.2)" strokeDasharray="5 5"/>
                  <Scatter data={data.points} fill={C.blue} fillOpacity={0.45} r={2.5}/>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </motion.div>
      )}
    </PageShell>
  );
}

export default function App() {
  const [page,setPage]=useState("home");
  const [history,setHistory]=useState([]);
  return (
    <div style={{background:C.bg,minHeight:"100vh",position:"relative"}}>
      <MeshBg/>
      <Navbar page={page} setPage={setPage}/>
      {page==="analyzer"&&history.length>0&&(
        <HistorySidebar history={history} onClear={()=>setHistory([])}/>
      )}
      <div style={{position:"relative",zIndex:1}}>
        <AnimatePresence mode="wait">
          {page==="home"     &&<Home        key="home"     setPage={setPage}/>}
          {page==="analyzer" &&<Analyzer    key="analyzer" history={history} setHistory={setHistory}/>}
          {page==="nlquery"  &&<NLQuery     key="nlquery"/>}
          {page==="batch"    &&<Batch       key="batch"/>}
          {page==="compare"  &&<Compare     key="compare"/>}
          {page==="mixer"    &&<Mixer       key="mixer"/>}
          {page==="map"      &&<MaterialsMap key="map"/>}
          {page==="parity"   &&<ParityPlot  key="parity"/>}
        </AnimatePresence>
      </div>
    </div>
  );
}