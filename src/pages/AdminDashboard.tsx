import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Clock3,
  RefreshCw,
  UserCheck,
  UserRound,
  UserX,
} from "lucide-react";
import { format } from "date-fns";
import AdminNavbar from "@/components/AdminNavbar";
import ProtectedAdminRoute from "@/components/ProtectedAdminRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getEffectiveDate } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface DashboardStats {
  students: number;
  teachers: number;
  circles: number;
  discontinuedStudents: number;
  attendance: {
    present: number;
    absent: number;
    late: number;
    excused: number;
  };
  queuedExams: number;
  inProgressExams: number;
  completedExamsThisMonth: number;
  dailyWorkRecords: number;
}

interface OverviewMetric {
  title: string;
  description: string;
  value: number | undefined;
  icon: LucideIcon;
  iconColor: string;
  iconBackground: string;
  path: string;
}

const numberFormatter = new Intl.NumberFormat("ar-SA");

const AdminDashboard = () => {
  const effectiveDate = getEffectiveDate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isFetching = useRef(false);
  const { toast } = useToast();

  const fetchStats = useCallback(async (notifyOnError = true) => {
    if (isFetching.current) return;

    isFetching.current = true;
    setRefreshing(true);
    setLoadError(false);

    try {
      const now = new Date();
      const effectiveDate = getEffectiveDate();
      const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
      const nextMonthStart = format(new Date(now.getFullYear(), now.getMonth() + 1, 1), "yyyy-MM-dd");

      const [
        studentsResult,
        teachersResult,
        circlesResult,
        discontinuedResult,
        presentAttendanceResult,
        absentAttendanceResult,
        lateAttendanceResult,
        excusedAttendanceResult,
        queuedExamsResult,
        inProgressExamsResult,
        completedExamsResult,
        dailyWorkResult,
      ] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("teachers").select("id", { count: "exact", head: true }),
        supabase.from("circles").select("id", { count: "exact", head: true }),
        supabase.from("discontinued_students").select("id", { count: "exact", head: true }),
        supabase
          .from("student_attendance")
          .select("id", { count: "exact", head: true })
          .eq("date", effectiveDate)
          .eq("status", "present"),
        supabase
          .from("student_attendance")
          .select("id", { count: "exact", head: true })
          .eq("date", effectiveDate)
          .eq("status", "absent"),
        supabase
          .from("student_attendance")
          .select("id", { count: "exact", head: true })
          .eq("date", effectiveDate)
          .eq("status", "late"),
        supabase
          .from("student_attendance")
          .select("id", { count: "exact", head: true })
          .eq("date", effectiveDate)
          .eq("status", "excused"),
        supabase
          .from("student_exams")
          .select("id", { count: "exact", head: true })
          .eq("exam_status", "queued"),
        supabase
          .from("student_exams")
          .select("id", { count: "exact", head: true })
          .eq("exam_status", "in_progress"),
        supabase
          .from("student_exams")
          .select("id", { count: "exact", head: true })
          .eq("exam_status", "completed")
          .gte("exam_date", monthStart)
          .lt("exam_date", nextMonthStart),
        supabase
          .from("student_daily_work")
          .select("id", { count: "exact", head: true })
          .eq("date", effectiveDate),
      ]);

      const queryResults = [
        studentsResult,
        teachersResult,
        circlesResult,
        discontinuedResult,
        presentAttendanceResult,
        absentAttendanceResult,
        lateAttendanceResult,
        excusedAttendanceResult,
        queuedExamsResult,
        inProgressExamsResult,
        completedExamsResult,
        dailyWorkResult,
      ];
      const failedQuery = queryResults.find((result) => result.error);
      if (failedQuery?.error) throw failedQuery.error;

      setStats({
        students: studentsResult.count ?? 0,
        teachers: teachersResult.count ?? 0,
        circles: circlesResult.count ?? 0,
        discontinuedStudents: discontinuedResult.count ?? 0,
        attendance: {
          present: presentAttendanceResult.count ?? 0,
          absent: absentAttendanceResult.count ?? 0,
          late: lateAttendanceResult.count ?? 0,
          excused: excusedAttendanceResult.count ?? 0,
        },
        queuedExams: queuedExamsResult.count ?? 0,
        inProgressExams: inProgressExamsResult.count ?? 0,
        completedExamsThisMonth: completedExamsResult.count ?? 0,
        dailyWorkRecords: dailyWorkResult.count ?? 0,
      });
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error loading admin dashboard statistics:", error);
      setLoadError(true);
      if (notifyOnError) {
        toast({
          title: "تعذر تحديث لوحة الإدارة",
          description: "تحقق من الاتصال ثم أعد المحاولة.",
          variant: "destructive",
        });
      }
    } finally {
      isFetching.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchStats();

    const refreshInterval = window.setInterval(() => {
      void fetchStats(false);
    }, 60_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void fetchStats(false);
    };

    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(refreshInterval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [fetchStats]);

  const overviewMetrics: OverviewMetric[] = [
    {
      title: "الطلاب النشطون",
      description: "المسجلون حاليًا في المعهد",
      value: stats?.students,
      icon: UserRound,
      iconColor: "text-blue-700",
      iconBackground: "bg-blue-50",
      path: "/admin/students",
    },
    {
      title: "الأساتذة",
      description: "أعضاء الهيئة التعليمية",
      value: stats?.teachers,
      icon: UserCheck,
      iconColor: "text-emerald-700",
      iconBackground: "bg-emerald-50",
      path: "/admin/teachers",
    },
    {
      title: "الحلقات الدراسية",
      description: "الحلقات المسجلة في النظام",
      value: stats?.circles,
      icon: BookOpen,
      iconColor: "text-violet-700",
      iconBackground: "bg-violet-50",
      path: "/admin/circles",
    },
    {
      title: "الطلاب المنقطعون",
      description: "محفوظون في سجل المنقطعين",
      value: stats?.discontinuedStudents,
      icon: UserX,
      iconColor: "text-amber-700",
      iconBackground: "bg-amber-50",
      path: "/admin/discontinued-students",
    },
  ];

  const attendanceMetrics = [
    { title: "حاضر", value: stats?.attendance.present, style: "bg-emerald-50 text-emerald-800" },
    { title: "غائب", value: stats?.attendance.absent, style: "bg-red-50 text-red-800" },
    { title: "متأخر", value: stats?.attendance.late, style: "bg-amber-50 text-amber-800" },
    { title: "بعذر", value: stats?.attendance.excused, style: "bg-sky-50 text-sky-800" },
  ];

  return (
    <ProtectedAdminRoute>
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background islamic-pattern">
        <AdminNavbar />

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8" dir="rtl">
          <header className="islamic-card mb-6 flex flex-col gap-5 p-5 sm:mb-8 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div>
              <p className="mb-1 text-sm font-semibold text-primary">
                تاريخ الدوام:{" "}
                {new Date(`${effectiveDate}T12:00:00`).toLocaleDateString("ar-SA", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <h2 className="text-2xl font-bold text-primary sm:text-3xl">نظرة عامة على المعهد</h2>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                متابعة أعداد المعهد والحضور والاختبارات وإنجاز الطلاب من بيانات النظام.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {lastUpdated && (
                <span className="text-xs text-muted-foreground">
                  آخر تحديث: {lastUpdated.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => void fetchStats()}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                تحديث البيانات
              </Button>
            </div>
          </header>

          {loadError && (
            <div
              role="alert"
              className="mb-6 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
            >
              <span>
                {stats
                  ? "تعذر تحديث البيانات؛ المعروض هو آخر ملخص تم تحميله بنجاح."
                  : "تعذر تحميل بيانات لوحة الإدارة."}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={() => void fetchStats()}>
                إعادة المحاولة
              </Button>
            </div>
          )}

          <section aria-labelledby="institute-overview-title" className="mb-8">
            <div className="mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <h3 id="institute-overview-title" className="text-lg font-bold text-foreground">
                مؤشرات المعهد
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {overviewMetrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <Link
                    key={metric.title}
                    to={metric.path}
                    className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Card className="islamic-card h-full transition-shadow hover:shadow-lg">
                      <CardContent className="flex items-center justify-between gap-4 p-5 sm:p-6">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-muted-foreground">{metric.title}</p>
                          <p className="mt-2 text-3xl font-bold text-foreground">
                            {metric.value === undefined ? (loading ? "…" : "—") : numberFormatter.format(metric.value)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{metric.description}</p>
                        </div>
                        <div className={`shrink-0 rounded-xl p-3 ${metric.iconBackground}`}>
                          <Icon className={`h-6 w-6 ${metric.iconColor}`} />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="daily-operations-title">
            <div className="mb-4 flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-primary" />
              <h3 id="daily-operations-title" className="text-lg font-bold text-foreground">
                متابعة سير العمل
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              <Card className="islamic-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarCheck className="h-5 w-5 text-emerald-700" />
                    حضور الطلاب في الدوام الحالي
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {attendanceMetrics.map((metric) => (
                      <div key={metric.title} className={`rounded-lg px-3 py-3 ${metric.style}`}>
                        <p className="text-xs font-medium">{metric.title}</p>
                        <p className="mt-1 text-2xl font-bold">
                          {metric.value === undefined
                            ? loading
                              ? "…"
                              : "—"
                            : numberFormatter.format(metric.value)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    إجمالي سجلات الحضور في هذا الدوام:{" "}
                    {stats
                      ? numberFormatter.format(
                          stats.attendance.present +
                            stats.attendance.absent +
                            stats.attendance.late +
                            stats.attendance.excused,
                        )
                      : loading
                        ? "…"
                        : "—"}
                  </p>
                  <Link
                    to="/admin/attendance"
                    className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline"
                  >
                    فتح سجل الغياب
                  </Link>
                </CardContent>
              </Card>

              <Card className="islamic-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ClipboardList className="h-5 w-5 text-violet-700" />
                    مسار الاختبارات
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-sky-50 px-3 py-3 text-sky-800">
                      <p className="text-xs font-medium">بانتظار الاختبار</p>
                      <p className="mt-1 text-2xl font-bold">
                        {stats ? numberFormatter.format(stats.queuedExams) : loading ? "…" : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-amber-50 px-3 py-3 text-amber-800">
                      <p className="text-xs font-medium">قيد الاختبار</p>
                      <p className="mt-1 text-2xl font-bold">
                        {stats ? numberFormatter.format(stats.inProgressExams) : loading ? "…" : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg bg-muted/60 px-3 py-3">
                    <p className="text-xs text-muted-foreground">اختبارات مكتملة هذا الشهر</p>
                    <p className="mt-1 text-xl font-bold text-foreground">
                      {stats ? numberFormatter.format(stats.completedExamsThisMonth) : loading ? "…" : "—"}
                    </p>
                  </div>
                  <Link
                    to="/admin/exam-records"
                    className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline"
                  >
                    فتح سجلات الاختبارات
                  </Link>
                </CardContent>
              </Card>

              <Card className="islamic-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BookOpen className="h-5 w-5 text-blue-700" />
                    إنجاز الطلاب في الدوام الحالي
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold text-foreground">
                    {stats ? numberFormatter.format(stats.dailyWorkRecords) : loading ? "…" : "—"}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">سجل إنجاز يومي أُضيف للطلاب</p>
                  <Link
                    to="/admin/records"
                    className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline"
                  >
                    فتح سجلات الطلاب
                  </Link>
                </CardContent>
              </Card>
            </div>
          </section>
        </main>
      </div>
    </ProtectedAdminRoute>
  );
};

export default AdminDashboard;
