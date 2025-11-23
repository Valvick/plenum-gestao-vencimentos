import React from "react";

const LandingPage: React.FC = () => {
  const scrollToId = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Navbar */}
      <header className="sticky top-0 z-30 bg-slate-950/90 border-b border-slate-800 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-sky-500 flex items-center justify-center shadow-lg overflow-hidden">
              <img
                src="/plenum_icon_192x192.png"
                alt="SegVenc"
                className="w-8 h-8 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">SegVenc</div>
              <div className="text-[11px] text-slate-400">
                Gestão de Vencimentos
              </div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
            <button
              onClick={() => scrollToId("como-funciona")}
              className="hover:text-white transition"
            >
              Como funciona
            </button>
            <button
              onClick={() => scrollToId("beneficios")}
              className="hover:text-white transition"
            >
              Benefícios
            </button>
            <button
              onClick={() => scrollToId("planos")}
              className="hover:text-white transition"
            >
              Planos
            </button>
            <button
              onClick={() => scrollToId("faq")}
              className="hover:text-white transition"
            >
              Dúvidas
            </button>
          </nav>

          <div className="flex items-center gap-2">
            {/* link pro sistema atual */}
            <a
              href="https://app.segvenc.app/checkout"
              className="hidden md:inline-flex text-xs font-semibold text-slate-300 hover:text-white transition"
            >
              Entrar
            </a>
            <button
              onClick={() => scrollToId("cta-final")}
              className="text-[11px] md:text-xs font-semibold rounded-2xl bg-sky-500 hover:bg-sky-600 px-4 py-2 shadow-lg transition"
            >
              Começar teste grátis
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#0ea5e980,_transparent_55%)] opacity-40 pointer-events-none" />
          <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 relative z-10 grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-500/50 bg-sky-500/10 px-3 py-1 text-[11px] font-medium text-sky-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Sistema para empresas de energia e serviços elétricos
              </span>

              <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-white">
                Controle total dos vencimentos de exames e cursos —
                <span className="text-sky-400"> sem planilhas e sem erros.</span>
              </h1>

              <p className="text-sm md:text-base text-slate-300 max-w-xl">
                O SegVenc monitora automaticamente exames médicos, NR10, NR35 e
                treinamentos. Evite multas, paralisações de equipe e riscos à
                segurança em poucos cliques.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => scrollToId("cta-final")}
                  className="inline-flex items-center justify-center rounded-2xl bg-sky-500 hover:bg-sky-600 px-6 py-3 text-sm font-semibold shadow-xl transition"
                >
                  Começar agora – 7 dias grátis
                </button>
                <a
                  href="https://wa.me/5587991448171" // TROCAR PELO SEU WHATSAPP
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-800/80 transition"
                >
                  Falar com especialista
                </a>
              </div>

              <div className="flex flex-wrap gap-4 pt-4 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Alertas automáticos por e-mail
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Ideal para distribuidoras, terceirizadas e EPSs
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Dados hospedados com segurança na nuvem
                </div>
              </div>
            </div>

            {/* Card de preview */}
            <div className="relative">
              <div className="absolute -top-10 -right-6 w-40 h-40 rounded-full bg-sky-500/20 blur-3xl" />
              <div className="relative bg-slate-900/80 border border-slate-700 rounded-[28px] p-5 shadow-2xl backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Painel de Vencimentos
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Situação em tempo real da sua equipe
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] px-3 py-1 font-semibold">
                    Compliance em dia
                  </span>
                </div>

                <div className="space-y-3 text-[11px]">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-2xl bg-slate-800/70 border border-slate-700 p-3">
                      <p className="text-slate-400">Exames a vencer</p>
                      <p className="text-lg font-bold text-amber-300">12</p>
                      <p className="text-[10px] text-amber-300/80">
                        próximos 30 dias
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-800/70 border border-slate-700 p-3">
                      <p className="text-slate-400">Cursos vencidos</p>
                      <p className="text-lg font-bold text-rose-300">3</p>
                      <p className="text-[10px] text-rose-300/80">
                        ação imediata
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-800/70 border border-slate-700 p-3">
                      <p className="text-slate-400">Colaboradores ok</p>
                      <p className="text-lg font-bold text-emerald-300">
                        87%
                      </p>
                      <p className="text-[10px] text-emerald-300/80">
                        dentro da validade
                      </p>
                    </div>
                  </div>

                  <div className="mt-2">
                    <p className="text-[11px] font-semibold text-slate-200 mb-2">
                      Próximos vencimentos
                    </p>
                    <div className="space-y-1.5">
                      {[
                        {
                          nome: "João Silva",
                          item: "Exame periódico",
                          dias: "em 7 dias",
                        },
                        {
                          nome: "Equipe Linha Viva",
                          item: "NR10 Reciclagem",
                          dias: "em 15 dias",
                        },
                        {
                          nome: "Time Subestação",
                          item: "NR35 Reciclagem",
                          dias: "em 22 dias",
                        },
                      ].map((v, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-xl bg-slate-800/60 border border-slate-700 px-3 py-2"
                        >
                          <div>
                            <p className="text-[11px] font-semibold text-slate-100">
                              {v.item}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {v.nome}
                            </p>
                          </div>
                          <span className="text-[10px] text-amber-300">
                            {v.dias}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="pt-2 text-[10px] text-slate-500">
                    *Imagens meramente ilustrativas. Interface real pode variar.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Benefícios / problemas */}
        <section
          id="beneficios"
          className="border-t border-slate-800 bg-slate-950"
        >
          <div className="max-w-6xl mx-auto px-4 py-14 md:py-18 grid md:grid-cols-2 gap-10">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white mb-3">
                Chega de planilhas confusas e riscos desnecessários.
              </h2>
              <p className="text-sm text-slate-300 mb-5">
                O SegVenc foi criado por quem vive a realidade da operação e da
                segurança em empresas de energia e serviços elétricos. Nada de
                sistemas genéricos: você tem um painel focado em exames,
                treinamentos normativos e certificações obrigatórias.
              </p>
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <span className="mt-1 h-5 w-5 rounded-full bg-rose-500/10 border border-rose-500/50 flex items-center justify-center text-[11px] text-rose-300">
                    !
                  </span>
                  <div>
                    <p className="font-semibold text-slate-100">
                      Exames e cursos vencendo sem ninguém perceber
                    </p>
                    <p className="text-slate-400 text-xs">
                      Exames periódicos, ASOs, NR10, NR35 e demais treinamentos
                      se perdem em planilhas desatualizadas — até o dia que a
                      fiscalização ou um acidente expõe o problema.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="mt-1 h-5 w-5 rounded-full bg-rose-500/10 border border-rose-500/50 flex items-center justify-center text-[11px] text-rose-300">
                    !
                  </span>
                  <div>
                    <p className="font-semibold text-slate-100">
                      Risco de multas, paralisações e imagem comprometida
                    </p>
                    <p className="text-slate-400 text-xs">
                      Equipe parada por documentação irregular custa caro,
                      derruba indicadores e ainda expõe a empresa em auditorias
                      e contratos.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="mt-1 h-5 w-5 rounded-full bg-emerald-500/10 border border-emerald-500/50 flex items-center justify-center text-[11px] text-emerald-300">
                    ✓
                  </span>
                  <div>
                    <p className="font-semibold text-slate-100">
                      Com o SegVenc, você antecipa problemas e ganha
                      previsibilidade
                    </p>
                    <p className="text-slate-400 text-xs">
                      Alertas automáticos, visão por unidade, cargo ou equipe, e
                      relatórios prontos para auditoria. Seu time regular, sua
                      operação protegida.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Como funciona */}
            <div
              id="como-funciona"
              className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-6 space-y-4 shadow-xl"
            >
              <h3 className="text-sm font-semibold text-slate-100">
                Como o SegVenc funciona na prática
              </h3>
              <ol className="space-y-3 text-xs text-slate-300">
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center text-[11px] font-semibold">
                    1
                  </span>
                  <div>
                    <p className="font-semibold text-slate-100">
                      Cadastre colaboradores e documentos
                    </p>
                    <p className="text-slate-400">
                      Importe sua planilha atual ou cadastre diretamente. Guarde
                      ASO, laudos e certificados em um só lugar.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center text-[11px] font-semibold">
                    2
                  </span>
                  <div>
                    <p className="font-semibold text-slate-100">
                      Configure prazos e alertas
                    </p>
                    <p className="text-slate-400">
                      Defina periodicidade de exames e reciclagens. O SegVenc
                      calcula automaticamente os vencimentos.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center text-[11px] font-semibold">
                    3
                  </span>
                  <div>
                    <p className="font-semibold text-slate-100">
                      Receba alertas antes de vencer
                    </p>
                    <p className="text-slate-400">
                      E-mails sinalizam o que está por vencer em 30, 15 e 7
                      dias — por empresa, contrato ou equipe.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center text-[11px] font-semibold">
                    4
                  </span>
                  <div>
                    <p className="font-semibold text-slate-100">
                      Utilize relatórios em auditorias e reuniões
                    </p>
                    <p className="text-slate-400">
                      Gere relatórios em poucos cliques, exporte para Excel e
                      mostre a situação real da sua força de trabalho.
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </section>

        {/* Planos */}
        <section
          id="planos"
          className="border-t border-slate-800 bg-slate-950/95"
        >
          <div className="max-w-6xl mx-auto px-4 py-16">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">
                Planos simples, pensados para sua operação
              </h2>
              <p className="text-sm text-slate-400 max-w-xl mx-auto">
                Comece pequeno e cresça com segurança. Todos os planos incluem
                as mesmas funcionalidades — o que muda é apenas o número de
                colaboradores monitorados.
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-5">
              {[
                {
                  nome: "Start",
                  descricao: "Para equipes compactas e empresas menores.",
                  preco: "R$ 97/mês",
                  faixa: "Até 20 colaboradores",
                  destaque: false,
                },
                {
                  nome: "Profissional",
                  descricao: "Ideal para empresas estruturadas e contratos fixos.",
                  preco: "R$ 197/mês",
                  faixa: "Até 50 colaboradores",
                  destaque: true,
                },
                {
                  nome: "Empresa",
                  descricao:
                    "Para operações com múltiplas equipes e turnos.",
                  preco: "R$ 297/mês",
                  faixa: "Até 120 colaboradores",
                  destaque: false,
                },
                {
                  nome: "Operacional",
                  descricao: "Para grandes contratos e operações intensivas.",
                  preco: "R$ 397/mês",
                  faixa: "Até 200 colaboradores",
                  destaque: false,
                },
              ].map((plano, i) => (
                <div
                  key={i}
                  className={`flex flex-col rounded-[24px] border p-5 text-sm ${
                    plano.destaque
                      ? "border-sky-500/70 bg-slate-900 shadow-xl shadow-sky-900/40"
                      : "border-slate-800 bg-slate-900/70"
                  }`}
                >
                  {plano.destaque && (
                    <span className="self-start mb-3 rounded-full bg-sky-500/20 text-sky-200 text-[10px] font-semibold px-3 py-1">
                      Mais escolhido
                    </span>
                  )}
                  <h3 className="text-base font-semibold text-white">
                    {plano.nome}
                  </h3>
                  <p className="text-[11px] text-slate-400 mb-3">
                    {plano.descricao}
                  </p>
                  <div className="mt-auto">
                    <p className="text-lg font-bold text-sky-300">
                      {plano.preco}
                    </p>
                    <p className="text-[11px] text-slate-400 mb-4">
                      {plano.faixa}
                    </p>
                    <ul className="space-y-1 mb-4 text-[11px] text-slate-300">
                      <li>• Alertas automáticos por e-mail</li>
                      <li>• Painel em tempo real</li>
                      <li>• Exportação de dados</li>
                      <li>• Suporte via WhatsApp</li>
                    </ul>
                    <button
                      onClick={() => scrollToId("cta-final")}
                      className={`w-full rounded-2xl px-3 py-2 text-xs font-semibold ${
                        plano.destaque
                          ? "bg-sky-500 hover:bg-sky-600 text-white"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-100"
                      } transition`}
                    >
                      Começar com este plano
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-5 text-[11px] text-slate-500 text-center">
              Precisa monitorar mais de 200 colaboradores?{" "}
              <a
                href="https://wa.me/5587991448171"
                target="_blank"
                rel="noreferrer"
                className="text-sky-300 hover:text-sky-200 font-medium"
              >
                Fale com a gente e peça uma proposta corporativa.
              </a>
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          className="border-t border-slate-800 bg-slate-950 py-14"
        >
          <div className="max-w-4xl mx-auto px-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white mb-2">
                Dúvidas frequentes
              </h2>
              <p className="text-sm text-slate-400">
                Algumas respostas rápidas antes de você começar.
              </p>
            </div>

            <div className="space-y-4 text-sm">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="font-semibold text-slate-100">
                  O SegVenc é específico para empresas de energia?
                </p>
                <p className="text-slate-400 text-xs mt-1">
                  Ele foi pensado principalmente para distribuidoras, empresas
                  terceirizadas de serviços elétricos, manutenção de redes,
                  construção e outras operações que exigem NRs e exames
                  periódicos. Porém, pode ser utilizado em qualquer empresa que
                  precise controlar vencimentos de treinamentos e exames
                  ocupacionais.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="font-semibold text-slate-100">
                  Consigo migrar meus dados da planilha atual?
                </p>
                <p className="text-slate-400 text-xs mt-1">
                  Sim. Você pode importar via planilha CSV/Excel ou ir
                  cadastrando aos poucos. Nossa equipe pode ajudar nessa etapa
                  inicial para você não perder tempo.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="font-semibold text-slate-100">
                  Em quanto tempo consigo ver resultado?
                </p>
                <p className="text-slate-400 text-xs mt-1">
                  Em poucos dias você já terá uma visão clara dos principais
                  vencimentos e riscos da sua operação. Em poucas semanas, a
                  organização e previsibilidade já são perceptíveis em auditorias
                  e reuniões de segurança.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="font-semibold text-slate-100">
                  Como funciona o suporte?
                </p>
                <p className="text-slate-400 text-xs mt-1">
                  Oferecemos suporte via WhatsApp e e-mail em horário comercial.
                  Nas primeiras semanas, acompanhamos bem de perto a implantação
                  para garantir que tudo esteja ajustado à realidade da sua
                  operação.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section
          id="cta-final"
          className="border-t border-slate-800 bg-gradient-to-r from-sky-600/20 via-slate-950 to-sky-500/10"
        >
          <div className="max-w-4xl mx-auto px-4 py-14 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                Dê o próximo passo na gestão de vencimentos da sua empresa.
              </h2>
              <p className="text-sm text-slate-200 max-w-xl">
                Comece com 7 dias grátis, sem compromisso. Se o SegVenc não
                simplificar sua rotina de exames e NRs, você pode cancelar sem
                burocracia.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="https://app.segvenc.app/checkout"
                className="inline-flex items-center justify-center rounded-2xl bg-white text-slate-900 px-6 py-3 text-sm font-semibold shadow-xl hover:bg-slate-100 transition"
              >
                Criar minha conta agora
              </a>
              <a
                href="https://wa.me/5587991448171"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300/60 px-6 py-3 text-sm font-semibold text-slate-50 hover:bg-slate-900/50 transition"
              >
                Falar com especialista
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500">
            © {new Date().getFullYear()} SegVenc — Sistema de Gestão de
            Vencimentos.
          </p>
          <p className="text-[11px] text-slate-500">
            Focado em segurança e compliance em operações de energia e serviços
            elétricos.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
