/* ============================================================
   Campos do briefing — fonte única usada pelo formulário e pelo
   painel. Para adicionar/remover uma pergunta, edite só aqui.

   tipos: texto | tel | email | url | area | chips | multichips | arquivos
   req: obrigatório · mostrarSe: só aparece se outro campo tiver o valor
   ============================================================ */
window.BRIEFING = {
  etapas: [
    {
      id: "negocio",
      titulo: "Seu negócio",
      sub: "O básico para começarmos. Leva menos de 1 minuto.",
      campos: [
        { id: "negocio", tipo: "texto", label: "Nome do seu negócio", ph: "Ex.: Clínica Bella Vita", req: true },
        { id: "responsavel", tipo: "texto", label: "Seu nome", ph: "Como podemos te chamar?", req: true },
        { id: "whatsapp", tipo: "tel", label: "Seu WhatsApp", ph: "(00) 00000-0000", req: true, dica: "Usamos só para falar com você sobre o site." },
        { id: "email", tipo: "email", label: "E-mail", ph: "voce@email.com" },
        {
          id: "segmento", tipo: "chips", label: "Qual é o seu segmento?", req: true,
          opcoes: ["Saúde / Clínica", "Estética / Beleza", "Advocacia", "Arquitetura / Engenharia", "Alimentação", "Loja / Comércio", "Serviços", "Outro"],
        },
        { id: "segmento_outro", tipo: "texto", label: "Qual segmento?", ph: "Descreva em poucas palavras", mostrarSe: { campo: "segmento", valor: "Outro" } },
        { id: "cidade", tipo: "texto", label: "Cidade e estado", ph: "Ex.: Natal / RN" },
        { id: "endereco", tipo: "texto", label: "Endereço completo", ph: "Rua, número, bairro", dica: "Só se você atende presencialmente e quer o endereço no site." },
        { id: "horario", tipo: "texto", label: "Horário de atendimento", ph: "Ex.: Seg a sex, 8h às 18h" },
      ],
    },
    {
      id: "presenca",
      titulo: "Presença online",
      sub: "Onde seus clientes já te encontram hoje.",
      campos: [
        { id: "instagram", tipo: "texto", label: "Instagram", ph: "@seunegocio" },
        { id: "outras_redes", tipo: "area", label: "Outras redes e links", ph: "Facebook, TikTok, YouTube, LinkedIn, Linktree…", linhas: 3 },
        { id: "google", tipo: "url", label: "Link do Google Maps / Perfil da Empresa", ph: "https://maps.app.goo.gl/…" },
        { id: "site_atual", tipo: "url", label: "Já tem site? Cole o link", ph: "https://…" },
        { id: "dominio", tipo: "chips", label: "Você já tem um domínio (endereço .com.br)?", opcoes: ["Já tenho", "Ainda não tenho", "Não sei"] },
        { id: "dominio_qual", tipo: "texto", label: "Qual é o domínio?", ph: "seunegocio.com.br", mostrarSe: { campo: "dominio", valor: "Já tenho" } },
      ],
    },
    {
      id: "conteudo",
      titulo: "Conteúdo do site",
      sub: "Escreva do seu jeito, sem se preocupar com o texto final. A gente lapida.",
      campos: [
        {
          id: "objetivo", tipo: "multichips", label: "O que o site precisa fazer por você?", dica: "Pode marcar mais de um.",
          opcoes: ["Receber contatos no WhatsApp", "Agendamentos", "Vender produtos", "Passar autoridade", "Mostrar portfólio", "Aparecer no Google"],
        },
        { id: "sobre", tipo: "area", label: "Conte sobre o negócio", ph: "Como começou, há quanto tempo existe, o que te move…", linhas: 5 },
        { id: "servicos", tipo: "area", label: "Serviços ou produtos que você oferece", ph: "Liste um por linha. Se quiser, inclua uma breve descrição de cada.", linhas: 5, req: true },
        { id: "diferenciais", tipo: "area", label: "Por que escolhem você e não o concorrente?", ph: "Seus diferenciais, formação, prêmios, anos de experiência…", linhas: 4 },
        { id: "publico", tipo: "area", label: "Quem é o seu cliente ideal?", ph: "Idade, perfil, o que essa pessoa procura…", linhas: 3 },
        { id: "whatsapp_site", tipo: "tel", label: "WhatsApp que vai no botão do site", ph: "(00) 00000-0000", dica: "Deixe em branco se for o mesmo número informado no início." },
        { id: "preferenciais", tipo: "area", label: "Informações que não podem faltar no site", ph: "Tudo o que você faz questão que apareça: convênios, formas de pagamento, áreas atendidas, promoções…", linhas: 5 },
      ],
    },
    {
      id: "visual",
      titulo: "Imagens e identidade",
      sub: "Quanto melhores as fotos, mais bonito fica o site. Envie os arquivos originais.",
      campos: [
        { id: "foto_profissional", tipo: "arquivos", label: "Foto profissional", dica: "Sua foto (ou da equipe) em boa qualidade. Até 3 arquivos.", max: 3 },
        { id: "logo", tipo: "arquivos", label: "Logo", dica: "De preferência em PNG com fundo transparente ou PDF. Até 3 arquivos.", max: 3 },
        { id: "imagens", tipo: "arquivos", label: "Demais imagens", dica: "Espaço, atendimento, produtos, antes e depois, prints de depoimentos. Até 20 arquivos.", max: 20 },
        { id: "cores", tipo: "texto", label: "Cores da sua marca", ph: "Ex.: verde-escuro e dourado" },
        { id: "referencias", tipo: "area", label: "Sites que você acha bonitos", ph: "Cole os links e diga o que gosta em cada um.", linhas: 3 },
        { id: "nao_quero", tipo: "area", label: "Algo que você NÃO quer no site?", ph: "Cores, estilos, palavras, assuntos…", linhas: 3 },
      ],
    },
    {
      id: "envio",
      titulo: "Quase lá",
      sub: "Último espaço para o que não coube nas perguntas.",
      campos: [
        { id: "observacoes", tipo: "area", label: "Observações finais", ph: "Prazo desejado, datas importantes, qualquer recado para a nossa equipe.", linhas: 4 },
      ],
    },
  ],

  categoriasArquivo: {
    foto_profissional: "Foto profissional",
    logo: "Logo",
    imagens: "Demais imagens",
  },

  status: {
    novo: "Novo",
    em_producao: "Em produção",
    entregue: "Entregue",
    arquivado: "Arquivado",
  },
};
