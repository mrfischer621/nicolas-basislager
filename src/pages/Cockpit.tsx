import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useCustomers } from "../hooks/queries";
import { useFinanceEntries } from "../hooks/useFinance";
import { useAnalytics } from "../hooks/useAnalytics";
import { useInvoiceSummary } from "../hooks/useInvoices";
import { useTimeSummary } from "../hooks/useTimeEntries";
import {
  useDeals,
  useLeadStatuses,
  usePipelineStages,
} from "../hooks/usePipeline";
import {
  useCompanySettings,
  useRevenueTargets,
} from "../hooks/useCompanySettings";
import { useBankBalances, useDeadlines } from "../hooks/useCockpitData";
import {
  CockpitCard,
  Figure,
  ProgressBar,
} from "../components/cockpit/CockpitCard";
import { BankBalanceForm } from "../components/settings/BankBalancesSettings";
import { PaidDatesDialog } from "../components/invoices/PaidDatesDialog";
import { Drawer } from "../components/list";
import { SegmentedControl } from "../components/ui";
import FinancialChart from "../components/FinancialChart";
import {
  filterRange,
  presetRange,
  summarize,
  zurichDay,
  type DayRange,
} from "../utils/financeAggregation";
import { formatChfDisplay } from "../utils/money";
import { formatDate, formatPercent } from "../utils/format";
import { buildTodos, type Todo } from "../utils/cockpitTodos";
import { invoiceState, summarizeInvoices } from "../utils/invoiceViews";
import { isUnbilled, totals } from "../utils/timeEntries";
import { opportunityCompany, weightedPipeline } from "../utils/pipeline";
import {
  concentration,
  fixedCosts,
  freeCash,
  incomeYearOverYear,
  liquidityForecast,
  recurringSeries,
  targetProgress,
  vatThreshold,
  type Level,
} from "../utils/cockpit";

const TODO_DOT: Record<Todo["tone"], string> = {
  negative: "bg-negative-solid",
  warning: "bg-warning-solid",
  attention: "bg-attention-solid",
  info: "bg-info-solid",
};
const LEVEL_WORD: Record<Level, string> = {
  ok: "",
  warning: "text-warning",
  negative: "text-negative",
};

/**
 * Cockpit: "Was muss ich heute tun?" und "Wie laeuft das Geschaeft?".
 * Alle Werte nur fuer das gewaehlte Unternehmen.
 */
export default function Cockpit() {
  const { selectedCompany } = useCompany();
  const today = zurichDay(new Date());
  const year = today.slice(0, 4);
  const finance = useFinanceEntries();
  const invoicesQ = useInvoiceSummary();
  const time = useTimeSummary();
  const { data: deals = [] } = useDeals();
  const { data: stages = [] } = usePipelineStages();
  const { data: leadStatuses = [] } = useLeadStatuses();
  const { data: settings } = useCompanySettings();
  const { data: targets = [] } = useRevenueTargets();
  const { data: balances = [] } = useBankBalances();
  const { data: deadlines = [] } = useDeadlines();
  const { data: customers = [] } = useCustomers();
  const [chartRange, setChartRange] = useState<"12m" | "90d">("12m");
  const [paidDatesOpen, setPaidDatesOpen] = useState(false);
  const [balanceOpen, setBalanceOpen] = useState(false);

  // 12 Monate: ab dem Ersten des Monats vor elf Monaten, monatlich; 90 Tage: woechentlich
  const [ty, tm] = today.split("-").map(Number);
  const twelveFrom = new Date(Date.UTC(ty, tm - 12, 1))
    .toISOString()
    .slice(0, 10);
  const range: DayRange =
    chartRange === "12m"
      ? { from: twelveFrom, to: today }
      : presetRange("last_90_days", today);
  const analytics = useAnalytics(
    range,
    chartRange === "12m" ? "month" : "week",
  );

  const entries = useMemo(() => finance.data?.entries ?? [], [finance.data]);
  const invoices = useMemo(() => invoicesQ.data ?? [], [invoicesQ.data]);
  const names = useMemo(
    () => new Map(customers.map((c) => [c.id, c.name])),
    [customers],
  );
  const summary = useMemo(
    () => summarizeInvoices(invoices, today),
    [invoices, today],
  );
  const series = useMemo(
    () => recurringSeries(entries, today),
    [entries, today],
  );
  const balance = balances[0]
    ? { date: balances[0].date, amount: balances[0].amount }
    : null;

  if (!selectedCompany) return null;
  const loading = finance.isLoading || invoicesQ.isLoading;

  // Kennzahlen
  const ytd = summarize(
    filterRange(entries, { from: `${year}-01-01`, to: today }),
  );
  const yoy = incomeYearOverYear(entries, today);
  const monthExpense = summarize(
    filterRange(entries, { from: `${today.slice(0, 7)}-01`, to: today }),
  ).expense;
  const unbilled = totals(time.rows.filter(isUnbilled));
  const open = summary.sums.versendet + summary.sums.ueberfaellig;

  // Erste Prioritaet
  const cash = freeCash(
    ytd.profit,
    settings?.ahv_rate ?? 10,
    settings?.tax_rate ?? null,
  );
  const liquidity = liquidityForecast(
    balance,
    invoices.map((i) => ({
      total: Number(i.total),
      due_date: i.due_date,
      status: i.status,
    })),
    series,
    today,
    settings?.min_reserve ?? null,
  );
  const conc = concentration(
    entries,
    names,
    today,
    settings?.concentration_warn ?? 50,
    settings?.concentration_alert ?? 70,
  );
  const target =
    targets.find((t) => String(t.year) === year)?.revenue_target ?? null;
  const progress = target ? targetProgress(target, ytd.income, today) : null;
  const pipeline3m = weightedPipeline(stages, deals, today, 90);
  const vat = vatThreshold(
    invoices.map((i) => ({
      total: Number(i.total),
      issue_date: i.issue_date,
      status: i.status,
    })),
    entries,
    settings?.vat_threshold ?? 100000,
    today,
  );

  const todos = buildTodos({
    today,
    invoices,
    deals,
    newLeads: leadStatuses.filter((l) => (l.lead_status ?? "neu") === "neu")
      .length,
    time: time.rows,
    entries,
    deadlines,
    lastBalanceDate: balances[0]?.date ?? null,
  });

  const nextDue = invoices
    .filter((i) => {
      const s = invoiceState(i, today);
      return s === "versendet" || s === "ueberfaellig";
    })
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
    .slice(0, 5);
  const nextActions = deals
    .filter((d) => !d.is_lost && d.next_action_date)
    .sort((a, b) => a.next_action_date!.localeCompare(b.next_action_date!))
    .slice(0, 5);

  const lagesatz = loading
    ? " "
    : `${todos.length ? `${todos.length} ${todos.length === 1 ? "Punkt" : "Punkte"} zu erledigen` : "Nichts dringend"}, ${formatChfDisplay(open, { decimals: 0 })} offen.`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">
          <span className="bw-marker">Cockpit</span>
        </h1>
        <p className="mt-2 text-sm text-fg-muted">{lagesatz}</p>
      </header>

      {/* 1. Zu erledigen */}
      {todos.length > 0 && (
        <section className="card p-2" aria-label="Zu erledigen">
          <h2 className="caps-sm px-3 pb-1 pt-2">Zu erledigen</h2>
          <ul className="divide-y divide-line">
            {todos.map((t) => {
              const body = (
                <>
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 shrink-0 rounded-full ${TODO_DOT[t.tone]}`}
                  />
                  <span className="flex-1 text-sm text-fg">{t.text}</span>
                  <ChevronRight
                    size={16}
                    className="text-fg-muted"
                    aria-hidden="true"
                  />
                </>
              );
              const cls =
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-canvas";
              return (
                <li key={t.key}>
                  {t.to ? (
                    <Link to={t.to} className={cls}>
                      {body}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={cls}
                      onClick={() =>
                        t.action === "zahlungsdaten"
                          ? setPaidDatesOpen(true)
                          : setBalanceOpen(true)
                      }
                    >
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 2. Steuerung */}
      <div className="grid gap-4 lg:grid-cols-2">
        <CockpitCard
          title={`Frei verfügbar ${year}`}
          info="Gewinn dieses Jahr (Einnahmen minus Ausgaben, Zahlungsprinzip) abzüglich geschätzter Rückstellungen. Sätze unter Einstellungen › Ziele und Schätzungen."
          footer="Schätzung, ersetzt keine Steuerberatung."
        >
          <p className="font-display text-3xl font-black tabular-nums text-fg">
            {formatChfDisplay(cash.free, { decimals: 0 })}
          </p>
          <p className="mb-3 text-xs text-fg-muted">
            von {formatChfDisplay(cash.profit, { decimals: 0 })} Gewinn
          </p>
          {cash.profit > 0 && (
            <>
              <div
                className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
                aria-hidden="true"
              >
                <span
                  className="bg-fg-muted"
                  style={{ width: `${(cash.ahv / cash.profit) * 100}%` }}
                />
                <span
                  className="bg-line-strong"
                  style={{ width: `${(cash.tax / cash.profit) * 100}%` }}
                />
                <span
                  className="bg-cta"
                  style={{
                    width: `${(Math.max(0, cash.free) / cash.profit) * 100}%`,
                  }}
                />
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="flex items-center gap-1.5 text-fg-muted">
                    <span className="h-2 w-2 rounded-sm bg-fg-muted" />
                    AHV/IV/EO {settings?.ahv_rate ?? 10} %
                  </dt>
                  <dd className="font-semibold tabular-nums text-fg">
                    {formatChfDisplay(cash.ahv, { decimals: 0 })}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-fg-muted">
                    <span className="h-2 w-2 rounded-sm bg-line-strong" />
                    Steuern{" "}
                    {settings?.tax_rate != null ? `${settings.tax_rate} %` : ""}
                  </dt>
                  <dd className="font-semibold tabular-nums text-fg">
                    {cash.taxMissing ? (
                      <Link className="underline" to="/einstellungen/ziele">
                        Satz festlegen
                      </Link>
                    ) : (
                      formatChfDisplay(cash.tax, { decimals: 0 })
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-fg-muted">
                    <span className="h-2 w-2 rounded-sm bg-cta" />
                    Frei
                  </dt>
                  <dd className="font-semibold tabular-nums text-fg">
                    {formatChfDisplay(cash.free, { decimals: 0 })}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </CockpitCard>

        <CockpitCard
          title="Liquidität"
          info="Letzter Kontostand plus offene Rechnungen nach Fälligkeit minus wiederkehrende Ausgaben. Überfällige Rechnungen zählen nicht als Eingang."
          action={
            balance && (
              <button
                type="button"
                className="text-xs text-fg-muted underline hover:text-fg"
                onClick={() => setBalanceOpen(true)}
              >
                Kontostand erfassen
              </button>
            )
          }
          footer={
            balance
              ? `Stand ${formatChfDisplay(balance.amount, { decimals: 0 })} am ${formatDate(balance.date)}${liquidity.overdue ? `; ${formatChfDisplay(liquidity.overdue, { decimals: 0 })} überfällig, nicht eingerechnet` : ""}`
              : undefined
          }
        >
          {balance ? (
            <div className="grid grid-cols-3 gap-3">
              {liquidity.points.map((p) => (
                <Figure
                  key={p.days}
                  value={formatChfDisplay(p.value, { decimals: 0 })}
                  label={`in ${p.days} Tagen${p.level === "warning" ? ", unter Reserve" : p.level === "negative" ? ", unter null" : ""}`}
                  tone={p.level}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-fg-muted">
                Ohne Kontostand gibt es keine Vorschau.
              </p>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setBalanceOpen(true)}
              >
                Kontostand erfassen
              </button>
            </div>
          )}
        </CockpitCard>

        <CockpitCard
          title="Abhängigkeit (12 Monate)"
          info="Hohe Abhängigkeit ist ein Geschäftsrisiko und kann bei der Beurteilung der Selbständigkeit durch die Ausgleichskasse eine Rolle spielen."
        >
          {conc.top.length === 0 ? (
            <p className="text-sm text-fg-muted">
              Noch keine Einnahmen in den letzten 12 Monaten.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {conc.top.map((c, i) => {
                const level: Level = i === 0 ? conc.level : "ok";
                return (
                  <li key={c.customerId ?? `ohne-${i}`}>
                    <div className="mb-1 flex justify-between gap-2 text-sm">
                      <span className="truncate text-fg">{c.name}</span>
                      <span
                        className={`tabular-nums font-semibold ${LEVEL_WORD[level] || "text-fg"}`}
                      >
                        {formatPercent(c.share)}
                      </span>
                    </div>
                    <ProgressBar
                      percent={c.share}
                      level={level}
                      label={`Anteil ${c.name}`}
                    />
                  </li>
                );
              })}
              {conc.level !== "ok" && (
                <li
                  className={`flex items-center gap-1.5 text-xs ${LEVEL_WORD[conc.level]}`}
                >
                  <AlertTriangle size={14} aria-hidden="true" />
                  {conc.level === "negative"
                    ? "Sehr hohe Abhängigkeit von einer Firma."
                    : "Hohe Abhängigkeit von einer Firma."}
                </li>
              )}
            </ul>
          )}
        </CockpitCard>

        <CockpitCard
          title={`Ziel ${year}`}
          info="Jahresziel aus den Einstellungen. Die blaue Marke zeigt, wo du zeitanteilig stehen müsstest. Gewichtete Pipeline: Betrag mal Wahrscheinlichkeit der Phase, nächste Aktion innert drei Monaten."
        >
          {progress ? (
            <>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="font-display text-2xl font-black tabular-nums text-fg">
                  {formatChfDisplay(progress.actual, { decimals: 0 })}
                </p>
                <p className="text-sm text-fg-muted">
                  von {formatChfDisplay(progress.target, { decimals: 0 })} ·{" "}
                  {formatPercent(progress.percent)}
                </p>
              </div>
              <ProgressBar
                percent={progress.percent}
                marker={progress.expectedPercent}
                label="Ziel erreicht"
                fillClass="bg-fg"
              />
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-fg-muted">Nötig pro Monat</dt>
                  <dd className="font-semibold tabular-nums">
                    {progress.gap > 0
                      ? formatChfDisplay(progress.neededPerMonth, {
                          decimals: 0,
                        })
                      : "Ziel erreicht"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-muted">
                    Pipeline gewichtet (3 Mte.)
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {formatChfDisplay(pipeline3m.weighted, { decimals: 0 })}
                    {progress.gap > 0 && (
                      <span className="ml-1 text-xs font-normal text-fg-muted">
                        ={" "}
                        {formatPercent(
                          (pipeline3m.weighted / progress.gap) * 100,
                        )}{" "}
                        der Lücke
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-fg-muted">
                Noch kein Umsatzziel für {year}.
              </p>
              <Link to="/einstellungen/ziele" className="btn-secondary">
                Jahresziel festlegen
              </Link>
            </div>
          )}
        </CockpitCard>

        {!selectedCompany.vat_registered && (
          <CockpitCard
            title="MWST-Schwelle"
            info="Vereinbarter Umsatz der letzten 12 Monate (Rechnungen nach Rechnungsdatum ohne Entwürfe, dazu Einnahmen ohne Rechnung) gegen die Umsatzgrenze. Nur dieses Unternehmen."
          >
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <p
                className={`font-display text-2xl font-black tabular-nums ${LEVEL_WORD[vat.level] || "text-fg"}`}
              >
                {formatChfDisplay(vat.revenue, { decimals: 0 })}
              </p>
              <p className="text-sm text-fg-muted">
                von {formatChfDisplay(vat.threshold, { decimals: 0 })} ·{" "}
                {formatPercent(vat.percent)}
              </p>
            </div>
            <ProgressBar
              percent={vat.percent}
              level={vat.level}
              label="Anteil an der MWST-Grenze"
            />
            {vat.level === "negative" && (
              <p className="mt-2 text-sm font-semibold text-negative">
                MWST-Pflicht prüfen, Anmeldung bei der ESTV nötig.
              </p>
            )}
            {vat.level === "warning" && (
              <p className="mt-2 text-sm text-warning">
                Über 80 % der Grenze. Behalte die nächsten Monate im Auge.
              </p>
            )}
          </CockpitCard>
        )}
      </div>

      {/* 3. Kennzahlen und Verlauf */}
      <section
        aria-label="Kennzahlen"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Link to="/berichte" className="card p-4 hover:shadow-md">
          <p className="caps-sm">Einnahmen {year}</p>
          <p className="font-display text-xl font-black tabular-nums">
            {formatChfDisplay(yoy.current, { decimals: 0 })}
          </p>
          <p className="text-xs text-fg-muted">
            {yoy.change === null
              ? "kein Vorjahreswert"
              : `${yoy.change >= 0 ? "+" : ""}${Math.round(yoy.change)} % zum Vorjahr (${formatChfDisplay(yoy.previous, { decimals: 0 })})`}
          </p>
        </Link>
        <Link
          to="/rechnungen?ansicht=versendet"
          className="card p-4 hover:shadow-md"
        >
          <p className="caps-sm">Offene Debitoren</p>
          <p className="font-display text-xl font-black tabular-nums">
            {formatChfDisplay(open, { decimals: 0 })}
          </p>
          <p
            className={`text-xs ${summary.sums.ueberfaellig ? "text-negative" : "text-fg-muted"}`}
          >
            {summary.sums.ueberfaellig
              ? `davon ${formatChfDisplay(summary.sums.ueberfaellig, { decimals: 0 })} überfällig`
              : "nichts überfällig"}
          </p>
        </Link>
        <Link
          to="/zeiterfassung?ansicht=offen"
          className="card p-4 hover:shadow-md"
        >
          <p className="caps-sm">Nicht verrechnet</p>
          <p className="font-display text-xl font-black tabular-nums">
            {formatChfDisplay(unbilled.amount, { decimals: 0 })}
          </p>
          <p className="text-xs text-fg-muted">
            {unbilled.billableHours.toFixed(2)} h
          </p>
        </Link>
        <Link
          to="/buchungen?ansicht=ausgaben"
          className="card p-4 hover:shadow-md"
        >
          <p className="caps-sm">Ausgaben diesen Monat</p>
          <p className="font-display text-xl font-black tabular-nums">
            {formatChfDisplay(monthExpense, { decimals: 0 })}
          </p>
          <p className="text-xs text-fg-muted">
            Fixkosten{" "}
            {formatChfDisplay(fixedCosts(series).monthly, { decimals: 0 })}/Mt.
          </p>
        </Link>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <CockpitCard
            title="Einnahmen und Ausgaben"
            action={
              <SegmentedControl
                label="Zeitraum"
                size="sm"
                value={chartRange}
                onChange={setChartRange}
                options={[
                  { value: "12m", label: "12 Monate" },
                  { value: "90d", label: "90 Tage" },
                ]}
              />
            }
          >
            <FinancialChart
              data={analytics.timeline.map((p) => ({
                period: p.date,
                revenue: p.income,
                expenses: p.expense,
              }))}
              height={260}
            />
          </CockpitCard>
        </div>

        <div className="space-y-4">
          <CockpitCard title="Nächste Fälligkeiten">
            {nextDue.length === 0 ? (
              <p className="text-sm text-fg-muted">Keine offenen Rechnungen.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {nextDue.map((i) => {
                  const overdue = invoiceState(i, today) === "ueberfaellig";
                  return (
                    <li key={i.id}>
                      <Link
                        to={`/rechnungen/${i.id}`}
                        className="flex items-center justify-between gap-3 py-2 hover:underline"
                      >
                        <span className="min-w-0 truncate">
                          {i.invoice_number} · {names.get(i.customer_id) ?? ""}
                        </span>
                        <span
                          className={`shrink-0 tabular-nums ${overdue ? "text-negative" : "text-fg-muted"}`}
                        >
                          {formatDate(i.due_date).slice(0, 6)} ·{" "}
                          {formatChfDisplay(Number(i.total), { decimals: 0 })}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CockpitCard>
          <CockpitCard title="Nächste Aktionen">
            {nextActions.length === 0 ? (
              <p className="text-sm text-fg-muted">
                Keine geplanten Aktionen in der Pipeline.
              </p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {nextActions.map((d) => (
                  <li key={d.id}>
                    <Link
                      to="/pipeline"
                      className="flex items-center justify-between gap-3 py-2 hover:underline"
                    >
                      <span className="min-w-0 truncate">
                        {opportunityCompany(d)}
                      </span>
                      <span
                        className={`shrink-0 tabular-nums ${d.next_action_date! < today ? "text-attention" : "text-fg-muted"}`}
                      >
                        {formatDate(d.next_action_date).slice(0, 6)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CockpitCard>
        </div>
      </div>

      <PaidDatesDialog
        open={paidDatesOpen}
        onClose={() => setPaidDatesOpen(false)}
        invoices={summary.missingPaidDate}
        customers={customers}
      />
      <Drawer
        open={balanceOpen}
        onClose={() => setBalanceOpen(false)}
        title="Kontostand erfassen"
      >
        <BankBalanceForm compact onSaved={() => setBalanceOpen(false)} />
      </Drawer>
    </div>
  );
}
