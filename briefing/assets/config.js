/* ============================================================
   Config — Supabase (projeto AgendaBaseSuperBase; tabelas do briefing isoladas)
   URL e chave "publishable" são públicas; a segurança real vem
   das políticas RLS (ver supabase-setup.sql).
   ============================================================ */
(function (global) {
  "use strict";

  var SUPA = {
    url: "https://ohlqzspfrhullnjfjmqi.supabase.co",
    key: "sb_publishable_XZw9mVzoFzMdovEE3fTBjA_fZM6PJTD",
  };

  global.VRMP = {
    bucket: "briefings",
    tabela: "briefings",
    whatsapp: "5584999370533",
    maxArquivoMB: 15,
    sb: (global.supabase && global.supabase.createClient)
      ? global.supabase.createClient(SUPA.url, SUPA.key, {
          auth: { persistSession: true, autoRefreshToken: true, storageKey: "vrmp.briefing.sb", detectSessionInUrl: false },
        })
      : null,
  };
})(window);
