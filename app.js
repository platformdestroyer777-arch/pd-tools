
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
let activeToolInterval = null;

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
    .select("site_name, primary_color, logo_url, favicon_url")
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

  if (data?.logo_url) aplicarLogo(data.logo_url);
  if (data?.favicon_url) aplicarFavicon(data.favicon_url);
}

function aplicarLogo(url) {
  document.querySelectorAll(".brand-mark").forEach(mark => {
    mark.innerHTML = `<img src="${esc(url)}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:inherit">`;
  });
}

function aplicarFavicon(url) {
  let link = document.querySelector('link[ rel="icon" ]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = url;
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
    <label>${esc(label)}</label>
    <input id="${esc(id)}" type="${esc(type)}"
      placeholder="${esc(placeholder)}">
  </div>
`;

function resolveToolBehaviorId(tool) {
  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

  const key = `${normalize(tool.id)} ${normalize(tool.name)}`;

  if (/corretor|ortograf|spell-check|spellchecker/.test(key)) return "spell-checker";
  if (/localizador|substituidor|find-replace|findreplace|replace-text/.test(key)) return "find-replace";
  if (/lorem/.test(key)) return "lorem-ipsum";
  if (/separador.*linha|linha.*separador|line-split|split-lines/.test(key)) return "line-splitter";
  if (/duplicad|remove-duplicates|unique-lines/.test(key)) return "remove-duplicates";
  if (/comparador|comparar-text|text-diff|compare-text/.test(key)) return "text-diff";
  if (/remove-spaces|espacos-extras/.test(key)) return "remove-spaces";
  if (/reverse-text|inversor-de-texto/.test(key)) return "reverse-text";
  if (tool.id === "base64-decode") return "base64-decode";
  if (tool.id === "json-validator") return "json-validator";
  if (tool.id === "api-qr") return "api-qr";

  return tool.id;
}

function openTool(id) {
  if (activeToolInterval) { clearInterval(activeToolInterval); activeToolInterval = null; }
  const tool = tools.find(item => item.id === id);
  if (!tool) return;

  const behaviorId = resolveToolBehaviorId(tool);
  $("#modalTitle").textContent = tool.name;
  $("#modalCategory").textContent = tool.cat.toUpperCase();
  $("#toolContent").innerHTML = toolHTML(behaviorId);
  $("#toolModal").classList.add("show");

  wireTool(behaviorId);
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

    case "names":
      return `
        <div class="field">
          <label>Estilo do nome</label>
          <select id="nameStyle">
            <option value="brand">Marca ou projeto</option>
            <option value="game">Game ou personagem</option>
            <option value="nickname">Apelido</option>
            <option value="fantasy">Fantasia</option>
          </select>
        </div>
        ${field("Palavra opcional", "nameWord", "Ex.: Shadow, Pixel, Nova")}
        <button class="action" id="nameMake">Gerar nomes</button>
        <div class="result" id="nameResult">Seus nomes aparecerão aqui.</div>
        <button class="secondary" id="nameCopy">Copiar resultado</button>
      `;

    case "ideas":
      return `
        <div class="field">
          <label>Área de interesse</label>
          <select id="ideaType">
            <option value="business">Negócios</option>
            <option value="content">Conteúdo</option>
            <option value="game">Games</option>
            <option value="community">Comunidade</option>
            <option value="general">Ideias gerais</option>
          </select>
        </div>
        <button class="action" id="ideaMake">Gerar ideias</button>
        <div class="result" id="ideaResult">Suas ideias aparecerão aqui.</div>
        <button class="secondary" id="ideaCopy">Copiar ideias</button>
      `;

    case "slogans":
      return `
        ${field("Nome da marca ou projeto", "sloganName", "Ex.: PD Tools")}
        <div class="field">
          <label>Estilo</label>
          <select id="sloganStyle">
            <option value="impact">Impactante</option>
            <option value="modern">Moderno</option>
            <option value="creative">Criativo</option>
            <option value="professional">Profissional</option>
          </select>
        </div>
        <button class="action" id="sloganMake">Gerar slogans</button>
        <div class="result" id="sloganResult">Seus slogans aparecerão aqui.</div>
        <button class="secondary" id="sloganCopy">Copiar slogans</button>
      `;

    case "palette":
      return `
        <button class="action" id="paletteMake">Gerar nova paleta</button>
        <div id="paletteResult" class="result"></div>
        <button class="secondary" id="paletteCopy">Copiar cores HEX</button>
      `;

    case "gradients":
      return `
        <div class="field">
          <label>Primeira cor</label>
          <input type="color" id="gradientA" value="#7c3aed">
        </div>
        <div class="field">
          <label>Segunda cor</label>
          <input type="color" id="gradientB" value="#ec4899">
        </div>
        <div class="field">
          <label>Direção</label>
          <select id="gradientDirection">
            <option value="to right">Horizontal</option>
            <option value="to left">Horizontal inverso</option>
            <option value="to bottom">Vertical</option>
            <option value="135deg">Diagonal</option>
          </select>
        </div>
        <div id="gradientPreview" style="height:120px;border-radius:12px;margin:15px 0"></div>
        <button class="action" id="gradientMake">Atualizar gradiente</button>
        <div class="result" id="gradientResult"></div>
        <button class="secondary" id="gradientCopy">Copiar CSS</button>
      `;

    case "color-combinations":
      return `
        <div class="field">
          <label>Escolha uma cor</label>
          <input type="color" id="combinationColor" value="#8b5cf6">
        </div>
        <button class="action" id="combinationMake">Encontrar combinações</button>
        <div class="result" id="combinationResult"></div>
        <button class="secondary" id="combinationCopy">Copiar cores</button>
      `;

    case "symbols":
      return `
        <div class="field">
          <label>Categoria</label>
          <select id="symbolType">
            <option value="all">Todos</option>
            <option value="arrows">Setas</option>
            <option value="stars">Estrelas</option>
            <option value="shapes">Formas</option>
            <option value="special">Especiais</option>
          </select>
        </div>
        <div class="result" id="symbolResult"></div>
        <button class="secondary" id="symbolCopy">Copiar símbolos</button>
      `;

    case "fonts":
      return `
        <div class="field">
          <label>Seu texto</label>
          <textarea id="fontInput" placeholder="Digite algo..."></textarea>
        </div>
        <button class="action" id="fontMake">Gerar estilos</button>
        <div class="result" id="fontResult"></div>
        <button class="secondary" id="fontCopy">Copiar estilos</button>
      `;

    case "decorative-text":
      return `
        <div class="field">
          <label>Seu texto</label>
          <textarea id="decorativeInput" placeholder="Digite algo..."></textarea>
        </div>
        <button class="action" id="decorativeMake">Criar decorações</button>
        <div class="result" id="decorativeResult"></div>
        <button class="secondary" id="decorativeCopy">Copiar resultado</button>
      `;

    case "counter":
      return `
        <div class="field">
          <label>Seu texto</label>
          <textarea id="countText" placeholder="Digite ou cole seu texto..."></textarea>
        </div>
        <div class="result" id="countResult">0 caracteres · 0 palavras · 0 linhas</div>
      `;

    case "remove-spaces":
      return `
        <div class="field">
          <label>Texto original</label>
          <textarea id="removeSpacesInput" placeholder="Cole ou digite seu texto..."></textarea>
        </div>
        <button class="action" id="removeSpacesGo">Remover espaços extras</button>
        <div class="result" id="removeSpacesResult">O texto ajustado aparecerá aqui.</div>
        <button class="secondary" id="removeSpacesCopy">Copiar resultado</button>
      `;

    case "reverse-text":
      return `
        <div class="field">
          <label>Texto original</label>
          <textarea id="reverseTextInput" placeholder="Cole ou digite seu texto..."></textarea>
        </div>
        <button class="action" id="reverseTextGo">Inverter texto</button>
        <div class="result" id="reverseTextResult">O texto invertido aparecerá aqui.</div>
        <button class="secondary" id="reverseTextCopy">Copiar resultado</button>
      `;

    case "spell-checker":
      return `
        <div class="field">
          <label>Texto para revisar</label>
          <textarea id="spellInput" spellcheck="true" maxlength="20000"
            placeholder="Cole aqui o texto que deseja revisar..."></textarea>
        </div>
        <div class="field">
          <label>Idioma</label>
          <select id="spellLanguage">
            <option value="pt-BR">Português (Brasil)</option>
            <option value="pt-PT">Português (Portugal)</option>
            <option value="en-US">Inglês (EUA)</option>
          </select>
        </div>
        <button class="action" id="spellGo">Corrigir texto</button>
        <div class="result" id="spellSummary">O resultado da revisão aparecerá aqui.</div>
        <div class="field">
          <label>Texto revisado</label>
          <textarea id="spellCorrected" readonly placeholder="O texto revisado aparecerá aqui..."></textarea>
        </div>
        <button class="secondary" id="spellCopy">Copiar texto revisado</button>
        <p style="font-size:12px;color:#999;margin-top:12px">
          A revisão é feita pelo <a href="https://languagetool.org" target="_blank" rel="noopener noreferrer">LanguageTool</a>.
          O texto enviado é processado pelo serviço para análise.
        </p>
      `;

    case "find-replace":
      return `
        <div class="field">
          <label>Texto</label>
          <textarea id="replaceText" placeholder="Cole o texto aqui..."></textarea>
        </div>
        ${field("Localizar", "replaceFind", "Palavra ou trecho que deseja encontrar")}
        ${field("Substituir por", "replaceWith", "Novo texto (deixe vazio para remover)")}
        <div class="checks">
          <label><input type="checkbox" id="replaceCaseSensitive"> Diferenciar maiúsculas e minúsculas</label>
        </div>
        <button class="action" id="replaceGo">Localizar e substituir</button>
        <div class="result" id="replaceResult">O texto atualizado aparecerá aqui.</div>
        <button class="secondary" id="replaceCopy">Copiar resultado</button>
      `;

    case "lorem-ipsum":
      return `
        <div class="field">
          <label>Quantidade de parágrafos</label>
          <input id="loremCount" type="number" min="1" max="10" value="3">
        </div>
        <button class="action" id="loremGo">Gerar Lorem Ipsum</button>
        <div class="result" id="loremResult">Seu texto será gerado aqui.</div>
        <button class="secondary" id="loremCopy">Copiar texto</button>
      `;

    case "line-splitter":
      return `
        <div class="field">
          <label>Texto para separar</label>
          <textarea id="lineSource" placeholder="Cole uma lista ou texto para organizar..."></textarea>
        </div>
        <div class="field">
          <label>Separar usando</label>
          <select id="lineDelimiter">
            <option value=",">Vírgula</option>
            <option value=";">Ponto e vírgula</option>
            <option value="|">Barra vertical (|)</option>
            <option value="space">Espaços</option>
            <option value="newline">Quebras de linha</option>
            <option value="custom">Separador personalizado</option>
          </select>
        </div>
        <div class="field" id="lineCustomWrap" hidden>
          <label>Separador personalizado</label>
          <input id="lineCustom" type="text" placeholder="Digite o separador">
        </div>
        <div class="checks">
          <label><input type="checkbox" id="lineRemoveEmpty" checked> Remover linhas vazias</label>
        </div>
        <button class="action" id="lineGo">Organizar em linhas</button>
        <div class="result" id="lineResult">Os itens separados aparecerão aqui.</div>
        <button class="secondary" id="lineCopy">Copiar resultado</button>
      `;

    case "remove-duplicates":
      return `
        <div class="field">
          <label>Texto com possíveis linhas repetidas</label>
          <textarea id="duplicatesInput" placeholder="Cole aqui seu texto, com um item por linha..."></textarea>
        </div>
        <div class="checks">
          <label><input type="checkbox" id="duplicatesIgnoreCase" checked> Ignorar diferenças entre maiúsculas e minúsculas</label>
        </div>
        <button class="action" id="duplicatesGo">Remover linhas duplicadas</button>
        <div class="result" id="duplicatesSummary">O resultado aparecerá aqui.</div>
        <div class="result" id="duplicatesResult"></div>
        <button class="secondary" id="duplicatesCopy">Copiar resultado</button>
      `;

    case "text-diff":
      return `
        <div class="field">
          <label>Primeiro texto</label>
          <textarea id="compareTextA" placeholder="Cole o primeiro texto..."></textarea>
        </div>
        <div class="field">
          <label>Segundo texto</label>
          <textarea id="compareTextB" placeholder="Cole o segundo texto..."></textarea>
        </div>
        <button class="action" id="compareGo">Comparar textos</button>
        <div class="result" id="compareSummary">As diferenças aparecerão aqui.</div>
        <div class="result" id="compareResult"></div>
        <button class="secondary" id="compareCopy">Copiar comparação</button>
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


    case "password-check":
      return `
        <div class="field">
          <label>Senha para analisar</label>
          <input id="passwordCheckInput" type="password" autocomplete="off" placeholder="Digite uma senha">
        </div>
        <button class="action" id="passwordCheckGo">Verificar força</button>
        <div class="result" id="passwordCheckResult">A análise é feita neste navegador. A senha não é enviada.</div>
      `;

    case "pin-generator":
      return `
        ${field("Quantidade de dígitos", "pinLength", "6", "number")}
        <button class="action" id="pinGo">Gerar PIN</button>
        <div class="result" id="pinResult">Seu PIN aparecerá aqui.</div>
        <button class="secondary" id="pinCopy">Copiar PIN</button>
      `;

    case "random-password":
      return `
        ${field("Comprimento da senha", "randomPassLength", "20", "number")}
        <div class="checks">
          <label><input type="checkbox" id="randomPassUpper" checked> Maiúsculas</label>
          <label><input type="checkbox" id="randomPassLower" checked> Minúsculas</label>
          <label><input type="checkbox" id="randomPassNumbers" checked> Números</label>
          <label><input type="checkbox" id="randomPassSymbols" checked> Símbolos</label>
        </div>
        <button class="action" id="randomPassGo">Gerar senha aleatória</button>
        <div class="result" id="randomPassResult">Sua senha aparecerá aqui.</div>
        <button class="secondary" id="randomPassCopy">Copiar senha</button>
      `;

    case "md5":
    case "sha256":
      return `
        <div class="field">
          <label>Texto para gerar hash</label>
          <textarea id="hashInput" placeholder="Digite ou cole o texto..."></textarea>
        </div>
        <button class="action" id="hashGo">Gerar ${id.toUpperCase()}</button>
        <p style="font-size:12px;color:#999">MD5 serve para compatibilidade e verificação simples, mas não deve ser usado para proteger senhas ou dados sensíveis. Para uso criptográfico, prefira SHA-256.</p>
        <div class="result" id="hashResult">O hash aparecerá aqui.</div>
        <button class="secondary" id="hashCopy">Copiar hash</button>
      `;

    case "url-encode":
    case "url-decode":
      return `
        <div class="field">
          <label>${id === "url-encode" ? "Texto para codificar" : "Texto codificado"}</label>
          <textarea id="urlTextInput" placeholder="Digite ou cole o conteúdo..."></textarea>
        </div>
        <button class="action" id="urlGo">${id === "url-encode" ? "Codificar URL" : "Decodificar URL"}</button>
        <div class="result" id="urlResult">O resultado aparecerá aqui.</div>
        <button class="secondary" id="urlCopy">Copiar resultado</button>
      `;

    case "token-generator":
      return `
        ${field("Quantidade de caracteres", "tokenLength", "48", "number")}
        <div class="field">
          <label>Formato</label>
          <select id="tokenFormat">
            <option value="hex">Hexadecimal</option>
            <option value="url">Seguro para URL</option>
            <option value="alphanumeric">Letras e números</option>
          </select>
        </div>
        <button class="action" id="tokenGo">Gerar token</button>
        <div class="result" id="tokenResult">Seu token aparecerá aqui.</div>
        <button class="secondary" id="tokenCopy">Copiar token</button>
      `;

    case "uuid-generator":
      return `
        ${field("Quantidade de UUIDs", "uuidCount", "5", "number")}
        <button class="action" id="uuidGo">Gerar UUIDs</button>
        <div class="result" id="uuidResult">Os identificadores aparecerão aqui.</div>
        <button class="secondary" id="uuidCopy">Copiar UUIDs</button>
      `;

    case "scientific-calculator":
      return `
        <div class="field">
          <label>Expressão científica</label>
          <input id="scientificInput" placeholder="Ex.: sin(30) + sqrt(25) + pi">
        </div>
        <div class="field">
          <label>Ângulo</label>
          <select id="scientificAngle"><option value="deg">Graus</option><option value="rad">Radianos</option></select>
        </div>
        <p style="font-size:12px;color:#999">Funções: sin, cos, tan, asin, acos, atan, sqrt, abs, log, ln, exp, floor, ceil, round, min e max. Use ^ para potência.</p>
        <button class="action" id="scientificGo">Calcular</button>
        <div class="result" id="scientificResult">O resultado aparecerá aqui.</div>
      `;

    case "percentage":
      return `
        ${field("Porcentagem (%)", "percentageRate", "15", "number")}
        ${field("Valor base", "percentageBase", "200", "number")}
        <button class="action" id="percentageGo">Calcular porcentagem</button>
        <div class="result" id="percentageResult">O resultado aparecerá aqui.</div>
      `;

    case "rule-of-three":
      return `
        <p style="color:#aaa;font-size:13px">Se A corresponde a B, então C corresponde a X.</p>
        ${field("Valor A", "ruleA", "2", "number")}
        ${field("Valor B", "ruleB", "10", "number")}
        ${field("Valor C", "ruleC", "5", "number")}
        <button class="action" id="ruleGo">Encontrar X</button>
        <div class="result" id="ruleResult">O valor de X aparecerá aqui.</div>
      `;

    case "average":
      return `
        <div class="field">
          <label>Números</label>
          <textarea id="averageInput" placeholder="Digite números separados por vírgula, espaço ou linha. Ex.: 10, 20, 30"></textarea>
        </div>
        <button class="action" id="averageGo">Calcular média</button>
        <div class="result" id="averageResult">A média aparecerá aqui.</div>
      `;

    case "simple-interest":
    case "compound-interest":
      return `
        ${field("Capital inicial (R$)", "interestPrincipal", "1000", "number")}
        ${field("Taxa de juros (%)", "interestRate", "2", "number")}
        ${field("Tempo", "interestTime", "12", "number")}
        <div class="field">
          <label>Período da taxa e do tempo</label>
          <select id="interestPeriod"><option value="month">Mensal</option><option value="year">Anual</option></select>
        </div>
        <button class="action" id="interestGo">Calcular juros</button>
        <div class="result" id="interestResult">O cálculo aparecerá aqui.</div>
      `;

    case "discount":
      return `
        ${field("Preço original (R$)", "discountPrice", "150", "number")}
        ${field("Desconto (%)", "discountRate", "10", "number")}
        <button class="action" id="discountGo">Calcular desconto</button>
        <div class="result" id="discountResult">O preço final aparecerá aqui.</div>
      `;

    case "bmi":
      return `
        ${field("Peso (kg)", "bmiWeight", "70", "number")}
        ${field("Altura (m)", "bmiHeight", "1.75", "number")}
        <button class="action" id="bmiGo">Calcular IMC</button>
        <div class="result" id="bmiResult">O resultado numérico aparecerá aqui. O IMC é apenas um indicador geral.</div>
      `;

    case "area-perimeter":
      return `
        <div class="field">
          <label>Figura geométrica</label>
          <select id="geometryShape"><option value="square">Quadrado</option><option value="rectangle">Retângulo</option><option value="triangle">Triângulo</option><option value="circle">Círculo</option></select>
        </div>
        ${field("Medida A (lado/base/raio)", "geometryA", "5", "number")}
        ${field("Medida B (largura/altura/lado)", "geometryB", "4", "number")}
        ${field("Medida C (terceiro lado do triângulo)", "geometryC", "3", "number")}
        <button class="action" id="geometryGo">Calcular área e perímetro</button>
        <div class="result" id="geometryResult">Os resultados aparecerão aqui.</div>
      `;

    case "currency":
      return `
        ${field("Valor", "currencyAmount", "100", "number")}
        <div class="field"><label>De</label><select id="currencyFrom"><option>BRL</option><option>USD</option><option>EUR</option><option>GBP</option><option>JPY</option><option>CAD</option><option>AUD</option><option>CHF</option><option>ARS</option><option>CLP</option><option>MXN</option><option>CNY</option><option>INR</option><option>NZD</option><option>KRW</option><option>SEK</option><option>NOK</option><option>DKK</option><option>PLN</option><option>ZAR</option></select></div>
        <div class="field"><label>Para</label><select id="currencyTo"><option>USD</option><option selected>BRL</option><option>EUR</option><option>GBP</option><option>JPY</option><option>CAD</option><option>AUD</option><option>CHF</option><option>ARS</option><option>CLP</option><option>MXN</option><option>CNY</option><option>INR</option><option>NZD</option><option>KRW</option><option>SEK</option><option>NOK</option><option>DKK</option><option>PLN</option><option>ZAR</option></select></div>
        <button class="action" id="currencyGo">Consultar cotação e converter</button>
        <div class="result" id="currencyResult">A conversão usará cotações de referência atualizadas diariamente.</div>
      `;

    case "temperature":
      return `
        ${field("Valor", "temperatureValue", "25", "number")}
        <div class="field"><label>Converter de</label><select id="temperatureFrom"><option value="C">Celsius (°C)</option><option value="F">Fahrenheit (°F)</option><option value="K">Kelvin (K)</option></select></div>
        <div class="field"><label>Converter para</label><select id="temperatureTo"><option value="F">Fahrenheit (°F)</option><option value="C">Celsius (°C)</option><option value="K">Kelvin (K)</option></select></div>
        <button class="action" id="temperatureGo">Converter temperatura</button>
        <div class="result" id="temperatureResult">O resultado aparecerá aqui.</div>
      `;

    case "storage":
      return `
        ${field("Valor", "storageValue", "1024", "number")}
        <div class="field"><label>De</label><select id="storageFrom"><option value="B">Bytes</option><option value="KB">KB</option><option value="MB" selected>MB</option><option value="GB">GB</option><option value="TB">TB</option></select></div>
        <div class="field"><label>Para</label><select id="storageTo"><option value="B">Bytes</option><option value="KB">KB</option><option value="MB">MB</option><option value="GB" selected>GB</option><option value="TB">TB</option></select></div>
        <button class="action" id="storageGo">Converter armazenamento</button>
        <div class="result" id="storageResult">O resultado aparecerá aqui.</div>
      `;

    case "speed":
      return `
        ${field("Valor", "speedValue", "100", "number")}
        <div class="field"><label>De</label><select id="speedFrom"><option value="kmh">Quilômetros por hora (km/h)</option><option value="ms">Metros por segundo (m/s)</option><option value="mph">Milhas por hora (mph)</option><option value="knot">Nós (kn)</option></select></div>
        <div class="field"><label>Para</label><select id="speedTo"><option value="ms">Metros por segundo (m/s)</option><option value="kmh">Quilômetros por hora (km/h)</option><option value="mph">Milhas por hora (mph)</option><option value="knot">Nós (kn)</option></select></div>
        <button class="action" id="speedGo">Converter velocidade</button>
        <div class="result" id="speedResult">O resultado aparecerá aqui.</div>
      `;

    case "time-converter":
      return `
        ${field("Valor", "timeValue", "60", "number")}
        <div class="field"><label>De</label><select id="timeFrom"><option value="seconds">Segundos</option><option value="minutes">Minutos</option><option value="hours">Horas</option><option value="days">Dias</option></select></div>
        <div class="field"><label>Para</label><select id="timeTo"><option value="minutes">Minutos</option><option value="seconds">Segundos</option><option value="hours">Horas</option><option value="days">Dias</option></select></div>
        <button class="action" id="timeConvertGo">Converter tempo</button>
        <div class="result" id="timeConvertResult">O resultado aparecerá aqui.</div>
      `;

    case "energy":
      return `
        ${field("Valor", "energyValue", "1000", "number")}
        <div class="field"><label>De</label><select id="energyFrom"><option value="J">Joule (J)</option><option value="kJ">Quilojoule (kJ)</option><option value="cal">Caloria (cal)</option><option value="kcal">Quilocaloria (kcal)</option><option value="Wh">Watt-hora (Wh)</option><option value="kWh">Quilowatt-hora (kWh)</option></select></div>
        <div class="field"><label>Para</label><select id="energyTo"><option value="kJ">Quilojoule (kJ)</option><option value="J">Joule (J)</option><option value="cal">Caloria (cal)</option><option value="kcal">Quilocaloria (kcal)</option><option value="Wh">Watt-hora (Wh)</option><option value="kWh">Quilowatt-hora (kWh)</option></select></div>
        <button class="action" id="energyGo">Converter energia</button>
        <div class="result" id="energyResult">O resultado aparecerá aqui.</div>
      `;

    case "angles":
      return `
        ${field("Valor", "angleValue", "180", "number")}
        <div class="field"><label>De</label><select id="angleFrom"><option value="deg">Graus</option><option value="rad">Radianos</option></select></div>
        <div class="field"><label>Para</label><select id="angleTo"><option value="rad">Radianos</option><option value="deg">Graus</option></select></div>
        <button class="action" id="angleGo">Converter ângulo</button>
        <div class="result" id="angleResult">O resultado aparecerá aqui.</div>
      `;

    case "pressure":
      return `
        ${field("Valor", "pressureValue", "1", "number")}
        <div class="field"><label>De</label><select id="pressureFrom"><option value="Pa">Pascal (Pa)</option><option value="kPa">Quilopascal (kPa)</option><option value="bar">Bar</option><option value="atm">Atmosfera (atm)</option><option value="psi">PSI</option></select></div>
        <div class="field"><label>Para</label><select id="pressureTo"><option value="bar">Bar</option><option value="Pa">Pascal (Pa)</option><option value="kPa">Quilopascal (kPa)</option><option value="atm">Atmosfera (atm)</option><option value="psi">PSI</option></select></div>
        <button class="action" id="pressureGo">Converter pressão</button>
        <div class="result" id="pressureResult">O resultado aparecerá aqui.</div>
      `;

    case "number-bases":
      return `
        ${field("Número inteiro", "baseNumberInput", "1010")}
        <div class="field"><label>Base de origem</label><select id="baseFrom"><option value="2">Binária (2)</option><option value="8">Octal (8)</option><option value="10" selected>Decimal (10)</option><option value="16">Hexadecimal (16)</option></select></div>
        <div class="field"><label>Converter para</label><select id="baseTo"><option value="2">Binária (2)</option><option value="8">Octal (8)</option><option value="10">Decimal (10)</option><option value="16" selected>Hexadecimal (16)</option></select></div>
        <button class="action" id="baseConvertGo">Converter base</button>
        <div class="result" id="baseConvertResult">O resultado aparecerá aqui.</div>
      `;

    case "digital-clock":
      return `
        <div class="result" id="digitalClockTime" style="font-size:38px;text-align:center;font-weight:700">--:--:--</div>
        <div class="result" id="digitalClockDate" style="text-align:center">Carregando data...</div>
        <p style="font-size:12px;color:#999;text-align:center">Horário local deste dispositivo.</p>
      `;

    case "world-clock":
      return `
        <div class="field"><label>Localidade</label><select id="worldClockZone"><option value="America/Sao_Paulo">São Paulo</option><option value="America/New_York">Nova York</option><option value="America/Los_Angeles">Los Angeles</option><option value="Europe/London">Londres</option><option value="Europe/Paris">Paris</option><option value="Europe/Lisbon">Lisboa</option><option value="Asia/Tokyo">Tóquio</option><option value="Asia/Dubai">Dubai</option><option value="Asia/Shanghai">Xangai</option><option value="Australia/Sydney">Sydney</option></select></div>
        <div class="result" id="worldClockTime" style="font-size:34px;text-align:center;font-weight:700">--:--:--</div>
        <div class="result" id="worldClockDate" style="text-align:center"></div>
      `;

    case "countdown":
      return `
        <div class="field"><label>Data e horário do evento</label><input id="countdownTarget" type="datetime-local"></div>
        <button class="action" id="countdownGo">Iniciar contagem</button>
        <div class="result" id="countdownResult">Escolha uma data futura.</div>
      `;

    case "age-calculator":
      return `
        <div class="field"><label>Data de nascimento</label><input id="ageBirth" type="date"></div>
        <button class="action" id="ageGo">Calcular idade</button>
        <div class="result" id="ageResult">Sua idade aparecerá aqui.</div>
      `;

    case "date-difference":
      return `
        <div class="field"><label>Data inicial</label><input id="dateStart" type="date"></div>
        <div class="field"><label>Data final</label><input id="dateEnd" type="date"></div>
        <button class="action" id="dateDiffGo">Calcular diferença</button>
        <div class="result" id="dateDiffResult">A diferença aparecerá aqui.</div>
      `;

    case "work-hours":
      return `
        <div class="field"><label>Início do expediente</label><input id="workStart" type="time" value="09:00"></div>
        <div class="field"><label>Fim do expediente</label><input id="workEnd" type="time" value="18:00"></div>
        ${field("Intervalo em minutos", "workBreak", "60", "number")}
        <button class="action" id="workGo">Calcular horas trabalhadas</button>
        <div class="result" id="workResult">O total aparecerá aqui.</div>
      `;

    case "timezone":
      return `
        <div class="field"><label>Data e horário de origem</label><input id="timezoneDate" type="datetime-local"></div>
        <div class="field"><label>Fuso de origem</label><select id="timezoneFrom"><option value="America/Sao_Paulo">São Paulo</option><option value="America/New_York">Nova York</option><option value="Europe/London">Londres</option><option value="Europe/Lisbon">Lisboa</option><option value="Europe/Paris">Paris</option><option value="Asia/Tokyo">Tóquio</option><option value="Asia/Dubai">Dubai</option><option value="Australia/Sydney">Sydney</option><option value="UTC">UTC</option></select></div>
        <div class="field"><label>Converter para</label><select id="timezoneTo"><option value="America/New_York">Nova York</option><option value="America/Sao_Paulo">São Paulo</option><option value="Europe/London">Londres</option><option value="Europe/Lisbon">Lisboa</option><option value="Europe/Paris">Paris</option><option value="Asia/Tokyo">Tóquio</option><option value="Asia/Dubai">Dubai</option><option value="Australia/Sydney">Sydney</option><option value="UTC">UTC</option></select></div>
        <button class="action" id="timezoneGo">Converter horário</button>
        <div class="result" id="timezoneResult">O horário convertido aparecerá aqui.</div>
      `;

    case "deadline":
      return `
        <div class="field"><label>Data inicial</label><input id="deadlineStart" type="date"></div>
        ${field("Quantidade de dias", "deadlineDays", "10", "number")}
        <div class="checks"><label><input type="checkbox" id="deadlineBusiness"> Contar apenas dias úteis (segunda a sexta)</label></div>
        <button class="action" id="deadlineGo">Calcular prazo</button>
        <div class="result" id="deadlineResult">A data final aparecerá aqui.</div>
      `;

    case "base64-decode":
      return `
        <div class="field"><label>Conteúdo Base64</label><textarea id="base64DecodeInput" placeholder="Cole o conteúdo Base64..."></textarea></div>
        <button class="action" id="base64DecodeGo">Decodificar Base64</button>
        <div class="result" id="base64DecodeResult">O conteúdo decodificado aparecerá aqui.</div>
        <button class="secondary" id="base64DecodeCopy">Copiar resultado</button>
      `;

    case "html-formatter":
    case "css-formatter":
    case "js-formatter":
      return `
        <div class="field"><label>Código para organizar</label><textarea id="formatterInput" rows="10" spellcheck="false" placeholder="Cole seu código aqui..."></textarea></div>
        <button class="action" id="formatterGo">Formatar código</button>
        <div class="field"><label>Código formatado</label><textarea id="formatterResult" rows="10" spellcheck="false" readonly placeholder="O código formatado aparecerá aqui..."></textarea></div>
        <button class="secondary" id="formatterCopy">Copiar código</button>
        <p style="font-size:12px;color:#999">O formatador usa Prettier no navegador. Na primeira utilização, precisa carregar a biblioteca pela internet.</p>
      `;

    case "code-minifier":
      return `
        <div class="field"><label>Tipo de código</label><select id="minifyType"><option value="html">HTML</option><option value="css">CSS</option><option value="js">JavaScript</option></select></div>
        <div class="field"><label>Código original</label><textarea id="minifyInput" rows="9" spellcheck="false" placeholder="Cole o código que deseja compactar..."></textarea></div>
        <button class="action" id="minifyGo">Minificar código</button>
        <p style="font-size:12px;color:#999">Compactação básica para reduzir espaços e comentários. Revise e teste o código minificado antes de publicar.</p>
        <div class="field"><label>Código minificado</label><textarea id="minifyResult" rows="9" spellcheck="false" readonly></textarea></div>
        <button class="secondary" id="minifyCopy">Copiar código</button>
      `;

    case "json-validator":
      return `
        <div class="field"><label>JSON para validar</label><textarea id="jsonValidateInput" rows="9" spellcheck="false" placeholder='{"nome":"PD Tools"}'></textarea></div>
        <button class="action" id="jsonValidateGo">Validar JSON</button>
        <div class="result" id="jsonValidateResult">O resultado da validação aparecerá aqui.</div>
        <button class="secondary" id="jsonValidateCopy">Copiar JSON formatado</button>
      `;

    case "api-qr":
      return `
        <div class="field"><label>Endereço da API</label><textarea id="apiQrInput" rows="3" placeholder="https://api.exemplo.com/v1/endpoint"></textarea></div>
        <button class="action" id="apiQrGo">Gerar QR Code da API</button>
        <div id="apiQrResult" style="display:grid;justify-items:center;gap:10px;margin:15px 0"></div>
        <button class="secondary" id="apiQrDownload" hidden>Baixar QR Code</button>
      `;

    case "image-bg-remover":
      return `<div class="field"><label>Escolha uma imagem</label><input id="imgBgFile" type="file" accept="image/*"></div><div id="imgBgPreview" class="result">A imagem processada aparecerá aqui.</div><button class="action" id="imgBgGo">Remover fundo</button><button class="secondary" id="imgBgDownload" hidden>Baixar PNG transparente</button><p style="font-size:12px;color:#999">O processamento é feito no navegador. Na primeira utilização, será necessário baixar o modelo pela internet.</p>`;
    case "image-compressor":
      return `<div class="field"><label>Imagem</label><input id="imgCompFile" type="file" accept="image/*"></div><div class="field"><label>Qualidade: <span id="imgCompQualityLabel">75%</span></label><input id="imgCompQuality" type="range" min="10" max="100" value="75"></div><div class="field"><label>Formato</label><select id="imgCompFormat"><option value="image/webp">WEBP</option><option value="image/jpeg">JPG</option></select></div><div class="result" id="imgCompResult">Selecione uma imagem para começar.</div><button class="action" id="imgCompGo">Comprimir imagem</button><button class="secondary" id="imgCompDownload" hidden>Baixar imagem</button>`;
    case "image-resizer":
      return `<div class="field"><label>Imagem</label><input id="imgResizeFile" type="file" accept="image/*"></div><div class="field"><label>Largura (px)</label><input id="imgResizeWidth" type="number" min="1" placeholder="Ex.: 800"></div><div class="field"><label>Altura (px)</label><input id="imgResizeHeight" type="number" min="1" placeholder="Ex.: 600"></div><label><input id="imgResizeKeep" type="checkbox" checked> Manter proporção</label><button class="action" id="imgResizeGo">Redimensionar</button><button class="secondary" id="imgResizeDownload" hidden>Baixar imagem</button><div class="result" id="imgResizeResult">A imagem redimensionada aparecerá aqui.</div>`;
    case "image-converter":
      return `<div class="field"><label>Imagem</label><input id="imgConvertFile" type="file" accept="image/*"></div><div class="field"><label>Converter para</label><select id="imgConvertFormat"><option value="image/png">PNG</option><option value="image/jpeg">JPG</option><option value="image/webp">WEBP</option></select></div><button class="action" id="imgConvertGo">Converter imagem</button><button class="secondary" id="imgConvertDownload" hidden>Baixar imagem</button><div class="result" id="imgConvertResult">O resultado aparecerá aqui.</div>`;
    case "image-crop":
      return `<div class="field"><label>Imagem</label><input id="imgCropFile" type="file" accept="image/*"></div><div class="field"><label>Posição X (px)</label><input id="imgCropX" type="number" min="0" value="0"></div><div class="field"><label>Posição Y (px)</label><input id="imgCropY" type="number" min="0" value="0"></div><div class="field"><label>Largura do corte (px)</label><input id="imgCropW" type="number" min="1" placeholder="Largura"></div><div class="field"><label>Altura do corte (px)</label><input id="imgCropH" type="number" min="1" placeholder="Altura"></div><button class="action" id="imgCropGo">Cortar imagem</button><button class="secondary" id="imgCropDownload" hidden>Baixar recorte</button><div class="result" id="imgCropResult">O recorte aparecerá aqui.</div>`;
    case "image-rotate":
      return `<div class="field"><label>Imagem</label><input id="imgRotateFile" type="file" accept="image/*"></div><div class="field"><label>Rotação</label><select id="imgRotateAngle"><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></div><button class="action" id="imgRotateGo">Rotacionar imagem</button><button class="secondary" id="imgRotateDownload" hidden>Baixar imagem</button><div class="result" id="imgRotateResult">A imagem rotacionada aparecerá aqui.</div>`;
    case "image-resolution":
      return `<div class="field"><label>Imagem</label><input id="imgResFile" type="file" accept="image/*"></div><div class="field"><label>Reduzir para</label><select id="imgResScale"><option value="75">75%</option><option value="50" selected>50%</option><option value="25">25%</option><option value="10">10%</option></select></div><button class="action" id="imgResGo">Reduzir resolução</button><button class="secondary" id="imgResDownload" hidden>Baixar imagem</button><div class="result" id="imgResResult">O resultado aparecerá aqui.</div>`;
    case "image-circle":
      return `<div class="field"><label>Imagem</label><input id="imgCircleFile" type="file" accept="image/*"></div><button class="action" id="imgCircleGo">Criar imagem circular</button><button class="secondary" id="imgCircleDownload" hidden>Baixar PNG</button><div class="result" id="imgCircleResult">A imagem circular aparecerá aqui.</div>`;
    case "image-watermark":
      return `<div class="field"><label>Imagem</label><input id="imgWaterFile" type="file" accept="image/*"></div><div class="field"><label>Texto da marca d'água</label><input id="imgWaterText" placeholder="Ex.: PD Tools"></div><div class="field"><label>Opacidade: <span id="imgWaterOpacityLabel">40%</span></label><input id="imgWaterOpacity" type="range" min="10" max="100" value="40"></div><button class="action" id="imgWaterGo">Adicionar marca d'água</button><button class="secondary" id="imgWaterDownload" hidden>Baixar imagem</button><div class="result" id="imgWaterResult">O resultado aparecerá aqui.</div>`;
    case "image-color-picker":
      return `<div class="field"><label>Imagem</label><input id="imgColorFile" type="file" accept="image/*"></div><p style="font-size:12px;color:#999">Clique na imagem para capturar a cor daquele ponto.</p><div id="imgColorPreview" style="max-width:100%;overflow:auto"></div><div class="result" id="imgColorResult">HEX e RGB aparecerão aqui.</div><button class="secondary" id="imgColorCopy">Copiar cor HEX</button>`;

    case "color-viewer":
      return `
        <div class="field"><label>Cor hexadecimal</label><input id="colorHexInput" value="#8b5cf6" placeholder="#8b5cf6"></div>
        <div class="field"><label>Ou escolha uma cor</label><input id="colorPickerInput" type="color" value="#8b5cf6"></div>
        <button class="action" id="colorViewerGo">Visualizar cor</button>
        <div id="colorViewerSwatch" style="height:100px;border-radius:12px;margin:14px 0;background:#8b5cf6"></div>
        <div class="result" id="colorViewerResult">HEX, RGB e HSL aparecerão aqui.</div>
        <button class="secondary" id="colorViewerCopy">Copiar valores</button>
      `;

    default:
      return "<p>Esta ferramenta ainda não foi implementada.</p>";
  }
}

function copy(value) {
  if (!value) return toast("Nada para copiar.");

  navigator.clipboard?.writeText(value)
    .then(() => toast("Copiado!"))
    .catch(() => toast("Não foi possível copiar."));
}

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function gerarCor() {
  return "#" + Math.floor(Math.random() * 16777215)
    .toString(16).padStart(6, "0");
}

function hexParaHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }

    h /= 6;
  }

  return [h * 360, s * 100, l * 100];
}

function hslParaHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s /= 100;
  l /= 100;

  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };

  return `#${f(0)}${f(8)}${f(4)}`;
}


function secureRandomInt(max) {
  if (!Number.isInteger(max) || max < 1) throw new Error("Limite aleatório inválido.");
  const range = 0x100000000;
  const limit = Math.floor(range / max) * max;
  const buffer = new Uint32Array(1);
  let value;
  do { crypto.getRandomValues(buffer); value = buffer[0]; } while (value >= limit);
  return value % max;
}

function secureRandomString(length, alphabet) {
  return Array.from({ length }, () => alphabet[secureRandomInt(alphabet.length)]).join("");
}

function formatNumber(value, digits = 6) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value);
}

function readNumber(id, label) {
  const raw = $(id)?.value ?? "";
  const value = Number(String(raw).replace(",", "."));
  if (String(raw).trim() === "" || !Number.isFinite(value)) throw new Error(`Informe ${label} com um número válido.`);
  return value;
}

function md5Hash(text) {
  const bytes = new TextEncoder().encode(text);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, bitLength >>> 0, true);
  view.setUint32(paddedLength - 4, Math.floor(bitLength / 0x100000000), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const shifts = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  const constants = Array.from({length:64}, (_,i) => Math.floor(Math.abs(Math.sin(i+1)) * 0x100000000) >>> 0);
  const leftRotate = (x, amount) => (x << amount) | (x >>> (32-amount));
  for (let offset=0; offset<paddedLength; offset+=64) {
    const words = Array.from({length:16}, (_,i) => view.getUint32(offset+i*4, true));
    let a=a0, b=b0, c=c0, d=d0;
    for (let i=0; i<64; i++) {
      let f, g;
      if (i<16) { f=(b & c) | (~b & d); g=i; }
      else if (i<32) { f=(d & b) | (~d & c); g=(5*i+1)%16; }
      else if (i<48) { f=b ^ c ^ d; g=(3*i+5)%16; }
      else { f=c ^ (b | ~d); g=(7*i)%16; }
      const nextD=d; d=c; c=b;
      const sum=(a + f + constants[i] + words[g]) >>> 0;
      b=(b + leftRotate(sum, shifts[i])) >>> 0; a=nextD;
    }
    a0=(a0+a)>>>0; b0=(b0+b)>>>0; c0=(c0+c)>>>0; d0=(d0+d)>>>0;
  }
  return [a0,b0,c0,d0].map(word => [0,8,16,24].map(shift => ((word>>>shift)&255).toString(16).padStart(2,"0")).join("")).join("");
}

async function ensurePrettier() {
  if (window.__pdPrettierResources) return window.__pdPrettierResources;
  const root = "https://unpkg.com/prettier@3.9.10";
  const [prettier, html, postcss, babel, estree] = await Promise.all([
    import(`${root}/standalone.mjs`),
    import(`${root}/plugins/html.mjs`),
    import(`${root}/plugins/postcss.mjs`),
    import(`${root}/plugins/babel.mjs`),
    import(`${root}/plugins/estree.mjs`)
  ]);
  window.__pdPrettierResources = {
    format: prettier.format,
    plugins: { html: [html], css: [postcss], babel: [babel, estree] }
  };
  return window.__pdPrettierResources;
}

function compactCode(source, type) {
  // Compactação conservadora: preserva textos entre aspas e remove comentários/espaços redundantes.
  let out="", quote=null, template=false, lineComment=false, blockComment=false, pendingSpace=false;
  const isWord = ch => !!ch && /[\w$]/.test(ch);
  for (let i=0; i<source.length; i++) {
    const ch=source[i], next=source[i+1];
    if (lineComment) { if (ch === "\n") { lineComment=false; pendingSpace=true; } continue; }
    if (blockComment) { if (ch === "*" && next === "/") { blockComment=false; i++; pendingSpace=true; } continue; }
    if (quote) {
      out += ch;
      if (ch === "\\" && i+1<source.length) out += source[++i];
      else if (ch === quote) quote=null;
      continue;
    }
    if (ch === "'" || ch === '"' || (ch === "`" && type === "js")) {
      if (pendingSpace && isWord(out.at(-1))) out += " ";
      pendingSpace=false; quote=ch; out+=ch; continue;
    }
    if (type === "js" && ch === "/" && next === "/") { lineComment=true; i++; continue; }
    if (ch === "/" && next === "*") { blockComment=true; i++; continue; }
    if (/\s/.test(ch)) { pendingSpace=true; continue; }
    if (pendingSpace) {
      const prev=out.at(-1);
      const needsSpace = isWord(prev) && isWord(ch) || (type === "js" && ((prev === "+" && ch === "+") || (prev === "-" && ch === "-")));
      if (needsSpace) out += " ";
      pendingSpace=false;
    }
    if (type === "html" && ch === ">" && out.endsWith("--")) { /* comments are removed above */ }
    out += ch;
  }
  if (type === "html") out=out.replace(/>\s+</g, "><").replace(/<!--[^]*?-->/g, "");
  return out.trim();
}

function zonedDateTimeToDate(value, timeZone) {
  if (!value) throw new Error("Escolha a data e o horário.");
  const [datePart,timePart] = value.split("T");
  const [y,m,d] = datePart.split("-").map(Number);
  const [hh,mm] = timePart.split(":").map(Number);
  const target = Date.UTC(y,m-1,d,hh,mm);
  let guess = target;
  const fmt = new Intl.DateTimeFormat("en-CA", {timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
  for (let i=0;i<4;i++) {
    const parts=Object.fromEntries(fmt.formatToParts(new Date(guess)).map(p=>[p.type,p.value]));
    const seen=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second));
    const delta=target-seen;
    guess+=delta;
    if (delta===0) break;
  }
  return new Date(guess);
}

function formatDateInZone(date, zone) {
  return new Intl.DateTimeFormat("pt-BR", {timeZone:zone,dateStyle:"full",timeStyle:"short"}).format(date);
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

  if (id === "names") {
    $("#nameMake").onclick = () => {
      const style = $("#nameStyle").value;
      const word = $("#nameWord").value.trim();

      const lists = {
        brand: ["Nova", "Pixel", "Prime", "Nexus", "Vortex", "Orbit", "Pulse", "Vision", "Core", "Infinity"],
        game: ["Shadow", "Dragon", "Phantom", "Blaze", "Storm", "Raven", "Wolf", "Knight", "Ghost", "Hunter"],
        nickname: ["Dark", "Fast", "Lucky", "Crazy", "Silent", "King", "Zero", "Frost", "Fire", "Legend"],
        fantasy: ["Eldoria", "Aether", "Valoria", "Drakon", "Mystara", "Eclipse", "Arvand", "Zephyria", "Nébula", "Lunaris"]
      };

      const suffixes = ["X", "Lab", "Hub", "Zone", "One", "Pro", "BR", "Plus", "Studio", "World"];
      const results = [];

      for (let i = 0; i < 10; i++) {
        const base = randomItem(lists[style]);
        const suffix = randomItem(suffixes);
        results.push(word ? `${word} ${base}` : `${base}${suffix}`);
      }

      $("#nameResult").textContent = [...new Set(results)].join("\n");
    };

    $("#nameCopy").onclick = () => copy($("#nameResult").textContent);
  }

  if (id === "ideas") {
    $("#ideaMake").onclick = () => {
      const ideas = {
        business: [
          "Criar uma loja virtual de produtos personalizados.",
          "Montar um serviço de assinatura mensal.",
          "Criar uma marca com produtos exclusivos.",
          "Oferecer consultoria para pequenos negócios.",
          "Criar um marketplace de serviços locais.",
          "Desenvolver uma plataforma de cursos.",
          "Criar kits personalizados para presentes.",
          "Montar um clube de benefícios.",
          "Criar uma agência de conteúdo digital.",
          "Desenvolver uma ferramenta online gratuita."
        ],
        content: [
          "Criar uma série de vídeos com dicas rápidas.",
          "Fazer desafios semanais com seguidores.",
          "Publicar curiosidades em formato de quiz.",
          "Criar tutoriais para iniciantes.",
          "Fazer comparações entre ferramentas.",
          "Criar uma série de erros comuns.",
          "Publicar bastidores do projeto.",
          "Criar vídeos respondendo perguntas.",
          "Fazer rankings temáticos.",
          "Criar um quadro de novidades."
        ],
        game: [
          "Organizar um campeonato entre jogadores.",
          "Criar um sistema de missões semanais.",
          "Fazer uma caça ao tesouro.",
          "Criar um desafio de sobrevivência.",
          "Montar um ranking por temporadas.",
          "Organizar uma noite de jogos.",
          "Criar um mapa personalizado.",
          "Fazer um torneio em equipes.",
          "Criar recompensas por conquistas.",
          "Organizar uma competição de construção."
        ],
        community: [
          "Criar um membro destaque da semana.",
          "Organizar encontros temáticos.",
          "Criar um mural de sugestões.",
          "Fazer uma votação de eventos.",
          "Criar desafios entre grupos.",
          "Montar um programa de boas-vindas.",
          "Criar uma campanha de participação.",
          "Organizar uma noite de perguntas.",
          "Criar um sistema de reconhecimento.",
          "Fazer uma retrospectiva mensal."
        ],
        general: [
          "Criar um projeto colaborativo.",
          "Organizar um desafio de 7 dias.",
          "Desenvolver uma ferramenta simples.",
          "Criar um guia para iniciantes.",
          "Montar uma competição criativa.",
          "Criar um calendário de atividades.",
          "Desenvolver uma identidade visual.",
          "Criar um espaço de compartilhamento.",
          "Organizar uma votação de ideias.",
          "Criar um projeto com metas mensais."
        ]
      };

      $("#ideaResult").textContent = [...ideas[$("#ideaType").value]]
        .sort(() => Math.random() - 0.5)
        .slice(0, 5)
        .map((idea, i) => `${i + 1}. ${idea}`)
        .join("\n");
    };

    $("#ideaCopy").onclick = () => copy($("#ideaResult").textContent);
  }

  if (id === "slogans") {
    $("#sloganMake").onclick = () => {
      const name = $("#sloganName").value.trim() || "Sua marca";

      const phrases = {
        impact: ["O próximo nível começa aqui.", "Feito para ir além.", "Sua evolução não tem limites.", "Transformando possibilidades em realidade.", "O futuro começa agora."],
        modern: ["Inovação em cada detalhe.", "Simples. Inteligente. Seu.", "Uma nova forma de fazer.", "Conectando ideias ao futuro.", "Tecnologia que acompanha você."],
        creative: ["Ideias que ganham vida.", "Onde a criatividade acontece.", "Pense diferente. Crie mais.", "Sua imaginação em movimento.", "Criatividade sem fronteiras."],
        professional: ["Compromisso com resultados.", "Excelência em cada etapa.", "Soluções que fazem a diferença.", "Qualidade que inspira confiança.", "Construindo resultados juntos."]
      };

      $("#sloganResult").textContent = phrases[$("#sloganStyle").value]
        .map((phrase, i) => `${i + 1}. ${name} — ${phrase}`)
        .join("\n");
    };

    $("#sloganCopy").onclick = () => copy($("#sloganResult").textContent);
  }

  if (id === "palette") {
    const gerar = () => {
      const colors = Array.from({ length: 5 }, gerarCor);

      $("#paletteResult").innerHTML = colors.map(color => `
        <div style="display:flex;align-items:center;gap:10px;margin:9px 0">
          <span style="width:42px;height:32px;border-radius:7px;background:${color};display:inline-block"></span>
          <b>${color}</b>
        </div>
      `).join("");

      $("#paletteResult").dataset.colors = colors.join(", ");
    };

    $("#paletteMake").onclick = gerar;
    $("#paletteCopy").onclick = () => copy($("#paletteResult").dataset.colors);
    gerar();
  }

  if (id === "gradients") {
    const atualizar = () => {
      const a = $("#gradientA").value;
      const b = $("#gradientB").value;
      const direction = $("#gradientDirection").value;
      const css = `linear-gradient(${direction}, ${a}, ${b})`;

      $("#gradientPreview").style.background = css;
      $("#gradientResult").textContent = `background: ${css};`;
    };

    $("#gradientMake").onclick = atualizar;
    $("#gradientCopy").onclick = () => copy($("#gradientResult").textContent);
    $("#gradientA").oninput = atualizar;
    $("#gradientB").oninput = atualizar;
    $("#gradientDirection").onchange = atualizar;
    atualizar();
  }

  if (id === "color-combinations") {
    $("#combinationMake").onclick = () => {
      const [h, s, l] = hexParaHsl($("#combinationColor").value);

      const colors = [
        hslParaHex(h, s, l),
        hslParaHex(h + 180, s, l),
        hslParaHex(h + 30, s, l),
        hslParaHex(h + 150, s, l),
        hslParaHex(h + 210, s, l)
      ];

      $("#combinationResult").innerHTML = colors.map(color => `
        <div style="display:flex;align-items:center;gap:10px;margin:9px 0">
          <span style="width:42px;height:32px;border-radius:7px;background:${color};display:inline-block"></span>
          <b>${color}</b>
        </div>
      `).join("");

      $("#combinationResult").dataset.colors = colors.join(", ");
    };

    $("#combinationCopy").onclick = () => copy($("#combinationResult").dataset.colors);
    $("#combinationMake").click();
  }

  if (id === "symbols") {
    const groups = {
      arrows: "← → ↑ ↓ ↗ ↘ ↙ ↖ ⇐ ⇒ ⇑ ⇓ ↔ ↕ ⟵ ⟶",
      stars: "★ ☆ ✦ ✧ ✩ ✪ ✫ ✬ ✭ ✮ ✯ ✰ ⋆ ⁕",
      shapes: "■ □ ▪ ▫ ● ○ ◉ ◎ ◆ ◇ ▲ △ ▼ ▽",
      special: "© ® ™ § ¶ † ‡ ※ ⁂ ♡ ♥ ♧ ♢ ♤ ♠",
      all: "← → ↑ ↓ ↗ ↘ ↙ ↖ ⇐ ⇒ ⇑ ⇓ ↔ ↕ ★ ☆ ✦ ✧ ✩ ✪ ✫ ✬ ✭ ✮ ✯ ✰ ■ □ ▪ ▫ ● ○ ◉ ◎ ◆ ◇ ▲ △ ▼ ▽ © ® ™ § ¶ † ‡ ※ ⁂ ♡ ♥ ♧ ♢ ♤ ♠"
    };

    const atualizar = () => {
      const symbols = groups[$("#symbolType").value].split(" ");

      $("#symbolResult").innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">
          ${symbols.map(symbol => `
            <button type="button" class="secondary symbol-option"
              data-symbol="${symbol}" style="font-size:22px;padding:10px">
              ${symbol}
            </button>
          `).join("")}
        </div>
      `;

      $$("#symbolResult [data-symbol]").forEach(button => {
        button.onclick = () => copy(button.dataset.symbol);
      });

      $("#symbolResult").dataset.symbols = symbols.join(" ");
    };

    $("#symbolType").onchange = atualizar;
    $("#symbolCopy").onclick = () => copy($("#symbolResult").dataset.symbols);
    atualizar();
  }

  if (id === "fonts") {
    const mapear = (text, start) => [...text].map(char => {
      const code = char.codePointAt(0);

      if (code >= 65 && code <= 90) return String.fromCodePoint(start + code - 65);
      if (code >= 97 && code <= 122) return String.fromCodePoint(start + code - 97);
      return char;
    }).join("");

    $("#fontMake").onclick = () => {
      const value = $("#fontInput").value;
      if (!value) return toast("Digite um texto primeiro.");

      const styles = [
        ["Negrito", mapear(value, 0x1D400)],
        ["Itálico", mapear(value, 0x1D434)],
        ["Negrito itálico", mapear(value, 0x1D468)],
        ["Monoespaçado", mapear(value, 0x1D670)],
        ["Duplo", mapear(value, 0x1D538)]
      ];

      const result = styles.map(([name, text]) => `${name}: ${text}`).join("\n\n");
      $("#fontResult").textContent = result;
    };

    $("#fontCopy").onclick = () => copy($("#fontResult").textContent);
  }

  if (id === "decorative-text") {
    $("#decorativeMake").onclick = () => {
      const value = $("#decorativeInput").value.trim();
      if (!value) return toast("Digite um texto primeiro.");

      const results = [
        `★彡 ${value} 彡★`,
        `『 ${value} 』`,
        `꧁ ${value} ꧂`,
        `༺ ${value} ༻`,
        `✧･ﾟ: ${value} :･ﾟ✧`,
        `【 ${value} 】`,
        `『✦』${value}『✦』`,
        `•°¯\`${value}\`¯°•`,
        `♡ ${value} ♡`,
        `⫷ ${value} ⫸`
      ];

      $("#decorativeResult").textContent = results.join("\n");
    };

    $("#decorativeCopy").onclick = () => copy($("#decorativeResult").textContent);
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

  if (id === "remove-spaces") {
    $("#removeSpacesGo").onclick = () => {
      const value = $("#removeSpacesInput").value;
      if (!value.trim()) return toast("Digite ou cole um texto.");

      $("#removeSpacesResult").textContent = value.replace(/\s+/g, " ").trim();
    };

    $("#removeSpacesCopy").onclick = () => copy($("#removeSpacesResult").textContent);
  }

  if (id === "reverse-text") {
    $("#reverseTextGo").onclick = () => {
      const value = $("#reverseTextInput").value;
      if (!value) return toast("Digite ou cole um texto.");

      $("#reverseTextResult").textContent = [...value].reverse().join("");
    };

    $("#reverseTextCopy").onclick = () => copy($("#reverseTextResult").textContent);
  }

  if (id === "spell-checker") {
    $("#spellGo").onclick = async () => {
      const textToCheck = $("#spellInput").value;
      if (!textToCheck.trim()) return toast("Digite um texto para revisar.");
      if (textToCheck.length > 20000) return toast("O texto deve ter até 20.000 caracteres.");

      const button = $("#spellGo");
      const originalLabel = button.textContent;
      button.disabled = true;
      button.textContent = "Revisando...";
      $("#spellSummary").textContent = "Analisando ortografia e gramática...";

      try {
        const body = new URLSearchParams({
          text: textToCheck,
          language: $("#spellLanguage").value
        });
        const response = await fetch("https://api.languagetool.org/v2/check", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const matches = Array.isArray(data.matches) ? data.matches : [];
        let corrected = textToCheck;
        let lastStart = Infinity;

        [...matches]
          .sort((a, b) => b.offset - a.offset)
          .forEach(match => {
            const suggestion = match.replacements?.[0]?.value;
            const start = Number(match.offset);
            const length = Number(match.length);
            if (typeof suggestion !== "string" || !Number.isInteger(start) || !Number.isInteger(length)) return;
            if (start < 0 || length < 0 || start + length > textToCheck.length || start + length > lastStart) return;
            corrected = corrected.slice(0, start) + suggestion + corrected.slice(start + length);
            lastStart = start;
          });

        $("#spellCorrected").value = corrected;
        if (!matches.length) {
          $("#spellSummary").textContent = "Nenhum possível erro foi encontrado. Seu texto está pronto!";
        } else {
          const details = matches.slice(0, 12).map(match => {
            const original = textToCheck.slice(match.offset, match.offset + match.length);
            const suggestion = match.replacements?.[0]?.value;
            return `<div style="margin:8px 0;padding:9px;border-bottom:1px solid #333">
              <b>${esc(original || "Trecho")}</b>
              ${suggestion ? ` → <b>${esc(suggestion)}</b>` : ""}
              <div style="font-size:12px;color:#aaa">${esc(match.message || "Possível ajuste")}</div>
            </div>`;
          }).join("");
          $("#spellSummary").innerHTML = `<b>${matches.length} possível(is) ajuste(s) encontrado(s).</b>${details}`;
        }
      } catch (error) {
        console.error("Erro ao revisar texto:", error);
        $("#spellSummary").textContent = "Não foi possível acessar o serviço de correção agora. Tente novamente mais tarde.";
      } finally {
        button.disabled = false;
        button.textContent = originalLabel;
      }
    };

    $("#spellCopy").onclick = () => copy($("#spellCorrected").value);
  }

  if (id === "find-replace") {
    $("#replaceGo").onclick = () => {
      const source = $("#replaceText").value;
      const find = $("#replaceFind").value;
      const replacement = $("#replaceWith").value;
      if (!source) return toast("Digite o texto que deseja editar.");
      if (!find) return toast("Digite o termo que deseja localizar.");

      const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const flags = $("#replaceCaseSensitive").checked ? "g" : "gi";
      const expression = new RegExp(escaped, flags);
      const count = (source.match(expression) || []).length;
      const updated = source.replace(expression, () => replacement);
      $("#replaceResult").textContent = `${updated}\n\nSubstituições realizadas: ${count}`;
      $("#replaceResult").dataset.output = updated;
    };

    $("#replaceCopy").onclick = () => copy($("#replaceResult").dataset.output || "");
  }

  if (id === "lorem-ipsum") {
    const paragraphs = [
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
      "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
      "Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris.",
      "Integer in mauris eu nibh euismod gravida. Duis ac tellus et risus vulputate vehicula. Donec lobortis risus a elit. Etiam tempor. Ut ullamcorper, ligula eu tempor congue, eros est euismod turpis, id tincidunt sapien risus a quam.",
      "Maecenas fermentum consequat mi. Donec fermentum. Pellentesque malesuada nulla a mi. Duis sapien sem, aliquet nec, commodo eget, consequat quis, neque. Aliquam faucibus, elit ut dictum aliquet, felis nisl adipiscing sapien, sed malesuada diam lacus eget erat."
    ];

    $("#loremGo").onclick = () => {
      const count = Math.min(10, Math.max(1, Number($("#loremCount").value) || 3));
      const output = Array.from({ length: count }, (_, index) => paragraphs[index % paragraphs.length]);
      $("#loremResult").textContent = output.join("\n\n");
    };

    $("#loremCopy").onclick = () => copy($("#loremResult").textContent);
    $("#loremGo").click();
  }

  if (id === "line-splitter") {
    const delimiterSelect = $("#lineDelimiter");
    const customWrap = $("#lineCustomWrap");
    delimiterSelect.onchange = () => {
      customWrap.hidden = delimiterSelect.value !== "custom";
    };

    $("#lineGo").onclick = () => {
      const source = $("#lineSource").value;
      if (!source.trim()) return toast("Digite um texto para organizar.");

      let parts;
      switch (delimiterSelect.value) {
        case "space": parts = source.trim().split(/\s+/); break;
        case "newline": parts = source.split(/\r?\n/); break;
        case "custom": {
          const custom = $("#lineCustom").value;
          if (!custom) return toast("Digite o separador personalizado.");
          parts = source.split(custom);
          break;
        }
        default: parts = source.split(delimiterSelect.value);
      }

      parts = parts.map(item => item.trim());
      if ($("#lineRemoveEmpty").checked) parts = parts.filter(Boolean);
      const output = parts.join("\n");
      $("#lineResult").textContent = output || "Nenhum item encontrado.";
      $("#lineResult").dataset.output = output;
    };

    $("#lineCopy").onclick = () => copy($("#lineResult").dataset.output || "");
  }

  if (id === "remove-duplicates") {
    $("#duplicatesGo").onclick = () => {
      const source = $("#duplicatesInput").value;
      if (!source.trim()) return toast("Cole um texto com uma linha por item.");

      const ignoreCase = $("#duplicatesIgnoreCase").checked;
      const seen = new Set();
      const unique = [];
      let removed = 0;

      source.split(/\r?\n/).forEach(line => {
        const key = ignoreCase ? line.trim().toLocaleLowerCase("pt-BR") : line.trim();
        if (!key) return;
        if (seen.has(key)) {
          removed++;
        } else {
          seen.add(key);
          unique.push(line.trim());
        }
      });

      const output = unique.join("\n");
      $("#duplicatesSummary").textContent = `${unique.length} linha(s) mantida(s) · ${removed} duplicada(s) removida(s).`;
      $("#duplicatesResult").textContent = output;
      $("#duplicatesResult").dataset.output = output;
    };

    $("#duplicatesCopy").onclick = () => copy($("#duplicatesResult").dataset.output || "");
  }

  if (id === "text-diff") {
    $("#compareGo").onclick = () => {
      const a = $("#compareTextA").value;
      const b = $("#compareTextB").value;
      if (!a && !b) return toast("Digite os dois textos para comparar.");

      const left = a.split(/\r?\n/);
      const right = b.split(/\r?\n/);
      if (left.length * right.length > 250000) {
        return toast("Os textos são muito grandes para comparar de uma só vez.");
      }

      const rows = left.length + 1;
      const cols = right.length + 1;
      const dp = Array.from({ length: rows }, () => new Uint32Array(cols));

      for (let i = left.length - 1; i >= 0; i--) {
        for (let j = right.length - 1; j >= 0; j--) {
          dp[i][j] = left[i] === right[j]
            ? dp[i + 1][j + 1] + 1
            : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }

      let i = 0;
      let j = 0;
      let removed = 0;
      let added = 0;
      const output = [];
      const plain = [];

      while (i < left.length || j < right.length) {
        if (i < left.length && j < right.length && left[i] === right[j]) {
          output.push(`<div style="padding:3px 7px;color:#aaa;white-space:pre-wrap">  ${esc(left[i] || " ")}</div>`);
          plain.push(`  ${left[i]}`);
          i++; j++;
        } else if (i < left.length && (j >= right.length || dp[i + 1][j] >= dp[i][j + 1])) {
          output.push(`<div style="padding:3px 7px;color:#ff8b8b;background:#ff555510;white-space:pre-wrap">− ${esc(left[i] || "(linha vazia)")}</div>`);
          plain.push(`- ${left[i]}`);
          removed++; i++;
        } else {
          output.push(`<div style="padding:3px 7px;color:#8ee6a4;background:#55cc6610;white-space:pre-wrap">+ ${esc(right[j] || "(linha vazia)")}</div>`);
          plain.push(`+ ${right[j]}`);
          added++; j++;
        }
      }

      $("#compareSummary").textContent = `${removed} linha(s) removida(s) · ${added} linha(s) adicionada(s).`;
      $("#compareResult").innerHTML = output.join("") || "Os textos são iguais.";
      $("#compareResult").dataset.output = plain.join("\n");
    };

    $("#compareCopy").onclick = () => copy($("#compareResult").dataset.output || "");
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


  if (id === "password-check") {
    const analyze = () => {
      const value = $("#passwordCheckInput").value;
      if (!value) return toast("Digite uma senha para analisar.");
      let score=0;
      if (value.length>=8) score++;
      if (value.length>=12) score++;
      if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
      if (/\d/.test(value)) score++;
      if (/[^A-Za-z0-9]/.test(value)) score++;
      const pool=(/[a-z]/.test(value)?26:0)+(/[A-Z]/.test(value)?26:0)+(/\d/.test(value)?10:0)+(/[^A-Za-z0-9]/.test(value)?32:0);
      const entropy=pool ? value.length*Math.log2(pool) : 0;
      const levels=["Muito fraca","Fraca","Razoável","Boa","Forte","Muito forte"];
      const level=score>=5?5:score;
      $("#passwordCheckResult").textContent=`Força estimada: ${levels[level]}\nComprimento: ${value.length} caracteres\nEntropia aproximada: ${Math.round(entropy)} bits\n\nUse senhas longas e exclusivas. Evite nomes, datas e padrões previsíveis.`;
    };
    $("#passwordCheckGo").onclick=analyze;
    $("#passwordCheckInput").oninput=analyze;
  }

  if (id === "pin-generator") {
    $("#pinGo").onclick=()=>{
      const length=Math.max(4,Math.min(12,Math.floor(Number($("#pinLength").value)||6)));
      $("#pinResult").textContent=secureRandomString(length,"0123456789");
    };
    $("#pinCopy").onclick=()=>copy($("#pinResult").textContent);
    $("#pinGo").click();
  }

  if (id === "random-password") {
    $("#randomPassGo").onclick=()=>{
      let alphabet="";
      if ($("#randomPassUpper").checked) alphabet+="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      if ($("#randomPassLower").checked) alphabet+="abcdefghijklmnopqrstuvwxyz";
      if ($("#randomPassNumbers").checked) alphabet+="0123456789";
      if ($("#randomPassSymbols").checked) alphabet+="!@#$%&*_-+=?";
      if (!alphabet) return toast("Selecione ao menos um tipo de caractere.");
      const length=Math.max(8,Math.min(128,Math.floor(Number($("#randomPassLength").value)||20)));
      $("#randomPassResult").textContent=secureRandomString(length,alphabet);
    };
    $("#randomPassCopy").onclick=()=>copy($("#randomPassResult").textContent);
    $("#randomPassGo").click();
  }

  if (id === "md5" || id === "sha256") {
    $("#hashGo").onclick=async()=>{
      const value=$("#hashInput").value;
      if (!value) return toast("Digite um texto para gerar o hash.");
      const button=$("#hashGo"); button.disabled=true; button.textContent="Gerando...";
      try {
        if (id === "md5") $("#hashResult").textContent=md5Hash(value);
        else {
          const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
          $("#hashResult").textContent=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
        }
      } catch(error) { console.error(error); toast("Não foi possível gerar o hash neste navegador."); }
      finally {button.disabled=false;button.textContent=`Gerar ${id.toUpperCase()}`;}
    };
    $("#hashCopy").onclick=()=>copy($("#hashResult").textContent);
  }

  if (id === "url-encode" || id === "url-decode") {
    $("#urlGo").onclick=()=>{
      const value=$("#urlTextInput").value;
      try { $("#urlResult").textContent=id === "url-encode" ? encodeURIComponent(value) : decodeURIComponent(value.replace(/\+/g," ")); }
      catch { $("#urlResult").textContent="Conteúdo codificado inválido."; }
    };
    $("#urlCopy").onclick=()=>copy($("#urlResult").textContent);
  }

  if (id === "token-generator") {
    $("#tokenGo").onclick=()=>{
      const length=Math.max(16,Math.min(256,Math.floor(Number($("#tokenLength").value)||48)));
      const alphabets={hex:"0123456789abcdef",url:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",alphanumeric:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"};
      $("#tokenResult").textContent=secureRandomString(length,alphabets[$("#tokenFormat").value]);
    };
    $("#tokenCopy").onclick=()=>copy($("#tokenResult").textContent);
    $("#tokenGo").click();
  }

  if (id === "uuid-generator") {
    $("#uuidGo").onclick=()=>{
      const count=Math.max(1,Math.min(50,Math.floor(Number($("#uuidCount").value)||5)));
      const values=Array.from({length:count},()=>crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{const r=secureRandomInt(16);return (c==="x"?r:(r&3)|8).toString(16);}));
      $("#uuidResult").textContent=values.join("\n");
    };
    $("#uuidCopy").onclick=()=>copy($("#uuidResult").textContent);
    $("#uuidGo").click();
  }

  if (id === "scientific-calculator") {
    $("#scientificGo").onclick=()=>{
      try {
        let expr=$("#scientificInput").value.trim().toLowerCase().replace(/π/g,"pi").replace(/×/g,"*").replace(/÷/g,"/").replace(/\^/g,"**");
        if (!expr) throw new Error("Digite uma expressão.");
        const allowed=["sin","cos","tan","asin","acos","atan","sqrt","abs","log","ln","exp","floor","ceil","round","min","max","pow","pi","e"];
        const identifiers=expr.match(/[a-z]+/g)||[];
        if (identifiers.some(name=>!allowed.includes(name))) throw new Error("A expressão contém uma função ou palavra não permitida.");
        const degrees=$("#scientificAngle").value==="deg";
        const fns={
          sin:x=>Math.sin(degrees?x*Math.PI/180:x), cos:x=>Math.cos(degrees?x*Math.PI/180:x), tan:x=>Math.tan(degrees?x*Math.PI/180:x),
          asin:x=>degrees?Math.asin(x)*180/Math.PI:Math.asin(x), acos:x=>degrees?Math.acos(x)*180/Math.PI:Math.acos(x), atan:x=>degrees?Math.atan(x)*180/Math.PI:Math.atan(x),
          sqrt:Math.sqrt,abs:Math.abs,log:Math.log10,ln:Math.log,exp:Math.exp,floor:Math.floor,ceil:Math.ceil,round:Math.round,min:Math.min,max:Math.max,pow:Math.pow,pi:Math.PI,e:Math.E
        };
        const safeExpr=expr.replace(/\bpi\b/g,"pi").replace(/\be\b/g,"e");
        if (!/^[0-9a-z+*/%().,\s*-]+$/.test(safeExpr)) throw new Error("Use apenas números, operadores e funções listadas.");
        const names=Object.keys(fns);
        const result=Function(...names,`"use strict";return (${safeExpr});`)(...names.map(n=>fns[n]));
        if (!Number.isFinite(result)) throw new Error("Resultado indefinido. Confira os valores.");
        $("#scientificResult").textContent=formatNumber(result,10);
      } catch(error) { $("#scientificResult").textContent=error.message||"Expressão inválida."; }
    };
  }

  if (id === "percentage") {
    $("#percentageGo").onclick=()=>{try{const rate=readNumber("#percentageRate","a porcentagem"),base=readNumber("#percentageBase","o valor base");$("#percentageResult").textContent=`${formatNumber(rate)}% de ${formatNumber(base)} = ${formatNumber(base*rate/100,8)}`;}catch(e){toast(e.message);}};
  }
  if (id === "rule-of-three") {
    $("#ruleGo").onclick=()=>{try{const a=readNumber("#ruleA","o valor A"),b=readNumber("#ruleB","o valor B"),c=readNumber("#ruleC","o valor C");if(a===0)throw new Error("O valor A não pode ser zero.");$("#ruleResult").textContent=`X = (B × C) ÷ A = ${formatNumber(b*c/a,8)}`;}catch(e){toast(e.message);}};
  }
  if (id === "average") {
    $("#averageGo").onclick=()=>{const raw=$("#averageInput").value.trim();if(!raw)return toast("Digite pelo menos um número.");const parts=raw.split(/[\s,;]+/).filter(Boolean);const values=parts.map(v=>Number(v.replace(",",".")));if(values.some(v=>!Number.isFinite(v)))return toast("Confira os números digitados.");const sum=values.reduce((a,b)=>a+b,0),sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2),median=sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;$("#averageResult").textContent=`Quantidade: ${values.length}\nSoma: ${formatNumber(sum,8)}\nMédia: ${formatNumber(sum/values.length,8)}\nMediana: ${formatNumber(median,8)}`;};
  }

  if (id === "simple-interest" || id === "compound-interest") {
    $("#interestGo").onclick=()=>{try{const principal=readNumber("#interestPrincipal","o capital"),rate=readNumber("#interestRate","a taxa"),time=readNumber("#interestTime","o tempo");if(principal<0||rate<0||time<0)throw new Error("Use valores iguais ou maiores que zero.");const annual=$("#interestPeriod").value==="year",periods=annual?time:time;const i=rate/100;const interest=id==="simple-interest"?principal*i*periods:principal*(Math.pow(1+i,periods)-1);const total=principal+interest;$("#interestResult").textContent=`Juros: ${new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(interest)}\nMontante: ${new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(total)}\nPeríodo: ${formatNumber(periods)} ${annual?"ano(s)":"mês(es)"}`;}catch(e){toast(e.message);}};
  }
  if (id === "discount") {
    $("#discountGo").onclick=()=>{try{const price=readNumber("#discountPrice","o preço"),rate=readNumber("#discountRate","o desconto");if(price<0||rate<0||rate>100)throw new Error("Informe um preço positivo e desconto entre 0 e 100%.");const saved=price*rate/100,final=price-saved;$("#discountResult").textContent=`Desconto: ${new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(saved)}\nPreço final: ${new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(final)}`;}catch(e){toast(e.message);}};
  }
  if (id === "bmi") {
    $("#bmiGo").onclick=()=>{try{const weight=readNumber("#bmiWeight","o peso"),height=readNumber("#bmiHeight","a altura");if(weight<=0||height<=0)throw new Error("Peso e altura devem ser maiores que zero.");$("#bmiResult").textContent=`IMC: ${formatNumber(weight/(height*height),2)}\nEste número é apenas um indicador geral e não substitui uma avaliação profissional.`;}catch(e){toast(e.message);}};
  }
  if (id === "area-perimeter") {
    $("#geometryGo").onclick=()=>{try{const shape=$("#geometryShape").value,a=readNumber("#geometryA","a medida A");if(a<=0)throw new Error("As medidas devem ser maiores que zero.");let area,perimeter,label;
      if(shape==="square"){area=a*a;perimeter=4*a;label="Quadrado";}
      else if(shape==="rectangle"){const b=readNumber("#geometryB","a medida B");if(b<=0)throw new Error("Informe uma largura válida.");area=a*b;perimeter=2*(a+b);label="Retângulo";}
      else if(shape==="circle"){area=Math.PI*a*a;perimeter=2*Math.PI*a;label="Círculo";}
      else {const b=readNumber("#geometryB","o segundo lado"),c=readNumber("#geometryC","o terceiro lado");if(b<=0||c<=0||a+b<=c||a+c<=b||b+c<=a)throw new Error("Os três lados não formam um triângulo válido.");perimeter=a+b+c;const half=perimeter/2;area=Math.sqrt(half*(half-a)*(half-b)*(half-c));label="Triângulo";}
      $("#geometryResult").textContent=`${label}\nÁrea: ${formatNumber(area,8)} unidades²\nPerímetro: ${formatNumber(perimeter,8)} unidades`;
    }catch(e){toast(e.message);}};
  }

  if (id === "currency") {
    $("#currencyGo").onclick=async()=>{try{const amount=readNumber("#currencyAmount","o valor");if(amount<0)throw new Error("O valor não pode ser negativo.");const from=$("#currencyFrom").value,to=$("#currencyTo").value;if(from===to){$("#currencyResult").textContent=`${formatNumber(amount,2)} ${from} = ${formatNumber(amount,2)} ${to}\nCotação: 1 ${from} = 1 ${to}`;return;}const button=$("#currencyGo");button.disabled=true;button.textContent="Consultando cotação...";const response=await fetch(`https://api.frankfurter.dev/v2/rate/${encodeURIComponent(from)}/${encodeURIComponent(to)}`);if(!response.ok)throw new Error("Não foi possível obter essa cotação. Tente outra moeda.");const data=await response.json();$("#currencyResult").textContent=`${formatNumber(amount,2)} ${from} = ${formatNumber(amount*data.rate,2)} ${to}\nCotação de referência: 1 ${from} = ${formatNumber(data.rate,6)} ${to}\nData da cotação: ${data.date}\nFonte: Frankfurter (taxas de referência diárias).`;}catch(e){toast(e.message||"Falha ao consultar o serviço de câmbio.");}finally{$("#currencyGo").disabled=false;$("#currencyGo").textContent="Consultar cotação e converter";}};
  }

  const conversionTools={
    temperature:{ids:["#temperatureValue","#temperatureFrom","#temperatureTo","#temperatureResult"],factors:null},
    storage:{ids:["#storageValue","#storageFrom","#storageTo","#storageResult"],factors:{B:1,KB:1024,MB:1024**2,GB:1024**3,TB:1024**4}},
    speed:{ids:["#speedValue","#speedFrom","#speedTo","#speedResult"],factors:{ms:1,kmh:1/3.6,mph:0.44704,knot:0.514444}},
    "time-converter":{ids:["#timeValue","#timeFrom","#timeTo","#timeConvertResult"],factors:{seconds:1,minutes:60,hours:3600,days:86400}},
    energy:{ids:["#energyValue","#energyFrom","#energyTo","#energyResult"],factors:{J:1,kJ:1000,cal:4.184,kcal:4184,Wh:3600,kWh:3600000}},
    angles:{ids:["#angleValue","#angleFrom","#angleTo","#angleResult"],factors:null},
    pressure:{ids:["#pressureValue","#pressureFrom","#pressureTo","#pressureResult"],factors:{Pa:1,kPa:1000,bar:100000,atm:101325,psi:6894.757293}}
  };
  const converter=conversionTools[id];
  if(converter){
    const [valueId,fromId,toId,resultId]=converter.ids;
    const goId={temperature:"#temperatureGo",storage:"#storageGo",speed:"#speedGo","time-converter":"#timeConvertGo",energy:"#energyGo",angles:"#angleGo",pressure:"#pressureGo"}[id];
    $(goId).onclick=()=>{try{const value=readNumber(valueId,"o valor"),from=$(fromId).value,to=$(toId).value;let result;
      if(id==="temperature"){const c=from==="C"?value:from==="F"?(value-32)*5/9:value-273.15;result=to==="C"?c:to==="F"?c*9/5+32:c+273.15;}
      else if(id==="angles"){const radians=from==="deg"?value*Math.PI/180:value;result=to==="deg"?radians*180/Math.PI:radians;}
      else result=value*converter.factors[from]/converter.factors[to];
      $(resultId).textContent=`${formatNumber(value,8)} ${from} = ${formatNumber(result,10)} ${to}`;
    }catch(e){toast(e.message);}};
  }

  if (id === "number-bases") {
    $("#baseConvertGo").onclick=()=>{const raw=$("#baseNumberInput").value.trim(),from=Number($("#baseFrom").value),to=Number($("#baseTo").value);if(!raw)return toast("Digite um número.");const valid={2:/^-?[01]+$/,8:/^-?[0-7]+$/,10:/^-?\d+$/,16:/^-?[0-9a-f]+$/i};if(!valid[from].test(raw))return toast("O número não corresponde à base de origem.");const num=parseInt(raw,from);if(!Number.isSafeInteger(num))return toast("Número fora do intervalo seguro.");$("#baseConvertResult").textContent=`Base ${from}: ${raw}\nBase ${to}: ${num.toString(to).toUpperCase()}`;};
  }

  if (id === "digital-clock") {
    const update=()=>{const now=new Date();$("#digitalClockTime").textContent=new Intl.DateTimeFormat("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(now);$("#digitalClockDate").textContent=new Intl.DateTimeFormat("pt-BR",{dateStyle:"full"}).format(now);};
    update();activeToolInterval=setInterval(update,1000);
  }
  if (id === "world-clock") {
    const update=()=>{const zone=$("#worldClockZone").value;$("#worldClockTime").textContent=new Intl.DateTimeFormat("pt-BR",{timeZone:zone,hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date());$("#worldClockDate").textContent=`${zone} · ${new Intl.DateTimeFormat("pt-BR",{timeZone:zone,dateStyle:"full"}).format(new Date())}`;};
    $("#worldClockZone").onchange=update;update();activeToolInterval=setInterval(update,1000);
  }
  if (id === "countdown") {
    $("#countdownGo").onclick=()=>{if(activeToolInterval)clearInterval(activeToolInterval);const raw=$("#countdownTarget").value;if(!raw)return toast("Escolha a data e o horário do evento.");const target=new Date(raw);if(Number.isNaN(target.getTime())||target<=new Date())return toast("Escolha uma data futura.");const update=()=>{const ms=target-Date.now();if(ms<=0){$("#countdownResult").textContent="O momento chegou!";clearInterval(activeToolInterval);activeToolInterval=null;return;}const days=Math.floor(ms/86400000),hours=Math.floor(ms%86400000/3600000),mins=Math.floor(ms%3600000/60000),secs=Math.floor(ms%60000/1000);$("#countdownResult").textContent=`Faltam ${days} dia(s), ${hours} hora(s), ${mins} minuto(s) e ${secs} segundo(s).`;};update();activeToolInterval=setInterval(update,1000);};
  }
  if (id === "age-calculator") {
    $("#ageGo").onclick=()=>{const raw=$("#ageBirth").value;if(!raw)return toast("Informe a data de nascimento.");const [y,m,d]=raw.split("-").map(Number),today=new Date();const birth=new Date(y,m-1,d);if(birth>today)return toast("A data de nascimento não pode estar no futuro.");let years=today.getFullYear()-y,months=today.getMonth()-(m-1),days=today.getDate()-d;if(days<0){months--;days+=new Date(today.getFullYear(),today.getMonth(),0).getDate();}if(months<0){years--;months+=12;}$("#ageResult").textContent=`Idade: ${years} ano(s), ${months} mês(es) e ${days} dia(s).`;};
  }
  if (id === "date-difference") {
    $("#dateDiffGo").onclick=()=>{const a=$("#dateStart").value,b=$("#dateEnd").value;if(!a||!b)return toast("Informe as duas datas.");const start=new Date(`${a}T00:00:00Z`),end=new Date(`${b}T00:00:00Z`),days=Math.abs(Math.round((end-start)/86400000));$("#dateDiffResult").textContent=`${days} dia(s) de diferença\nEquivalente a ${formatNumber(days/7,2)} semana(s).${end<start?"\nA data final é anterior à inicial.":""}`;};
  }
  if (id === "work-hours") {
    $("#workGo").onclick=()=>{const start=$("#workStart").value,end=$("#workEnd").value;if(!start||!end)return toast("Informe o início e o fim do expediente.");const toMin=t=>{const [h,m]=t.split(":").map(Number);return h*60+m;};let duration=toMin(end)-toMin(start);if(duration<0)duration+=1440;const pause=Math.max(0,Number($("#workBreak").value)||0),worked=duration-pause;if(worked<0)return toast("O intervalo não pode ser maior que a jornada.");$("#workResult").textContent=`Tempo bruto: ${Math.floor(duration/60)}h ${duration%60}min\nIntervalo: ${pause}min\nTotal trabalhado: ${Math.floor(worked/60)}h ${worked%60}min`;};
  }
  if (id === "timezone") {
    $("#timezoneGo").onclick=()=>{try{const instant=zonedDateTimeToDate($("#timezoneDate").value,$("#timezoneFrom").value),zone=$("#timezoneTo").value;$("#timezoneResult").textContent=`${$("#timezoneFrom").selectedOptions[0].textContent}: ${formatDateInZone(instant,$("#timezoneFrom").value)}\n${$("#timezoneTo").selectedOptions[0].textContent}: ${formatDateInZone(instant,zone)}`;}catch(e){toast(e.message||"Não foi possível converter o horário.");}};
  }
  if (id === "deadline") {
    $("#deadlineGo").onclick=()=>{const raw=$("#deadlineStart").value;if(!raw)return toast("Informe a data inicial.");let days=Math.floor(Number($("#deadlineDays").value));if(!Number.isFinite(days)||days<0||days>10000)return toast("Informe uma quantidade de dias entre 0 e 10.000.");const date=new Date(`${raw}T12:00:00`),business=$("#deadlineBusiness").checked;let added=0;while(added<days){date.setDate(date.getDate()+1);if(!business||(date.getDay()!==0&&date.getDay()!==6))added++;}$("#deadlineResult").textContent=`Data calculada: ${new Intl.DateTimeFormat("pt-BR",{dateStyle:"full"}).format(date)}\nDias adicionados: ${days}${business?" úteis":" corridos"}.`;};
  }

  if (id === "base64-decode") {
    $("#base64DecodeGo").onclick=()=>{try{$("#base64DecodeResult").textContent=decodeURIComponent(escape(atob($("#base64DecodeInput").value.trim())));}catch{$("#base64DecodeResult").textContent="Conteúdo Base64 inválido.";}};
    $("#base64DecodeCopy").onclick=()=>copy($("#base64DecodeResult").textContent);
  }

  if (["html-formatter","css-formatter","js-formatter"].includes(id)) {
    $("#formatterGo").onclick=async()=>{const code=$("#formatterInput").value;if(!code.trim())return toast("Cole o código que deseja formatar.");const button=$("#formatterGo");button.disabled=true;button.textContent="Carregando formatador...";try{const lib=await ensurePrettier();const parser=id==="html-formatter"?"html":id==="css-formatter"?"css":"babel";const formatted=await lib.format(code,{parser,plugins:lib.plugins[parser],singleQuote:true,semi:true,tabWidth:2});$("#formatterResult").value=formatted;}catch(error){console.error("Erro no Prettier:",error);toast("Não foi possível formatar. Confira se o código é válido e se a internet está funcionando.");}finally{button.disabled=false;button.textContent="Formatar código";}};
    $("#formatterCopy").onclick=()=>copy($("#formatterResult").value);
  }
  if (id === "code-minifier") {
    $("#minifyGo").onclick=()=>{const value=$("#minifyInput").value;if(!value.trim())return toast("Cole o código que deseja minificar.");$("#minifyResult").value=compactCode(value,$("#minifyType").value);};
    $("#minifyCopy").onclick=()=>copy($("#minifyResult").value);
  }
  if (id === "json-validator") {
    $("#jsonValidateGo").onclick=()=>{try{const parsed=JSON.parse($("#jsonValidateInput").value);const formatted=JSON.stringify(parsed,null,2);$("#jsonValidateResult").textContent="JSON válido! Estrutura reconhecida corretamente.";$("#jsonValidateInput").dataset.formatted=formatted;}catch(e){$("#jsonValidateResult").textContent=`JSON inválido: ${e.message}`;$("#jsonValidateInput").dataset.formatted="";}};
    $("#jsonValidateCopy").onclick=()=>copy($("#jsonValidateInput").dataset.formatted||"");
  }
  if (id === "api-qr") {
    $("#apiQrGo").onclick=()=>{const value=$("#apiQrInput").value.trim();if(!value)return toast("Digite o endereço da API.");try{new URL(value);}catch{return toast("Digite um endereço URL válido, incluindo https://.");}if(!window.QRCode)return toast("Não foi possível carregar o gerador QR.");$("#apiQrResult").innerHTML="";new QRCode($("#apiQrResult"),{text:value,width:210,height:210});$("#apiQrDownload").hidden=false;};
    $("#apiQrDownload").onclick=()=>{const img=$("#apiQrResult img")||$("#apiQrResult canvas");if(!img)return toast("Gere um QR Code primeiro.");const url=img.tagName==="CANVAS"?img.toDataURL():img.src;const a=document.createElement("a");a.href=url;a.download="pd-tools-api-qrcode.png";a.click();};
  }
  if (id === "color-viewer") {
    const update=()=>{let hex=$("#colorHexInput").value.trim();if(!/^#?[0-9a-f]{6}$/i.test(hex))return toast("Digite uma cor HEX válida, como #8b5cf6.");if(!hex.startsWith("#"))hex="#"+hex;hex=hex.toUpperCase();const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);const [h,s,l]=hexParaHsl(hex);$("#colorHexInput").value=hex;$("#colorPickerInput").value=hex;$("#colorViewerSwatch").style.background=hex;$("#colorViewerResult").textContent=`HEX: ${hex}\nRGB: rgb(${r}, ${g}, ${b})\nHSL: hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;};
    $("#colorViewerGo").onclick=update;$("#colorPickerInput").oninput=()=>{$("#colorHexInput").value=$("#colorPickerInput").value;update();};$("#colorViewerCopy").onclick=()=>copy($("#colorViewerResult").textContent);update();
  }


  const imageTools = ["image-bg-remover","image-compressor","image-resizer","image-converter","image-crop","image-rotate","image-resolution","image-circle","image-watermark","image-color-picker"];
  if (imageTools.includes(id)) {
    const loadImage = (file) => new Promise((resolve,reject) => { if(!file) return reject(new Error("Selecione uma imagem.")); const url=URL.createObjectURL(file); const img=new Image(); img.onload=()=>resolve({img,url}); img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Não foi possível abrir a imagem."));}; img.src=url; });
    const makeCanvas = (w,h) => { const c=document.createElement("canvas"); c.width=w; c.height=h; return c; };
    const downloadCanvas = (canvas, buttonId, filename, mime="image/png", quality=0.92) => { canvas.toBlob(blob=>{if(!blob)return toast("Não foi possível gerar o arquivo.");const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);},mime,quality); };
    const showCanvas = (canvas, resultId) => { const el=$("#"+resultId); if(el){el.innerHTML="";canvas.style.maxWidth="100%";canvas.style.height="auto";canvas.style.borderRadius="10px";el.appendChild(canvas);} };
    const bindFile = (inputId, callback) => { $("#"+inputId).onchange=()=>{const f=$("#"+inputId).files[0];if(f)callback(f);}; };
    const safeRun = fn => async()=>{try{await fn();}catch(e){toast(e.message||"Ocorreu um erro ao processar a imagem.");}};

    if(id==="image-bg-remover"){
      let output=null;
      bindFile("imgBgFile",async file=>{try{const {img}=await loadImage(file);const c=makeCanvas(img.naturalWidth,img.naturalHeight);c.getContext("2d").drawImage(img,0,0);showCanvas(c,"imgBgPreview");}catch(e){toast(e.message);}});
      $("#imgBgGo").onclick=safeRun(async()=>{const file=$("#imgBgFile").files[0];if(!file)throw new Error("Selecione uma imagem.");const btn=$("#imgBgGo");btn.disabled=true;btn.textContent="Carregando modelo...";try{const lib=await import("https://esm.sh/@imgly/background-removal@1.5.5");const blob=await lib.removeBackground(file);output=await createImageBitmap(blob);const c=makeCanvas(output.width,output.height);c.getContext("2d").drawImage(output,0,0);showCanvas(c,"imgBgPreview");$("#imgBgDownload").hidden=false;$("#imgBgDownload").onclick=()=>downloadCanvas(c,"imgBgDownload","pd-tools-sem-fundo.png");}catch(e){console.error(e);throw new Error("Não foi possível remover o fundo. Verifique sua conexão e tente novamente.");}finally{btn.disabled=false;btn.textContent="Remover fundo";}});
    }
    if(id==="image-compressor"){
      let canvas=null;$("#imgCompQuality").oninput=()=>$("#imgCompQualityLabel").textContent=$("#imgCompQuality").value+"%";
      bindFile("imgCompFile",async file=>{const {img}=await loadImage(file);canvas=makeCanvas(img.naturalWidth,img.naturalHeight);canvas.getContext("2d").drawImage(img,0,0);$("#imgCompResult").textContent=`Original: ${file.size>1048576?(file.size/1048576).toFixed(2)+" MB":(file.size/1024).toFixed(1)+" KB"} • ${img.naturalWidth} × ${img.naturalHeight}px`;});
      $("#imgCompGo").onclick=safeRun(async()=>{if(!canvas)throw new Error("Selecione uma imagem.");const mime=$("#imgCompFormat").value,q=Number($("#imgCompQuality").value)/100;canvas.toBlob(blob=>{if(!blob)return toast("Falha ao comprimir.");window.__pdCompressedBlob=blob;$("#imgCompResult").textContent=`Novo tamanho: ${blob.size>1048576?(blob.size/1048576).toFixed(2)+" MB":(blob.size/1024).toFixed(1)+" KB"}`;$("#imgCompDownload").hidden=false;$("#imgCompDownload").onclick=()=>{const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="pd-tools-comprimida."+(mime==="image/webp"?"webp":"jpg");a.click();};},mime,q);});
    }
    if(id==="image-resizer"){
      let source=null;
      const widthInput=$("#imgResizeWidth"),heightInput=$("#imgResizeHeight"),keepInput=$("#imgResizeKeep");
      bindFile("imgResizeFile",async f=>{source=(await loadImage(f)).img;widthInput.value=source.naturalWidth;heightInput.value=source.naturalHeight;});
      widthInput.oninput=()=>{if(source&&keepInput.checked){const width=Number(widthInput.value);if(width>0)heightInput.value=Math.max(1,Math.round(width*source.naturalHeight/source.naturalWidth));}};
      heightInput.oninput=()=>{if(source&&keepInput.checked){const height=Number(heightInput.value);if(height>0)widthInput.value=Math.max(1,Math.round(height*source.naturalWidth/source.naturalHeight));}};
      keepInput.onchange=()=>{if(source&&keepInput.checked){const width=Number(widthInput.value);if(width>0)heightInput.value=Math.max(1,Math.round(width*source.naturalHeight/source.naturalWidth));}};
      $("#imgResizeGo").onclick=safeRun(async()=>{if(!source)throw new Error("Selecione uma imagem.");const w=Number(widthInput.value),h=Number(heightInput.value);if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>12000||h>12000)throw new Error("Informe dimensões válidas (de 1 até 12.000 px).");const c=makeCanvas(w,h);c.getContext("2d").drawImage(source,0,0,w,h);showCanvas(c,"imgResizeResult");$("#imgResizeDownload").hidden=false;$("#imgResizeDownload").onclick=()=>downloadCanvas(c,"imgResizeDownload","pd-tools-redimensionada.png");});
    }
    if(id==="image-converter"){
      let source=null,convertedBlob=null;
      bindFile("imgConvertFile",async f=>{source=(await loadImage(f)).img;convertedBlob=null;$("#imgConvertDownload").hidden=true;$("#imgConvertResult").textContent="Imagem pronta para conversão.";});
      $("#imgConvertFormat").onchange=()=>{convertedBlob=null;$("#imgConvertDownload").hidden=true;};
      $("#imgConvertGo").onclick=safeRun(async()=>{
        if(!source)throw new Error("Selecione uma imagem.");
        const mime=$("#imgConvertFormat").value,c=makeCanvas(source.naturalWidth,source.naturalHeight);
        c.getContext("2d").drawImage(source,0,0);
        c.toBlob(blob=>{
          if(!blob){toast("Falha na conversão. Tente outro formato.");return;}
          convertedBlob=blob;
          const extension={"image/png":"png","image/jpeg":"jpg","image/webp":"webp"}[mime];
          $("#imgConvertResult").textContent=`Imagem convertida com sucesso! Formato: ${extension.toUpperCase()} • ${(blob.size/1024).toFixed(1)} KB`;
          $("#imgConvertDownload").hidden=false;
        },mime,0.92);
      });
      $("#imgConvertDownload").onclick=()=>{
        if(!convertedBlob)return toast("Converta a imagem antes de baixar.");
        const url=URL.createObjectURL(convertedBlob),a=document.createElement("a");
        a.href=url;a.download="pd-tools-convertida."+({"image/png":"png","image/jpeg":"jpg","image/webp":"webp"}[$("#imgConvertFormat").value]);
        a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
      };
    }
    if(id==="image-crop"){
      let source=null;bindFile("imgCropFile",async f=>{source=(await loadImage(f)).img;$("#imgCropW").value=source.naturalWidth;$("#imgCropH").value=source.naturalHeight;});
      $("#imgCropGo").onclick=safeRun(async()=>{if(!source)throw new Error("Selecione uma imagem.");const x=Math.max(0,Number($("#imgCropX").value)),y=Math.max(0,Number($("#imgCropY").value)),w=Number($("#imgCropW").value),h=Number($("#imgCropH").value);if(!w||!h||x+w>source.naturalWidth||y+h>source.naturalHeight)throw new Error("O recorte precisa ficar dentro dos limites da imagem.");const c=makeCanvas(w,h);c.getContext("2d").drawImage(source,x,y,w,h,0,0,w,h);showCanvas(c,"imgCropResult");$("#imgCropDownload").hidden=false;$("#imgCropDownload").onclick=()=>downloadCanvas(c,"imgCropDownload","pd-tools-recorte.png");});
    }
    if(id==="image-rotate"){
      let source=null;bindFile("imgRotateFile",async f=>source=(await loadImage(f)).img);
      $("#imgRotateGo").onclick=safeRun(async()=>{if(!source)throw new Error("Selecione uma imagem.");const a=Number($("#imgRotateAngle").value)*Math.PI/180,swap=a===Math.PI/2||a===3*Math.PI/2,w=swap?source.naturalHeight:source.naturalWidth,h=swap?source.naturalWidth:source.naturalHeight,c=makeCanvas(w,h),ctx=c.getContext("2d");ctx.translate(w/2,h/2);ctx.rotate(a);ctx.drawImage(source,-source.naturalWidth/2,-source.naturalHeight/2);showCanvas(c,"imgRotateResult");$("#imgRotateDownload").hidden=false;$("#imgRotateDownload").onclick=()=>downloadCanvas(c,"imgRotateDownload","pd-tools-rotacionada.png");});
    }
    if(id==="image-resolution"){
      let source=null;bindFile("imgResFile",async f=>source=(await loadImage(f)).img);
      $("#imgResGo").onclick=safeRun(async()=>{if(!source)throw new Error("Selecione uma imagem.");const scale=Number($("#imgResScale").value)/100,w=Math.max(1,Math.round(source.naturalWidth*scale)),h=Math.max(1,Math.round(source.naturalHeight*scale)),c=makeCanvas(w,h);c.getContext("2d").drawImage(source,0,0,w,h);showCanvas(c,"imgResResult");$("#imgResDownload").hidden=false;$("#imgResDownload").onclick=()=>downloadCanvas(c,"imgResDownload","pd-tools-resolucao-reduzida.png");});
    }
    if(id==="image-circle"){
      let source=null;bindFile("imgCircleFile",async f=>source=(await loadImage(f)).img);
      $("#imgCircleGo").onclick=safeRun(async()=>{if(!source)throw new Error("Selecione uma imagem.");const size=Math.min(source.naturalWidth,source.naturalHeight),sx=(source.naturalWidth-size)/2,sy=(source.naturalHeight-size)/2,c=makeCanvas(size,size),ctx=c.getContext("2d");ctx.beginPath();ctx.arc(size/2,size/2,size/2,0,Math.PI*2);ctx.clip();ctx.drawImage(source,sx,sy,size,size,0,0,size,size);showCanvas(c,"imgCircleResult");$("#imgCircleDownload").hidden=false;$("#imgCircleDownload").onclick=()=>downloadCanvas(c,"imgCircleDownload","pd-tools-circular.png");});
    }
    if(id==="image-watermark"){
      let source=null;$("#imgWaterOpacity").oninput=()=>$("#imgWaterOpacityLabel").textContent=$("#imgWaterOpacity").value+"%";bindFile("imgWaterFile",async f=>source=(await loadImage(f)).img);
      $("#imgWaterGo").onclick=safeRun(async()=>{if(!source)throw new Error("Selecione uma imagem.");const label=$("#imgWaterText").value.trim();if(!label)throw new Error("Digite o texto da marca d'água.");const c=makeCanvas(source.naturalWidth,source.naturalHeight),ctx=c.getContext("2d");ctx.drawImage(source,0,0);ctx.globalAlpha=Number($("#imgWaterOpacity").value)/100;ctx.fillStyle="#ffffff";ctx.strokeStyle="#222222";ctx.lineWidth=Math.max(1,source.naturalWidth/700);ctx.textAlign="right";ctx.font=`bold ${Math.max(18,source.naturalWidth/22)}px Arial`;ctx.strokeText(label,c.width-24,c.height-28);ctx.fillText(label,c.width-24,c.height-28);ctx.globalAlpha=1;showCanvas(c,"imgWaterResult");$("#imgWaterDownload").hidden=false;$("#imgWaterDownload").onclick=()=>downloadCanvas(c,"imgWaterDownload","pd-tools-marca-dagua.png");});
    }
    if(id==="image-color-picker"){
      let canvas=null;bindFile("imgColorFile",async f=>{const {img}=await loadImage(f);canvas=makeCanvas(img.naturalWidth,img.naturalHeight);canvas.getContext("2d").drawImage(img,0,0);showCanvas(canvas,"imgColorPreview");canvas.style.cursor="crosshair";canvas.onclick=e=>{const r=canvas.getBoundingClientRect(),x=Math.min(canvas.width-1,Math.max(0,Math.floor((e.clientX-r.left)*canvas.width/r.width))),y=Math.min(canvas.height-1,Math.max(0,Math.floor((e.clientY-r.top)*canvas.height/r.height))),d=canvas.getContext("2d").getImageData(x,y,1,1).data,hex="#"+[...d].slice(0,3).map(v=>v.toString(16).padStart(2,"0")).join("").toUpperCase();$("#imgColorResult").textContent=`HEX: ${hex}\nRGB: rgb(${d[0]}, ${d[1]}, ${d[2]})`;$("#imgColorResult").dataset.hex=hex;};});
      $("#imgColorCopy").onclick=()=>copy($("#imgColorResult").dataset.hex||"");
    }
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

    const { error } = await supabaseClient.auth.signInWithPassword({
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
  if (!/^#[0-9a-f]{6}$/i.test(color)) return toast("Informe uma cor hexadecimal válida.");

  const { error } = await supabaseClient
    .from("site_settings")
    .upsert({ id: 1, site_name: siteName, primary_color: color, updated_at: new Date().toISOString() });

  if (error) {
    console.error(error);
    toast("Erro ao salvar aparência.");
    return;
  }

  document.documentElement.style.setProperty("--purple", color);
  document.title = `${siteName} — Ferramentas inteligentes`;
  toast("Aparência salva no Supabase!");
}

async function enviarImagemSite(tipo, inputId) {
  const input = $(inputId);
  const file = input?.files?.[0];
  if (!file) return toast("Selecione uma imagem primeiro.");
  if (!file.type.startsWith("image/")) return toast("Envie um arquivo de imagem.");
  if (file.size > 5 * 1024 * 1024) return toast("A imagem deve ter no máximo 5 MB.");

  const button = $(`[data-upload="${tipo}"]`);
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Enviando...";

  try {
    const ext = tipo === "favicon" ? "png" : (file.name.split(".").pop() || "png").toLowerCase();
    const path = tipo === "logo" ? `logo.${ext}` : `${tipo}.png`;
    const { error: uploadError } = await supabaseClient.storage
      .from(ASSET_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "0" });
    if (uploadError) throw uploadError;

    const publicUrl = `${ASSET_BASE}/${path}`;
    const column = tipo === "logo" ? "logo_url" : "favicon_url";
    const { error: saveError } = await supabaseClient
      .from("site_settings")
      .upsert({ id: 1, [column]: publicUrl, updated_at: new Date().toISOString() });
    if (saveError) throw saveError;

    const freshUrl = `${publicUrl}?v=${Date.now()}`;
    if (tipo === "logo") aplicarLogo(freshUrl);
    if (tipo === "favicon") aplicarFavicon(freshUrl);
    input.value = "";
    toast(tipo === "logo" ? "Logo atualizada!" : "Ícone da aba atualizado!");
  } catch (error) {
    console.error(error);
    toast("Não foi possível enviar. Confira o bucket e as permissões do Supabase.");
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

async function enviarImagemCompartilhamento() {
  const input = $("#shareImage");
  const file = input?.files?.[0];
  if (!file) return toast("Selecione uma imagem primeiro.");
  if (!file.type.startsWith("image/")) return toast("Envie um arquivo de imagem.");
  if (file.size > 5 * 1024 * 1024) return toast("A imagem deve ter no máximo 5 MB.");
  const button = $('[data-upload="share"]');
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Enviando...";
  try {
    const { error } = await supabaseClient.storage.from(ASSET_BUCKET).upload("share.png", file, {
      upsert: true, contentType: file.type, cacheControl: "0"
    });
    if (error) throw error;
    input.value = "";
    toast("Imagem de compartilhamento atualizada! Pode levar um tempo para redes sociais renovarem o cache.");
  } catch (error) {
    console.error(error);
    toast("Não foi possível enviar. Confira o bucket e as permissões do Supabase.");
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
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
      <hr style="border:0;border-top:1px solid var(--line);margin:22px 0">
      <h4>Imagens do site</h4>
      <div class="field">
        <label>Logo do site</label>
        <input id="logoImage" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml">
        <button class="secondary" type="button" data-upload="logo">Enviar logo</button>
      </div>
      <div class="field">
        <label>Ícone da aba do navegador (PNG)</label>
        <input id="faviconImage" type="file" accept="image/png">
        <button class="secondary" type="button" data-upload="favicon">Enviar ícone</button>
      </div>
      <div class="field">
        <label>Imagem de prévia ao compartilhar o link (recomendado: 1200 × 630)</label>
        <input id="shareImage" type="file" accept="image/png,image/jpeg,image/webp">
        <button class="secondary" type="button" data-upload="share">Enviar imagem de compartilhamento</button>
      </div>
      <p style="color:#999;font-size:11px;line-height:1.6">
        Imagens de até 5 MB. Os arquivos ficam no armazenamento do Supabase. A prévia de redes sociais pode demorar para atualizar por causa do cache.
      </p>
    `;

    carregarAparencia().then(async () => {
      const { data } = await supabaseClient
        .from("site_settings")
        .select("site_name, primary_color, logo_url, favicon_url")
        .eq("id", 1)
        .maybeSingle();

      if (data) {
        $("#siteName").value = data.site_name || "PD Tools";
        $("#siteColor").value = data.primary_color || "#9b7bff";
      }
    });

    $("#saveAppearance").onclick = salvarAparencia;
    $('[data-upload="logo"]').onclick = () => enviarImagemSite("logo", "#logoImage");
    $('[data-upload="favicon"]').onclick = () => enviarImagemSite("favicon", "#faviconImage");
    $('[data-upload="share"]').onclick = enviarImagemCompartilhamento;
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
    if (event.target === modal) {
      modal.classList.remove("show");
      if (modal.id === "toolModal" && activeToolInterval) {
        clearInterval(activeToolInterval);
        activeToolInterval = null;
      }
    }
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
