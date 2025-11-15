import { useEffect, useMemo, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";

// =========================
// Supabase Client (Auth)
// =========================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "⚠️ Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local"
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// =========================
/** Tipos de domínio */
// =========================

type TipoRegistro = "Exame" | "Curso";

type StatusRegistro = "Vencido" | "Vence em 30 dias" | "Ok";

export type Colaborador = {
  id: number;
  matricula: string;
  nome: string;
  funcao: string;
  setor: string;
  baseOperacional: string;
  dataAdmissao: string; // ISO
  [key: string]: any;
};

export type Registro = {
  id: number;
  matricula: string;
  colaboradorNome: string;
  funcao: string;
  setor: string;
  baseOperacional: string;
  tipo: TipoRegistro;
  cursoExame: string;
  dataAdmissao: string;
  dataUltimoEvento: string;
  vencimento: string;
  status?: StatusRegistro;
  qtdeDias?: number;
  [key: string]: any;
};

export type ExameCurso = {
  id: number;
  tipo: TipoRegistro;
  nome: string;
  validadeDias: number;
  [key: string]: any;
};

type CustomFilter = {
  id: string;
  nome: string;
  origem: "registros" | "colaboradores";
  usarNoDashboard: boolean;
  usarNosRegistros: boolean;
};

type TabKey = "dashboard" | "registros" | "colaboradores" | "exames" | "campos";

// =========================
// Utilitários
// =========================

function classNames(...classes: (string | boolean | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function daysUntil(dateISO: string): number {
  if (!dateISO) return 0;
  const target = new Date(dateISO);
  const today = new Date();
  const diffMs =
    target.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function statusFromDays(diff: number): StatusRegistro {
  if (diff < 0) return "Vencido";
  if (diff <= 30) return "Vence em 30 dias";
  return "Ok";
}

function statusChipClasses(status: StatusRegistro) {
  switch (status) {
    case "Vencido":
      return "bg-rose-50 text-rose-700 border border-rose-300";
    case "Vence em 30 dias":
      return "bg-amber-50 text-amber-800 border border-amber-300";
    case "Ok":
      return "bg-emerald-50 text-emerald-700 border-emerald-300";
  }
}

// soma dias na data (ISO yyyy-mm-dd)
function addDays(dateISO: string, days: number): string {
  if (!dateISO || !days) return dateISO;
  const d = new Date(dateISO);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// =========================
// Helpers CSV / XLS
// =========================

type CsvColumn = { key: string; label: string };

function objectsToCsv(columns: CsvColumn[], rows: any[]): string {
  const header = columns
    .map((c) => `"${String(c.label).replace(/"/g, '""')}"`)
    .join(";");

  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const v = row[c.key] ?? "";
        const s = String(v).replace(/"/g, '""');
        return `"${s}"`;
      })
      .join(";")
  );

  return [header, ...lines].join("\r\n");
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Excel abre CSV normalmente; mudamos só o mime/ extensão
function downloadCsvFile(filename: string, columns: CsvColumn[], rows: any[]) {
  const csv = objectsToCsv(columns, rows);
  downloadFile(filename, csv, "text/csv;charset=utf-8;");
}

function downloadXlsFile(filename: string, columns: CsvColumn[], rows: any[]) {
  const csv = objectsToCsv(columns, rows);
  downloadFile(filename, csv, "application/vnd.ms-excel");
}

// parser simples de CSV (separa por ; ou ,)
function parseCsv(text: string): string[][] {
  const lines = text.trim().split(/\r?\n/);
  return lines.map((line) => {
    const sep = line.includes(";") ? ";" : ",";
    return line
      .split(sep)
      .map((cell) => cell.replace(/^"|"$/g, ""));
  });
}

// =========================
// Tipos DB (Supabase) + mapeadores
// =========================

type DbColaborador = {
  id: number;
  empresa_id: string;
  matricula: string | null;
  nome: string | null;
  funcao: string | null;
  setor: string | null;
  base_operacional: string | null;
  data_admissao: string | null;
};

type DbExameCurso = {
  id: number;
  empresa_id: string;
  tipo: "Exame" | "Curso";
  nome: string;
  validade_dias: number;
};

type DbRegistro = {
  id: number;
  empresa_id: string;
  colaborador_id: number | null;
  matricula: string | null;
  colaborador_nome: string | null;
  funcao: string | null;
  setor: string | null;
  base_operacional: string | null;
  tipo: "Exame" | "Curso";
  curso_exame: string;
  data_admissao: string | null;
  data_ultimo_evento: string | null;
  vencimento: string | null;
  qtde_dias: number | null;
  status: string | null;
};

type DbCustomFilter = {
  id: number;
  empresa_id: string;
  nome: string;
  origem: "registros" | "colaboradores";
  usar_no_dashboard: boolean;
  usar_nos_registros: boolean;
};

function mapColaboradorFromDb(row: DbColaborador): Colaborador {
  return {
    id: row.id,
    matricula: row.matricula ?? "",
    nome: row.nome ?? "",
    funcao: row.funcao ?? "",
    setor: row.setor ?? "",
    baseOperacional: row.base_operacional ?? "",
    dataAdmissao: row.data_admissao ?? "",
  };
}

function mapExameFromDb(row: DbExameCurso): ExameCurso {
  return {
    id: row.id,
    tipo: row.tipo,
    nome: row.nome,
    validadeDias: row.validade_dias,
  };
}

function mapRegistroFromDb(row: DbRegistro): Registro {
  return {
    id: row.id,
    matricula: row.matricula ?? "",
    colaboradorNome: row.colaborador_nome ?? "",
    funcao: row.funcao ?? "",
    setor: row.setor ?? "",
    baseOperacional: row.base_operacional ?? "",
    tipo: row.tipo,
    cursoExame: row.curso_exame,
    dataAdmissao: row.data_admissao ?? "",
    dataUltimoEvento: row.data_ultimo_evento ?? "",
    vencimento: row.vencimento ?? "",
    qtdeDias: row.qtde_dias ?? undefined,
    status: (row.status as StatusRegistro | null) ?? undefined,
  };
}

function mapCustomFilterFromDb(row: DbCustomFilter): CustomFilter {
  return {
    id: String(row.id),
    nome: row.nome,
    origem: row.origem,
    usarNoDashboard: row.usar_no_dashboard,
    usarNosRegistros: row.usar_nos_registros,
  };
}

// =========================
// Componentes de UI
// =========================

const StatCard: React.FC<{
  title: string;
  value: number;
  subtitle: string;
  color: "blue" | "red" | "amber" | "green";
}> = ({ title, value, subtitle, color }) => {
  const mapBg: Record<string, string> = {
    blue: "from-sky-500 to-indigo-600 text-sky-50",
    red: "from-rose-500 to-red-600 text-rose-50",
    amber: "from-amber-400 to-orange-500 text-amber-950",
    green: "from-emerald-500 to-emerald-600 text-emerald-50",
  };

  return (
    <div className="relative overflow-hidden rounded-3xl shadow-md border border-slate-200">
      <div
        className={classNames(
          "p-4 flex flex-col gap-1 bg-gradient-to-br",
          mapBg[color]
        )}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide opacity-95">
          {title}
        </span>
        <span className="text-3xl font-extrabold leading-tight drop-shadow-sm">
          {value}
        </span>
        <span className="text-[11px] font-semibold opacity-95">
          {subtitle}
        </span>
      </div>
    </div>
  );
};

// =========================
// Tela de Login (Plenum)
// =========================

const AuthScreen: React.FC<{ onAuth: (session: Session | null) => void }> = ({
  onAuth,
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);
  setLoading(true);

  try {
    if (isLogin) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      onAuth(data.session);
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      onAuth(data.session);
    }
  } catch (err: any) {
    console.error(err);
    setError(err.message || "Erro ao autenticar. Verifique os dados.");
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur rounded-[32px] shadow-2xl p-8 space-y-6 border border-slate-200">
        {/* Logo + Nome */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-sky-900 flex items-center justify-center shadow-lg overflow-hidden">
            <img
              src="/plenum-logo.png"
              alt="Plenum"
              className="w-14 h-14 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Plenum
            </h1>
            <p className="text-[13px] text-slate-500 font-medium">
              Seu Sistema de Gestão de Vencimentos
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-rose-50 text-rose-700 text-xs p-3 border border-rose-200">
              {error}
            </div>
          )}

          <div className="space-y-1 text-sm">
            <label className="font-semibold text-slate-700 text-xs" htmlFor="email">
              E-mail corporativo
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-slate-50"
              placeholder="voce@empresa.com.br"
            />
          </div>

          <div className="space-y-1 text-sm">
            <label
              className="font-semibold text-slate-700 text-xs"
              htmlFor="password"
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-slate-50"
              placeholder="Sua senha"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-sky-600 text-white py-2.5 text-sm font-semibold shadow-lg hover:bg-sky-700 transition disabled:opacity-60"
          >
            {loading
              ? "Aguarde..."
              : isLogin
              ? "Entrar no Plenum"
              : "Criar conta"}
          </button>
        </form>

        <div className="text-center text-xs text-slate-500">
          {isLogin ? (
            <>
              Ainda não tem acesso?{" "}
              <button
                type="button"
                className="text-sky-600 font-semibold hover:underline"
                onClick={() => setIsLogin(false)}
              >
                Criar conta
              </button>
            </>
          ) : (
            <>
              Já possui conta?{" "}
              <button
                type="button"
                className="text-sky-600 font-semibold hover:underline"
                onClick={() => setIsLogin(true)}
              >
                Fazer login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// =========================
// DASHBOARD
// =========================

type DashboardProps = {
  registros: Registro[];
  colaboradores: Colaborador[];
  filtrosDashboard: {
    setor: string;
    funcao: string;
    tipo: string; // nome do curso/exame
    custom: Record<string, string>;
  };
  onChangeFiltros: (f: DashboardProps["filtrosDashboard"]) => void;
  customFilters: CustomFilter[];
};

const DashboardView: React.FC<DashboardProps> = ({
  registros,
  colaboradores,
  filtrosDashboard,
  onChangeFiltros,
  customFilters,
}) => {
  const registrosComCalculos = useMemo(() => {
    return registros.map((reg) => {
      const diff = daysUntil(reg.vencimento);
      const status = statusFromDays(diff);
      return { ...reg, qtdeDias: diff, status };
    });
  }, [registros]);

  const setores = Array.from(
    new Set(colaboradores.map((c) => c.setor).filter(Boolean))
  ).sort();

  const funcoes = Array.from(
    new Set(colaboradores.map((c) => c.funcao).filter(Boolean))
  ).sort();

  const cursosExames = Array.from(
    new Set(registros.map((r) => r.cursoExame).filter(Boolean))
  ).sort();

  const filtered = registrosComCalculos.filter((reg) => {
    if (filtrosDashboard.setor && reg.setor !== filtrosDashboard.setor) {
      return false;
    }
    if (filtrosDashboard.funcao && reg.funcao !== filtrosDashboard.funcao) {
      return false;
    }
    if (filtrosDashboard.tipo && reg.cursoExame !== filtrosDashboard.tipo) {
      return false;
    }

    for (const cf of customFilters.filter((c) => c.usarNoDashboard)) {
      const val = filtrosDashboard.custom[cf.id];
      if (!val) continue;
      const regVal = (reg as any)[cf.nome];
      if (
        regVal === undefined ||
        String(regVal).toLowerCase() !== val.toLowerCase()
      ) {
        return false;
      }
    }

    return true;
  });

  const ordered = [...filtered].sort((a, b) => {
    const da = (a as any).qtdeDias ?? daysUntil(a.vencimento);
    const db = (b as any).qtdeDias ?? daysUntil(b.vencimento);
    return da - db;
  });

  const total = filtered.length;
  const vencidos = filtered.filter((r) => r.status === "Vencido").length;
  const vence30 = filtered.filter((r) => r.status === "Vence em 30 dias").length;
  const ok = filtered.filter((r) => r.status === "Ok").length;

  return (
    <div className="space-y-6">
      {/* Filtros globais */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1 text-xs">
          <label className="block font-semibold text-slate-600">Setor</label>
          <select
            value={filtrosDashboard.setor}
            onChange={(e) =>
              onChangeFiltros({
                ...filtrosDashboard,
                setor: e.target.value,
              })
            }
            className="min-w-[160px] rounded-2xl border border-slate-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs bg-white"
          >
            <option value="">Todos</option>
            {setores.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1 text-xs">
          <label className="block font-semibold text-slate-600">Função</label>
          <select
            value={filtrosDashboard.funcao}
            onChange={(e) =>
              onChangeFiltros({
                ...filtrosDashboard,
                funcao: e.target.value,
              })
            }
            className="min-w-[160px] rounded-2xl border border-slate-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs bg-white"
          >
            <option value="">Todas</option>
            {funcoes.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por nome do Curso/Exame */}
        <div className="space-y-1 text-xs">
          <label className="block font-semibold text-slate-600">
            Curso/Exame
          </label>
          <select
            value={filtrosDashboard.tipo}
            onChange={(e) =>
              onChangeFiltros({
                ...filtrosDashboard,
                tipo: e.target.value,
              })
            }
            className="min-w-[160px] rounded-2xl border border-slate-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs bg-white"
          >
            <option value="">Todos</option>
            {cursosExames.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {customFilters
          .filter((c) => c.usarNoDashboard)
          .map((cf) => (
            <div className="space-y-1 text-xs" key={cf.id}>
              <label className="block font-semibold text-slate-600">
                {cf.nome}
              </label>
              <input
                type="text"
                value={filtrosDashboard.custom[cf.id] || ""}
                onChange={(e) =>
                  onChangeFiltros({
                    ...filtrosDashboard,
                    custom: {
                      ...filtrosDashboard.custom,
                      [cf.id]: e.target.value,
                    },
                  })
                }
                className="min-w-[160px] rounded-2xl border border-slate-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs bg-white"
                placeholder={`Filtrar por ${cf.nome}`}
              />
            </div>
          ))}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total monitorados"
          value={total}
          subtitle="Registros de exames e cursos sob gestão."
          color="blue"
        />
        <StatCard
          title="Vencidos"
          value={vencidos}
          subtitle="Tire da operação urgente!"
          color="red"
        />
        <StatCard
          title="Vence em 30 dias ou menos"
          value={vence30}
          subtitle="Programe a atualização!"
          color="amber"
        />
        <StatCard
          title="OK"
          value={ok}
          subtitle="Parabéns, em dia!"
          color="green"
        />
      </div>

      {/* Tabela resumo */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">
          Resumo por colaborador
        </h3>
        <div className="border border-slate-200 rounded-3xl overflow-hidden bg-white">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">
                  Matrícula
                </th>
                <th className="px-3 py-2 text-left font-semibold">Nome</th>
                <th className="px-3 py-2 text-left font-semibold">Função</th>
                <th className="px-3 py-2 text-left font-semibold">Setor</th>
                <th className="px-3 py-2 text-left font-semibold">
                  Qtde Dias
                </th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((reg) => {
                const qtdeDias =
                  reg.qtdeDias ?? daysUntil(reg.vencimento);
                const status =
                  reg.status ?? statusFromDays(qtdeDias);

                return (
                  <tr
                    key={reg.id}
                    className="border-t border-slate-100 hover:bg-slate-50/60"
                  >
                    <td className="px-3 py-2">{reg.matricula}</td>
                    <td className="px-3 py-2">{reg.colaboradorNome}</td>
                    <td className="px-3 py-2">{reg.funcao}</td>
                    <td className="px-3 py-2">{reg.setor}</td>
                    <td
                      className={classNames(
                        "px-3 py-2 font-medium",
                        qtdeDias < 0
                          ? "text-rose-600"
                          : qtdeDias <= 30
                          ? "text-amber-700"
                          : "text-emerald-700"
                      )}
                    >
                      {qtdeDias}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={classNames(
                          "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold",
                          statusChipClasses(status)
                        )}
                      >
                        {status === "Vencido"
                          ? "Vencido"
                          : status === "Vence em 30 dias"
                          ? "Vence em 30 dias ou menos"
                          : "OK"}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {ordered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-slate-400 text-xs"
                  >
                    Nenhum registro encontrado com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// =========================
// TELA REGISTROS
// =========================

type RegistrosViewProps = {
  registros: Registro[];
  setRegistros: (regs: Registro[]) => void;
  colaboradores: Colaborador[];
  customFilters: CustomFilter[];
  exames: ExameCurso[];
};

const RegistrosView: React.FC<RegistrosViewProps> = ({
  registros,
  setRegistros,
  colaboradores,
  customFilters,
  exames,
}) => {
  const [statusFiltro, setStatusFiltro] = useState<string>("");
  const [tipoFiltro, setTipoFiltro] = useState<string>("");
  const [filtrosCustom, setFiltrosCustom] = useState<Record<string, string>>({});
  const [extraCols, setExtraCols] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const colunasBase: CsvColumn[] = [
    { key: "matricula", label: "Matrícula" },
    { key: "colaboradorNome", label: "Colaborador" },
    { key: "funcao", label: "Função" },
    { key: "setor", label: "Setor" },
    { key: "baseOperacional", label: "Base Operacional" },
    { key: "cursoExame", label: "Curso/Exame" },
    { key: "tipo", label: "Tipo" },
    { key: "dataAdmissao", label: "Data Admissão" },
    { key: "dataUltimoEvento", label: "Data Último Evento" },
    { key: "vencimento", label: "Vencimento" },
    { key: "qtdeDias", label: "Qtde Dias" },
    { key: "status", label: "Status" },
  ];

  const colunasExtras: CsvColumn[] = extraCols.map((nome) => ({
    key: nome,
    label: nome,
  }));

  const todasColunas = [...colunasBase, ...colunasExtras];

  const atualizarRegistro = (id: number, field: string, value: any) => {
    setRegistros(
      registros.map((r) => {
        if (r.id !== id) return r;
        let updated: Registro = { ...r, [field]: value };

        // Auto-preenchimento pela matrícula
        if (field === "matricula") {
          const colab = colaboradores.find((c) => c.matricula === value);
          if (colab) {
            updated = {
              ...updated,
              colaboradorNome: colab.nome,
              funcao: colab.funcao,
              setor: colab.setor,
              baseOperacional: colab.baseOperacional,
              dataAdmissao: colab.dataAdmissao,
            };
          }
        }

        // Cálculo automático do vencimento
        if (
          field === "dataUltimoEvento" ||
          field === "cursoExame" ||
          field === "tipo"
        ) {
          const exam = exames.find(
            (e) => e.tipo === updated.tipo && e.nome === updated.cursoExame
          );

          if (exam && updated.dataUltimoEvento) {
            updated.vencimento = addDays(
              updated.dataUltimoEvento,
              exam.validadeDias
            );
            const diff = daysUntil(updated.vencimento);
            updated.qtdeDias = diff;
            updated.status = statusFromDays(diff);
          }
        }

        return updated;
      })
    );
  };

  const adicionarLinha = () => {
    const novo: Registro = {
      id: Date.now(),
      matricula: "",
      colaboradorNome: "",
      funcao: "",
      setor: "",
      baseOperacional: "",
      tipo: "Exame",
      cursoExame: "",
      dataAdmissao: "",
      dataUltimoEvento: "",
      vencimento: "",
    };
    setRegistros([...registros, novo]);
  };

  const removerLinha = (id: number) => {
    setRegistros(registros.filter((r) => r.id !== id));
  };

  const adicionarColuna = () => {
    const nome = window.prompt("Nome da nova coluna personalizada:");
    if (!nome) return;
    if (extraCols.includes(nome)) return;
    setExtraCols([...extraCols, nome]);
  };

  const removerColuna = (nome: string) => {
    setExtraCols(extraCols.filter((c) => c !== nome));
    setRegistros(
      registros.map((r) => {
        const novo = { ...r };
        delete (novo as any)[nome];
        return novo;
      })
    );
  };

  // IMPORTAÇÃO CSV
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const matrix = parseCsv(text);
      if (!matrix.length) return;

      const [header, ...rows] = matrix;

      const indexToKey: Record<number, string> = {};
      todasColunas.forEach((col) => {
        const idx = header.findIndex(
          (h) => h.trim().toLowerCase() === col.label.toLowerCase()
        );
        if (idx >= 0) {
          indexToKey[idx] = col.key;
        }
      });

      const imported: Registro[] = rows
        .filter((r) => r.some((cell) => cell.trim() !== ""))
        .map((cells, idx) => {
          const base: any = {
            id: Date.now() + idx,
            tipo: "Exame",
          };
          Object.entries(indexToKey).forEach(([idxStr, key]) => {
            const i = Number(idxStr);
            base[key] = cells[i] ?? "";
          });

          if (base.vencimento) {
            const diff = daysUntil(base.vencimento);
            base.qtdeDias = diff;
            base.status = statusFromDays(diff);
          }

          return base as Registro;
        });

      setRegistros(imported);
      e.target.value = "";
    };
    reader.readAsText(file, "utf-8");
  };

  const exportarCsv = () => {
    downloadCsvFile("registros.csv", todasColunas, registros);
  };

  const exportarXls = () => {
    downloadXlsFile("registros.xls", todasColunas, registros);
  };

  const registrosFiltrados = registros.filter((reg) => {
    const diff = daysUntil(reg.vencimento);
    const status = statusFromDays(diff);

    if (statusFiltro) {
      if (statusFiltro === "Vencidos" && status !== "Vencido") return false;
      if (
        statusFiltro === "Vence em 30 dias ou menos" &&
        status !== "Vence em 30 dias"
      )
        return false;
      if (statusFiltro === "OK" && status !== "Ok") return false;
    }

    if (tipoFiltro && reg.tipo !== tipoFiltro) return false;

    for (const cf of customFilters.filter((c) => c.usarNosRegistros)) {
      const valorFiltro = filtrosCustom[cf.id];
      if (!valorFiltro) continue;
      const valorReg = (reg as any)[cf.nome];
      if (
        valorReg === undefined ||
        String(valorReg).toLowerCase() !== valorFiltro.toLowerCase()
      ) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filtros & Ações */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1 text-xs">
          <label className="block text-slate-700 font-semibold">Status</label>
          <select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value)}
            className="rounded-2xl border border-slate-300 px-3 py-1.5 text-xs min-w-[180px] focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">Todos</option>
            <option value="Vencidos">Vencidos</option>
            <option value="Vence em 30 dias ou menos">
              Vence em 30 dias ou menos
            </option>
            <option value="OK">OK</option>
          </select>
        </div>

        <div className="space-y-1 text-xs">
          <label className="block text-slate-700 font-semibold">
            Tipo (Exame/Curso)
          </label>
          <select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
            className="rounded-2xl border border-slate-300 px-3 py-1.5 text-xs min-w-[140px] focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">Todos</option>
            <option value="Exame">Exame</option>
            <option value="Curso">Curso</option>
          </select>
        </div>

        {customFilters
          .filter((c) => c.usarNosRegistros)
          .map((cf) => (
            <div className="space-y-1 text-xs" key={cf.id}>
              <label className="block text-slate-700 font-semibold">
                {cf.nome}
              </label>
              <input
                type="text"
                value={filtrosCustom[cf.id] || ""}
                onChange={(e) =>
                  setFiltrosCustom({
                    ...filtrosCustom,
                    [cf.id]: e.target.value,
                  })
                }
                className="rounded-2xl border border-slate-300 px-3 py-1.5 text-xs min-w-[160px] focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder={`Filtrar por ${cf.nome}`}
              />
            </div>
          ))}

        <div className="ml-auto flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={adicionarColuna}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            + Nova coluna
          </button>
          <button
            type="button"
            onClick={adicionarLinha}
            className="rounded-full bg-sky-600 text-white px-3 py-1.5 text-[11px] font-semibold shadow hover:bg-sky-700"
          >
            + Nova linha
          </button>
          <button
            type="button"
            onClick={handleImportClick}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            Importar CSV
          </button>
          <button
            type="button"
            onClick={exportarCsv}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            Baixar CSV
          </button>
          <button
            type="button"
            onClick={exportarXls}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            Baixar XLS
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="border border-slate-200 rounded-3xl overflow-auto bg-white">
        <table className="w-full text-xs min-w-[1100px]">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">
                Matrícula
              </th>
              <th className="px-3 py-2 text-left font-semibold">
                Colaborador
              </th>
              <th className="px-3 py-2 text-left font-semibold">Função</th>
              <th className="px-3 py-2 text-left font-semibold">Setor</th>
              <th className="px-3 py-2 text-left font-semibold">
                Base Operacional
              </th>
              <th className="px-3 py-2 text-left font-semibold">
                Curso/Exame
              </th>
              <th className="px-3 py-2 text-left font-semibold">Tipo</th>
              <th className="px-3 py-2 text-left font-semibold">
                Data Admissão
              </th>
              <th className="px-3 py-2 text-left font-semibold">
                Data Último Evento
              </th>
              <th className="px-3 py-2 text-left font-semibold">
                Vencimento
              </th>
              <th className="px-3 py-2 text-left font-semibold">
                Qtde Dias
              </th>
              <th className="px-3 py-2 text-left font-semibold">Status</th>

              {extraCols.map((col) => (
                <th key={col} className="px-3 py-2 text-left font-semibold">
                  <div className="flex items-center gap-1">
                    {col}
                    <button
                      className="text-rose-500 text-[10px]"
                      onClick={() => removerColuna(col)}
                    >
                      ✕
                    </button>
                  </div>
                </th>
              ))}

              <th className="px-3 py-2 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {registrosFiltrados.map((reg) => {
              const diff = daysUntil(reg.vencimento);
              const status = statusFromDays(diff);

              return (
                <tr
                  key={reg.id}
                  className="border-t border-slate-100 hover:bg-slate-50/60"
                >
                  <td className="px-3 py-1.5">
                    <input
                      className="w-full border border-slate-200 bg-transparent rounded-lg px-2 py-1"
                      value={reg.matricula}
                      onChange={(e) =>
                        atualizarRegistro(reg.id, "matricula", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      className="w-full border border-slate-200 bg-transparent rounded-lg px-2 py-1"
                      value={reg.colaboradorNome}
                      onChange={(e) =>
                        atualizarRegistro(
                          reg.id,
                          "colaboradorNome",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      className="w-full border border-slate-200 bg-transparent rounded-lg px-2 py-1"
                      value={reg.funcao}
                      onChange={(e) =>
                        atualizarRegistro(reg.id, "funcao", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      className="w-full border border-slate-200 bg-transparent rounded-lg px-2 py-1"
                      value={reg.setor}
                      onChange={(e) =>
                        atualizarRegistro(reg.id, "setor", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      className="w-full border border-slate-200 bg-transparent rounded-lg px-2 py-1"
                      value={reg.baseOperacional}
                      onChange={(e) =>
                        atualizarRegistro(
                          reg.id,
                          "baseOperacional",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      className="w-full border border-slate-200 bg-transparent rounded-lg px-2 py-1"
                      value={reg.cursoExame}
                      onChange={(e) =>
                        atualizarRegistro(
                          reg.id,
                          "cursoExame",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      className="w-full border border-slate-200 bg-transparent rounded-lg px-2 py-1 text-xs"
                      value={reg.tipo}
                      onChange={(e) =>
                        atualizarRegistro(
                          reg.id,
                          "tipo",
                          e.target.value as TipoRegistro
                        )
                      }
                    >
                      <option value="Exame">Exame</option>
                      <option value="Curso">Curso</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="date"
                      className="w-full border border-slate-200 bg-transparent rounded-lg px-2 py-1"
                      value={reg.dataAdmissao}
                      onChange={(e) =>
                        atualizarRegistro(
                          reg.id,
                          "dataAdmissao",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="date"
                      className="w-full border border-slate-200 bg-transparent rounded-lg px-2 py-1"
                      value={reg.dataUltimoEvento}
                      onChange={(e) =>
                        atualizarRegistro(
                          reg.id,
                          "dataUltimoEvento",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="date"
                      className="w-full border border-slate-200 bg-transparent rounded-lg px-2 py-1"
                      value={reg.vencimento}
                      onChange={(e) =>
                        atualizarRegistro(
                          reg.id,
                          "vencimento",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <span
                      className={classNames(
                        "inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold",
                        statusChipClasses(status)
                      )}
                    >
                      {status === "Vencido"
                        ? "Vencido"
                        : status === "Vence em 30 dias"
                        ? "Vence em 30 dias ou menos"
                        : "OK"}
                    </span>
                  </td>

                  {extraCols.map((colName) => (
                    <td key={colName} className="px-3 py-1.5">
                      <input
                        className="w-full border border-slate-200 bg-transparent rounded-lg px-2 py-1"
                        value={(reg as any)[colName] || ""}
                        onChange={(e) =>
                          atualizarRegistro(
                            reg.id,
                            colName,
                            e.target.value
                          )
                        }
                      />
                    </td>
                  ))}

                  <td className="px-3 py-1.5 text-right">
                    <button
                      onClick={() => removerLinha(reg.id)}
                      className="text-rose-600 text-xs font-semibold hover:underline"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              );
            })}

            {registrosFiltrados.length === 0 && (
              <tr>
                <td
                  colSpan={12 + extraCols.length}
                  className="px-3 py-6 text-center text-slate-400 text-xs"
                >
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
// =========================
// TELA COLABORADORES
// =========================

type ColaboradoresViewProps = {
  colaboradores: Colaborador[];
  setColaboradores: (rows: Colaborador[]) => void;
  customFilters: CustomFilter[];
};

const ColaboradoresView: React.FC<ColaboradoresViewProps> = ({
  colaboradores,
  setColaboradores,
  customFilters,
}) => {
  const [extraCols, setExtraCols] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const colunasBase: CsvColumn[] = [
    { key: "matricula", label: "Matrícula" },
    { key: "nome", label: "Colaborador" },
    { key: "funcao", label: "Função" },
    { key: "setor", label: "Setor" },
    { key: "baseOperacional", label: "Base Operacional" },
    { key: "dataAdmissao", label: "Data Admissão" },
  ];

  const colunasExtras: CsvColumn[] = extraCols.map((nome) => ({
    key: nome,
    label: nome,
  }));

  const todasColunas = [...colunasBase, ...colunasExtras];

  const atualizarColaborador = (id: number, field: string, value: any) => {
    setColaboradores(
      colaboradores.map((c) =>
        c.id === id ? { ...c, [field]: value } : c
      )
    );
  };

  const adicionarLinha = () => {
    const novo: Colaborador = {
      id: Date.now(),
      matricula: "",
      nome: "",
      funcao: "",
      setor: "",
      baseOperacional: "",
      dataAdmissao: "",
    };
    setColaboradores([...colaboradores, novo]);
  };

  const removerLinha = (id: number) => {
    setColaboradores(colaboradores.filter((c) => c.id !== id));
  };

  const adicionarColuna = () => {
    const nome = window.prompt("Nome da nova coluna personalizada:");
    if (!nome) return;
    if (extraCols.includes(nome)) return;
    setExtraCols([...extraCols, nome]);
  };

  const removerColuna = (nome: string) => {
    setExtraCols(extraCols.filter((c) => c !== nome));
    setColaboradores(
      colaboradores.map((c) => {
        const novo = { ...c };
        delete (novo as any)[nome];
        return novo;
      })
    );
  };

  // IMPORTAÇÃO CSV
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const matrix = parseCsv(text);
      if (!matrix.length) return;

      const [header, ...rows] = matrix;

      const indexToKey: Record<number, string> = {};
      todasColunas.forEach((col) => {
        const idx = header.findIndex(
          (h) => h.trim().toLowerCase() === col.label.toLowerCase()
        );
        if (idx >= 0) indexToKey[idx] = col.key;
      });

      const imported: Colaborador[] = rows
        .filter((r) => r.some((cell) => cell.trim() !== ""))
        .map((cells, idx) => {
          const base: any = {
            id: Date.now() + idx,
          };
          Object.entries(indexToKey).forEach(([idxStr, key]) => {
            const i = Number(idxStr);
            base[key] = cells[i] ?? "";
          });
          return base as Colaborador;
        });

      setColaboradores(imported);
      e.target.value = "";
    };
    reader.readAsText(file, "utf-8");
  };

  const exportarCsv = () => {
    downloadCsvFile("colaboradores.csv", todasColunas, colaboradores);
  };

  const exportarXls = () => {
    downloadXlsFile("colaboradores.xls", todasColunas, colaboradores);
  };

  return (
    <div className="space-y-4">
      {/* Ações */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={adicionarColuna}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            + Nova coluna
          </button>
          <button
            type="button"
            onClick={adicionarLinha}
            className="rounded-full bg-sky-600 text-white px-3 py-1.5 text-[11px] font-semibold shadow hover:bg-sky-700"
          >
            + Nova linha
          </button>
          <button
            type="button"
            onClick={handleImportClick}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            Importar CSV
          </button>
          <button
            type="button"
            onClick={exportarCsv}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            Baixar CSV
          </button>
          <button
            type="button"
            onClick={exportarXls}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            Baixar XLS
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Tabela */}
      <div className="border border-slate-200 rounded-3xl overflow-auto bg-white">
        <table className="w-full text-xs min-w-[900px]">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Matrícula</th>
              <th className="px-3 py-2 text-left font-semibold">Colaborador</th>
              <th className="px-3 py-2 text-left font-semibold">Função</th>
              <th className="px-3 py-2 text-left font-semibold">Setor</th>
              <th className="px-3 py-2 text-left font-semibold">
                Base Operacional
              </th>
              <th className="px-3 py-2 text-left font-semibold">
                Data Admissão
              </th>
              {extraCols.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left font-semibold whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>{col}</span>
                    <button
                      type="button"
                      onClick={() => removerColuna(col)}
                      className="text-rose-500 hover:text-rose-700 text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {colaboradores.map((c) => (
              <tr
                key={c.id}
                className="border-t border-slate-100 hover:bg-slate-50/60"
              >
                <td className="px-3 py-1.5">
                  <input
                    className="w-full bg-transparent border border-slate-200 rounded-lg px-2 py-1"
                    value={c.matricula}
                    onChange={(e) =>
                      atualizarColaborador(c.id, "matricula", e.target.value)
                    }
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    className="w-full bg-transparent border border-slate-200 rounded-lg px-2 py-1"
                    value={c.nome}
                    onChange={(e) =>
                      atualizarColaborador(c.id, "nome", e.target.value)
                    }
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    className="w-full bg-transparent border border-slate-200 rounded-lg px-2 py-1"
                    value={c.funcao}
                    onChange={(e) =>
                      atualizarColaborador(c.id, "funcao", e.target.value)
                    }
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    className="w-full bg-transparent border border-slate-200 rounded-lg px-2 py-1"
                    value={c.setor}
                    onChange={(e) =>
                      atualizarColaborador(c.id, "setor", e.target.value)
                    }
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    className="w-full bg-transparent border border-slate-200 rounded-lg px-2 py-1"
                    value={c.baseOperacional}
                    onChange={(e) =>
                      atualizarColaborador(
                        c.id,
                        "baseOperacional",
                        e.target.value
                      )
                    }
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="date"
                    className="w-full bg-transparent border border-slate-200 rounded-lg px-2 py-1"
                    value={c.dataAdmissao}
                    onChange={(e) =>
                      atualizarColaborador(
                        c.id,
                        "dataAdmissao",
                        e.target.value
                      )
                    }
                  />
                </td>

                {extraCols.map((col) => (
                  <td key={col} className="px-3 py-1.5">
                    <input
                      className="w-full bg-transparent border border-slate-200 rounded-lg px-2 py-1"
                      value={(c as any)[col] || ""}
                      onChange={(e) =>
                        atualizarColaborador(c.id, col, e.target.value)
                      }
                    />
                  </td>
                ))}

                <td className="px-3 py-1.5 text-right">
                  <button
                    onClick={() => removerLinha(c.id)}
                    className="text-rose-600 text-xs font-semibold hover:underline"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}

            {colaboradores.length === 0 && (
              <tr>
                <td
                  colSpan={6 + extraCols.length}
                  className="px-3 py-6 text-center text-slate-400 text-xs"
                >
                  Nenhum colaborador cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// =========================
// TELA EXAMES/CURSOS
// =========================

type ExamesViewProps = {
  exames: ExameCurso[];
  setExames: (rows: ExameCurso[]) => void;
};

const ExamesView: React.FC<ExamesViewProps> = ({ exames, setExames }) => {
  const adicionarLinha = () => {
    const novo: ExameCurso = {
      id: Date.now(),
      tipo: "Exame",
      nome: "",
      validadeDias: 365,
    };
    setExames([...exames, novo]);
  };

  const removerLinha = (id: number) => {
    setExames(exames.filter((e) => e.id !== id));
  };

  const atualizar = (id: number, field: keyof ExameCurso, value: any) => {
    setExames(
      exames.map((e) =>
        e.id === id ? { ...e, [field]: value } : e
      )
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-slate-500 max-w-xl">
          Cadastre aqui os tipos de Exames e Cursos e defina a validade em dias.
          Esses dados são usados automaticamente na aba Registros para calcular
          o vencimento.
        </p>
        <button
          type="button"
          onClick={adicionarLinha}
          className="rounded-full bg-sky-600 text-white px-3 py-1.5 text-[11px] font-semibold shadow hover:bg-sky-700"
        >
          + Novo exame/curso
        </button>
      </div>

      <div className="border border-slate-200 rounded-3xl overflow-auto bg-white">
        <table className="w-full text-xs min-w-[600px]">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Tipo</th>
              <th className="px-3 py-2 text-left font-semibold">
                Curso/Exame
              </th>
              <th className="px-3 py-2 text-left font-semibold">
                Validade (dias)
              </th>
              <th className="px-3 py-2 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {exames.map((e) => (
              <tr
                key={e.id}
                className="border-t border-slate-100 hover:bg-slate-50/60"
              >
                <td className="px-3 py-1.5">
                  <select
                    className="w-full bg-transparent border border-slate-200 rounded-lg px-2 py-1"
                    value={e.tipo}
                    onChange={(ev) =>
                      atualizar(e.id, "tipo", ev.target.value as TipoRegistro)
                    }
                  >
                    <option value="Exame">Exame</option>
                    <option value="Curso">Curso</option>
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  <input
                    className="w-full bg-transparent border border-slate-200 rounded-lg px-2 py-1"
                    value={e.nome}
                    onChange={(ev) =>
                      atualizar(e.id, "nome", ev.target.value)
                    }
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="number"
                    min={0}
                    className="w-full bg-transparent border border-slate-200 rounded-lg px-2 py-1"
                    value={e.validadeDias}
                    onChange={(ev) =>
                      atualizar(
                        e.id,
                        "validadeDias",
                        Number(ev.target.value || 0)
                      )
                    }
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button
                    onClick={() => removerLinha(e.id)}
                    className="text-rose-600 text-xs font-semibold hover:underline"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}

            {exames.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-6 text-center text-slate-400 text-xs"
                >
                  Nenhum exame/curso cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// =========================
// TELA CAMPOS & FILTROS
// =========================

type CamposFiltrosViewProps = {
  customFilters: CustomFilter[];
  setCustomFilters: (rows: CustomFilter[]) => void;
};

const CamposFiltrosView: React.FC<CamposFiltrosViewProps> = ({
  customFilters,
  setCustomFilters,
}) => {
  const adicionarCampo = () => {
    const nome = window.prompt("Nome do campo personalizado (sem espaços especiais):");
    if (!nome) return;

    const novo: CustomFilter = {
      id: String(Date.now()),
      nome,
      origem: "registros",
      usarNoDashboard: false,
      usarNosRegistros: true,
    };

    setCustomFilters([...customFilters, novo]);
  };

  const atualizarCampo = (id: string, patch: Partial<CustomFilter>) => {
    setCustomFilters(
      customFilters.map((c) =>
        c.id === id ? { ...c, ...patch } : c
      )
    );
  };

  const removerCampo = (id: string) => {
    if (!window.confirm("Remover este campo personalizado?")) return;
    setCustomFilters(customFilters.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start gap-4">
        <p className="text-xs text-slate-500 max-w-xl">
          Crie campos personalizados para enriquecer seus registros e habilite
          quais deles poderão ser usados como filtros no Dashboard e na tela de
          Registros.
        </p>
        <button
          type="button"
          onClick={adicionarCampo}
          className="rounded-full bg-sky-600 text-white px-3 py-1.5 text-[11px] font-semibold shadow hover:bg-sky-700"
        >
          + Novo campo
        </button>
      </div>

      <div className="border border-slate-200 rounded-3xl overflow-auto bg-white">
        <table className="w-full text-xs min-w-[600px]">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">
                Nome do campo (chave)
              </th>
              <th className="px-3 py-2 text-left font-semibold">
                Usar no Dashboard
              </th>
              <th className="px-3 py-2 text-left font-semibold">
                Usar nos Registros
              </th>
              <th className="px-3 py-2 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {customFilters.map((cf) => (
              <tr
                key={cf.id}
                className="border-t border-slate-100 hover:bg-slate-50/60"
              >
                <td className="px-3 py-1.5">
                  <input
                    className="w-full bg-transparent border border-slate-200 rounded-lg px-2 py-1"
                    value={cf.nome}
                    onChange={(e) =>
                      atualizarCampo(cf.id, { nome: e.target.value })
                    }
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={cf.usarNoDashboard}
                    onChange={(e) =>
                      atualizarCampo(cf.id, {
                        usarNoDashboard: e.target.checked,
                      })
                    }
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={cf.usarNosRegistros}
                    onChange={(e) =>
                      atualizarCampo(cf.id, {
                        usarNosRegistros: e.target.checked,
                      })
                    }
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button
                    onClick={() => removerCampo(cf.id)}
                    className="text-rose-600 text-xs font-semibold hover:underline"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}

            {customFilters.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-6 text-center text-slate-400 text-xs"
                >
                  Nenhum campo personalizado criado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// =========================
// APP PRINCIPAL
// =========================

const App: React.FC = () => {
  // 👤 sessão / empresa / loading inicial
  const [session, setSession] = useState<Session | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [loadingInitialData, setLoadingInitialData] = useState<boolean>(false);

  // 📊 estados principais
  const [currentTab, setCurrentTab] = useState<TabKey>("dashboard");
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [exames, setExames] = useState<ExameCurso[]>([]);
  const [customFilters, setCustomFilters] = useState<CustomFilter[]>([]);
  const [filtrosDashboard, setFiltrosDashboard] = useState<{
    setor: string;
    funcao: string;
    tipo: string;
    custom: Record<string, string>;
  }>({
    setor: "",
    funcao: "",
    tipo: "",
    custom: {},
  });

  // =====================
  // Auth listener
  // =====================

  useEffect(() => {
    // sessão atual
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    // mudanças de sessão
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // =====================
  // Carregar dados do Supabase
  // =====================

  useEffect(() => {
    const loadAllData = async () => {
      if (!session) return;

      setLoadingInitialData(true);

      try {
        // 1) pegar empresa_id do usuário logado
        const { data: usuario, error: userError } = await supabase
          .from("usuarios")
          .select("empresa_id")
          .eq("auth_user_id", session.user.id)
          .single();

        if (userError || !usuario) {
          console.error("Erro ao buscar usuario/empresa:", userError);
          setLoadingInitialData(false);
          return;
        }

        const empId = usuario.empresa_id as string;
        setEmpresaId(empId);

        // 2) colaboradores
        const { data: colabs, error: colabError } = await supabase
          .from("colaboradores")
          .select("*")
          .eq("empresa_id", empId)
          .order("nome", { ascending: true });

        if (colabError) {
          console.error("Erro ao carregar colaboradores:", colabError);
        } else if (colabs) {
          setColaboradores(colabs.map(mapColaboradorFromDb));
        }

        // 3) exames/cursos
        const { data: exams, error: examError } = await supabase
          .from("exames_cursos")
          .select("*")
          .eq("empresa_id", empId)
          .order("nome", { ascending: true });

        if (examError) {
          console.error("Erro ao carregar exames/cursos:", examError);
        } else if (exams) {
          setExames(exams.map(mapExameFromDb));
        }

        // 4) registros
        const { data: regs, error: regsError } = await supabase
          .from("registros")
          .select("*")
          .eq("empresa_id", empId);

        if (regsError) {
          console.error("Erro ao carregar registros:", regsError);
        } else if (regs) {
          setRegistros(regs.map(mapRegistroFromDb));
        }

        // 5) custom_filters
        const { data: filters, error: filtError } = await supabase
          .from("custom_filters")
          .select("*")
          .eq("empresa_id", empId);

        if (filtError) {
          console.error("Erro ao carregar custom_filters:", filtError);
        } else if (filters) {
          setCustomFilters(filters.map(mapCustomFilterFromDb));
        }
      } catch (err) {
        console.error("Erro inesperado ao carregar dados:", err);
      } finally {
        setLoadingInitialData(false);
      }
    };

    loadAllData();
  }, [session]);

  // =====================
  // UI de alto nível
  // =====================

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setEmpresaId(null);
  };

  if (!session) {
    return <AuthScreen onAuth={setSession} />;
  }

  if (loadingInitialData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="bg-white px-6 py-4 rounded-2xl shadow text-sm text-slate-600 border border-slate-200">
          Carregando dados do Supabase...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Cabeçalho */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-sky-900 flex items-center justify-center shadow-md overflow-hidden">
              <img
                src="/plenum-logo.png"
                alt="Plenum"
                className="w-8 h-8 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <div>
              <div className="text-sm font-extrabold text-slate-900">
                Plenum
              </div>
              <div className="text-[11px] text-slate-500">
                Seu Sistema de Gestão de Vencimentos
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] text-slate-500">
                Usuário autenticado
              </div>
              <div className="text-xs font-semibold text-slate-800 truncate max-w-[200px]">
                {session.user.email}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="max-w-6xl mx-auto px-4 py-4">
        {/* Abas */}
        <div className="flex gap-2 mb-4">
          {(
            [
              ["dashboard", "Dashboard"],
              ["registros", "Registros"],
              ["colaboradores", "Colaboradores"],
              ["exames", "Exames/Cursos"],
              ["campos", "Campos & Filtros"],
            ] as [TabKey, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setCurrentTab(key)}
              className={classNames(
                "px-3 py-1.5 rounded-full text-xs font-semibold border",
                currentTab === key
                  ? "bg-sky-600 text-white border-sky-600 shadow"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Conteúdo da aba */}
        <div className="bg-slate-50/60 border border-slate-200 rounded-3xl p-4 shadow-sm">
          {currentTab === "dashboard" && (
            <DashboardView
              registros={registros}
              colaboradores={colaboradores}
              filtrosDashboard={filtrosDashboard}
              onChangeFiltros={setFiltrosDashboard}
              customFilters={customFilters}
            />
          )}

          {currentTab === "registros" && (
            <RegistrosView
              registros={registros}
              setRegistros={setRegistros}
              colaboradores={colaboradores}
              customFilters={customFilters}
              exames={exames}
            />
          )}

          {currentTab === "colaboradores" && (
            <ColaboradoresView
              colaboradores={colaboradores}
              setColaboradores={setColaboradores}
              customFilters={customFilters}
            />
          )}

          {currentTab === "exames" && (
            <ExamesView exames={exames} setExames={setExames} />
          )}

          {currentTab === "campos" && (
            <CamposFiltrosView
              customFilters={customFilters}
              setCustomFilters={setCustomFilters}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
