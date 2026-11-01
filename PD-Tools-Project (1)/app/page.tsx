"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  Search, QrCode, Type, LockKeyhole, Calculator, RefreshCw,
  Ruler, Timer, Clock3, Copy, Check, Download, Wrench, Menu, X,
  ArrowRight, Sparkles, Github
} from "lucide-react";

type ToolId = "qr" | "counter" | "password" | "calculator" | "text" | "units" | "stopwatch" | "timer";

const tools: { id: ToolId; name: string; description: string; category: string; icon: typeof QrCode }[] = [
  { id: "qr", name: "Gerador de QR Code", description: "Crie QR Codes para links e textos.", category: "Geradores", icon: QrCode },
  { id: "counter", name: "Contador de texto", description: "Conte palavras, caracteres e linhas.", category: "Texto", icon: Type },
  { id: "password", name: "Gerador de senhas", description: "Gere senhas aleatórias e fortes.", category: "Segurança", icon: LockKeyhole },
  { id: "calculator", name: "Calculadora", description: "Faça cálculos de forma rápida.", category: "Cálculos", icon: Calculator },
  { id: "text", name: "Conversor de texto", description: "Altere maiúsculas, minúsculas e mais.", category: "Texto", icon: RefreshCw },
  { id: "units", name: "Conversor de medidas", description: "Converta comprimento, peso e temperatura.", category: "Conversores", icon: Ruler },
  { id: "stopwatch", name: "Cronômetro", description: "Marque o tempo com precisão.", category: "Tempo", icon: Timer },
  { id: "timer", name: "Temporizador", description: "Configure uma contagem regressiva.", category: "Tempo", icon: Clock3 },
];

function ToolContent({ id }: { id: ToolId }) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState("");
  const [passwordLength, setPasswordLength] = useState(16);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [unitType, setUnitType] = useState("length");
  const [fromUnit, setFromUnit] = useState("m");
  const [toUnit, setToUnit] = useState("km");
  const [seconds, setSeconds] = useState(60);
  const [remaining, setRemaining] = useState(60);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (id !== "qr" || !value.trim()) { setQr(""); return; }
    QRCode.toDataURL(value, { width: 280, margin: 2, color: { dark: "#171321", light: "#ffffff" } })
      .then(setQr).catch(() => setQr(""));
  }, [id, value]);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      if (id === "timer") setRemaining((v) => {
        if (v <= 1) { window.clearInterval(interval); setRunning(false); return 0; }
        return v - 1;
      });
      if (id === "stopwatch") setElapsed((v) => v + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [running, id]);

  const copyResult = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }
    catch { setCopied(false); }
  };

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" + (includeSymbols ? "!@#$%&*_-+=" : "");
    const bytes = new Uint32Array(passwordLength);
    crypto.getRandomValues(bytes);
    setResult(Array.from(bytes, (n) => chars[n % chars.length]).join(""));
  };

  const convertUnits = () => {
    const n = Number(value);
    if (!Number.isFinite(n)) { setResult("Digite um número válido."); return; }
    const tables: Record<string, Record<string, number>> = {
      length: { mm: 0.001, cm: 0.01, m: 1, km: 1000 },
      weight: { mg: 0.000001, g: 0.001, kg: 1, t: 1000 },
    };
    if (unitType === "temperature") {
      let c = n;
      if (fromUnit === "f") c = (n - 32) * 5 / 9;
      if (fromUnit === "k") c = n - 273.15;
      let out = c;
      if (toUnit === "f") out = c * 9 / 5 + 32;
      if (toUnit === "k") out = c + 273.15;
      setResult(`${Number(out.toFixed(4))} ${toUnit.toUpperCase()}`); return;
    }
    const table = tables[unitType];
    setResult(`${Number((n * table[fromUnit] / table[toUnit]).toFixed(6))} ${toUnit}`);
  };

  const title = tools.find((t) => t.id === id)?.name ?? "Ferramenta";

  return (
    <div className="tool-panel">
      <div className="tool-panel-heading"><span className="eyebrow">FERRAMENTA PD</span><h2>{title}</h2></div>
      {id === "qr" && <div className="tool-grid"><div className="field"><label>Texto ou link</label><textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://exemplo.com" rows={4} /><p className="hint">O QR Code é criado automaticamente.</p></div><div className="qr-preview">{qr ? <><img src={qr} alt="QR Code gerado" /><a className="button primary" href={qr} download="pd-tools-qrcode.png"><Download size={16}/> Baixar QR Code</a></> : <div className="empty-qr"><QrCode size={42}/><span>Seu QR Code aparecerá aqui</span></div>}</div></div>}
      {id === "counter" && <><label>Digite ou cole seu texto</label><textarea value={value} onChange={(e) => setValue(e.target.value)} rows={8} placeholder="Comece a escrever..." /><div className="stats"><div><strong>{value.trim() ? value.trim().split(/\s+/).length : 0}</strong><span>Palavras</span></div><div><strong>{value.length}</strong><span>Caracteres</span></div><div><strong>{value.replace(/\s/g, "").length}</strong><span>Sem espaços</span></div><div><strong>{value ? value.split(/\n/).length : 0}</strong><span>Linhas</span></div></div></>}
      {id === "password" && <><label>Tamanho da senha: {passwordLength}</label><input type="range" min="8" max="48" value={passwordLength} onChange={(e) => setPasswordLength(Number(e.target.value))}/><label className="check"><input type="checkbox" checked={includeSymbols} onChange={(e) => setIncludeSymbols(e.target.checked)}/> Incluir símbolos</label><button className="button primary full" onClick={generatePassword}>Gerar senha</button>{result && <div className="result-row"><code>{result}</code><button className="icon-button" onClick={() => copyResult(result)}>{copied ? <Check/> : <Copy/>}</button></div>}</>}
      {id === "calculator" && <><label>Expressão matemática</label><input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ex.: (25 + 15) * 2" /><button className="button primary" onClick={() => { try { if (!/^[0-9+\-*/().%\s]+$/.test(value)) throw new Error(); const answer = Function(`"use strict"; return (${value})`)(); setResult(String(answer)); } catch { setResult("Expressão inválida."); } }}>Calcular</button>{result && <div className="result-box">{result}</div>}<p className="hint">Use +, -, *, /, %, parênteses e números.</p></>}
      {id === "text" && <><label>Seu texto</label><textarea value={value} onChange={(e) => setValue(e.target.value)} rows={5} placeholder="Digite seu texto..." /><div className="button-row"><button className="button secondary" onClick={() => setResult(value.toUpperCase())}>MAIÚSCULAS</button><button className="button secondary" onClick={() => setResult(value.toLowerCase())}>minúsculas</button><button className="button secondary" onClick={() => setResult(value.replace(/\b\w/g, (c) => c.toUpperCase()))}>Capitalizar</button><button className="button secondary" onClick={() => setResult(value.trim().replace(/\s+/g, " "))}>Remover espaços extras</button></div>{result && <div className="result-row"><p>{result}</p><button className="icon-button" onClick={() => copyResult(result)}>{copied ? <Check/> : <Copy/>}</button></div>}</>}
      {id === "units" && <><label>Tipo de conversão</label><select value={unitType} onChange={(e) => { const t = e.target.value; setUnitType(t); setFromUnit(t === "length" ? "m" : t === "weight" ? "kg" : "c"); setToUnit(t === "length" ? "km" : t === "weight" ? "g" : "f"); }}><option value="length">Comprimento</option><option value="weight">Peso</option><option value="temperature">Temperatura</option></select><label>Valor</label><input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Digite um valor"/><div className="two-fields"><div><label>De</label><select value={fromUnit} onChange={(e) => setFromUnit(e.target.value)}>{(unitType === "length" ? ["mm","cm","m","km"] : unitType === "weight" ? ["mg","g","kg","t"] : ["c","f","k"]).map((u) => <option key={u} value={u}>{u.toUpperCase()}</option>)}</select></div><div><label>Para</label><select value={toUnit} onChange={(e) => setToUnit(e.target.value)}>{(unitType === "length" ? ["mm","cm","m","km"] : unitType === "weight" ? ["mg","g","kg","t"] : ["c","f","k"]).map((u) => <option key={u} value={u}>{u.toUpperCase()}</option>)}</select></div></div><button className="button primary" onClick={convertUnits}>Converter</button>{result && <div className="result-box">{result}</div>}</>}
      {id === "stopwatch" && <div className="timer-tool"><div className="big-time">{String(Math.floor(elapsed/60)).padStart(2,"0")}:{String(elapsed%60).padStart(2,"0")}</div><div className="button-row"><button className="button primary" onClick={() => setRunning(!running)}>{running ? "Pausar" : "Iniciar"}</button><button className="button secondary" onClick={() => {setRunning(false);setElapsed(0);}}>Zerar</button></div></div>}
      {id === "timer" && <div className="timer-tool"><label>Duração em segundos</label><input type="number" min="1" value={seconds} onChange={(e) => {setSeconds(Math.max(1,Number(e.target.value)));setRemaining(Math.max(1,Number(e.target.value)));}}/><div className="big-time">{String(Math.floor(remaining/60)).padStart(2,"0")}:{String(remaining%60).padStart(2,"0")}</div><div className="button-row"><button className="button primary" onClick={() => {if (remaining <= 0) setRemaining(seconds);setRunning(!running);}}>{running ? "Pausar" : "Iniciar"}</button><button className="button secondary" onClick={() => {setRunning(false);setRemaining(seconds);}}>Reiniciar</button></div>{remaining === 0 && <p className="success-text">Tempo encerrado!</p>}</div>}
    </div>
  );
}

export default function Home() {
  const [active, setActive] = useState<ToolId>("qr");
  const [search, setSearch] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const filtered = useMemo(() => tools.filter((t) => `${t.name} ${t.description} ${t.category}`.toLowerCase().includes(search.toLowerCase())), [search]);
  const activeTool = tools.find((t) => t.id === active)!;

  return (
    <main className="app-shell">
      <header className="topbar"><a className="brand" href="#"><span className="brand-mark"><Wrench size={19}/></span><span>PD <b>TOOLS</b><small>PLATFORM DESTROYER</small></span></a><div className="top-links"><span>Ferramentas gratuitas</span><a href="#ferramentas">Explorar <ArrowRight size={14}/></a></div><button className="mobile-toggle" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Abrir menu">{mobileMenu ? <X/> : <Menu/>}</button></header>
      <section className="hero"><div className="hero-glow"/><span className="eyebrow"><Sparkles size={14}/> SIMPLES • GRATUITO • ONLINE</span><h1>Ferramentas para<br/><span>facilitar seu dia.</span></h1><p>O que você precisa, em um só lugar. Acesse ferramentas gratuitas e fáceis de usar, sem complicação.</p><a className="button primary" href="#ferramentas">Explorar ferramentas <ArrowRight size={16}/></a></section>
      <section className="workspace" id="ferramentas"><div className="section-head"><div><span className="eyebrow">CENTRAL DE FERRAMENTAS</span><h2>O que você precisa hoje?</h2></div><div className="search-box"><Search size={17}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar ferramenta..."/></div></div>
        <div className="workspace-grid"><aside className={`sidebar ${mobileMenu ? "show" : ""}`}><span className="side-label">FERRAMENTAS</span>{filtered.map((tool) => {const Icon = tool.icon;return <button key={tool.id} className={`nav-tool ${active === tool.id ? "selected" : ""}`} onClick={() => {setActive(tool.id);setMobileMenu(false);}}><Icon size={18}/><span>{tool.name}</span></button>})}{filtered.length === 0 && <p className="hint">Nenhuma ferramenta encontrada.</p>}</aside><div className="main-tool"><div className="active-title"><div className="active-icon"><activeTool.icon size={20}/></div><div><span className="eyebrow">{activeTool.category}</span><h3>{activeTool.name}</h3></div></div><ToolContent key={active} id={active}/></div></div>
      </section>
      <footer><a className="brand footer-brand" href="#"><span className="brand-mark"><Wrench size={17}/></span><span>PD <b>TOOLS</b><small>PLATFORM DESTROYER</small></span></a><p>Feito para a comunidade. Gratuito para todos.</p><span className="copyright">© {new Date().getFullYear()} Platform Destroyer</span></footer>
    </main>
  );
}