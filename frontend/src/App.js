import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, ScatterChart, Scatter, Line, LineChart,
} from "recharts";

const API = "http://127.0.0.1:5001";

/* ═══════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════ */
const C = {
  bg:       "#000000",
  surface:  "rgba(255,255,255,0.04)",
  border:   "rgba(255,255,255,0.08)",
  blue:     "#0071e3",
  blueGlow: "rgba(0,113,227,0.25)",
  blueSoft: "rgba(0,113,227,0.12)",
  green:    "#34d399",
  amber:    "#f59e0b",
  red:      "#ef4444",
  textPrim: "#f5f5f7",
  textSec:  "rgba(245,245,247,0.55)",
  textTer:  "rgba(245,245,247,0.30)",
  mono:     "'JetBrains Mono', monospace",
  display:  "'Syne', sans-serif",
  body:     "'Outfit', sans-serif",
};

/* ═══════════════════════════════════════════════════
   MESH BACKGROUND
═══════════════════════════════════════════════════ */
function MeshBg() {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:"-20%", left:"-10%", width:"60vw", height:"60vw", borderRadius:"50%",
        background:"radial-gradient(circle, rgba(0,113,227,0.08) 0%, transparent 70%)" }} />
      <div style={{ position:"absolute", bottom:"-20%", right:"-10%", width:"50vw", height:"50vw", borderRadius:"50%",
        background:"radial-gradient(circle, rgba(52,211,153,0.05) 0%, transparent 70%)" }} />
      <div style={{ position:"absolute", inset:0,
        backgroundImage:"radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
        backgroundSize:"40px 40px" }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   NAVBAR
═══════════════════════════════════════════════════ */
const NAV_ITEMS = [
  { id:"home",     label:"Home" },
  { id:"analyzer", label:"Analyzer" },
  { id:"batch",    label:"Batch" },
  { id:"compare",  label:"Compare" },
  { id:"parity",   label:"Parity Plot" },
];

function Navbar({ page, setPage }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <motion.nav
      initial={{ y:-60, opacity:0 }}
      animate={{ y:0, opacity:1 }}
      transition={{ duration:0.6, ease:[0.16,1,0.3,1] }}
      style={{
        position:"fixed", top:16, left:"50%", transform:"translateX(-50%)",
        zIndex:1000, display:"flex", alignItems:"center", gap:4,
        background: scrolled ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.4)",
        backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
        border:`1px solid ${C.border}`, borderRadius:999, padding:"8px 16px",
        transition:"background 0.3s",
      }}
    >
      <span onClick={() => setPage("home")} style={{
        fontFamily:C.display, fontWeight:800, fontSize:15,
        letterSpacing:"0.12em", color:C.textPrim, cursor:"pointer", marginRight:16,
      }}>Q</span>
      {NAV_ITEMS.map(({ id, label }) => (
        <button key={id} onClick={() => setPage(id)} style={{
          background: page===id ? C.blueSoft : "transparent",
          border:"none", color: page===id ? C.blue : C.textSec,
          fontFamily:C.body, fontWeight:500, fontSize:13,
          padding:"6px 12px", borderRadius:999, cursor:"pointer", transition:"all 0.2s",
        }}>{label}</button>
      ))}
    </motion.nav>
  );
}

/* ═══════════════════════════════════════════════════
   SHARED UI ATOMS
═══════════════════════════════════════════════════ */
function PrimaryButton({ children, onClick, disabled, small }) {
  return (
    <motion.button
      whileHover={!disabled ? { scale:1.03 } : {}}
      whileTap={!disabled ? { scale:0.97 } : {}}
      onClick={onClick} disabled={disabled}
      style={{
        padding: small ? "10px 18px" : "14px 26px", borderRadius:999,
        background: disabled ? "rgba(0,113,227,0.35)" : C.blue,
        border:"none", color:"#fff", fontFamily:C.body, fontWeight:600,
        fontSize: small ? 13 : 14, cursor: disabled ? "not-allowed" : "pointer",
        display:"flex", alignItems:"center", gap:8, whiteSpace:"nowrap",
        boxShadow: disabled ? "none" : `0 0 24px ${C.blueGlow}`,
        transition:"background 0.2s, box-shadow 0.2s",
      }}>{children}</motion.button>
  );
}

function GhostButton({ children, onClick, small }) {
  return (
    <motion.button whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }} onClick={onClick}
      style={{
        padding: small ? "10px 18px" : "14px 26px", borderRadius:999,
        background:"transparent", border:`1px solid ${C.border}`,
        color:C.textSec, fontFamily:C.body, fontWeight:500,
        fontSize: small ? 13 : 14, cursor:"pointer", whiteSpace:"nowrap",
      }}>{children}</motion.button>
  );
}

function Spinner() {
  return (
    <motion.div animate={{ rotate:360 }} transition={{ duration:0.8, repeat:Infinity, ease:"linear" }}
      style={{ width:14, height:14, border:"2px solid rgba(255,255,255,0.3)",
        borderTopColor:"#fff", borderRadius:"50%" }} />
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
    <div style={{ padding:"20px", borderRadius:16, border:`1px solid ${C.border}`,
      background:C.surface, backdropFilter:"blur(10px)" }}>
      <p style={{ fontFamily:C.mono, fontSize:10, color:C.textTer,
        letterSpacing:"0.1em", marginBottom:8 }}>{label.toUpperCase()}</p>
      <p style={{ fontFamily:C.display, fontWeight:700, fontSize:20,
        color: accent||C.textPrim, marginBottom: sub?4:0 }}>{value}</p>
      {sub && <p style={{ fontFamily:C.mono, fontSize:10, color:C.textTer }}>{sub}</p>}
    </div>
  );
}

function PageShell({ eyebrow, title, children }) {
  return (
    <motion.section
      initial={{ opacity:0, x:60 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-60 }}
      transition={{ duration:0.45, ease:[0.16,1,0.3,1] }}
      style={{ minHeight:"100vh", padding:"120px 24px 80px", maxWidth:920, margin:"0 auto" }}
    >
      <p style={{ fontFamily:C.mono, fontSize:11, letterSpacing:"0.2em", color:C.blue,
        textTransform:"uppercase", marginBottom:16 }}>{eyebrow}</p>
      <h2 style={{ fontFamily:C.display, fontWeight:800,
        fontSize:"clamp(2rem,5vw,3.5rem)", lineHeight:1.05,
        marginBottom:48, color:C.textPrim }}>{title}</h2>
      {children}
    </motion.section>
  );
}

function ErrorBox({ msg }) {
  return (
    <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }}
      style={{ padding:"14px 18px", borderRadius:12, marginBottom:24,
        background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)",
        color:C.red, fontSize:13, fontFamily:C.mono }}>
      ⚠ {msg}
    </motion.div>
  );
}

function EyebrowLabel({ text }) {
  return <p style={{ fontFamily:C.mono, fontSize:10, color:C.textTer,
    letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:16 }}>{text}</p>;
}

/* ═══════════════════════════════════════════════════
   SHAP CHART (shared)
═══════════════════════════════════════════════════ */
const ShapTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background:"#111", border:`1px solid ${C.border}`,
      borderRadius:8, padding:"10px 14px" }}>
      <p style={{ fontFamily:C.mono, fontSize:11, color:C.textSec, marginBottom:4 }}>{d.name}</p>
      <p style={{ fontFamily:C.mono, fontSize:14, color: d.value>=0 ? C.blue : C.red }}>
        {d.value>=0?"+":""}{d.value.toFixed(4)}
      </p>
    </div>
  );
};

function ShapChart({ data, height=240 }) {
  const top = (data||[]).slice(0,8);
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={top} layout="vertical" margin={{ left:0, right:20 }}>
          <XAxis type="number" stroke="rgba(255,255,255,0.15)"
            tick={{ fill:C.textTer, fontSize:10, fontFamily:C.mono }} axisLine={false} tickLine={false}/>
          <YAxis type="category" dataKey="name" width={130}
            stroke="rgba(255,255,255,0.15)"
            tick={{ fill:C.textSec, fontSize:11, fontFamily:C.mono }} axisLine={false} tickLine={false}/>
          <Tooltip content={<ShapTooltip/>} cursor={{ fill:"rgba(255,255,255,0.03)" }}/>
          <ReferenceLine x={0} stroke="rgba(255,255,255,0.15)" strokeWidth={1}/>
          <Bar dataKey="value" radius={[0,4,4,0]}>
            {top.map((e,i) => <Cell key={i} fill={e.value>=0 ? C.blue : C.red}/>)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ELEMENT CHIPS + SIMILAR + INSIGHTS (shared)
═══════════════════════════════════════════════════ */
function ElementChip({ el }) {
  const color = { "Transition Metal":C.blue, "Metal":C.amber, "Oxygen":C.red,
    "Metalloid":C.green, "Non-metal":C.textSec }[el.category]||C.textSec;
  return (
    <div style={{ padding:"12px 16px", borderRadius:12, border:`1px solid ${C.border}`,
      background:C.surface, minWidth:72, textAlign:"center" }}>
      <div style={{ fontFamily:C.display, fontWeight:800, fontSize:20, color, lineHeight:1 }}>{el.symbol}</div>
      <div style={{ fontFamily:C.mono, fontSize:9, color:C.textTer, marginTop:2 }}>Z={el.number}</div>
      <div style={{ fontFamily:C.mono, fontSize:9, color:C.textSec, marginTop:1 }}>
        ×{el.amount%1===0?el.amount:el.amount.toFixed(1)}
      </div>
    </div>
  );
}

function SimilarMaterials({ data }) {
  return (
    <GlassCard title="Structurally Similar Materials">
      {data.map((m, i) => (
        <div key={i} style={{ display:"flex", justifyContent:"space-between",
          alignItems:"center", padding:"10px 0",
          borderBottom: i<data.length-1 ? `1px solid ${C.border}` : "none" }}>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <span style={{ fontFamily:C.mono, fontSize:11, color:C.textTer }}>#{i+1}</span>
            <span style={{ fontSize:13, color:C.textSec }}>
              {m.is_metallic ? "Metal" : "Non-metal"}
            </span>
          </div>
          <div style={{ display:"flex", gap:16, alignItems:"center" }}>
            <span style={{ fontFamily:C.mono, fontSize:12,
              color: m.is_metallic ? C.amber : C.blue }}>
              {m.band_gap} eV
            </span>
            <span style={{ fontFamily:C.mono, fontSize:10, color:C.textTer }}>
              dist {m.distance}
            </span>
          </div>
        </div>
      ))}
    </GlassCard>
  );
}

function ResultPanel({ result }) {
  const stabilityColor = { Stable:C.green, Metastable:C.amber,
    Unstable:C.red, Unknown:C.textSec }[result.stability]||C.textSec;
  const typeColor = result.is_metallic ? C.amber :
    result.material_type==="Insulator" ? C.textSec : C.blue;

  return (
    <motion.div initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }}
      transition={{ duration:0.5, ease:[0.16,1,0.3,1] }}>
      <div style={{ display:"flex", alignItems:"baseline", gap:12, marginBottom:24 }}>
        <h3 style={{ fontFamily:C.display, fontWeight:800,
          fontSize:"clamp(1.5rem,3vw,2.5rem)", color:C.textPrim }}>{result.formula}</h3>
        {result.source && (
          <span style={{ fontFamily:C.mono, fontSize:10, color:C.blue,
            background:C.blueSoft, padding:"3px 8px", borderRadius:999 }}>
            {result.source}
          </span>
        )}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",
        gap:12, marginBottom:16 }}>
        <MetricCard label="Band Gap" value={`${result.bandgap} eV`} accent={C.blue} sub={result.material_type}/>
        <MetricCard label="Conductivity" value={result.is_metallic?"Metallic":"Non-metallic"} accent={typeColor}/>
        <MetricCard label="Stability" value={result.stability} accent={stabilityColor}
          sub={result.e_above_hull!=null?`${result.e_above_hull} eV/atom`:""}/>
      </div>

      <GlassCard title="Feature Impact (SHAP)" style={{ marginBottom:16 }}>
        <ShapChart data={result.shap}/>
      </GlassCard>

      {result.elements?.length>0 && (
        <GlassCard title="Elemental Composition" style={{ marginBottom:16 }}>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            {result.elements.map(el => <ElementChip key={el.symbol} el={el}/>)}
          </div>
        </GlassCard>
      )}

      {result.similar?.length>0 && (
        <div style={{ marginBottom:16 }}>
          <SimilarMaterials data={result.similar}/>
        </div>
      )}

      {result.insights?.length>0 && (
        <GlassCard title="AI Insights">
          {result.insights.map((ins,i) => (
            <div key={i} style={{ display:"flex", gap:10,
              marginBottom:i<result.insights.length-1?12:0 }}>
              <span style={{ color:C.blue, flexShrink:0, marginTop:2 }}>→</span>
              <p style={{ fontSize:14, color:C.textSec, lineHeight:1.65 }}>{ins}</p>
            </div>
          ))}
        </GlassCard>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   HOME PAGE
═══════════════════════════════════════════════════ */
function Home({ setPage }) {
  return (
    <motion.section key="home" initial={{ opacity:0 }} animate={{ opacity:1 }}
      exit={{ opacity:0, y:-30 }} transition={{ duration:0.5 }}
      style={{ minHeight:"100vh", display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center", textAlign:"center", padding:"0 24px" }}>
      <motion.p initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
        transition={{ delay:0.1, duration:0.7 }}
        style={{ fontFamily:C.mono, fontSize:11, letterSpacing:"0.2em",
          textTransform:"uppercase", color:C.blue, marginBottom:24 }}>
        Materials Intelligence Platform
      </motion.p>
      <motion.h1 initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }}
        transition={{ delay:0.2, duration:0.9 }}
        style={{ fontFamily:C.display, fontWeight:800,
          fontSize:"clamp(4rem,12vw,9rem)", lineHeight:0.95, letterSpacing:"-0.02em",
          background:"linear-gradient(160deg,#fff 40%,rgba(255,255,255,0.4))",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginBottom:28 }}>
        QUANTARA
      </motion.h1>
      <motion.p initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
        transition={{ delay:0.35, duration:0.7 }}
        style={{ fontSize:"clamp(1rem,2.5vw,1.25rem)", color:C.textSec,
          maxWidth:560, lineHeight:1.6, marginBottom:48, fontWeight:300 }}>
        Structure-aware AI that predicts band gaps, classifies conductivity,
        and explains every decision — in seconds.
      </motion.p>
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
        transition={{ delay:0.5, duration:0.7 }}
        style={{ display:"flex", gap:12, flexWrap:"wrap", justifyContent:"center" }}>
        <PrimaryButton onClick={() => setPage("analyzer")}>Launch Analyzer</PrimaryButton>
        <GhostButton onClick={() => setPage("batch")}>Batch Predict →</GhostButton>
      </motion.div>
      <motion.div initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }}
        transition={{ delay:0.7, duration:0.8 }}
        style={{ display:"flex", gap:16, marginTop:80, flexWrap:"wrap", justifyContent:"center" }}>
        {[["8,000+","Oxides covered"],["11","Features extracted"],["5","Models compared"],["100%","SHAP explained"]].map(([v,l]) => (
          <div key={l} style={{ padding:"12px 20px", borderRadius:12,
            border:`1px solid ${C.border}`, background:C.surface, backdropFilter:"blur(10px)" }}>
            <div style={{ fontFamily:C.display, fontSize:22, fontWeight:700,
              color:C.textPrim, marginBottom:2 }}>{v}</div>
            <div style={{ fontSize:11, color:C.textSec }}>{l}</div>
          </div>
        ))}
      </motion.div>
    </motion.section>
  );
}

/* ═══════════════════════════════════════════════════
   ANALYZER PAGE (formula + CIF tabs)
═══════════════════════════════════════════════════ */
function Analyzer() {
  const [tab,      setTab]      = useState("formula");
  const [formula,  setFormula]  = useState("");
  const [cifFile,  setCifFile]  = useState(null);
  const [result,   setResult]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const inputRef = useRef(null);

  useEffect(() => { if (tab==="formula") inputRef.current?.focus(); }, [tab]);

  const analyze = useCallback(async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      let res;
      if (tab==="formula") {
        res = await fetch(`${API}/predict`, {
          method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({ material: formula.trim() }),
        });
      } else {
        const fd = new FormData();
        fd.append("file", cifFile);
        res = await fetch(`${API}/predict/cif`, { method:"POST", body:fd });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error||"Unknown error");
      setResult(data);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [tab, formula, cifFile]);

  const canSubmit = tab==="formula" ? formula.trim().length>0 : !!cifFile;

  return (
    <PageShell eyebrow="Material Analyzer" title="Enter a formula.">
      {/* Tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:32,
        background:C.surface, borderRadius:12, padding:4, width:"fit-content",
        border:`1px solid ${C.border}` }}>
        {["formula","cif"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:"8px 20px", borderRadius:8, border:"none",
            background: tab===t ? "rgba(255,255,255,0.08)" : "transparent",
            color: tab===t ? C.textPrim : C.textSec,
            fontFamily:C.body, fontWeight:500, fontSize:13, cursor:"pointer",
            transition:"all 0.2s",
          }}>{t==="formula" ? "Formula" : "CIF File"}</button>
        ))}
      </div>

      {/* Input row */}
      <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:32 }}>
        {tab==="formula" ? (
          <input ref={inputRef} value={formula}
            onChange={e => setFormula(e.target.value)}
            onKeyDown={e => e.key==="Enter" && canSubmit && analyze()}
            placeholder="e.g. TiO2, Fe2O3, ZnO"
            style={{ flex:1, padding:"16px 20px", borderRadius:14,
              border:`1px solid ${formula ? C.blue : C.border}`,
              background:C.surface, color:C.textPrim, fontFamily:C.mono,
              fontSize:16, outline:"none", transition:"border-color 0.2s",
              backdropFilter:"blur(10px)" }}/>
        ) : (
          <label style={{ flex:1, padding:"16px 20px", borderRadius:14,
            border:`1px dashed ${cifFile ? C.blue : C.border}`,
            background:C.surface, color: cifFile ? C.textPrim : C.textSec,
            fontFamily:C.mono, fontSize:14, cursor:"pointer",
            display:"flex", alignItems:"center", gap:12, backdropFilter:"blur(10px)" }}>
            <input type="file" accept=".cif" style={{ display:"none" }}
              onChange={e => setCifFile(e.target.files[0])}/>
            {cifFile ? `✓ ${cifFile.name}` : "Click to upload a .cif file"}
          </label>
        )}
        <PrimaryButton onClick={analyze} disabled={loading||!canSubmit}>
          {loading ? <Spinner/> : "Analyze"}
        </PrimaryButton>
      </div>

      {/* Quick examples (formula tab only) */}
      {tab==="formula" && !result && !loading && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.2 }}>
          <p style={{ fontSize:12, color:C.textTer, marginBottom:10 }}>Quick examples</p>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {["TiO2","Fe2O3","ZnO","Al2O3","MnO2"].map(f => (
              <button key={f} onClick={() => setFormula(f)} style={{
                fontFamily:C.mono, fontSize:12, color:C.textSec,
                background:C.surface, border:`1px solid ${C.border}`,
                padding:"6px 12px", borderRadius:8, cursor:"pointer" }}>{f}</button>
            ))}
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {error && <ErrorBox msg={error}/>}
        {result && <ResultPanel result={result} key="result"/>}
      </AnimatePresence>
    </PageShell>
  );
}

/* ═══════════════════════════════════════════════════
   BATCH PAGE
═══════════════════════════════════════════════════ */
function Batch() {
  const [csvFile,  setCsvFile]  = useState(null);
  const [results,  setResults]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [progress, setProgress] = useState(0);

  const run = async () => {
    setLoading(true); setError(null); setResults(null); setProgress(0);
    try {
      const fd = new FormData();
      fd.append("file", csvFile);
      const res  = await fetch(`${API}/predict/batch`, { method:"POST", body:fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error||"Unknown error");
      setResults(data.results);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const downloadCSV = () => {
    if (!results) return;
    const headers = ["formula","bandgap","material_type","stability","e_above_hull","error"];
    const rows = results.map(r => headers.map(h => r[h]??"").join(","));
    const blob = new Blob([headers.join(",")+"\n"+rows.join("\n")], { type:"text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "quantara_batch.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const typeColor = t => ({ Metal:C.amber, Semiconductor:C.blue, Insulator:C.textSec }[t]||C.textSec);
  const stabColor = s => ({ Stable:C.green, Metastable:C.amber, Unstable:C.red, Unknown:C.textSec }[s]||C.textSec);

  return (
    <PageShell eyebrow="Batch Prediction" title="Predict at scale.">
      <p style={{ color:C.textSec, fontSize:15, marginBottom:36, maxWidth:560, lineHeight:1.65, marginTop:-24 }}>
        Upload a CSV with a <span style={{ fontFamily:C.mono, color:C.blue }}>formula</span> column.
        Get band gap, type, and stability for up to 100 materials at once.
      </p>

      <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:32 }}>
        <label style={{ flex:1, padding:"16px 20px", borderRadius:14,
          border:`1px dashed ${csvFile ? C.blue : C.border}`,
          background:C.surface, color: csvFile ? C.textPrim : C.textSec,
          fontFamily:C.mono, fontSize:14, cursor:"pointer",
          display:"flex", alignItems:"center", gap:12, backdropFilter:"blur(10px)" }}>
          <input type="file" accept=".csv" style={{ display:"none" }}
            onChange={e => setCsvFile(e.target.files[0])}/>
          {csvFile ? `✓ ${csvFile.name}` : "Click to upload a .csv file"}
        </label>
        <PrimaryButton onClick={run} disabled={loading||!csvFile}>
          {loading ? <Spinner/> : "Run Batch"}
        </PrimaryButton>
        {results && (
          <GhostButton onClick={downloadCSV}>↓ Export CSV</GhostButton>
        )}
      </div>

      <AnimatePresence>
        {error && <ErrorBox msg={error}/>}
      </AnimatePresence>

      {results && (
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
          transition={{ duration:0.5 }}>
          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"center", marginBottom:12 }}>
            <p style={{ fontFamily:C.mono, fontSize:11, color:C.textTer }}>
              {results.length} RESULTS
            </p>
            <p style={{ fontFamily:C.mono, fontSize:11, color:C.green }}>
              {results.filter(r=>!r.error).length} successful
            </p>
          </div>
          <div style={{ borderRadius:16, border:`1px solid ${C.border}`,
            overflow:"hidden", background:C.surface }}>
            {/* Header */}
            <div style={{ display:"grid",
              gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr",
              padding:"12px 20px", borderBottom:`1px solid ${C.border}`,
              background:"rgba(255,255,255,0.03)" }}>
              {["Formula","Band Gap","Type","Stability","E above hull"].map(h => (
                <span key={h} style={{ fontFamily:C.mono, fontSize:10,
                  color:C.textTer, letterSpacing:"0.08em" }}>{h.toUpperCase()}</span>
              ))}
            </div>
            {/* Rows */}
            {results.map((r, i) => (
              <div key={i} style={{ display:"grid",
                gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr",
                padding:"14px 20px",
                borderBottom: i<results.length-1 ? `1px solid ${C.border}` : "none",
                background: r.error ? "rgba(239,68,68,0.04)" : "transparent" }}>
                <span style={{ fontFamily:C.mono, fontSize:13, color:C.textPrim }}>{r.formula}</span>
                {r.error ? (
                  <span style={{ fontSize:12, color:C.red, gridColumn:"span 4" }}>
                    {r.error}
                  </span>
                ) : (
                  <>
                    <span style={{ fontFamily:C.mono, fontSize:13, color:C.blue }}>{r.bandgap} eV</span>
                    <span style={{ fontSize:13, color:typeColor(r.material_type) }}>{r.material_type}</span>
                    <span style={{ fontSize:13, color:stabColor(r.stability) }}>{r.stability}</span>
                    <span style={{ fontFamily:C.mono, fontSize:12, color:C.textSec }}>
                      {r.e_above_hull!=null ? `${r.e_above_hull}` : "—"}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </PageShell>
  );
}

/* ═══════════════════════════════════════════════════
   COMPARE PAGE
═══════════════════════════════════════════════════ */
function Compare() {
  const [a,       setA]       = useState("");
  const [b,       setB]       = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const run = async () => {
    setLoading(true); setError(null); setResults(null);
    try {
      const res  = await fetch(`${API}/compare`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ material_a:a.trim(), material_b:b.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error||"Unknown error");
      setResults(data);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const inputStyle = (val) => ({
    flex:1, padding:"16px 20px", borderRadius:14,
    border:`1px solid ${val ? C.blue : C.border}`,
    background:C.surface, color:C.textPrim, fontFamily:C.mono,
    fontSize:15, outline:"none", transition:"border-color 0.2s",
    backdropFilter:"blur(10px)",
  });

  return (
    <PageShell eyebrow="Material Comparison" title="Compare two materials.">
      <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:40,
        flexWrap:"wrap" }}>
        <input value={a} onChange={e=>setA(e.target.value)}
          placeholder="Material A — e.g. TiO2" style={inputStyle(a)}/>
        <span style={{ color:C.textTer, fontFamily:C.display, fontSize:20 }}>vs</span>
        <input value={b} onChange={e=>setB(e.target.value)}
          placeholder="Material B — e.g. ZnO" style={inputStyle(b)}/>
        <PrimaryButton onClick={run} disabled={loading||!a.trim()||!b.trim()}>
          {loading ? <Spinner/> : "Compare"}
        </PrimaryButton>
      </div>

      <AnimatePresence>{error && <ErrorBox msg={error}/>}</AnimatePresence>

      {results && (
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
          transition={{ duration:0.5 }}>
          {/* Side-by-side metrics */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:24 }}>
            {[["a","Material A"],["b","Material B"]].map(([key,label]) => {
              const r = results[key];
              const stabColor = { Stable:C.green, Metastable:C.amber,
                Unstable:C.red, Unknown:C.textSec }[r.stability]||C.textSec;
              return (
                <GlassCard key={key} title={label}>
                  <div style={{ fontFamily:C.display, fontWeight:800, fontSize:22,
                    color:C.textPrim, marginBottom:16 }}>{r.formula}</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    <Row label="Band Gap" val={`${r.bandgap} eV`} color={C.blue}/>
                    <Row label="Type" val={r.material_type}
                      color={r.is_metallic?C.amber:C.blue}/>
                    <Row label="Stability" val={r.stability} color={stabColor}/>
                    <Row label="E above hull"
                      val={r.e_above_hull!=null?`${r.e_above_hull} eV/atom`:"—"}
                      color={C.textSec}/>
                  </div>
                </GlassCard>
              );
            })}
          </div>

          {/* Side-by-side SHAP */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            {["a","b"].map(key => (
              <GlassCard key={key}
                title={`${results[key].formula} — Feature Impact`}>
                <ShapChart data={results[key].shap} height={220}/>
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
    <div style={{ display:"flex", justifyContent:"space-between" }}>
      <span style={{ fontSize:13, color:C.textSec }}>{label}</span>
      <span style={{ fontFamily:C.mono, fontSize:13, color }}>{val}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PARITY PLOT PAGE
═══════════════════════════════════════════════════ */
function ParityPlot() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`${API}/parity`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error||"Failed to load");
      setData(json);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const ParityTooltip = ({ active, payload }) => {
    if (!active||!payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background:"#111", border:`1px solid ${C.border}`,
        borderRadius:8, padding:"10px 14px" }}>
        <p style={{ fontFamily:C.mono, fontSize:11, color:C.textSec }}>
          Actual: {d.actual} eV
        </p>
        <p style={{ fontFamily:C.mono, fontSize:11, color:C.blue }}>
          Predicted: {d.predicted} eV
        </p>
        <p style={{ fontFamily:C.mono, fontSize:10, color:C.textTer }}>
          Error: {(d.predicted-d.actual).toFixed(3)} eV
        </p>
      </div>
    );
  };

  return (
    <PageShell eyebrow="Model Performance" title="Parity Plot.">
      {loading && (
        <div style={{ display:"flex", justifyContent:"center", paddingTop:60 }}>
          <Spinner/>
        </div>
      )}
      <AnimatePresence>{error && <ErrorBox msg={error}/>}</AnimatePresence>

      {data && (
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
          transition={{ duration:0.5 }}>
          {/* Metrics */}
          <div style={{ display:"grid",
            gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",
            gap:12, marginBottom:24 }}>
            <MetricCard label="R² Score"
              value={data.r2.toFixed(4)} accent={C.green}/>
            <MetricCard label="RMSE"
              value={`${data.rmse} eV`} accent={C.blue}/>
            <MetricCard label="Test Samples"
              value={data.n.toLocaleString()} accent={C.textPrim}/>
          </div>

          {/* Scatter plot */}
          <GlassCard title="Actual vs Predicted Band Gap">
            <div style={{ height:440 }}>
              <ResponsiveContainer>
                <ScatterChart margin={{ top:10, right:20, bottom:20, left:10 }}>
                  <XAxis type="number" dataKey="actual" name="Actual"
                    label={{ value:"Actual (eV)", position:"insideBottom",
                      offset:-8, fill:C.textTer, fontSize:11, fontFamily:C.mono }}
                    stroke="rgba(255,255,255,0.15)"
                    tick={{ fill:C.textTer, fontSize:10, fontFamily:C.mono }}
                    axisLine={false} tickLine={false}/>
                  <YAxis type="number" dataKey="predicted" name="Predicted"
                    label={{ value:"Predicted (eV)", angle:-90, position:"insideLeft",
                      offset:16, fill:C.textTer, fontSize:11, fontFamily:C.mono }}
                    stroke="rgba(255,255,255,0.15)"
                    tick={{ fill:C.textTer, fontSize:10, fontFamily:C.mono }}
                    axisLine={false} tickLine={false}/>
                  <Tooltip content={<ParityTooltip/>}
                    cursor={{ strokeDasharray:"3 3",
                      stroke:"rgba(255,255,255,0.1)" }}/>
                  {/* Ideal parity line */}
                  <ReferenceLine
                    segment={[{ x:0, y:0 },{ x:12, y:12 }]}
                    stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4"/>
                  <Scatter data={data.points} fill={C.blue}
                    fillOpacity={0.5} r={2}/>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <p style={{ fontFamily:C.mono, fontSize:10, color:C.textTer,
              textAlign:"center", marginTop:8 }}>
              Dashed line = perfect prediction. Points above = overestimate,
              below = underestimate.
            </p>
          </GlassCard>
        </motion.div>
      )}
    </PageShell>
  );
}

/* ═══════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════ */
export default function App() {
  const [page, setPage] = useState("home");

  return (
    <div style={{ background:C.bg, minHeight:"100vh", position:"relative" }}>
      <MeshBg/>
      <Navbar page={page} setPage={setPage}/>
      <div style={{ position:"relative", zIndex:1 }}>
        <AnimatePresence mode="wait">
          {page==="home"     && <Home     key="home"    setPage={setPage}/>}
          {page==="analyzer" && <Analyzer key="analyzer"/>}
          {page==="batch"    && <Batch    key="batch"/>}
          {page==="compare"  && <Compare  key="compare"/>}
          {page==="parity"   && <ParityPlot key="parity"/>}
        </AnimatePresence>
      </div>
    </div>
  );
}