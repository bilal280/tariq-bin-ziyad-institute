import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, CalendarRange, Check, Clock3, Users } from "lucide-react";
import AdminNavbar from "@/components/AdminNavbar";
import ProtectedAdminRoute from "@/components/ProtectedAdminRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type AttendanceStatus = "present" | "absent" | "unexcused_absence";
type Section = "cohorts" | "daily" | "monthly";

interface Cohort {
  id: number;
  label: string;
  startTime: string;
}

interface TeacherAssignment {
  id: string;
  name: string;
  cohort: number;
  circleNames: string[];
}

interface AttendanceRecord {
  id: string;
  teacher_id: string;
  cohort: number;
  attendance_date: string;
  status: AttendanceStatus;
  check_in_time: string | null;
  late_minutes: number;
}

interface MonthlyReport {
  teacherId: string;
  teacherName: string;
  lateMinutes: number;
  absentDays: number;
  unexcusedDays: number;
}

const cohorts: Cohort[] = [
  { id: 1, label: "الفوج الأول", startTime: "08:30" },
  { id: 2, label: "الفوج الثاني", startTime: "12:56" },
  { id: 3, label: "الفوج الثالث", startTime: "16:15" },
];

const pad = (value: number) => String(value).padStart(2, "0");
const getLocalDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
};
const recordKey = (teacherId: string, cohortId: number) => `${teacherId}:${cohortId}`;
const formatTime = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
const timeMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};
const getLateMinutes = (checkInTime: string, startTime: string) => Math.max(0, timeMinutes(checkInTime) - timeMinutes(startTime));
const statusLabels: Record<AttendanceStatus, string> = {
  present: "حاضر",
  absent: "غائب",
  unexcused_absence: "غائب بدون إذن",
};
const statusStyles: Record<AttendanceStatus, string> = {
  present: "bg-green-100 text-green-800",
  absent: "bg-amber-100 text-amber-800",
  unexcused_absence: "bg-red-100 text-red-800",
};

const AdminTeacherAttendance = () => {
  const [teachers, setTeachers] = useState<TeacherAssignment[]>([]);
  const [dailyRecords, setDailyRecords] = useState<AttendanceRecord[]>([]);
  const [monthlyRecords, setMonthlyRecords] = useState<AttendanceRecord[]>([]);
  const [activeSection, setActiveSection] = useState<Section>("cohorts");
  const [selectedCohort, setSelectedCohort] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(getLocalDate(new Date()));
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [draftTimes, setDraftTimes] = useState<Record<string, string>>({});
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchTeachers = async () => {
    setLoadingTeachers(true);
    try {
      const { data, error } = await (supabase as any)
        .from("circles")
        .select("id, name, group_name, cohort, teacher_id, teachers(name)");
      if (error) throw error;

      const assignments = new Map<string, TeacherAssignment>();
      (data || []).forEach((circle: any) => {
        const cohort = Number(circle.cohort || 1);
        const relation = Array.isArray(circle.teachers) ? circle.teachers[0] : circle.teachers;
        if (!circle.teacher_id || !relation?.name || cohort < 1 || cohort > 3) return;
        const key = recordKey(circle.teacher_id, cohort);
        const assignment = assignments.get(key) || {
          id: circle.teacher_id,
          name: relation.name,
          cohort,
          circleNames: [],
        };
        assignment.circleNames.push(circle.name || circle.group_name || "حلقة");
        assignments.set(key, assignment);
      });
      setTeachers(Array.from(assignments.values()).sort((a, b) => a.name.localeCompare(b.name, "ar") || a.cohort - b.cohort));
    } catch (error) {
      console.error("Failed to load teacher cohorts:", error);
      toast({ title: "خطأ", description: "تعذر تحميل الأساتذة والأفواج", variant: "destructive" });
    } finally {
      setLoadingTeachers(false);
    }
  };

  const fetchDailyRecords = async () => {
    setLoadingDaily(true);
    const { data, error } = await (supabase as any)
      .from("teacher_attendance")
      .select("*")
      .eq("attendance_date", selectedDate);
    if (error) {
      console.error("Failed to load daily teacher attendance:", error);
      toast({ title: "خطأ", description: "تعذر تحميل السجل اليومي", variant: "destructive" });
    } else {
      setDailyRecords((data || []) as AttendanceRecord[]);
    }
    setLoadingDaily(false);
  };

  const fetchMonthlyRecords = async () => {
    if (!/^\d{4}-\d{2}$/.test(selectedMonth)) return;
    setLoadingMonthly(true);
    const [year, month] = selectedMonth.split("-").map(Number);
    const monthStart = `${selectedMonth}-01`;
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;
    const { data, error } = await (supabase as any)
      .from("teacher_attendance")
      .select("*")
      .gte("attendance_date", monthStart)
      .lt("attendance_date", nextMonth);
    if (error) {
      console.error("Failed to load monthly teacher attendance:", error);
      toast({ title: "خطأ", description: "تعذر تحميل التقرير الشهري", variant: "destructive" });
    } else {
      setMonthlyRecords((data || []) as AttendanceRecord[]);
    }
    setLoadingMonthly(false);
  };

  useEffect(() => { void fetchTeachers(); }, []);
  useEffect(() => { void fetchDailyRecords(); }, [selectedDate]);
  useEffect(() => { void fetchMonthlyRecords(); }, [selectedMonth]);

  const getRecord = (teacher: TeacherAssignment) => dailyRecords.find(
    (record) => record.teacher_id === teacher.id && Number(record.cohort) === teacher.cohort
  );

  const saveRecord = async (
    teacher: TeacherAssignment,
    status: AttendanceStatus,
    checkInTime: string | null,
    lateMinutes: number,
  ) => {
    const key = recordKey(teacher.id, teacher.cohort);
    setBusyKey(key);
    try {
      const payload = {
        teacher_id: teacher.id,
        cohort: teacher.cohort,
        attendance_date: selectedDate,
        status,
        check_in_time: checkInTime,
        late_minutes: lateMinutes,
      };
      const { data, error } = await (supabase as any)
        .from("teacher_attendance")
        .upsert(payload, { onConflict: "teacher_id,cohort,attendance_date" })
        .select("*")
        .single();
      if (error) throw error;
      setDailyRecords((previous) => [
        ...previous.filter((record) => !(record.teacher_id === teacher.id && Number(record.cohort) === teacher.cohort)),
        data as AttendanceRecord,
      ]);
      setMonthlyRecords((previous) => previous.filter((record) => !(
        record.teacher_id === teacher.id && Number(record.cohort) === teacher.cohort && record.attendance_date === selectedDate
      )).concat(selectedDate.startsWith(selectedMonth) ? [data as AttendanceRecord] : []));
      return true;
    } catch (error) {
      console.error("Failed to save teacher attendance:", error);
      toast({ title: "خطأ", description: "تعذر حفظ سجل الأستاذ", variant: "destructive" });
      return false;
    } finally {
      setBusyKey(null);
    }
  };

  const checkIn = async (teacher: TeacherAssignment) => {
    if (selectedDate !== getLocalDate(new Date())) {
      toast({ title: "تنبيه", description: "تسجيل وقت الدخول متاح لتاريخ اليوم فقط", variant: "destructive" });
      return;
    }
    const now = new Date();
    const currentTime = formatTime(now);
    const cohort = cohorts.find((item) => item.id === teacher.cohort)!;
    await saveRecord(teacher, "present", currentTime, getLateMinutes(currentTime, cohort.startTime));
  };

  const setManualStatus = async (teacher: TeacherAssignment, status: AttendanceStatus | "unrecorded") => {
    const existing = getRecord(teacher);
    if (status === "unrecorded") {
      const key = recordKey(teacher.id, teacher.cohort);
      setBusyKey(key);
      try {
        const { error } = await (supabase as any)
          .from("teacher_attendance")
          .delete()
          .eq("teacher_id", teacher.id)
          .eq("cohort", teacher.cohort)
          .eq("attendance_date", selectedDate);
        if (error) throw error;
        setDailyRecords((previous) => previous.filter((record) => !(record.teacher_id === teacher.id && Number(record.cohort) === teacher.cohort)));
        setMonthlyRecords((previous) => previous.filter((record) => !(record.teacher_id === teacher.id && Number(record.cohort) === teacher.cohort && record.attendance_date === selectedDate)));
      } catch (error) {
        console.error("Failed to clear teacher attendance:", error);
        toast({ title: "خطأ", description: "تعذر تعديل سجل الأستاذ", variant: "destructive" });
      } finally {
        setBusyKey(null);
      }
      return;
    }
    const checkInTime = status === "present" ? existing?.check_in_time || null : null;
    const lateMinutes = status === "present" ? existing?.late_minutes || 0 : 0;
    await saveRecord(teacher, status, checkInTime, lateMinutes);
  };

  const saveManualTime = async (teacher: TeacherAssignment) => {
    const key = recordKey(teacher.id, teacher.cohort);
    const value = draftTimes[key] ?? getRecord(teacher)?.check_in_time?.slice(0, 5) ?? "";
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      toast({ title: "وقت غير صالح", description: "أدخل الوقت بصيغة الساعة والدقيقة", variant: "destructive" });
      return;
    }
    const cohort = cohorts.find((item) => item.id === teacher.cohort)!;
    const checkInTime = `${value}:00`;
    const status = getRecord(teacher)?.status || "present";
    const saved = await saveRecord(teacher, status, checkInTime, getLateMinutes(value, cohort.startTime));
    if (saved) setDraftTimes((previous) => ({ ...previous, [key]: value }));
  };

  const monthlyReport = useMemo<MonthlyReport[]>(() => {
    const reports = new Map<string, MonthlyReport & { absentDates: Set<string>; unexcusedDates: Set<string> }>();
    teachers.forEach((teacher) => {
      if (!reports.has(teacher.id)) reports.set(teacher.id, {
        teacherId: teacher.id,
        teacherName: teacher.name,
        lateMinutes: 0,
        absentDays: 0,
        unexcusedDays: 0,
        absentDates: new Set(),
        unexcusedDates: new Set(),
      });
    });
    monthlyRecords.forEach((record) => {
      const report = reports.get(record.teacher_id);
      if (!report) return;
      report.lateMinutes += Number(record.late_minutes || 0);
      if (record.status === "absent") report.absentDates.add(record.attendance_date);
      if (record.status === "unexcused_absence") report.unexcusedDates.add(record.attendance_date);
    });
    return Array.from(reports.values()).map(({ absentDates, unexcusedDates, ...report }) => ({
      ...report,
      absentDays: absentDates.size,
      unexcusedDays: unexcusedDates.size,
    })).sort((a, b) => a.teacherName.localeCompare(b.teacherName, "ar"));
  }, [teachers, monthlyRecords]);

  const dailyOverview = useMemo(() => teachers.map((teacher) => ({ teacher, record: getRecord(teacher) })), [teachers, dailyRecords]);
  const cohortTeachers = selectedCohort === null ? [] : teachers.filter((teacher) => teacher.cohort === selectedCohort);
  const selectedCohortInfo = cohorts.find((cohort) => cohort.id === selectedCohort);

  const statusBadge = (status?: AttendanceStatus) => status
    ? <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusStyles[status]}`}>{statusLabels[status]}</span>
    : <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">غير مسجل</span>;

  const statusEditor = (teacher: TeacherAssignment, record?: AttendanceRecord) => (
    <Select value={record?.status || "unrecorded"} onValueChange={(value) => void setManualStatus(teacher, value as AttendanceStatus | "unrecorded")}>
      <SelectTrigger className="h-9 min-w-40 text-right"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="unrecorded">غير مسجل</SelectItem>
        <SelectItem value="present">حاضر</SelectItem>
        <SelectItem value="absent">غائب</SelectItem>
        <SelectItem value="unexcused_absence">غائب بدون إذن</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <ProtectedAdminRoute>
      <div dir="rtl" className="min-h-screen bg-gray-50">
        <AdminNavbar />
        <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold text-emerald-700">قسم إداري مستقل</p>
              <h1 className="mt-1 text-3xl font-bold text-gray-900">متابعة الأساتذة</h1>
              <p className="mt-2 text-sm text-gray-600">تسجيل الحضور والتأخر ومراجعة السجلات والتقارير الشهرية.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                ["cohorts", "الأفواج"],
                ["daily", "السجل اليومي"],
                ["monthly", "التقرير الشهري"],
              ] as [Section, string][]).map(([section, label]) => (
                <Button key={section} variant={activeSection === section ? "default" : "outline"} onClick={() => setActiveSection(section)}>
                  {label}
                </Button>
              ))}
            </div>
          </header>

          {activeSection === "cohorts" && selectedCohort === null && (
            <section className="grid gap-4 md:grid-cols-3">
              {cohorts.map((cohort) => {
                const assigned = teachers.filter((teacher) => teacher.cohort === cohort.id);
                const present = assigned.filter((teacher) => getRecord(teacher)?.status === "present").length;
                const absent = assigned.filter((teacher) => getRecord(teacher)?.status === "absent").length;
                const unexcused = assigned.filter((teacher) => getRecord(teacher)?.status === "unexcused_absence").length;
                return (
                  <button key={cohort.id} type="button" onClick={() => setSelectedCohort(cohort.id)} className="text-right">
                    <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between text-xl text-gray-900"><span>{cohort.label}</span><Clock3 className="h-5 w-5 text-emerald-600" /></CardTitle>
                        <p className="text-sm text-gray-600">بداية الدوام {cohort.startTime}</p>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold text-emerald-700">{assigned.length}<span className="mr-2 text-sm font-medium text-gray-600">أستاذ</span></p>
                        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
                          <span className="rounded-full bg-green-100 px-2.5 py-1 text-green-800">حضور {present}</span>
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">غياب {absent}</span>
                          <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-800">بدون إذن {unexcused}</span>
                        </div>
                        <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-emerald-700">عرض الأساتذة <ArrowRight className="h-4 w-4" /></span>
                      </CardContent>
                    </Card>
                  </button>
                );
              })}
            </section>
          )}

          {activeSection === "cohorts" && selectedCohort !== null && selectedCohortInfo && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedCohortInfo.label}</h2>
                  <p className="text-sm text-gray-600">بداية الفوج {selectedCohortInfo.startTime} · {selectedDate}</p>
                </div>
                <Button variant="outline" onClick={() => setSelectedCohort(null)}><ArrowRight className="ml-2 h-4 w-4" />العودة إلى الأفواج</Button>
              </div>
              {loadingTeachers || loadingDaily ? <p className="py-8 text-center text-gray-500">جاري تحميل السجلات...</p> : cohortTeachers.length === 0 ? (
                <Card><CardContent className="py-10 text-center text-gray-500">لا توجد حلقات أو أساتذة مرتبطون بهذا الفوج.</CardContent></Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {cohortTeachers.map((teacher) => {
                    const record = getRecord(teacher);
                    const key = recordKey(teacher.id, teacher.cohort);
                    return (
                      <Card key={key}>
                        <CardContent className="space-y-4 p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div><h3 className="font-bold text-gray-900">{teacher.name}</h3><p className="mt-1 text-xs text-gray-500">{teacher.circleNames.join("، ")}</p></div>
                            {statusBadge(record?.status)}
                          </div>
                          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
                            <span>الدخول: <b className="text-gray-900">{record?.check_in_time?.slice(0, 5) || "-"}</b></span>
                            <span>التأخر: <b className="text-gray-900">{record?.late_minutes || 0} دقيقة</b></span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => void checkIn(teacher)} disabled={busyKey === key || selectedDate !== getLocalDate(new Date())}>
                              <Check className="ml-1 h-4 w-4" />تسجيل حضور
                            </Button>
                            <Button size="sm" variant={record?.status === "absent" ? "secondary" : "outline"} onClick={() => void setManualStatus(teacher, "absent")} disabled={busyKey === key}>غياب</Button>
                            <Button size="sm" variant={record?.status === "unexcused_absence" ? "destructive" : "outline"} onClick={() => void setManualStatus(teacher, "unexcused_absence")} disabled={busyKey === key}>غياب بدون إذن</Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {activeSection === "daily" && (
            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div><CardTitle>السجل اليومي لجميع الأساتذة</CardTitle><p className="mt-1 text-sm text-gray-600">يمكن تعديل الحالة ووقت الدخول يدويًا، ويعاد حساب التأخر بالدقائق.</p></div>
                <div className="space-y-1"><Label htmlFor="attendance-date">التاريخ</Label><Input id="attendance-date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="w-44" /></div>
              </CardHeader>
              <CardContent>
                {loadingTeachers || loadingDaily ? <p className="py-8 text-center text-gray-500">جاري تحميل السجل...</p> : teachers.length === 0 ? <p className="py-8 text-center text-gray-500">لا يوجد أساتذة مرتبطون بحلقات.</p> : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>الأستاذ</TableHead><TableHead>الفوج</TableHead><TableHead>الحالة</TableHead><TableHead>وقت الدخول</TableHead><TableHead>التأخر</TableHead><TableHead>الإجراء</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {dailyOverview.map(({ teacher, record }) => {
                          const key = recordKey(teacher.id, teacher.cohort);
                          const cohort = cohorts.find((item) => item.id === teacher.cohort)!;
                          return <TableRow key={key}>
                            <TableCell className="font-medium">{teacher.name}<span className="block text-xs text-gray-500">{teacher.circleNames.join("، ")}</span></TableCell>
                            <TableCell>{cohort.label}</TableCell>
                            <TableCell>{statusEditor(teacher, record)}</TableCell>
                            <TableCell><Input type="time" value={draftTimes[key] ?? record?.check_in_time?.slice(0, 5) ?? ""} disabled={record?.status !== "present"} onChange={(event) => setDraftTimes((previous) => ({ ...previous, [key]: event.target.value }))} onBlur={() => { if (draftTimes[key]) void saveManualTime(teacher); }} className="w-32" /></TableCell>
                            <TableCell>{record?.late_minutes || 0} دقيقة</TableCell>
                            <TableCell><Button size="sm" variant="outline" disabled={busyKey === key || record?.status !== "present" || !draftTimes[key]} onClick={() => void saveManualTime(teacher)}>حفظ الوقت</Button></TableCell>
                          </TableRow>;
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeSection === "monthly" && (
            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div><CardTitle>التقرير الشهري للأساتذة</CardTitle><p className="mt-1 text-sm text-gray-600">الإجماليات محسوبة من سجلات الحضور اليومية نفسها.</p></div>
                <div className="space-y-1"><Label htmlFor="attendance-month">الشهر</Label><Input id="attendance-month" type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="w-44" /></div>
              </CardHeader>
              <CardContent>
                {loadingTeachers || loadingMonthly ? <p className="py-8 text-center text-gray-500">جاري إعداد التقرير...</p> : monthlyReport.length === 0 ? <p className="py-8 text-center text-gray-500">لا يوجد أساتذة لعرض التقرير.</p> : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>الأستاذ</TableHead><TableHead>إجمالي التأخر</TableHead><TableHead>أيام الغياب</TableHead><TableHead>أيام الغياب بدون إذن</TableHead></TableRow></TableHeader>
                      <TableBody>{monthlyReport.map((report) => <TableRow key={report.teacherId}><TableCell className="font-medium">{report.teacherName}</TableCell><TableCell>{report.lateMinutes} دقيقة</TableCell><TableCell>{report.absentDays}</TableCell><TableCell>{report.unexcusedDays}</TableCell></TableRow>)}</TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-2 text-xs text-gray-500"><CalendarDays className="h-4 w-4" /><span>تُحسب مدة التأخر بالدقائق فقط، دون احتساب الثواني.</span><CalendarRange className="mr-3 h-4 w-4" /><span>غياب الأيام يُحسب مرة واحدة لكل أستاذ في الشهر.</span></div>
        </main>
      </div>
    </ProtectedAdminRoute>
  );
};

export default AdminTeacherAttendance;
