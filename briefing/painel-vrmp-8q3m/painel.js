/* ============================================================
   Painel de briefings — só para a equipe (login Supabase +
   tabela briefing_admins; ver supabase-setup.sql)
   ?demo na URL abre com dados de exemplo, sem login e sem gravar.
   ============================================================ */
(function () {
  "use strict";

  var CFG = window.VRMP;
  var SB = CFG.sb;
  var ETAPAS = window.BRIEFING.etapas;
  var CATEGORIAS = window.BRIEFING.categoriasArquivo;
  var STATUS = window.BRIEFING.status;
  var DEMO = /[?&]demo\b/.test(location.search);

  var $ = function (id) { return document.getElementById(id); };
  var briefings = [];
  var selecionado = null;
  var fechados = { arquivado: true }; // grupos recolhidos na lista
  var termo = "";
  var links = {};        // path → URL assinada
  var visorLista = [];
  var visorPos = 0;
  var ultimaCarga = 0;

  /* ---------- utilidades ---------- */
  function el(tag, attrs, filhos) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    });
    [].concat(filhos || []).forEach(function (f) {
      if (f == null) return;
      n.appendChild(typeof f === "string" ? document.createTextNode(f) : f);
    });
    return n;
  }

  var toastTimer;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("ativo");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("ativo"); }, 2400);
  }

  function copiar(texto, aviso) {
    function ok() { toast(aviso || "Copiado"); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(ok, function () { copiarLegado(texto); ok(); });
    } else { copiarLegado(texto); ok(); }
  }
  function copiarLegado(texto) {
    var a = el("textarea", { style: "position:fixed;opacity:0" });
    a.value = texto;
    document.body.appendChild(a);
    a.select();
    try { document.execCommand("copy"); } catch (e) {}
    a.remove();
  }

  function data(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) +
      " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  function dataCurta(iso) {
    var d = new Date(iso), hoje = new Date();
    if (d.toDateString() === hoje.toDateString()) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }
  function tamanho(b) {
    if (!b) return "";
    return b > 1048576 ? (b / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";
  }
  function slug(s) {
    return String(s || "cliente").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cliente";
  }
  function ehImagem(a) { return /^image\/(jpeg|png|webp|gif)$/.test(a.tipo || ""); }
  function soDigitos(v) { return String(v || "").replace(/\D/g, ""); }
  function linkSeguro(v) { return /^https?:\/\//i.test(String(v || "").trim()) ? String(v).trim() : null; }

  function baixarBlob(blob, nome) {
    var url = URL.createObjectURL(blob);
    var a = el("a", { href: url, download: nome });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  /* ---------- acesso ---------- */
  function mostrar(tela) {
    $("telaLogin").hidden = tela !== "login";
    $("telaPainel").hidden = tela !== "painel";
  }

  function erroLogin(error) {
    var m = ((error && error.message) || "").toLowerCase();
    if (m.indexOf("invalid login") !== -1) return "E-mail ou senha incorretos.";
    if (m.indexOf("confirm") !== -1) return "E-mail ainda não confirmado no Supabase.";
    return "Não foi possível entrar. Tente novamente.";
  }

  async function ehAdmin() {
    var r = await SB.rpc("is_briefing_admin");
    return !r.error && r.data === true;
  }

  async function iniciar() {
    if (DEMO) { briefings = dadosDemo(); mostrar("painel"); desenharTudo(); return; }
    if (!SB) { mostrar("login"); $("erroLogin").textContent = "Sem conexão com o servidor."; return; }
    var s = await SB.auth.getSession();
    if (s.data && s.data.session && await ehAdmin()) { mostrar("painel"); carregar(); }
    else mostrar("login");
  }

  $("formLogin").addEventListener("submit", async function (e) {
    e.preventDefault();
    var btn = $("btnEntrar"), erro = $("erroLogin");
    erro.textContent = "";
    btn.disabled = true; btn.textContent = "Entrando…";
    var r = await SB.auth.signInWithPassword({ email: $("email").value.trim(), password: $("senha").value });
    if (r.error) erro.textContent = erroLogin(r.error);
    else if (!(await ehAdmin())) {
      await SB.auth.signOut();
      erro.textContent = "Esta conta não tem acesso aos briefings.";
    } else {
      $("senha").value = "";
      mostrar("painel");
      carregar();
    }
    btn.disabled = false; btn.textContent = "Entrar →";
  });

  $("btnSair").addEventListener("click", async function () {
    if (!DEMO) await SB.auth.signOut();
    briefings = []; selecionado = null; links = {};
    mostrar("login");
  });

  /* ---------- dados ---------- */
  async function carregar() {
    ultimaCarga = Date.now();
    var r = await SB.from(CFG.tabela).select("*").order("created_at", { ascending: false });
    if (r.error) { console.error(r.error); toast("Erro ao carregar os briefings"); return; }
    briefings = r.data || [];
    desenharTudo();
  }

  async function assinar(paths) {
    var faltam = paths.filter(function (p) { return p && !links[p]; });
    if (!faltam.length || DEMO) return;
    var r = await SB.storage.from(CFG.bucket).createSignedUrls(faltam, 3600);
    if (r.error) { console.error(r.error); return; }
    (r.data || []).forEach(function (x) { if (x.signedUrl) links[x.path] = x.signedUrl; });
  }

  async function atualizar(b, campos) {
    Object.keys(campos).forEach(function (k) { b[k] = campos[k]; });
    if (DEMO) return true;
    var r = await SB.from(CFG.tabela).update(campos).eq("id", b.id);
    if (r.error) { console.error(r.error); toast("Não foi possível salvar"); return false; }
    return true;
  }

  async function obterBlob(a) {
    if (DEMO) return (await fetch(links[a.path])).blob();
    var r = await SB.storage.from(CFG.bucket).download(a.path);
    if (r.error) throw r.error;
    return r.data;
  }

  async function baixarArquivo(a) {
    try { toast("Baixando…"); baixarBlob(await obterBlob(a), a.nome || "arquivo"); }
    catch (e) { console.error(e); toast("Falha ao baixar o arquivo"); }
  }

  async function baixarTudo(b, botao) {
    var arqs = b.arquivos || [];
    if (!arqs.length) return;
    var rotulo = botao.textContent;
    botao.disabled = true;
    try {
      var zip = new JSZip();
      var usados = {};
      for (var i = 0; i < arqs.length; i++) {
        botao.textContent = "Baixando " + (i + 1) + "/" + arqs.length + "…";
        var pasta = slug(CATEGORIAS[arqs[i].campo] || arqs[i].campo);
        var nome = pasta + "/" + (arqs[i].nome || "arquivo-" + (i + 1));
        while (usados[nome]) nome = nome.replace(/(\.[^./]+)?$/, "-" + (i + 1) + "$1");
        usados[nome] = true;
        zip.file(nome, await obterBlob(arqs[i]));
      }
      zip.file("briefing.md", markdown(b));
      botao.textContent = "Compactando…";
      baixarBlob(await zip.generateAsync({ type: "blob" }), "briefing-" + slug(b.negocio) + ".zip");
    } catch (e) { console.error(e); toast("Falha ao baixar os arquivos"); }
    botao.disabled = false;
    botao.textContent = rotulo;
  }

  /* ---------- briefing em texto ---------- */
  function valorTexto(v) { return Array.isArray(v) ? v.join(", ") : String(v); }

  function markdown(b) {
    var d = b.dados || {};
    var out = ["# Briefing: " + b.negocio, "", "Recebido em " + data(b.created_at), ""];
    ETAPAS.forEach(function (e) {
      var linhas = e.campos.filter(function (c) { return c.tipo !== "arquivos" && d[c.id] != null && d[c.id] !== ""; })
        .map(function (c) {
          var v = valorTexto(d[c.id]);
          return v.indexOf("\n") === -1 ? "- **" + c.label + ":** " + v : "### " + c.label + "\n\n" + v + "\n";
        });
      if (linhas.length) out.push("## " + e.titulo, "", linhas.join("\n"), "");
    });
    var arqs = b.arquivos || [];
    if (arqs.length) {
      out.push("## Arquivos enviados", "");
      Object.keys(CATEGORIAS).forEach(function (k) {
        var l = arqs.filter(function (a) { return a.campo === k; });
        if (l.length) out.push("- **" + CATEGORIAS[k] + ":** " + l.map(function (a) { return a.nome; }).join(", "));
      });
      out.push("");
    }
    if (b.notas) out.push("## Notas internas", "", b.notas, "");
    return out.join("\n");
  }

  // texto único com tudo do cliente, pronto para colar no Claude e começar o site
  function paraClaude(b) {
    var n = (b.arquivos || []).length;
    return "Crie o site deste cliente a partir do briefing abaixo. " +
      (n ? "Os arquivos listados no final (" + n + ") estão em briefing-" + slug(b.negocio) + ".zip, separados em pastas por categoria."
         : "O cliente não enviou imagens.") + "\n\n" + markdown(b);
  }

  /* ---------- lista ---------- */
  var GRUPOS = [["novo", "Novos"], ["em_producao", "Em produção"], ["entregue", "Entregues"], ["arquivado", "Arquivados"]];

  function filtrados() {
    var t = termo.trim().toLowerCase();
    if (!t) return briefings;
    return briefings.filter(function (b) {
      var d = b.dados || {};
      return [b.negocio, d.responsavel, d.instagram, d.cidade, d.segmento].join(" ").toLowerCase().indexOf(t) !== -1;
    });
  }

  // números no topo: quantos clientes em cada etapa; clicar leva ao grupo na lista
  function desenharResumo() {
    $("resumo").replaceChildren.apply($("resumo"), GRUPOS.slice(0, 3).map(function (g) {
      var n = briefings.filter(function (b) { return b.status === g[0]; }).length;
      return el("button", { type: "button", class: "conta " + g[0], "aria-label": n + " " + g[1], onclick: function () {
        fechados[g[0]] = false;
        if (termo) { termo = ""; $("busca").value = ""; }
        desenharLista();
        var alvo = $("lista").querySelector('[data-grupo="' + g[0] + '"]');
        if (alvo) $("lista").scrollTo({ top: alvo.offsetTop, behavior: "smooth" });
      } }, [el("b", { text: String(n) }), el("span", { text: g[1] })]);
    }));
  }

  // lista compacta, uma linha por cliente, agrupada por status
  function desenharLista() {
    desenharResumo();
    if (!briefings.length) {
      $("lista").replaceChildren(el("div", { class: "vazio", text: "Nenhum briefing recebido ainda. Envie o link do formulário para o seu cliente." }));
      return;
    }
    var lista = filtrados();
    var buscando = !!termo.trim();
    var nos = [];
    GRUPOS.forEach(function (g) {
      var l = lista.filter(function (b) { return b.status === g[0]; });
      if (g[0] === "arquivado" && !l.length) return;
      var aberto = buscando ? l.length > 0 : !fechados[g[0]];
      nos.push(el("button", { type: "button", class: "grupo", "data-grupo": g[0], "aria-expanded": String(aberto), onclick: function () {
        fechados[g[0]] = aberto; desenharLista();
      } }, [el("i", { class: "ponto " + g[0] }), g[1], el("b", { text: String(l.length) })]));
      if (!aberto) return;
      if (!l.length) nos.push(el("div", { class: "grupo-vazio", text: "Nenhum cliente" }));
      l.forEach(function (b) {
        var d = b.dados || {};
        nos.push(el("button", {
          type: "button", class: "item", "aria-current": String(selecionado === b.id),
          title: [d.segmento, d.cidade, data(b.created_at)].filter(Boolean).join(" · "),
          onclick: function () { abrir(b.id); },
        }, [el("span", { class: "nome", text: b.negocio }), el("span", { class: "quando", text: dataCurta(b.created_at) })]));
      });
    });
    $("lista").replaceChildren.apply($("lista"), nos);
  }

  function desenharTudo() {
    desenharLista();
    if (selecionado && briefings.some(function (b) { return b.id === selecionado; })) abrir(selecionado, true);
    else detalheVazio();
  }

  /* ---------- detalhe ---------- */
  function detalheVazio() {
    selecionado = null;
    $("telaPainel").classList.remove("com-detalhe");
    $("detalhe").replaceChildren(el("div", { class: "detalhe-vazio" }, el("div", {}, [
      el("h2", { text: briefings.length ? "Selecione um cliente" : "Tudo pronto" }),
      el("p", { text: briefings.length ? "Escolha um briefing na lista para ver as respostas e as imagens." : "Os briefings enviados pelos clientes aparecem aqui." }),
    ])));
  }

  function renderValor(c, v) {
    if (Array.isArray(v)) return el("div", { class: "etiquetas" }, v.map(function (x) { return el("span", { text: x }); }));
    var s = String(v);
    if (c.tipo === "tel" && soDigitos(s).length >= 10) {
      var n = soDigitos(s);
      return el("a", { href: "https://wa.me/" + (n.length <= 11 ? "55" + n : n), target: "_blank", rel: "noopener noreferrer", text: s });
    }
    if (c.tipo === "email" && /^[^\s@]+@[^\s@]+$/.test(s)) return el("a", { href: "mailto:" + s, text: s });
    if (c.id === "instagram") {
      var user = s.replace(/^.*instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
      if (/^[A-Za-z0-9._]{1,30}$/.test(user)) return el("a", { href: "https://instagram.com/" + user, target: "_blank", rel: "noopener noreferrer", text: "@" + user });
    }
    if (linkSeguro(s)) return el("a", { href: linkSeguro(s), target: "_blank", rel: "noopener noreferrer", text: s });
    return document.createTextNode(s);
  }

  async function abrir(id, semRolar) {
    var b = briefings.filter(function (x) { return x.id === id; })[0];
    if (!b) return;
    selecionado = id;
    $("telaPainel").classList.add("com-detalhe");
    desenharLista();

    var d = b.dados || {};
    var arqs = b.arquivos || [];
    var raiz = $("detalhe");

    var seletor = el("select", { "aria-label": "Status do projeto" }, Object.keys(STATUS).map(function (k) {
      return el("option", { value: k, selected: b.status === k, text: STATUS[k] });
    }));
    seletor.addEventListener("change", async function () {
      if (await atualizar(b, { status: seletor.value })) { toast("Status: " + STATUS[seletor.value]); desenharLista(); }
    });

    var btnZip = el("button", { class: "btn btn-ghost btn-sm", type: "button", disabled: !arqs.length, text: "Baixar imagens (.zip)" });
    btnZip.addEventListener("click", function () { baixarTudo(b, btnZip); });
    var zap = soDigitos(d.whatsapp);

    var nos = [
      el("button", { class: "btn btn-ghost btn-sm voltar", type: "button", onclick: detalheVazioEAtualiza }, "← Clientes"),
      el("div", { class: "cabeca" }, [
        el("div", {}, [
          el("h1", { text: b.negocio }),
          el("div", { class: "quando", text: "Recebido em " + data(b.created_at) + (d.responsavel ? " · " + d.responsavel : "") }),
        ]),
        seletor,
      ]),
      el("div", { class: "acoes" }, [
        el("button", { class: "btn btn-sm", type: "button", onclick: function () { copiar(paraClaude(b), "Tudo copiado. Agora é só colar no Claude"); } }, "Copiar tudo para o Claude"),
        btnZip,
        zap.length >= 10 ? el("a", { class: "btn btn-ghost btn-sm", href: "https://wa.me/" + (zap.length <= 11 ? "55" + zap : zap), target: "_blank", rel: "noopener noreferrer" }, "WhatsApp do cliente") : null,
      ]),
    ];

    // imagens primeiro: é o que mais se usa na hora de montar o site
    var galerias = [];
    Object.keys(CATEGORIAS).forEach(function (k) {
      var l = arqs.filter(function (a) { return a.campo === k; });
      if (!l.length) return;
      var grade = el("div", { class: "galeria" });
      galerias.push({ grade: grade, arquivos: l });
      nos.push(el("section", { class: "bloco" }, [
        el("h2", {}, [CATEGORIAS[k], el("small", { text: l.length + (l.length === 1 ? " arquivo" : " arquivos") })]),
        grade,
      ]));
    });

    ETAPAS.forEach(function (e) {
      var campos = e.campos.filter(function (c) {
        var v = d[c.id];
        return c.tipo !== "arquivos" && v != null && v !== "" && !(Array.isArray(v) && !v.length);
      });
      if (!campos.length) return;
      nos.push(el("section", { class: "bloco" }, [
        el("h2", { text: e.titulo }),
        el("dl", { style: "margin:0" }, campos.map(function (c) {
          return el("div", { class: "dado" }, [
            el("dt", { text: c.label }),
            el("dd", {}, renderValor(c, d[c.id])),
            el("button", { class: "copiar", type: "button", "aria-label": "Copiar " + c.label, onclick: function () { copiar(valorTexto(d[c.id])); } }, "Copiar"),
          ]);
        })),
      ]));
    });

    var notas = el("textarea", { placeholder: "Anotações só suas: prazo combinado, domínio, pendências…", "aria-label": "Notas internas" });
    notas.value = b.notas || "";
    var salvo = el("div", { class: "salvo" });
    var t;
    notas.addEventListener("input", function () {
      salvo.textContent = "Salvando…";
      clearTimeout(t);
      t = setTimeout(async function () {
        salvo.textContent = (await atualizar(b, { notas: notas.value })) ? "Salvo" : "Não foi possível salvar";
      }, 700);
    });
    nos.push(el("section", { class: "bloco notas campo" }, [el("h2", { text: "Notas internas" }), notas, salvo]));

    raiz.replaceChildren.apply(raiz, nos);
    if (!semRolar) raiz.scrollTop = 0;

    await assinar(arqs.map(function (a) { return a.path; }));
    if (selecionado !== id) return;
    galerias.forEach(function (g) { desenharGaleria(g.grade, g.arquivos, arqs); });
  }

  function detalheVazioEAtualiza() { detalheVazio(); desenharLista(); }

  function desenharGaleria(grade, lista, todos) {
    var imagens = todos.filter(function (a) { return ehImagem(a) && links[a.path]; });
    grade.replaceChildren.apply(grade, lista.map(function (a) {
      var url = links[a.path];
      var miolo = ehImagem(a) && url
        ? el("img", { src: url, alt: a.nome || "", loading: "lazy" })
        : el("div", { class: "doc" }, el("div", {}, [el("b", { text: (String(a.nome || "").split(".").pop() || "ARQ").toUpperCase().slice(0, 5) }), "Prévia indisponível"]));
      return el("figure", { class: "foto", style: "margin:0" }, [
        el("button", { class: "abrir", type: "button", "aria-label": "Ampliar " + (a.nome || "imagem"), onclick: function () {
          var p = imagens.indexOf(a);
          if (p !== -1) abrirVisor(imagens, p); else baixarArquivo(a);
        } }, miolo),
        el("figcaption", { class: "pe" }, [
          el("span", { title: a.nome, text: (a.nome || "arquivo") + (a.tamanho ? " · " + tamanho(a.tamanho) : "") }),
          el("button", { type: "button", onclick: function () { baixarArquivo(a); } }, "Baixar"),
        ]),
      ]);
    }));
  }

  /* ---------- visor ---------- */
  function abrirVisor(lista, pos) {
    visorLista = lista; visorPos = pos;
    $("visor").hidden = false;
    mostrarNoVisor();
    $("visorFechar").focus();
  }
  function mostrarNoVisor() {
    var a = visorLista[visorPos];
    $("visorImg").src = links[a.path];
    $("visorImg").alt = a.nome || "";
    $("visorNome").textContent = (visorPos + 1) + " / " + visorLista.length + " · " + (a.nome || "");
    $("visorAnt").hidden = $("visorProx").hidden = visorLista.length < 2;
  }
  function moverVisor(passo) {
    visorPos = (visorPos + passo + visorLista.length) % visorLista.length;
    mostrarNoVisor();
  }
  function fecharVisor() { $("visor").hidden = true; $("visorImg").removeAttribute("src"); }

  $("visorFechar").addEventListener("click", fecharVisor);
  $("visorAnt").addEventListener("click", function () { moverVisor(-1); });
  $("visorProx").addEventListener("click", function () { moverVisor(1); });
  $("visorBaixar").addEventListener("click", function () { baixarArquivo(visorLista[visorPos]); });
  $("visor").addEventListener("click", function (e) { if (e.target === $("visor")) fecharVisor(); });
  document.addEventListener("keydown", function (e) {
    if ($("visor").hidden) return;
    if (e.key === "Escape") fecharVisor();
    if (e.key === "ArrowLeft") moverVisor(-1);
    if (e.key === "ArrowRight") moverVisor(1);
  });

  /* ---------- barra lateral ---------- */
  $("busca").addEventListener("input", function (e) { termo = e.target.value; desenharLista(); });
  $("btnLink").addEventListener("click", function () {
    copiar(new URL("../", location.href).href, "Link do formulário copiado");
  });
  window.addEventListener("focus", function () {
    if (!DEMO && !$("telaPainel").hidden && Date.now() - ultimaCarga > 60000) carregar();
  });

  /* ---------- dados de exemplo (?demo) ---------- */
  function dadosDemo() {
    function img(cor, texto) {
      return "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="' + cor +
        '"/><text x="300" y="320" font-family="sans-serif" font-size="44" font-weight="700" text-anchor="middle" fill="rgba(255,255,255,.85)">' + texto + "</text></svg>");
    }
    function arq(campo, nome, cor) {
      var path = "demo/" + campo + "/" + nome;
      links[path] = img(cor, nome.replace(/\..+$/, ""));
      return { campo: campo, path: path, nome: nome, tipo: "image/png", tamanho: 1843200 };
    }
    return [
      {
        id: "demo-1", created_at: new Date(Date.now() - 3600e3).toISOString(), negocio: "Clínica Bella Vita", status: "novo", notas: "",
        dados: {
          negocio: "Clínica Bella Vita", responsavel: "Dra. Marina Souza", whatsapp: "(84) 99888-7766", email: "contato@bellavita.com.br",
          segmento: "Estética / Beleza", cidade: "Natal / RN", horario: "Seg a sex, 9h às 19h",
          instagram: "@clinicabellavita", google: "https://maps.app.goo.gl/exemplo", dominio: "Ainda não tenho",
          objetivo: ["Receber contatos no WhatsApp", "Agendamentos", "Passar autoridade"],
          sobre: "Clínica de estética avançada fundada em 2018.\nAtendimento individual, com foco em resultados naturais.",
          servicos: "Harmonização facial\nBotox\nBioestimuladores de colágeno\nLimpeza de pele",
          diferenciais: "Pós-graduação em harmonização orofacial, mais de 2.000 procedimentos realizados.",
          registro: "CRO-RN 0000", preferenciais: "Parcelamos em até 10x. Avaliação gratuita.",
          cores: "Rosé e dourado", referencias: "https://exemplo.com.br: gosto do visual limpo",
        },
        arquivos: [arq("foto_profissional", "dra-marina.png", "#8A5A6B"), arq("logo", "logo-bella-vita.png", "#B98A5E"),
          arq("imagens", "recepcao.png", "#3E6B66"), arq("imagens", "sala-1.png", "#55708F"), arq("imagens", "antes-depois.png", "#6B5A8A")],
      },
      {
        id: "demo-2", created_at: new Date(Date.now() - 3 * 86400e3).toISOString(), negocio: "Almeida Advocacia", status: "em_producao", notas: "Domínio já comprado. Entrega combinada para sexta.",
        dados: { negocio: "Almeida Advocacia", responsavel: "Rafael Almeida", whatsapp: "(11) 97777-1234", segmento: "Advocacia", cidade: "São Paulo / SP",
          instagram: "@almeida.adv", dominio: "Já tenho", dominio_qual: "almeidaadvocacia.com.br",
          objetivo: ["Passar autoridade", "Aparecer no Google"], servicos: "Direito trabalhista\nDireito previdenciário", registro: "OAB/SP 000.000" },
        arquivos: [arq("foto_profissional", "rafael.png", "#2F3E55")],
      },
      {
        id: "demo-3", created_at: new Date(Date.now() - 9 * 86400e3).toISOString(), negocio: "Forno da Vila", status: "entregue", notas: "",
        dados: { negocio: "Forno da Vila", responsavel: "Carla Menezes", whatsapp: "(31) 96666-4321", segmento: "Alimentação", cidade: "Belo Horizonte / MG",
          instagram: "@fornodavila", objetivo: ["Vender produtos"], servicos: "Pizzas artesanais\nMassas frescas" },
        arquivos: [],
      },
    ].concat([
      ["Studio Lume Pilates", "novo", "Saúde / Clínica", 0.2], ["Dr. Paulo Rezende Ortopedia", "novo", "Saúde / Clínica", 0.6],
      ["Barbearia Dom Corte", "novo", "Estética / Beleza", 1], ["Marmoraria Pedra Viva", "novo", "Serviços", 1.4],
      ["Pet Shop Patinhas", "em_producao", "Loja / Comércio", 2], ["Costa & Lima Arquitetura", "em_producao", "Arquitetura / Engenharia", 4],
      ["Odonto Sorriso Natal", "em_producao", "Saúde / Clínica", 5], ["Ateliê Flor de Açúcar", "entregue", "Alimentação", 12],
      ["Nutri Camila Duarte", "entregue", "Saúde / Clínica", 15], ["Auto Center Rota 84", "entregue", "Serviços", 20],
      ["Psicóloga Helena Prado", "entregue", "Saúde / Clínica", 26], ["Imobiliária Porto Seguro", "arquivado", "Serviços", 40],
    ].map(function (x, i) {
      return { id: "demo-x" + i, created_at: new Date(Date.now() - x[3] * 86400e3).toISOString(), negocio: x[0], status: x[1], notas: "",
        dados: { negocio: x[0], responsavel: "Cliente de exemplo", whatsapp: "(84) 90000-0000", segmento: x[2], servicos: "Serviço de exemplo" }, arquivos: [] };
    }));
  }

  iniciar();
})();
