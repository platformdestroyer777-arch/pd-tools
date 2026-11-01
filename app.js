
const SUPABASE_URL = "https://aohhacasirnzkchbyzlw.supabase.co";
const SUPABASE_KEY = "sb_publishable_I5gPq6-Qti8SPAoN_8RrOg_-w5shIPo";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const defaultTools = [
  {id:"qr",name:"Gerador de QR Code",desc:"Transforme links e textos em QR Codes.",cat:"Criatividade",icon:"▦",active:true},
  {id:"counter",name:"Contador de texto",desc:"Conte palavras, caracteres e linhas.",cat:"Texto",icon:"¶",active:true},
  {id:"password",name:"Gerador de senhas",desc:"Crie senhas fortes e aleatórias.",cat:"Segurança",icon:"✳",active:true},
  {id:"calc",name:"Calculadora",desc:"Faça cálculos de forma rápida.",cat:"Matemática",icon:"＋",active:true},
  {id:"text",name:"Conversor de texto",desc:"Altere maiúsculas, minúsculas e formato.",cat:"Texto",icon:"Aa",active:true},
  {id:"units",name:"Conversor de medidas",desc:"Converta comprimento, peso e temperatura.",cat:"Conversores",icon:"⇄",active:true},
  {id:"stopwatch",name:"Cronômetro",desc:"Marque o tempo e registre voltas.",cat:"Tempo",icon:"◷",active:true},
  {id:"timer",name:"Temporizador",desc:"Configure uma contagem regressiva.",cat:"Tempo",icon:"◴",active:true},
  {id:"json",name:"Formatador JSON",desc:"Organize e valide seus dados JSON.",cat:"Desenvolvimento",icon:"{}",active:true},
  {id:"base64",name:"Codificador Base64",desc:"Codifique ou decodifique textos.",cat:"Desenvolvimento",icon:"⌘",active:true}
];

let tools = defaultTools;
let category = "Todas";
let adminSession = null;

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

function toast(message) {
  const element = $("#toast");
  if (!element) return;
  element.textContent = message;
  element.classList.add("show");
  setTimeout(() => element.classList.remove("show"), 2200);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function mapTool(tool) {
  return {
    id: tool.id,
    name: tool.name,
    desc: tool.description,
    cat: tool.category,
    icon: tool.icon,
    active: tool.active
  };
}

async function carregarFerramentasSupabase() {
  const { data, error } = await supabaseClient
    .from("tools")
    .select("*")
    .order("position");

  if (error) {
    console.error("Erro ao carregar ferramentas:", error);
    toast("Não foi possível carregar as ferramentas.");
    return;
  }

  tools = data.map(mapTool);
  category = "Todas";
  render();

  console.log("Ferramentas carregadas do Supabase!");
}

async function carregarAparencia() {
  const { data, error } = await supabaseClient
    .from("site_settings")
    .select("site_name, primary_color")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar aparência:", error);
    return;
  }

  if (data?.primary_color) {
    document.documentElement.style.setProperty(
      "--purple",
      data.primary_color
    );
  }

  if (data?.site_name) {
    document.title = `${data.site_name} — Ferramentas inteligentes`;
  }
}

function render() {
  const filters = $("#filters");
  const grid = $("#toolGrid");

  if (!filters || !grid) return;

  const categories = [
    "Todas",
    ...new Set(tools.filter(t => t.active).map(t => t.cat))
  ];

  filters.innerHTML = categories.map(c => `
    <button class="filter ${category === c ? "active" : ""}"
      data-cat="${esc(c)}">${esc(c)}</button>
  `).join("");

  const query = ($("#search")?.value || "").toLowerCase();

  const list = tools.filter(t =>
    t.active &&
    (category === "Todas" || t.cat === category) &&
    (t.name + " " + t.desc + " " + t.cat).toLowerCase().includes(query)
  );

  grid.innerHTML = list.map(t => `
    <article class="tool-card" data-tool="${esc(t.id)}">
      <span class="tool-arrow">↗</span>
      <div class="tool-icon">${esc(t.icon)}</div>
      <h3>${esc(t.name)}</h3>
      <p>${esc(t.desc)}</p>
    </article>
  `).join("") || '<p style="color:#999">Nenhuma ferramenta encontrada.</p>';

  filters.querySelectorAll("button").forEach(button => {
    button.onclick = () => {
      category = button.dataset.cat;
      render();
    };
  });

  grid.querySelectorAll("[data-tool]").forEach(card => {
    card.onclick = () => openTool(card.dataset.tool);
  });
}

const field = (label, id, placeholder = "", type = "text") => `
  <div class="field">
    <label>${label}</label>
    <input id="${id}" type="${type}" placeholder="${placeholder}">
  </div>
`;

function openTool(id) {
  const tool = tools.find(item => item.id === id);
  if (!tool) return;

  $("#modalTitle").textContent = tool.name;
  $("#modalCategory").textContent = tool.cat.toUpperCase();
  $("#toolContent").innerHTML = toolHTML(id);
  $("#toolModal").classList.add("show");

  wireTool(id);
}

function toolHTML(id) {
  switch (id) {
    case "qr":
      return `
        ${field("Texto ou link", "qrInput", "https://exemplo.com")}
        <button class="action" id="qrMake">Gerar QR Code</button>
        <div id="qrcode"></div>
        <button class="secondary" id="qrDownload" hidden>Baixar PNG</button>
      `;

    case "counter":
      return `
        <div class="field">
          <label>Seu texto</label>
          <textarea id="countText" placeholder="Digite ou cole seu texto..."></textarea>
        </div>
        <div class="result" id="countResult">0 caracteres · 0 palavras · 0 linhas</div>
      `;

    case "password":
      return `
        ${field("Comprimento", "passLen", "16", "number")}
        <div class="checks">
          <label><input type="checkbox" id="upper" checked> Maiúsculas</label>
          <label><input type="checkbox" id="lower" checked> Minúsculas</label>
          <label><input type="checkbox" id="nums" checked> Números</label>
          <label><input type="checkbox" id="symbols" checked> Símbolos</label>
        </div>
        <div class="actions">
          <button class="action" id="passMake">Gerar senha</button>
          <button class="secondary" id="passCopy">Copiar</button>
        </div>
        <div class="result" id="passResult">Sua senha aparecerá aqui.</div>
      `;

    case "calc":
      return `
        ${field("Expressão matemática", "calcInput", "Ex.: (12 + 8) * 3")}
        <button class="action" id="calcGo">Calcular</button>
        <div class="result" id="calcResult">Resultado</div>
      `;

    case "text":
      return `
        <div class="field">
          <label>Texto</label>
          <textarea id="textInput" placeholder="Digite seu texto..."></textarea>
        </div>
        <div class="actions">
          ${["MAIÚSCULAS","minúsculas","Título","Frase","Inverter","Limpar espaços"].map((x,i) =>
            `<button class="secondary" data-convert="${i}">${x}</button>`
          ).join("")}
        </div>
        <div class="result" id="textResult"></div>
        <button class="secondary" id="textCopy">Copiar resultado</button>
      `;

    case "units":
      return `
        <div class="field">
          <label>Tipo de conversão</label>
          <select id="unitType">
            <option value="length">Comprimento (m → km)</option>
            <option value="weight">Peso (kg → g)</option>
            <option value="temp">Temperatura (°C → °F)</option>
            <option value="data">Dados (MB → GB)</option>
          </select>
        </div>
        ${field("Valor", "unitValue", "Digite um número", "number")}
        <button class="action" id="unitGo">Converter</button>
        <div class="result" id="unitResult"></div>
      `;

    case "stopwatch":
      return `
        <div class="result" id="watchTime" style="font-size:30px;text-align:center">00:00.00</div>
        <div class="actions">
          <button class="action" id="watchStart">Iniciar</button>
          <button class="secondary" id="watchLap">Volta</button>
          <button class="secondary" id="watchReset">Zerar</button>
        </div>
        <div class="result" id="watchLaps"></div>
      `;

    case "timer":
      return `
        ${field("Minutos", "timerMin", "5", "number")}
        ${field("Segundos", "timerSec", "0", "number")}
        <div class="result" id="timerDisplay" style="font-size:28px;text-align:center">05:00</div>
        <div class="actions">
          <button class="action" id="timerStart">Iniciar</button>
          <button class="secondary" id="timerReset">Resetar</button>
        </div>
      `;

    case "json":
      return `
        <div class="field">
          <label>JSON de entrada</label>
          <textarea id="jsonInput" placeholder='{"nome":"PD Tools"}'></textarea>
        </div>
        <button class="action" id="jsonGo">Formatar JSON</button>
        <div class="result" id="jsonResult"></div>
        <button class="secondary" id="jsonCopy">Copiar</button>
      `;

    case "base64":
      return `
        <div class="field">
          <label>Texto</label>
          <textarea id="b64Input" placeholder="Digite o texto..."></textarea>
        </div>
        <div class="actions">
          <button class="action" id="b64Encode">Codificar</button>
          <button class="secondary" id="b64Decode">Decodificar</button>
        </div>
        <div class="result" id="b64Result"></div>
        <button class="secondary" id="b64Copy">Copiar</button>
      `;

    default:
      return "<p>Ferramenta não encontrada.</p>";
  }
}

function copy(value) {
  if (!value) return toast("Nada para copiar.");

  navigator.clipboard?.writeText(value)
    .then(() => toast("Copiado!"))
    .catch(() => toast("Não foi possível copiar."));
}

function wireTool(id) {
  if (id === "qr") {
    $("#qrMake").onclick = () => {
      const value = $("#qrInput").value.trim();

      if (!value) return toast("Digite um texto ou link.");
      if (!window.QRCode) return toast("Não foi possível carregar o gerador.");

      $("#qrcode").innerHTML = "";
      new QRCode($("#qrcode"), {
        text: value,
        width: 210,
        height: 210
      });

      $("#qrDownload").hidden = false;
    };

    $("#qrDownload").onclick = () => {
      const image = $("#qrcode img") || $("#qrcode canvas");
      if (!image) return toast("Gere um QR Code primeiro.");

      const url = image.tagName === "CANVAS"
        ? image.toDataURL()
        : image.src;

      const link = document.createElement("a");
      link.href = url;
      link.download = "pd-tools-qrcode.png";
      link.click();
    };
  }

  if (id === "counter") {
    $("#countText").oninput = () => {
      const value = $("#countText").value;

      $("#countResult").textContent =
        `${value.length} caracteres · ` +
        `${value.replace(/\s/g, "").length} sem espaços · ` +
        `${(value.trim().match(/\S+/g) || []).length} palavras · ` +
        `${value ? value.split(/\n/).length : 0} linhas · ` +
        `${(value.match(/[.!?]+(?=\s|$)/g) || []).length} frases`;
    };
  }

  if (id === "password") {
    $("#passMake").onclick = () => {
      let chars = "";

      if ($("#upper").checked) chars += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      if ($("#lower").checked) chars += "abcdefghijklmnopqrstuvwxyz";
      if ($("#nums").checked) chars += "0123456789";
      if ($("#symbols").checked) chars += "!@#$%&*_-+=";

      if (!chars) return toast("Selecione ao menos um tipo.");

      const length = Math.min(128, Math.max(4, Number($("#passLen").value) || 16));
      const random = new Uint32Array(length);
      crypto.getRandomValues(random);

      $("#passResult").textContent = Array.from(
        random,
        value => chars[value % chars.length]
      ).join("");
    };

    $("#passCopy").onclick = () => copy($("#passResult").textContent);
  }

  if (id === "calc") {
    $("#calcGo").onclick = () => {
      try {
        const expression = $("#calcInput").value;

        if (!/^[\d+\-*/().%\s]+$/.test(expression)) throw new Error();

        const result = Function('"use strict";return (' + expression + ')')();

        $("#calcResult").textContent = Number.isFinite(result)
          ? String(result)
          : "Expressão inválida";
      } catch {
        $("#calcResult").textContent = "Expressão inválida";
      }
    };
  }

  if (id === "text") {
    $$("#toolContent [data-convert]").forEach(button => {
      button.onclick = () => {
        const value = $("#textInput").value;
        const index = Number(button.dataset.convert);

        const results = [
          value.toUpperCase(),
          value.toLowerCase(),
          value.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
          value.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, c => c.toUpperCase()),
          [...value].reverse().join(""),
          value.replace(/\s+/g, " ").trim()
        ];

        $("#textResult").textContent = results[index];
      };
    });

    $("#textCopy").onclick = () => copy($("#textResult").textContent);
  }

  if (id === "units") {
    $("#unitGo").onclick = () => {
      const value = Number($("#unitValue").value);
      const type = $("#unitType").value;

      if ($("#unitValue").value.trim() === "" || !Number.isFinite(value)) {
        return toast("Digite um número válido.");
      }

      const result = type === "length"
        ? `${value} m = ${value / 1000} km`
        : type === "weight"
        ? `${value} kg = ${value * 1000} g`
        : type === "temp"
        ? `${value} °C = ${(value * 9 / 5 + 32).toFixed(2)} °F`
        : `${value} MB = ${value / 1024} GB`;

      $("#unitResult").textContent = result;
    };
  }

  if (id === "stopwatch") {
    let start = 0;
    let elapsed = 0;
    let running = false;
    let interval;

    const format = ms => {
      const cs = Math.floor(ms / 10) % 100;
      const seconds = Math.floor(ms / 1000) % 60;
      const minutes = Math.floor(ms / 60000);

      return `${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}.${String(cs).padStart(2,"0")}`;
    };

    $("#watchStart").onclick = () => {
      if (running) {
        elapsed += Date.now() - start;
        running = false;
        clearInterval(interval);
        $("#watchStart").textContent = "Continuar";
      } else {
        start = Date.now();
        running = true;
        $("#watchStart").textContent = "Pausar";

        interval = setInterval(() => {
          $("#watchTime").textContent = format(elapsed + Date.now() - start);
        }, 30);
      }
    };

    $("#watchLap").onclick = () => {
      $("#watchLaps").textContent += `${$("#watchTime").textContent}\n`;
    };

    $("#watchReset").onclick = () => {
      clearInterval(interval);
      running = false;
      elapsed = 0;
      $("#watchTime").textContent = "00:00.00";
      $("#watchLaps").textContent = "";
      $("#watchStart").textContent = "Iniciar";
    };
  }

  if (id === "timer") {
    let remaining = 300;
    let interval = null;

    const display = () => {
      $("#timerDisplay").textContent =
        `${String(Math.floor(remaining / 60)).padStart(2,"0")}:${String(remaining % 60).padStart(2,"0")}`;
    };

    $("#timerStart").onclick = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
        $("#timerStart").textContent = "Continuar";
        return;
      }

      if (remaining <= 0) {
        remaining = Math.max(
          0,
          Number($("#timerMin").value) * 60 +
          Number($("#timerSec").value)
        );
      }

      if (remaining <= 0) return toast("Configure um tempo válido.");

      interval = setInterval(() => {
        remaining--;
        display();

        if (remaining <= 0) {
          clearInterval(interval);
          interval = null;
          $("#timerStart").textContent = "Iniciar";
          toast("Tempo encerrado!");
        }
      }, 1000);

      $("#timerStart").textContent = "Pausar";
    };

    $("#timerReset").onclick = () => {
      clearInterval(interval);
      interval = null;

      remaining = Math.max(
        0,
        (Number($("#timerMin").value) || 0) * 60 +
        (Number($("#timerSec").value) || 0)
      );

      display();
      $("#timerStart").textContent = "Iniciar";
    };
  }

  if (id === "json") {
    $("#jsonGo").onclick = () => {
      try {
        $("#jsonResult").textContent = JSON.stringify(
          JSON.parse($("#jsonInput").value),
          null,
          2
        );
      } catch (error) {
        $("#jsonResult").textContent = "JSON inválido: " + error.message;
      }
    };

    $("#jsonCopy").onclick = () => copy($("#jsonResult").textContent);
  }

  if (id === "base64") {
    $("#b64Encode").onclick = () => {
      try {
        $("#b64Result").textContent = btoa(
          unescape(encodeURIComponent($("#b64Input").value))
        );
      } catch {
        $("#b64Result").textContent = "Não foi possível codificar.";
      }
    };

    $("#b64Decode").onclick = () => {
      try {
        $("#b64Result").textContent = decodeURIComponent(
          escape(atob($("#b64Input").value.trim()))
        );
      } catch {
        $("#b64Result").textContent = "Base64 inválido.";
      }
    };

    $("#b64Copy").onclick = () => copy($("#b64Result").textContent);
  }
}

async function verificarAdmin() {
  const { data: { session }, error: sessionError } =
    await supabaseClient.auth.getSession();

  if (sessionError || !session) return false;

  const { data, error } = await supabaseClient
    .from("admins")
    .select("user_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error || !data) {
    console.error("Falha ao verificar administrador:", error);
    return false;
  }

  adminSession = session;
  return true;
}

async function abrirAdmin() {
  let autorizado = await verificarAdmin();

  if (!autorizado) {
    const email = prompt("Digite seu e-mail de administrador:");
    if (!email) return;

    const password = prompt("Digite sua senha:");
    if (!password) return;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error(error);
      toast("E-mail ou senha incorretos.");
      return;
    }

    autorizado = await verificarAdmin();

    if (!autorizado) {
      await supabaseClient.auth.signOut();
      toast("Você não tem permissão de administrador.");
      return;
    }
  }

  renderAdmin("overview");
  $("#adminModal").classList.add("show");
}

async function atualizarListaAdmin() {
  const { data, error } = await supabaseClient
    .from("tools")
    .select("*")
    .order("position");

  if (error) {
    console.error(error);
    toast("Erro ao atualizar ferramentas.");
    return false;
  }

  tools = data.map(mapTool);
  render();
  return true;
}

async function alterarStatusTool(id) {
  const tool = tools.find(item => item.id === id);
  if (!tool) return;

  const { error } = await supabaseClient
    .from("tools")
    .update({ active: !tool.active })
    .eq("id", id);

  if (error) {
    console.error(error);
    toast("Erro ao atualizar ferramenta.");
    return;
  }

  await atualizarListaAdmin();
  renderAdmin("toolsAdmin");
  toast("Ferramenta atualizada!");
}

async function excluirTool(id) {
  if (!confirm("Deseja realmente excluir esta ferramenta?")) return;

  const { error } = await supabaseClient
    .from("tools")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    toast("Erro ao excluir ferramenta.");
    return;
  }

  await atualizarListaAdmin();
  renderAdmin("toolsAdmin");
  toast("Ferramenta excluída!");
}

async function editarTool(id = null) {
  const oldTool = id
    ? tools.find(item => item.id === id)
    : null;

  const name = prompt("Nome da ferramenta:", oldTool?.name || "");
  if (name === null || !name.trim()) return;

  const description = prompt("Descrição:", oldTool?.desc || "");
  if (description === null) return;

  const category = prompt("Categoria:", oldTool?.cat || "Geral");
  if (category === null || !category.trim()) return;

  const icon = prompt("Ícone:", oldTool?.icon || "✦");
  if (icon === null) return;

  const values = {
    name: name.trim(),
    description: description.trim(),
    category: category.trim(),
    icon: icon.trim()
  };

  let error;

  if (oldTool) {
    ({ error } = await supabaseClient
      .from("tools")
      .update(values)
      .eq("id", oldTool.id));
  } else {
    const newId = prompt("Identificador único (sem espaços):");
    if (!newId || !/^[a-zA-Z0-9_-]+$/.test(newId)) {
      return toast("Identificador inválido.");
    }

    const { data: existing } = await supabaseClient
      .from("tools")
      .select("id")
      .eq("id", newId)
      .maybeSingle();

    if (existing) return toast("Esse identificador já existe.");

    const { data: lastTool } = await supabaseClient
      .from("tools")
      .select("position")
      .order("position", { ascending: false })
      .limit(1);

    const position = lastTool?.length
      ? lastTool[0].position + 1
      : 1;

    ({ error } = await supabaseClient
      .from("tools")
      .insert({
        id: newId,
        ...values,
        active: true,
        position
      }));
  }

  if (error) {
    console.error(error);
    toast("Erro ao salvar ferramenta.");
    return;
  }

  await atualizarListaAdmin();
  renderAdmin("toolsAdmin");
  toast("Ferramenta salva!");
}

async function salvarAparencia() {
  const siteName = $("#siteName").value.trim();
  const color = $("#siteColor").value.trim();

  if (!siteName) return toast("Informe o nome do site.");

  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    return toast("Informe uma cor hexadecimal válida.");
  }

  const { error } = await supabaseClient
    .from("site_settings")
    .upsert({
      id: 1,
      site_name: siteName,
      primary_color: color,
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error(error);
    toast("Erro ao salvar aparência.");
    return;
  }

  document.documentElement.style.setProperty("--purple", color);
  document.title = `${siteName} — Ferramentas inteligentes`;

  toast("Aparência salva no Supabase!");
}

function renderAdmin(tab) {
  $$(".admin-tabs button").forEach(button => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });

  const element = $("#adminContent");

  if (tab === "overview") {
    element.innerHTML = `
      <div class="result">
        <b>${tools.length}</b> ferramentas cadastradas<br>
        <b>${tools.filter(t => t.active).length}</b> ferramentas ativas<br>
        <b>${new Set(tools.map(t => t.cat)).size}</b> categorias<br><br>
        PD Tools conectado ao Supabase.
        <br><br>
        <button class="secondary" id="adminLogout">Sair da conta administrativa</button>
      </div>
    `;

    $("#adminLogout").onclick = async () => {
      await supabaseClient.auth.signOut();
      adminSession = null;
      $("#adminModal").classList.remove("show");
      toast("Sessão encerrada.");
    };
  }

  if (tab === "toolsAdmin") {
    element.innerHTML = `
      <button class="action" id="addTool">+ Nova ferramenta</button>
      <div>
        ${tools.map(tool => `
          <div class="admin-row">
            <div>
              <b>${esc(tool.name)}</b>
              <small>${esc(tool.cat)} · ${tool.active ? "Ativa" : "Inativa"}</small>
            </div>
            <div>
              <button data-toggle="${esc(tool.id)}">${tool.active ? "Desativar" : "Ativar"}</button>
              <button data-edit="${esc(tool.id)}">Editar</button>
              <button data-delete="${esc(tool.id)}">Excluir</button>
            </div>
          </div>
        `).join("")}
      </div>
    `;

    $("#addTool").onclick = () => editarTool();

    $$("[data-toggle]").forEach(button => {
      button.onclick = () => alterarStatusTool(button.dataset.toggle);
    });

    $$("[data-edit]").forEach(button => {
      button.onclick = () => editarTool(button.dataset.edit);
    });

    $$("[data-delete]").forEach(button => {
      button.onclick = () => excluirTool(button.dataset.delete);
    });
  }

  if (tab === "appearance") {
    element.innerHTML = `
      <div class="field">
        <label>Nome exibido</label>
        <input id="siteName" value="PD Tools">
      </div>
      <div class="field">
        <label>Cor principal (hex)</label>
        <input id="siteColor" value="#9b7bff">
      </div>
      <button class="action" id="saveAppearance">Salvar aparência</button>
      <p style="color:#999;font-size:11px">
        As alterações serão salvas no Supabase.
      </p>
    `;

    carregarAparencia().then(async () => {
      const { data } = await supabaseClient
        .from("site_settings")
        .select("site_name, primary_color")
        .eq("id", 1)
        .maybeSingle();

      if (data) {
        $("#siteName").value = data.site_name || "PD Tools";
        $("#siteColor").value = data.primary_color || "#9b7bff";
      }
    });

    $("#saveAppearance").onclick = salvarAparencia;
  }
}

$("#search").oninput = render;

$("#year").textContent = new Date().getFullYear();

$$("[data-close]").forEach(button => {
  button.onclick = () => {
    $("#" + button.dataset.close).classList.remove("show");
  };
});

$$(".modal-backdrop").forEach(modal => {
  modal.onclick = event => {
    if (event.target === modal) modal.classList.remove("show");
  };
});

$("#adminOpen").onclick = abrirAdmin;

$$(".admin-tabs button").forEach(button => {
  button.onclick = async () => {
    const autorizado = await verificarAdmin();

    if (!autorizado) {
      toast("Sua sessão expirou. Entre novamente.");
      $("#adminModal").classList.remove("show");
      return;
    }

    renderAdmin(button.dataset.tab);
  };
});

render();
carregarFerramentasSupabase();
carregarAparencia();
