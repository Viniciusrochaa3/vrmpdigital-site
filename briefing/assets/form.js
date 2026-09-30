/* ============================================================
   Formulário de briefing — etapas geradas a partir de campos.js
   Envia imagens para o Storage e as respostas para a tabela
   "briefings" (o cliente só consegue ENVIAR, nunca ler).
   ============================================================ */
(function () {
  "use strict";

  var ETAPAS = window.BRIEFING.etapas;
  var CFG = window.VRMP;
  var K_RASCUNHO = "vrmp.briefing.rascunho";
  var K_ID = "vrmp.briefing.id";
  // ?revisar na URL: modo de revisão (setas percorrem todas as telas sem validar nem enviar)
  var REVISAR = /[?&]revisar\b/.test(location.search);
  var TIPOS_OK = /^(image\/(jpeg|png|webp|gif|heic|heif)|application\/pdf)$/;

  var app = document.getElementById("app");
  var valores = lerRascunho();
  var arquivos = {};   // { campoId: [{ file, url, path, falhou }] }
  var atual = -1;      // -1 = abertura
  var enviando = false;

  /* ---------- utilidades ---------- */
  function el(tag, attrs, filhos) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k === "html") n.innerHTML = v;
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    });
    [].concat(filhos || []).forEach(function (f) {
      if (f == null) return;
      n.appendChild(typeof f === "string" ? document.createTextNode(f) : f);
    });
    return n;
  }

  function lerRascunho() {
    try { return JSON.parse(localStorage.getItem(K_RASCUNHO)) || {}; } catch (e) { return {}; }
  }
  function salvarRascunho() {
    try { localStorage.setItem(K_RASCUNHO, JSON.stringify(valores)); } catch (e) {}
  }
  function limparRascunho() {
    try { localStorage.removeItem(K_RASCUNHO); localStorage.removeItem(K_ID); } catch (e) {}
  }

  // o mesmo id é reaproveitado se o envio falhar no meio e o cliente tentar de novo
  function idDoBriefing() {
    var id = null;
    try { id = localStorage.getItem(K_ID); } catch (e) {}
    if (!id) {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0;
            return (c === "x" ? r : (r & 3 | 8)).toString(16);
          });
      try { localStorage.setItem(K_ID, id); } catch (e) {}
    }
    return id;
  }

  function mascaraTel(v) {
    var d = String(v || "").replace(/\D/g, "").slice(0, 13);
    if (d.length > 11) return "+" + d.slice(0, d.length - 11) + " (" + d.slice(-11, -9) + ") " + d.slice(-9, -4) + "-" + d.slice(-4);
    if (d.length > 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
    if (d.length > 6) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    if (d.length > 2) return "(" + d.slice(0, 2) + ") " + d.slice(2);
    return d;
  }

  function nomeSeguro(nome) {
    var s = String(nome || "arquivo").normalize("NFD").replace(/[̀-ͯ]/g, "");
    s = s.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    return (s || "arquivo").slice(-80);
  }

  function visivel(campo) {
    if (REVISAR || !campo.mostrarSe) return true;
    return valores[campo.mostrarSe.campo] === campo.mostrarSe.valor;
  }

  function subirTopo() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- telas ---------- */
  function abertura() {
    var temRascunho = Object.keys(valores).length > 0;
    app.replaceChildren(
      el("section", { class: "abertura" }, [
        el("span", { class: "etiqueta", text: "Briefing do seu site" }),
        el("h1", { html: "Vamos construir o <em>seu site</em> juntos" }),
        el("p", { text: "Responda algumas perguntas e envie suas imagens. Com isso em mãos, nossa equipe começa a criar." }),
        el("button", { class: "btn", type: "button", onclick: function () { ir(0); } },
          temRascunho ? "Continuar de onde parei →" : "Começar →"),
        el("ul", { class: "passos-lista" }, [
          passo("01", "5 minutos", "Perguntas rápidas sobre o seu negócio."),
          passo("02", "Suas imagens", "Foto, logo e fotos do espaço ou produtos."),
          passo("03", "Salva sozinho", "Pode sair e voltar: suas respostas ficam guardadas neste aparelho."),
        ]),
      ])
    );
  }
  function passo(n, t, d) {
    return el("li", {}, [el("span", { text: n }), el("b", { text: t }), d]);
  }

  function ir(i, voltando) {
    atual = i;
    atualizarRevisao();
    if (i < 0) { abertura(); subirTopo(); return; }
    var etapa = ETAPAS[i];
    var ultima = i === ETAPAS.length - 1;

    var cartao = el("section", { class: "etapa" + (voltando ? " voltando" : "") }, [
      el("h2", { text: etapa.titulo, tabindex: "-1" }),
      el("p", { class: "sub", text: etapa.sub }),
    ]);
    if (ultima) cartao.appendChild(resumo());
    etapa.campos.forEach(function (c) { cartao.appendChild(montarCampo(c)); });
    if (ultima) cartao.appendChild(aceite());

    cartao.appendChild(el("div", { class: "aviso", id: "aviso", hidden: true, role: "alert" }));
    cartao.appendChild(el("div", { class: "nav" }, [
      el("button", { class: "btn btn-ghost", type: "button", onclick: function () { ir(i - 1, true); } }, "← Voltar"),
      el("button", { class: "btn", type: "button", id: "avancar", onclick: avancar },
        ultima ? "Enviar briefing ✓" : "Continuar →"),
    ]));

    app.replaceChildren(
      el("div", { class: "progresso" }, [
        el("div", { class: "linha" }, [
          el("b", { text: etapa.titulo }),
          el("span", { text: "Etapa " + (i + 1) + " de " + ETAPAS.length }),
        ]),
        el("div", { class: "trilho", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(Math.round((i + 1) / ETAPAS.length * 100)) },
          el("i", { id: "barra" })),
      ]),
      cartao
    );
    requestAnimationFrame(function () {
      document.getElementById("barra").style.width = ((i + 1) / ETAPAS.length * 100) + "%";
    });
    subirTopo();
  }

  function resumo() {
    var total = Object.keys(arquivos).reduce(function (n, k) { return n + arquivos[k].length; }, 0);
    function linha(r, v) { return el("div", {}, [el("span", { text: r }), el("b", { text: v || "—" })]); }
    return el("div", { class: "resumo" }, [
      linha("Negócio", valores.negocio),
      linha("Responsável", valores.responsavel),
      linha("WhatsApp", valores.whatsapp),
      linha("Arquivos anexados", total ? String(total) : "Nenhum"),
    ]);
  }

  function aceite() {
    var caixa = el("input", { type: "checkbox", id: "aceite" });
    caixa.checked = !!valores._aceite;
    caixa.addEventListener("change", function () {
      valores._aceite = caixa.checked; salvarRascunho();
      caixa.closest(".campo").classList.remove("erro");
    });
    return el("div", { class: "campo", "data-campo": "_aceite" }, [
      el("label", { class: "aceite" }, [
        caixa,
        el("span", { text: "Autorizo a VRMP Digital a usar as informações e imagens enviadas para criar o meu site, e confirmo que tenho direito de uso sobre elas." }),
      ]),
      el("span", { class: "msg-erro", text: "Marque a autorização para enviar." }),
    ]);
  }

  /* ---------- campos ---------- */
  function montarCampo(c) {
    var caixa = el("div", { class: "campo", "data-campo": c.id, hidden: !visivel(c) });
    var idEntrada = "c-" + c.id;
    var rotulo = el(c.tipo === "chips" || c.tipo === "multichips" || c.tipo === "arquivos" ? "span" : "label",
      { class: "rotulo", for: idEntrada, id: "r-" + c.id }, [c.label, c.req ? el("span", { class: "req", text: "*" }) : null]);
    caixa.appendChild(rotulo);
    if (c.dica) caixa.appendChild(el("span", { class: "dica", text: c.dica }));

    if (c.tipo === "chips" || c.tipo === "multichips") caixa.appendChild(montarChips(c));
    else if (c.tipo === "arquivos") montarArquivos(c, caixa);
    else caixa.appendChild(montarEntrada(c, idEntrada));

    caixa.appendChild(el("span", { class: "msg-erro" }));
    return caixa;
  }

  function montarEntrada(c, id) {
    var area = c.tipo === "area";
    var n = el(area ? "textarea" : "input", {
      id: id, placeholder: c.ph || "", rows: area ? String(c.linhas || 4) : null,
      type: area ? null : ({ tel: "tel", email: "email", url: "url" }[c.tipo] || "text"),
      inputmode: c.tipo === "tel" ? "tel" : null,
      autocomplete: { negocio: "organization", responsavel: "name", whatsapp: "tel", email: "email", endereco: "street-address" }[c.id] || "off",
      maxlength: area ? "4000" : "300",
      "aria-required": c.req ? "true" : null,
    });
    n.value = valores[c.id] || "";
    n.addEventListener("input", function () {
      if (c.tipo === "tel") n.value = mascaraTel(n.value);
      valores[c.id] = n.value;
      salvarRascunho();
      n.closest(".campo").classList.remove("erro");
    });
    if (c.tipo === "url") {
      n.addEventListener("blur", function () {
        var v = n.value.trim();
        if (v && !/^https?:\/\//i.test(v)) { n.value = "https://" + v; valores[c.id] = n.value; salvarRascunho(); }
      });
    }
    return n;
  }

  function montarChips(c) {
    var multi = c.tipo === "multichips";
    var grupo = el("div", { class: "chips", role: "group", "aria-labelledby": "r-" + c.id });
    c.opcoes.forEach(function (op) {
      var ligado = multi ? (valores[c.id] || []).indexOf(op) !== -1 : valores[c.id] === op;
      var b = el("button", { type: "button", class: "chip", "aria-pressed": String(ligado), text: op });
      b.addEventListener("click", function () {
        if (multi) {
          var lista = (valores[c.id] || []).slice();
          var p = lista.indexOf(op);
          if (p === -1) lista.push(op); else lista.splice(p, 1);
          valores[c.id] = lista;
          b.setAttribute("aria-pressed", String(p === -1));
        } else {
          valores[c.id] = valores[c.id] === op ? "" : op;
          [].forEach.call(grupo.children, function (x) { x.setAttribute("aria-pressed", String(x === b && valores[c.id] === op)); });
        }
        salvarRascunho();
        grupo.closest(".campo").classList.remove("erro");
        atualizarCondicionais();
      });
      grupo.appendChild(b);
    });
    return grupo;
  }

  function atualizarCondicionais() {
    ETAPAS[atual].campos.forEach(function (c) {
      if (!c.mostrarSe) return;
      var n = app.querySelector('[data-campo="' + c.id + '"]');
      if (n) n.hidden = !visivel(c);
    });
  }

  function montarArquivos(c, caixa) {
    arquivos[c.id] = arquivos[c.id] || [];
    var entrada = el("input", { type: "file", multiple: c.max > 1, accept: "image/*,application/pdf", "aria-labelledby": "r-" + c.id });
    var area = el("label", { class: "soltar" }, [
      el("span", { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>' }),
      el("b", { text: "Toque para escolher ou arraste aqui" }),
      el("small", { text: "JPG, PNG, WEBP ou PDF · até " + CFG.maxArquivoMB + " MB cada" }),
      entrada,
    ]);
    var grade = el("div", { class: "miniaturas" });

    function adicionar(lista) {
      var recusados = [];
      [].forEach.call(lista, function (f) {
        var tipo = f.type || (/\.hei[cf]$/i.test(f.name) ? "image/heic" : "");
        if (!TIPOS_OK.test(tipo)) { recusados.push(f.name + " (formato não aceito)"); return; }
        if (f.size > CFG.maxArquivoMB * 1024 * 1024) { recusados.push(f.name + " (maior que " + CFG.maxArquivoMB + " MB)"); return; }
        if (arquivos[c.id].length >= c.max) { recusados.push(f.name + " (limite de " + c.max + " arquivos)"); return; }
        arquivos[c.id].push({ file: f, tipo: tipo, url: /^image\/(jpeg|png|webp|gif)$/.test(tipo) ? URL.createObjectURL(f) : null });
      });
      var msg = caixa.querySelector(".msg-erro");
      caixa.classList.toggle("erro", recusados.length > 0);
      msg.textContent = recusados.length ? "Não adicionados: " + recusados.join(", ") : "";
      desenhar();
    }

    function desenhar() {
      grade.replaceChildren.apply(grade, arquivos[c.id].map(function (item, i) {
        return el("div", { class: "mini" + (item.path ? " ok" : "") + (item.falhou ? " falhou" : "") }, [
          item.url ? el("img", { src: item.url, alt: item.file.name }) : el("div", { class: "doc", text: item.file.name }),
          el("button", { type: "button", "aria-label": "Remover " + item.file.name, text: "×", onclick: function () {
            if (item.url) URL.revokeObjectURL(item.url);
            arquivos[c.id].splice(i, 1);
            desenhar();
          } }),
          el("div", { class: "estado" }, el("i")),
        ]);
      }));
    }

    entrada.addEventListener("change", function () { adicionar(entrada.files); entrada.value = ""; });
    ["dragenter", "dragover"].forEach(function (ev) {
      area.addEventListener(ev, function (e) { e.preventDefault(); area.classList.add("sobre"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      area.addEventListener(ev, function (e) { e.preventDefault(); area.classList.remove("sobre"); });
    });
    area.addEventListener("drop", function (e) { if (e.dataTransfer) adicionar(e.dataTransfer.files); });

    caixa.appendChild(area);
    caixa.appendChild(grade);
    desenhar();
  }

  /* ---------- validação ---------- */
  function validar() {
    var primeiro = null;
    function marcar(id, texto) {
      var n = app.querySelector('[data-campo="' + id + '"]');
      if (!n) return;
      n.classList.add("erro");
      if (texto) n.querySelector(".msg-erro").textContent = texto;
      primeiro = primeiro || n;
    }

    ETAPAS[atual].campos.forEach(function (c) {
      if (!visivel(c) || c.tipo === "arquivos") return;
      var v = valores[c.id];
      var vazio = Array.isArray(v) ? v.length === 0 : !String(v || "").trim();
      if (vazio) { if (c.req) marcar(c.id, "Preencha este campo para continuar."); return; }
      if (c.tipo === "tel" && String(v).replace(/\D/g, "").length < 10) marcar(c.id, "Informe o número com DDD.");
      if (c.tipo === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) marcar(c.id, "Confira o e-mail digitado.");
    });
    if (atual === ETAPAS.length - 1 && !valores._aceite) marcar("_aceite");

    if (primeiro) {
      primeiro.scrollIntoView({ behavior: "smooth", block: "center" });
      var foco = primeiro.querySelector("input, textarea, button");
      if (foco) foco.focus({ preventScroll: true });
    }
    return !primeiro;
  }

  function avancar() {
    if (REVISAR) { irRevisao(atual + 1); return; }
    if (enviando || !validar()) return;
    if (atual < ETAPAS.length - 1) ir(atual + 1);
    else enviar();
  }

  /* ---------- envio ---------- */
  function telaEnviando() {
    app.replaceChildren(el("section", { class: "etapa central" }, [
      el("div", { class: "giro" }),
      el("h2", { text: "Enviando seu briefing…" }),
      el("p", { id: "andamento", text: "Não feche esta página." }),
    ]));
    subirTopo();
  }

  function telaSucesso() {
    var nome = String(valores.responsavel || "").trim().split(" ")[0];
    var texto = "Olá! Acabei de enviar o briefing do site" + (valores.negocio ? " da " + valores.negocio : "") + ".";
    app.replaceChildren(el("section", { class: "etapa central" }, [
      el("div", { class: "check", html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' }),
      el("h2", { text: (nome ? nome + ", r" : "R") + "ecebemos tudo!" }),
      el("p", { text: "Nossa equipe já vai analisar suas respostas e começar o seu site. Se precisarmos de algo mais, chamamos você no WhatsApp." }),
      el("a", { class: "btn", href: "https://wa.me/" + CFG.whatsapp + "?text=" + encodeURIComponent(texto), target: "_blank", rel: "noopener" }, "Avisar no WhatsApp →"),
    ]));
    subirTopo();
  }

  function falhaNoEnvio(texto) {
    enviando = false;
    ir(ETAPAS.length - 1);
    var aviso = document.getElementById("aviso");
    aviso.textContent = texto;
    aviso.hidden = false;
  }

  async function enviar() {
    if (!CFG.sb) { falhaNoEnvio("Não foi possível conectar. Verifique sua internet e tente de novo."); return; }
    enviando = true;
    telaEnviando();

    var id = idDoBriefing();
    var fila = [];
    Object.keys(arquivos).forEach(function (campo) {
      arquivos[campo].forEach(function (item, i) { fila.push({ campo: campo, item: item, ordem: i + 1 }); });
    });

    var andamento = document.getElementById("andamento");
    var falhas = 0;
    for (var i = 0; i < fila.length; i++) {
      var f = fila[i];
      if (f.item.path) continue; // já subiu numa tentativa anterior
      andamento.textContent = "Enviando arquivo " + (i + 1) + " de " + fila.length + "…";
      var caminho = id + "/" + f.campo + "/" + Date.now().toString(36) + "-" + f.ordem + "-" + nomeSeguro(f.item.file.name);
      var r = await subir(caminho, f.item);
      if (r) { f.item.path = caminho; f.item.falhou = false; }
      else { f.item.falhou = true; falhas++; }
    }
    if (falhas) {
      falhaNoEnvio(falhas + (falhas === 1 ? " arquivo não foi enviado" : " arquivos não foram enviados") +
        ". Suas respostas estão salvas: toque em Enviar para tentar de novo, ou volte e remova os arquivos marcados em vermelho.");
      return;
    }

    andamento.textContent = "Salvando suas respostas…";
    var dados = {};
    ETAPAS.forEach(function (e) {
      e.campos.forEach(function (c) {
        if (c.tipo === "arquivos" || !visivel(c)) return;
        var v = valores[c.id];
        if (Array.isArray(v) ? v.length : String(v || "").trim()) dados[c.id] = Array.isArray(v) ? v : String(v).trim();
      });
    });
    dados._aceite_em = new Date().toISOString();

    var res = await CFG.sb.from(CFG.tabela).insert({
      id: id,
      negocio: String(valores.negocio).trim().slice(0, 200),
      dados: dados,
      arquivos: fila.map(function (f) {
        return { campo: f.campo, path: f.item.path, nome: f.item.file.name, tipo: f.item.tipo, tamanho: f.item.file.size };
      }),
    });
    // 23505 = id já gravado: o envio anterior chegou, só a resposta se perdeu
    if (res.error && res.error.code !== "23505") {
      console.error(res.error);
      falhaNoEnvio("Não conseguimos salvar suas respostas agora. Verifique a internet e toque em Enviar de novo: nada foi perdido.");
      return;
    }

    enviando = false;
    limparRascunho();
    valores = {};
    arquivos = {};
    telaSucesso();
  }

  async function subir(caminho, item) {
    for (var tentativa = 0; tentativa < 2; tentativa++) {
      try {
        var r = await CFG.sb.storage.from(CFG.bucket).upload(caminho, item.file, { contentType: item.tipo, upsert: false });
        if (!r.error) return true;
        console.error(r.error);
      } catch (e) { console.error(e); }
    }
    return false;
  }

  /* ---------- modo de revisão (?revisar) ---------- */
  function nomeDaTela(i) {
    if (i < 0) return "Abertura";
    if (i >= ETAPAS.length) return "Tela de sucesso";
    return (i + 1) + "/" + ETAPAS.length + " · " + ETAPAS[i].titulo;
  }
  function irRevisao(i) {
    i = Math.max(-1, Math.min(ETAPAS.length, i));
    if (i === atual) return;
    var voltando = i < atual;
    if (i === ETAPAS.length) { atual = i; telaSucesso(); atualizarRevisao(); }
    else ir(i, voltando);
  }
  function atualizarRevisao() {
    var r = document.getElementById("revRotulo");
    if (!r) return;
    r.textContent = nomeDaTela(atual);
    document.getElementById("revAnt").disabled = atual <= -1;
    document.getElementById("revProx").disabled = atual >= ETAPAS.length;
  }
  if (REVISAR) {
    document.body.classList.add("revisando");
    document.body.appendChild(el("div", { class: "revisao", role: "navigation", "aria-label": "Revisão das telas" }, [
      el("button", { type: "button", id: "revAnt", "aria-label": "Tela anterior", text: "◀", onclick: function () { irRevisao(atual - 1); } }),
      el("span", {}, [el("small", { text: "MODO REVISÃO" }), el("b", { id: "revRotulo" })]),
      el("button", { type: "button", id: "revProx", "aria-label": "Próxima tela", text: "▶", onclick: function () { irRevisao(atual + 1); } }),
    ]));
    document.addEventListener("keydown", function (e) {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === "ArrowLeft") irRevisao(atual - 1);
      if (e.key === "ArrowRight") irRevisao(atual + 1);
    });
  }

  window.addEventListener("beforeunload", function (e) {
    if (enviando) { e.preventDefault(); e.returnValue = ""; }
  });

  abertura();
  atualizarRevisao();
})();
