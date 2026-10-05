import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import Svg, { Defs, G, Line, LinearGradient as SvgGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import { LoadingSpinner } from "../../components/ui";
import { radius, shadow } from "../../styles/theme";
import { useThemeStore } from "../../store/useThemeStore";
import {
  classAdminService,
  establishmentService,
  matiereService,
  professorService,
  userService,
} from "../../services/api";
import { ClassEntity, Etablissement, Matiere, Professor } from "../../types";
import { useAuthStore } from "../../store/useAuthStore";
import { classService } from "../../services/classService";
import type { QuickAction } from "./QuickActionsSheet";

/**
 * Mobile port of web's DashboardContent
 * (scholchat_front/src/pages/Dashbaord/principale/DashboardContent.jsx):
 * same header, KPI cards, secondary KPIs, charts and recent activity, in the
 * same order, with web's slate palette. Charts are drawn with react-native-svg
 * since recharts is web-only.
 */

// LinearGradient via expo-linear-gradient (safe fallback to View if unavailable)
let LinearGradient: any;
try {
  LinearGradient = require("expo-linear-gradient").LinearGradient;
} catch {
  LinearGradient = ({ children, style, colors: c }: any) => (
    <View style={[style, { backgroundColor: c?.[0] }]}>{children}</View>
  );
}

// ─── Colour palette for charts (same as web) ─────────────────────────────────
const CHART_COLORS = [
  "#3B82F6",
  "#6366F1",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#06B6D4",
];

// Web's Tailwind slate scale, light vs dark
const palette = (isDark: boolean) => ({
  isDark,
  page: isDark ? "#0F172A" : "#F8FAFC", // slate-900 / slate-50
  card: isDark ? "#1E293B" : "#FFFFFF", // slate-800 / white
  border: isDark ? "#334155" : "#F1F5F9", // slate-700 / slate-100
  title: isDark ? "#FFFFFF" : "#0F172A", // white / slate-900
  heading: isDark ? "#FFFFFF" : "#1E293B", // white / slate-800
  muted: isDark ? "#94A3B8" : "#64748B", // slate-400 / slate-500
  faint: isDark ? "#64748B" : "#94A3B8", // slate-500 / slate-400
  legend: isDark ? "#94A3B8" : "#475569", // slate-400 / slate-600
  grid: isDark ? "#334155" : "#F1F5F9",
  axis: isDark ? "#94A3B8" : "#64748B",
});
type Palette = ReturnType<typeof palette>;

interface DashboardContentBodyProps {
  accentColor?: string;
  quickActions?: QuickAction[];
  onQuickAction?: (item: QuickAction) => void;
  onNavigate?: (tab: string) => void;
}

// ─── Chart helpers ───────────────────────────────────────────────────────────
const polar = (cx: number, cy: number, r: number, a: number) => ({
  x: cx + r * Math.cos(a),
  y: cy + r * Math.sin(a),
});

const arcPath = (cx: number, cy: number, rOut: number, rIn: number, start: number, end: number) => {
  const sweep = Math.min(end - start, Math.PI * 2 - 0.0001);
  const e = start + sweep;
  const large = sweep > Math.PI ? 1 : 0;
  const o1 = polar(cx, cy, rOut, start);
  const o2 = polar(cx, cy, rOut, e);
  const i1 = polar(cx, cy, rIn, e);
  const i2 = polar(cx, cy, rIn, start);
  return `M${o1.x},${o1.y} A${rOut},${rOut} 0 ${large} 1 ${o2.x},${o2.y} L${i1.x},${i1.y} A${rIn},${rIn} 0 ${large} 0 ${i2.x},${i2.y} Z`;
};

/** Catmull-Rom → cubic Bézier, close to recharts' "monotone" curve for this data. */
const smoothPath = (pts: { x: number; y: number }[]) => {
  if (pts.length === 0) return "";
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
};

/** Four evenly spaced ticks from 0 up to a round number ≥ max. */
const niceTicks = (max: number) => {
  const raw = Math.max(max, 1) / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = Math.ceil(raw / mag) * mag;
  return [0, step, step * 2, step * 3, step * 4];
};

type Slice = { name: string; value: number; color: string };

const DonutChart = ({ data, size, inner, outer, padAngle }: { data: Slice[]; size: number; inner: number; outer: number; padAngle: number }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const rOut = (size / 2) * outer;
  const rIn = (size / 2) * inner;
  const pad = data.filter((d) => d.value > 0).length > 1 ? (padAngle * Math.PI) / 180 : 0;
  let angle = -Math.PI / 2;
  return (
    <Svg width={size} height={size}>
      {total > 0 &&
        data.map((d, i) => {
          if (d.value <= 0) return null;
          const sweep = (d.value / total) * Math.PI * 2;
          const start = angle + pad / 2;
          const end = angle + sweep - pad / 2;
          angle += sweep;
          return <Path key={i} d={arcPath(cx, cy, rOut, rIn, start, Math.max(end, start + 0.001))} fill={d.color} />;
        })}
    </Svg>
  );
};

const BarChartSvg = ({ data, width, height, p }: { data: { name: string; progression: number }[]; width: number; height: number; p: Palette }) => {
  const left = 32;
  const bottom = 22;
  const top = 8;
  const plotW = width - left;
  const plotH = height - bottom - top;
  const ticks = [0, 25, 50, 75, 100];
  const slot = plotW / data.length;
  const barW = Math.min(20, slot * 0.6);
  const r = Math.min(6, barW / 2);
  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#6366f1" />
          <Stop offset="100%" stopColor="#3b82f6" />
        </SvgGradient>
      </Defs>
      {ticks.map((t) => {
        const y = top + plotH - (t / 100) * plotH;
        return (
          <G key={t}>
            <Line x1={left} x2={width} y1={y} y2={y} stroke={p.grid} strokeDasharray="3 3" />
            <SvgText x={left - 6} y={y + 4} fontSize={10} fill={p.axis} textAnchor="end">{t}</SvgText>
          </G>
        );
      })}
      {data.map((d, i) => {
        const h = (d.progression / 100) * plotH;
        const x = left + slot * i + (slot - barW) / 2;
        const y = top + plotH - h;
        // Rounded top corners only, like recharts' radius={[6, 6, 0, 0]}
        const path = `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + barW - r},${y} Q${x + barW},${y} ${x + barW},${y + r} L${x + barW},${y + h} Z`;
        return (
          <G key={i}>
            <Path d={path} fill="url(#barGrad)" />
            <SvgText x={left + slot * i + slot / 2} y={height - 6} fontSize={9} fill={p.axis} textAnchor="middle">
              {d.name}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
};

type AreaPoint = { mois: string; cours: number; exercices: number };

const AreaChartSvg = ({ data, width, height, p }: { data: AreaPoint[]; width: number; height: number; p: Palette }) => {
  const left = 28;
  const bottom = 22;
  const top = 8;
  const plotW = width - left - 8;
  const plotH = height - bottom - top;
  const ticks = niceTicks(Math.max(...data.map((d) => Math.max(d.cours, d.exercices))));
  const yMax = ticks[ticks.length - 1];
  const xAt = (i: number) => left + (data.length === 1 ? plotW / 2 : (plotW * i) / (data.length - 1));
  const yAt = (v: number) => top + plotH - (v / yMax) * plotH;
  const series = [
    { key: "exercices" as const, color: "#10b981", grad: "gradExo" },
    { key: "cours" as const, color: "#3b82f6", grad: "gradCours" },
  ];
  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGradient id="gradCours" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
          <Stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
        </SvgGradient>
        <SvgGradient id="gradExo" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
          <Stop offset="95%" stopColor="#10b981" stopOpacity={0} />
        </SvgGradient>
      </Defs>
      {ticks.map((t) => (
        <G key={t}>
          <Line x1={left} x2={width} y1={yAt(t)} y2={yAt(t)} stroke={p.grid} strokeDasharray="3 3" />
          <SvgText x={left - 6} y={yAt(t) + 4} fontSize={10} fill={p.axis} textAnchor="end">{t}</SvgText>
        </G>
      ))}
      {series.map((s) => {
        const pts = data.map((d, i) => ({ x: xAt(i), y: yAt(d[s.key]) }));
        const line = smoothPath(pts);
        const base = top + plotH;
        const area = `${line} L${pts[pts.length - 1].x},${base} L${pts[0].x},${base} Z`;
        return (
          <G key={s.key}>
            <Path d={area} fill={`url(#${s.grad})`} />
            <Path d={line} stroke={s.color} strokeWidth={2.5} fill="none" />
          </G>
        );
      })}
      {data.map((d, i) => (
        <SvgText key={d.mois} x={xAt(i)} y={height - 6} fontSize={10} fill={p.axis} textAnchor="middle">
          {d.mois}
        </SvgText>
      ))}
    </Svg>
  );
};

// ─── Stat Card ───────────────────────────────────────────────────────────────
const StatCard = ({
  title,
  value,
  icon,
  gradient,
  trend,
  subtitle,
  width,
  p,
}: {
  title: string;
  value: number | string;
  icon: string;
  gradient: [string, string];
  trend?: string;
  subtitle?: string;
  width: number;
  p: Palette;
}) => {
  const styles = useMemo(() => createStyles(p), [p]);
  return (
    <View style={[styles.statCard, { width }]}>
      {/* gradient blob */}
      <View style={[styles.statBlob, { backgroundColor: gradient[0] }]} pointerEvents="none" />
      <View style={styles.statTopRow}>
        <View style={styles.statTextCol}>
          <Text style={styles.statTitle}>{title}</Text>
          <Text style={styles.statValue}>{typeof value === "number" ? value.toLocaleString("fr-FR") : value}</Text>
          {subtitle ? (
            <View style={styles.statSubRow}>
              <View style={styles.statDot} />
              <Text style={styles.statSub}>{subtitle}</Text>
            </View>
          ) : null}
        </View>
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statIconBox}>
          <FontAwesome5 name={icon as any} size={17} color="#FFFFFF" />
        </LinearGradient>
      </View>
      {trend ? (
        <View style={styles.statTrendRow}>
          <View style={styles.trendPill}>
            <FontAwesome5 name="chart-line" size={9} color="#047857" />
            <Text style={styles.trendPillText}>{trend}</Text>
          </View>
          <Text style={styles.statSub}>ce mois</Text>
        </View>
      ) : null}
    </View>
  );
};

// ─── Chart card wrapper ──────────────────────────────────────────────────────
const ChartCard = ({ title, icon, children, p }: { title: string; icon: string; children: React.ReactNode; p: Palette }) => {
  const styles = useMemo(() => createStyles(p), [p]);
  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>{title}</Text>
        <FontAwesome5 name={icon as any} size={14} color="#94A3B8" />
      </View>
      {children}
    </View>
  );
};

// ─── Main component ──────────────────────────────────────────────────────────
const DashboardContentBody = (_props: DashboardContentBodyProps) => {
  const isDark = useThemeStore((s) => s.mode === "dark");
  const p = useMemo(() => palette(isDark), [isDark]);
  const styles = useMemo(() => createStyles(p), [p]);
  const { width: windowW } = useWindowDimensions();
  // This home is shared by admin and professor/tutor. Platform-wide figures
  // (every professor, pending validations, every class, every establishment)
  // are admin-only; a professor only sees their own classes.
  const isAdmin = useAuthStore((s) => s.role) === "admin";
  const userId = useAuthStore((s) => s.user?.userId);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [establishments, setEstablishments] = useState<Etablissement[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  const load = useCallback(async () => {
    const [profs, cls, mats, ests, pending] = await Promise.all([
      isAdmin ? professorService.getAll().catch(() => [] as Professor[]) : Promise.resolve([] as Professor[]),
      isAdmin
        ? classAdminService.getAll().catch(() => [] as ClassEntity[])
        : userId
          ? classService.getClassesWithPublicationRights(userId).catch(() => [] as ClassEntity[])
          : Promise.resolve([] as ClassEntity[]),
      matiereService.getAll().catch(() => [] as Matiere[]),
      isAdmin ? establishmentService.getAll().catch(() => [] as Etablissement[]) : Promise.resolve([] as Etablissement[]),
      // Admin-only endpoint — other roles would just get a 403.
      isAdmin ? userService.getPendingProfessors().catch(() => [] as unknown[]) : Promise.resolve([] as unknown[]),
    ]);
    setProfessors(profs || []);
    setClasses(cls || []);
    setMatieres(mats || []);
    setEstablishments(ests || []);
    setPendingCount(Array.isArray(pending) ? pending.length : ((pending as any)?.content ?? []).length);
    setLoading(false);
  }, [isAdmin, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Same figures as web: course/exercise/progress totals aren't wired to an
  // endpoint there yet either, so they stay at 0.
  const stats = {
    totalCourses: 0,
    totalExercises: 0,
    activeClasses: classes.filter((c) => (c.etat as string) === "ACTIF").length,
    averageProgress: 0,
    totalMatieres: matieres.length,
    totalStudents: 0,
    totalProfessors: professors.length,
    pendingProfessors: pendingCount,
    completionRate: 0,
  };

  // ── Chart data (mirrors web, which fills these with placeholder values) ───
  // Memoised on the source lists so the random placeholders don't reshuffle
  // on every re-render.
  const pieData: Slice[] = useMemo(
    () =>
      matieres.slice(0, 10).map((m, i) => ({
        name: m.nom || `Matière ${i + 1}`,
        value: Math.floor(Math.random() * 40) + 10,
        color: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [matieres]
  );
  const barData = useMemo(
    () =>
      classes.slice(0, 8).map((c) => ({
        name: c.nom ? (c.nom.length > 6 ? c.nom.slice(0, 6) + "…" : c.nom) : "Classe",
        progression: Math.floor(Math.random() * 35) + 60,
      })),
    [classes]
  );
  const areaData: AreaPoint[] = [
    { mois: "Jan", cours: 4, exercices: 8 },
    { mois: "Fév", cours: 7, exercices: 14 },
    { mois: "Mar", cours: 5, exercices: 11 },
    { mois: "Avr", cours: 9, exercices: 18 },
    { mois: "Mai", cours: 12, exercices: 22 },
    { mois: "Jun", cours: stats.totalCourses || 10, exercices: stats.totalExercises || 20 },
  ];
  const statusData: Slice[] = [
    { name: "Terminés", value: stats.completionRate || 0, color: "#10B981" },
    { name: "En cours", value: 15, color: "#6366F1" },
    { name: "Non démarrés", value: 6, color: "#F43F5E" },
  ];

  const recentItems = [
    {
      icon: "book-open",
      color: "#2563EB",
      bg: isDark ? "rgba(37,99,235,0.15)" : "#EFF6FF",
      label: "Nouveau cours publié",
      sub: professors[0] ? `${professors[0].prenom} ${professors[0].nom}` : "Professeur",
      time: "Il y a 2h",
    },
    {
      icon: "check-circle",
      color: "#059669",
      bg: isDark ? "rgba(5,150,105,0.15)" : "#ECFDF5",
      label: "Exercices complétés",
      sub: classes[0]?.nom || "Classe 3ème A",
      time: "Il y a 3h",
    },
    {
      icon: "users",
      color: "#9333EA",
      bg: isDark ? "rgba(147,51,234,0.15)" : "#FAF5FF",
      label: "Nouvelle classe créée",
      sub: "Admin",
      time: "Il y a 5h",
    },
    {
      icon: "award",
      color: "#D97706",
      bg: isDark ? "rgba(217,119,6,0.15)" : "#FFFBEB",
      label: "Jalon de progression atteint",
      sub: "Système",
      time: "Hier",
    },
    {
      icon: "file-alt",
      color: "#4F46E5",
      bg: isDark ? "rgba(79,70,229,0.15)" : "#EEF2FF",
      label: "Matière mise à jour",
      sub: professors[1] ? `${professors[1].prenom} ${professors[1].nom}` : "Professeur",
      time: "Il y a 2j",
    },
  ];

  if (loading) return <LoadingSpinner label="Chargement du tableau de bord…" fullScreen />;

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const BODY_PAD = 16;
  const GAP = 12;
  const halfW = (windowW - BODY_PAD * 2 - GAP) / 2;
  // Chart card: 20px padding + 1px border each side
  const chartW = windowW - BODY_PAD * 2 - 42;

  const secondary = isAdmin
    ? [
        { label: "Professeurs", value: stats.totalProfessors, icon: "graduation-cap", color: "#3b82f6" },
        { label: "En attente valid.", value: stats.pendingProfessors, icon: "clock", color: "#f59e0b" },
        { label: "Matières", value: stats.totalMatieres, icon: "layer-group", color: "#8b5cf6" },
        { label: "Établissements", value: establishments.length, icon: "school", color: "#10b981" },
      ]
    : [
        { label: "Mes classes", value: classes.length, icon: "school", color: "#3b82f6" },
        { label: "Matières", value: stats.totalMatieres, icon: "layer-group", color: "#8b5cf6" },
      ];

  return (
    <ScrollView
      style={styles.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3B82F6" />}
    >
      <View style={styles.body}>
        {/* ── Page Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <LinearGradient colors={["#2563EB", "#4F46E5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerIcon}>
              <FontAwesome5 name="heartbeat" size={17} color="#FFFFFF" />
            </LinearGradient>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.headerTitle}>Tableau de Bord</Text>
              <View style={styles.headerDateRow}>
                <FontAwesome5 name="calendar-alt" size={10} color={p.muted} />
                <Text style={styles.headerDate}>{today}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity onPress={handleRefresh} activeOpacity={0.85}>
            <LinearGradient colors={["#2563EB", "#4F46E5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.refreshBtn}>
              <FontAwesome5 name="sync-alt" size={14} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── KPI Cards ───────────────────────────────────────────────── */}
        <View style={styles.grid}>
          <StatCard
            title="Cours disponibles"
            value={stats.totalCourses}
            icon="book-open"
            gradient={["#3b82f6", "#6366f1"]}
            trend="+12%"
            subtitle={`${stats.totalMatieres} matières`}
            width={halfW}
            p={p}
          />
          <StatCard
            title="Exercices"
            value={stats.totalExercises}
            icon="bullseye"
            gradient={["#10b981", "#059669"]}
            trend="+18%"
            subtitle={`${stats.completionRate}% complété`}
            width={halfW}
            p={p}
          />
          <StatCard
            title="Classes actives"
            value={stats.activeClasses}
            icon="users"
            gradient={["#8b5cf6", "#7c3aed"]}
            trend="+8%"
            subtitle={`${stats.totalStudents} élèves`}
            width={halfW}
            p={p}
          />
          <StatCard
            title="Progression moyenne"
            value={`${stats.averageProgress}%`}
            icon="chart-bar"
            gradient={["#f59e0b", "#d97706"]}
            trend="+5%"
            subtitle="Toutes les classes"
            width={halfW}
            p={p}
          />
        </View>

        {/* ── Secondary KPIs ──────────────────────────────────────────── */}
        <View style={styles.grid}>
          {secondary.map((item) => (
            <View key={item.label} style={[styles.miniCard, { width: halfW }]}>
              <View style={[styles.miniIcon, { backgroundColor: item.color + "20" }]}>
                <FontAwesome5 name={item.icon as any} size={14} color={item.color} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.miniLabel} numberOfLines={1}>{item.label}</Text>
                <Text style={styles.miniValue}>{item.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Distribution des cours (donut) ──────────────────────────── */}
        <ChartCard title="Distribution des Cours" icon="chart-bar" p={p}>
          {pieData.length === 0 ? (
            <View style={styles.emptyChart}>
              <Text style={styles.emptyText}>Aucune matière disponible</Text>
            </View>
          ) : (
            <>
              <View style={styles.centered}>
                <DonutChart data={pieData} size={Math.min(chartW, 240)} inner={0.4} outer={0.7} padAngle={2} />
              </View>
              <View style={styles.legendWrap}>
                {pieData.slice(0, 6).map((d, i) => (
                  <View key={i} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                    <Text style={styles.legendText} numberOfLines={1}>{d.name}</Text>
                  </View>
                ))}
                {pieData.length > 6 && <Text style={styles.legendMore}>+{pieData.length - 6} autres</Text>}
              </View>
            </>
          )}
        </ChartCard>

        {/* ── Progression des élèves (bar) ────────────────────────────── */}
        <ChartCard title="Progression des Élèves" icon="chart-line" p={p}>
          {barData.length === 0 ? (
            <View style={styles.emptyChart}>
              <Text style={styles.emptyText}>Aucune classe disponible</Text>
            </View>
          ) : (
            <BarChartSvg data={barData} width={chartW} height={256} p={p} />
          )}
        </ChartCard>

        {/* ── Tendances mensuelles (area) ─────────────────────────────── */}
        <ChartCard title="Tendances Mensuelles" icon="heartbeat" p={p}>
          <AreaChartSvg data={areaData} width={chartW} height={224} p={p} />
        </ChartCard>

        {/* ── Statut des exercices (donut + list) ─────────────────────── */}
        <ChartCard title="Statut des Exercices" icon="bullseye" p={p}>
          <View style={styles.centered}>
            <DonutChart data={statusData} size={176} inner={0.45} outer={0.7} padAngle={3} />
          </View>
          <View style={{ gap: 8, marginTop: 4 }}>
            {statusData.map((d) => (
              <View key={d.name} style={styles.statusRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                  <Text style={styles.statusName}>{d.name}</Text>
                </View>
                <Text style={styles.statusValue}>{d.value}%</Text>
              </View>
            ))}
          </View>
        </ChartCard>

        {/* ── Activités récentes ──────────────────────────────────────── */}
        <ChartCard title="Activités Récentes" icon="heartbeat" p={p}>
          <View style={{ gap: 4 }}>
            {recentItems.map((item, i) => (
              <View key={i} style={styles.activityRow}>
                <View style={[styles.activityIcon, { backgroundColor: item.bg }]}>
                  <FontAwesome5 name={item.icon as any} size={14} color={item.color} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.activityLabel} numberOfLines={1}>{item.label}</Text>
                  <Text style={styles.activitySub} numberOfLines={1}>{item.sub}</Text>
                </View>
                <Text style={styles.activityTime}>{item.time}</Text>
              </View>
            ))}
          </View>
        </ChartCard>

        <View style={{ height: 110 }} />
      </View>
    </ScrollView>
  );
};

const createStyles = (p: Palette) =>
  StyleSheet.create({
    scroll: { flex: 1, backgroundColor: p.page },
    body: { paddingHorizontal: 16, paddingTop: 16, gap: 20 },

    // Header
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: p.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: p.isDark ? "#334155" : "#E2E8F0",
      paddingHorizontal: 16,
      paddingVertical: 16,
      ...shadow.sm,
    },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#3B82F6",
      shadowOpacity: 0.3,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    headerTitle: { fontSize: 20, fontWeight: "900", color: p.title, letterSpacing: -0.4 },
    headerDateRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
    headerDate: { fontSize: 12, color: p.muted },
    refreshBtn: {
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: 12,
      shadowColor: "#3B82F6",
      shadowOpacity: 0.3,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },

    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },

    // Stat card
    statCard: {
      backgroundColor: p.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: p.border,
      padding: 16,
      overflow: "hidden",
      ...shadow.md,
    },
    statBlob: {
      position: "absolute",
      top: -24,
      right: -24,
      width: 112,
      height: 112,
      borderRadius: 56,
      opacity: 0.1,
    },
    statTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 6 },
    statTextCol: { flex: 1, minWidth: 0 },
    statTitle: {
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1.2,
      color: p.muted,
      marginBottom: 4,
    },
    statValue: { fontSize: 28, fontWeight: "900", color: p.title, lineHeight: 32 },
    statSubRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
    statDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#3B82F6" },
    statSub: { fontSize: 11, color: p.muted, flexShrink: 1 },
    statIconBox: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      ...shadow.md,
    },
    statTrendRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: p.border,
    },
    trendPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "#D1FAE5",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.full,
    },
    trendPillText: { fontSize: 11, fontWeight: "800", color: "#047857" },

    // Secondary KPI
    miniCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: p.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: p.border,
      padding: 16,
      ...shadow.sm,
    },
    miniIcon: { padding: 10, borderRadius: 12 },
    miniLabel: {
      fontSize: 9,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      color: p.muted,
    },
    miniValue: { fontSize: 20, fontWeight: "900", color: p.title },

    // Chart card
    chartCard: {
      backgroundColor: p.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: p.border,
      padding: 20,
      ...shadow.sm,
    },
    chartHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
    chartTitle: { fontSize: 14, fontWeight: "800", color: p.heading },
    centered: { alignItems: "center" },
    emptyChart: { height: 256, alignItems: "center", justifyContent: "center" },
    emptyText: { fontSize: 13, color: p.faint },
    legendWrap: { flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 6, marginTop: 8 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { fontSize: 11, color: p.legend, maxWidth: 80 },
    legendMore: { fontSize: 11, color: p.faint },
    statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    statusName: { fontSize: 12, color: p.legend },
    statusValue: { fontSize: 12, fontWeight: "800", color: p.heading },

    // Recent activity
    activityRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 12 },
    activityIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    activityLabel: { fontSize: 14, fontWeight: "700", color: p.heading },
    activitySub: { fontSize: 12, color: p.muted, marginTop: 1 },
    activityTime: { fontSize: 12, color: p.faint },
  });

export default DashboardContentBody;
