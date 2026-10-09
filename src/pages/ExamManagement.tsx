import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import TeacherNavbar from "@/components/TeacherNavbar";
import ProtectedTeacherRoute from "@/components/ProtectedTeacherRoute";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Save, UserSearch, Download, Trash2, Edit, X, Search, Filter, Send, Clock3, Play, Check, ListOrdered, RefreshCw } from "lucide-react";
import { ExamDefinition, ExamProgressRecord, getExamDisplayName, getNextExam } from "@/lib/examProgression";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Circle {
  id: string;
  name: string;
}

interface Student {
  id: string;
  name: string;
  level: string;
  circle_id: string;
}

interface LabExaminer {
  id: string;
  name: string;
}

interface Exam {
  id: string;
  student_id?: string;
  exam_date: string;
  created_at?: string;
  exam_status?: string;
  exam_kind?: string;
  stage_name?: string | null;
  manual_start?: boolean;
  teacher_name?: string | null;
  lab_examiner_id?: string | null;
  lab_examiner_name?: string | null;
  juz_number: number | null;
  attempt_number: number;
  exam_score: number | null;
  tajweed_score: number | null;
  tafsir_score: number | null;
  surah_memory_score: number | null;
  stability_score: number | null;
  grade: string | null;
  notes: string | null;
  tamhidi_stage: string | null;
  tilawah_section: string | null;
  hifd_section: string | null;
  student_name?: string;
  student_level?: string;
  circle_name?: string;
  circle_id?: string;
}

interface QueueExam extends Exam {
  student_id: string;
  students?: {
    name?: string;
    level?: string;
    circle_id?: string;
    circles?: { name?: string } | null;
  } | null;
}

const ExamManagement = () => {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [labExaminers, setLabExaminers] = useState<LabExaminer[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedCircleId, setSelectedCircleId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [resultLabExaminerId, setResultLabExaminerId] = useState("");
  const [selectedStudentLevel, setSelectedStudentLevel] = useState("");
  const [studentName, setStudentName] = useState("");
  const [showExamForm, setShowExamForm] = useState(false);
  const [studentExamHistory, setStudentExamHistory] = useState<ExamProgressRecord[]>([]);
  const [recommendedExam, setRecommendedExam] = useState<ExamDefinition | null>(null);
  const [nextAfterCurrentExam, setNextAfterCurrentExam] = useState<ExamDefinition | null>(null);
  const [manualInitialExam, setManualInitialExam] = useState(false);
  const [manualSection, setManualSection] = useState("");
  const [examQueue, setExamQueue] = useState<QueueExam[]>([]);
  const [selectedQueueExam, setSelectedQueueExam] = useState<QueueExam | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(false);
  
  // حقول مشتركة
  const [attemptNumber, setAttemptNumber] = useState("");
  const [examDate, setExamDate] = useState(new Date().toISOString().split('T')[0]);
  const [examScore, setExamScore] = useState("");
  const [grade, setGrade] = useState("");
  const [tajweedScore, setTajweedScore] = useState("");

  // دالة لحساب التقدير تلقائياً بناءً على العلامة ومستوى الطالب
  const calculateGrade = (score: number, level: string, examStage?: string): string => {
    if (!score || score < 0 || score > 100) return "";

    if (level === "تمهيدي") {
      // سلم التمهيدي الكامل (حد النجاح من 85)
      if (examStage === "مرحلة كامل") {
        if (score === 100) return "شرف";
        if (score >= 97) return "تفوق";
        if (score >= 94) return "ممتاز";
        if (score >= 90) return "جيد جداً";
        if (score >= 87) return "جيد";
        if (score >= 85) return "مقبول";
        return "إعادة";
      }
      
      // سلم التمهيدي العادي
      if (score === 100) return "شرف";
      if (score >= 98) return "تفوق";
      if (score >= 96) return "ممتاز";
      if (score >= 94) return "جيد جداً";
      if (score >= 92) return "جيد";
      if (score >= 90) return "مقبول";
      if (score == 0) return "إعادة";

      return "إعادة";
    } else if (level === "حافظ") {
      // سلم الحافظ
      if (score === 100) return "شرف";
      if (score >= 97) return "تفوق";
      if (score >= 94) return "ممتاز";
      if (score >= 90) return "جيد جداً";
      if (score >= 85) return "جيد";
      if (score >= 80 ) return "مقبول";
      

      return "إعادة";
    } else {
      // سلم التلاوة
      if (score === 100) return "شرف";
      if (score >= 98 ) return "تفوق";
      if (score >= 95) return "ممتاز";
      if (score >= 92) return "جيد جداً";
      if (score >= 89) return "جيد";
      if (score >= 85) return "مقبول";
     

      return "إعادة";
    }
  };

  const [surahMemoryScore, setSurahMemoryScore] = useState("");
  const [notes, setNotes] = useState("");
  
  // حقول التمهيدي
  const [tamhidiStage, setTamhidiStage] = useState("");
  
  // حقول التلاوة
  const [tilawahSection, setTilawahSection] = useState("");
  const [tafsirScore, setTafsirScore] = useState("");
  
  // حقول الحفاظ
  const [hifdSection, setHifdSection] = useState("");
  const [stabilityScore, setStabilityScore] = useState("");
  
  const [loading, setLoading] = useState(false);
  
  // حالات تبويب سجلات الاختبارات
  const location = useLocation();
  const isExaminerView = location.pathname.startsWith("/examiner");
  const [activeTab, setActiveTab] = useState(isExaminerView ? "queue" : "new");
  const [previousExams, setPreviousExams] = useState<Exam[]>([]);

  // تحديث التقدير تلقائياً عند تغيير العلامة
  useEffect(() => {
    if (examScore && selectedStudentLevel) {
      const score = parseFloat(examScore);
      const calculatedGrade = calculateGrade(score, selectedStudentLevel, tamhidiStage);
      setGrade(calculatedGrade);
    } else {
      setGrade("");
    }
  }, [examScore, selectedStudentLevel, tamhidiStage]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [filterCircleId, setFilterCircleId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [examToDelete, setExamToDelete] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [examToEdit, setExamToEdit] = useState<Exam | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Exam>>({});

  const { toast } = useToast();

  useEffect(() => {
    fetchCircles();
    fetchLabExaminers();
  }, []);

  const fetchLabExaminers = async () => {
    const { data, error } = await supabase
      .from('lab_examiners')
      .select('id, name')
      .order('name');

    if (error) {
      console.error('Error fetching lab examiners:', error);
      toast({ title: "خطأ", description: "تعذر تحميل أسماء المختبرين", variant: "destructive" });
      return;
    }

    const examiners = data || [];
    setLabExaminers(examiners);
    if (resultLabExaminerId && !examiners.some((examiner) => examiner.id === resultLabExaminerId)) {
      setResultLabExaminerId("");
    }
  };

  const fetchExamQueue = useCallback(async (showLoading = true) => {
    if (showLoading) setLoadingQueue(true);
    const { data, error } = await supabase
      .from("student_exams")
      .select("*, students(name, level, circle_id, circles(name))")
      .in("exam_status", ["queued", "in_progress"])
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching exam queue:", error);
      toast({ title: "خطأ", description: "تعذر تحميل قائمة الانتظار", variant: "destructive" });
    } else {
      setExamQueue((data || []) as QueueExam[]);
    }
    if (showLoading) setLoadingQueue(false);
  }, [toast]);

  useEffect(() => {
    if (activeTab === "records" && !isExaminerView) {
      fetchPreviousExams();
    }
    if (activeTab === "queue" && isExaminerView) fetchExamQueue();
  }, [activeTab, isExaminerView, fetchExamQueue]);

  useEffect(() => {
    if (!isExaminerView || activeTab !== "queue") return;

    const refreshInterval = window.setInterval(() => {
      fetchExamQueue(false);
    }, 10000);

    return () => window.clearInterval(refreshInterval);
  }, [activeTab, fetchExamQueue, isExaminerView]);

  const fetchPreviousExams = async () => {
    try {
      setLoadingExams(true);
      const { data, error } = await supabase
        .from('student_exams')
        .select(`
          *,
          students (
            name,
            level,
            circle_id,
            circles (
              name
            )
          )
        `)
        .eq("exam_status", "completed")
        .order('exam_date', { ascending: false });

      if (error) throw error;

      const examsWithDetails = data?.map(exam => ({
        ...exam,
        student_name: exam.students?.name || "غير محدد",
        student_level: exam.students?.level || "غير محدد",
        circle_name: exam.students?.circles?.name || "غير محدد",
        circle_id: exam.students?.circle_id
      })) || [];

      setPreviousExams(examsWithDetails);
    } catch (error) {
      console.error('Error fetching exams:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل سجلات الاختبارات",
        variant: "destructive",
      });
    } finally {
      setLoadingExams(false);
    }
  };

  const handleEditClick = (exam: Exam) => {
    setExamToEdit(exam);
    setEditFormData({
      exam_date: exam.exam_date,
      juz_number: exam.juz_number,
      attempt_number: exam.attempt_number,
      exam_score: exam.exam_score,
      tajweed_score: exam.tajweed_score,
      tafsir_score: exam.tafsir_score,
      surah_memory_score: exam.surah_memory_score,
      stability_score: exam.stability_score,
      grade: exam.grade,
      notes: exam.notes,
      tamhidi_stage: exam.tamhidi_stage,
      tilawah_section: exam.tilawah_section,
      hifd_section: exam.hifd_section,
    });
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!examToEdit) return;

    try {
      const { error } = await supabase
        .from('student_exams')
        .update(editFormData)
        .eq('id', examToEdit.id);

      if (error) throw error;

      toast({
        title: "تم التحديث بنجاح",
        description: "تم تحديث بيانات الاختبار",
      });

      setEditDialogOpen(false);
      setExamToEdit(null);
      setEditFormData({});
      fetchPreviousExams();
    } catch (error) {
      console.error('Error updating exam:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحديث بيانات الاختبار",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (examId: string) => {
    setExamToDelete(examId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!examToDelete) return;

    try {
      const { error } = await supabase
        .from('student_exams')
        .delete()
        .eq('id', examToDelete);

      if (error) throw error;

      toast({
        title: "تم الحذف بنجاح",
        description: "تم حذف سجل الاختبار",
      });

      fetchPreviousExams();
    } catch (error) {
      console.error('Error deleting exam:', error);
      toast({
        title: "خطأ",
        description: "فشل في حذف سجل الاختبار",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setExamToDelete(null);
    }
  };

  const getExamSection = (exam: Exam): string => {
    return getExamDisplayName(exam, exam.student_level || "");
  };

  const filteredExams = previousExams.filter(exam => {
    // فلترة حسب الحلقة
    const circleMatch = filterCircleId === "all" || exam.circle_id === filterCircleId;
    
    // فلترة حسب البحث (الاسم)
    const searchMatch = !searchQuery || 
      exam.student_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return circleMatch && searchMatch;
  });

  useEffect(() => {
    if (selectedCircleId) {
      fetchStudents(selectedCircleId);
    } else {
      setStudents([]);
      setSelectedStudentId("");
      setSelectedStudentLevel("");
    }
  }, [selectedCircleId]);

  const handleStudentSelect = async () => {
    if (!selectedCircleId || !selectedStudentId) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار الحلقة والطالب",
        variant: "destructive",
      });
      return;
    }
    
    const student = students.find(s => s.id === selectedStudentId);
    if (student) {
      const { data, error } = await supabase
        .from("student_exams")
        .select("exam_status, exam_kind, stage_name, manual_start, attempt_number, tamhidi_stage, juz_number, tilawah_section, hifd_section, grade")
        .eq("student_id", student.id)
        .eq("exam_status", "completed");

      const { data: activeExams, error: activeExamError } = await supabase
        .from("student_exams")
        .select("id")
        .eq("student_id", student.id)
        .in("exam_status", ["queued", "in_progress"]);

      if (error || activeExamError) {
        toast({ title: "خطأ", description: "تعذر قراءة سجل الطالب لتحديد الاختبار التالي", variant: "destructive" });
        return;
      }
      if (activeExams?.length) {
        toast({ title: "لدى الطالب اختبار مفتوح", description: "أنه الاختبار الموجود في قائمة الانتظار قبل إرسال اختبار آخر", variant: "destructive" });
        return;
      }

      const history = (data || []) as ExamProgressRecord[];
      const nextExam = getNextExam(student.level, history);
      setSelectedStudentLevel(student.level);
      setStudentName(student.name);
      setStudentExamHistory(history);
      setRecommendedExam(nextExam);
      setManualInitialExam(false);
      setManualSection(nextExam?.section || nextExam?.stageName || "");
      setShowExamForm(true);
    }
  };

  const fetchCircles = async () => {
    try {
      const teacherData = localStorage.getItem("teacher");
      if (!teacherData) return;
      const teacher = JSON.parse(teacherData);

      const { data, error } = await supabase
        .from('circles')
        .select('id, name')
        .eq('teacher_id', teacher.id)
        .order('name');

      if (error) throw error;
      setCircles(data || []);
    } catch (error) {
      console.error('Error fetching circles:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل الحلقات",
        variant: "destructive",
      });
    }
  };

  const fetchStudents = async (circleId: string) => {
    try {
      setSelectedStudentId("");
      setStudents([]);
      const { data, error } = await supabase
        .from('students')
        .select('id, name, level, circle_id')
        .eq('circle_id', circleId)
        .order('name');

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل الطلاب",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isExaminerView) return;

    if (!circles.some((circle) => circle.id === selectedCircleId) ||
        !students.some((student) => student.id === selectedStudentId && student.circle_id === selectedCircleId)) {
      toast({
        title: "اختيار غير صالح",
        description: "يمكنك إرسال طالب من إحدى حلقاتك فقط",
        variant: "destructive",
      });
      return;
    }

    if (!selectedCircleId || !selectedStudentId || !recommendedExam || !examDate) {
      toast({
        title: "خطأ",
        description: "لا يوجد اختبار تالٍ متاح لهذا الطالب أو أن بيانات الإرسال غير مكتملة",
        variant: "destructive",
      });
      return;
    }

    if (manualInitialExam && studentExamHistory.length > 0) {
      toast({
        title: "خطأ",
        description: "يمكن تعديل الاختبار يدويًا عند أول إرسال فقط",
        variant: "destructive",
      });
      return;
    }

    let exam = recommendedExam;
    if (manualInitialExam && studentExamHistory.length === 0 && manualSection) {
      if (selectedStudentLevel === "تمهيدي") {
        exam = { kind: "milestone", stageName: manualSection, section: null, juzNumber: null, label: manualSection };
      } else {
        const hizbNumber = Number(manualSection.match(/^الحزب (\d+)$/)?.[1]);
        const juzNumber = Number(manualSection.match(/^الجزء (\d+)$/)?.[1]);
        exam = {
          kind: "regular",
          stageName: null,
          juzNumber: juzNumber || null,
          section: manualSection,
          label: manualSection,
        };
        if (!hizbNumber && !juzNumber) {
          toast({ title: "اختيار غير صالح", description: "اختر حزبًا أو جزءًا من القائمة", variant: "destructive" });
          return;
        }
      }
    }

    setLoading(true);
    try {
      const teacherData = localStorage.getItem('teacher');
      const teacher = teacherData ? JSON.parse(teacherData) : null;
      const teacherName = teacher?.name || null;
      const sectionField = selectedStudentLevel === "حافظ" ? "hifd_section" : "tilawah_section";
      const matchingAttempts = studentExamHistory.filter((record) =>
        (record.exam_kind || "regular") === exam.kind &&
        record.stage_name === exam.stageName &&
        (exam.section ? record[sectionField] === exam.section : record.tamhidi_stage === exam.stageName),
      ).length;
      const nextAttempt = exam.kind === "milestone" ? 100 + matchingAttempts : matchingAttempts + 1;

      if ((exam.kind === "regular" && nextAttempt > 4) || nextAttempt > 199) {
        toast({ title: "تعذر الإرسال", description: "تم بلوغ الحد الأقصى للمحاولات لهذا الاختبار", variant: "destructive" });
        return;
      }

      const insertData: Record<string, string | number | boolean | null> = {
        student_id: selectedStudentId,
        circle_id: selectedCircleId,
        attempt_number: nextAttempt,
        exam_score: null,
        grade: null,
        exam_kind: exam.kind,
        exam_status: "queued",
        stage_name: exam.stageName,
        manual_start: manualInitialExam,
        juz_number: exam.juzNumber,
        exam_date: examDate,
        teacher_name: teacherName
      };

      if (selectedStudentLevel === 'تمهيدي') {
        insertData.tamhidi_stage = exam.stageName;
      } else {
        insertData[sectionField] = exam.section;
      }

      const { error } = await supabase
        .from('student_exams')
        .insert(insertData);

      if (error) {
        console.error('Database error:', error);
        toast({
          title: "خطأ",
          description: "فشل في حفظ نتيجة الاختبار: " + error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "أُرسل الاختبار",
        description: `أُضيف ${exam.label} إلى قائمة انتظار المختبر`,
      });

      resetForm();
    } catch (error) {
      console.error('Error saving exam:', error);
      toast({
        title: "خطأ",
        description: "فشل في حفظ نتيجة الاختبار",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setAttemptNumber("");
    setExamDate(new Date().toISOString().split('T')[0]);
    setExamScore("");
    setGrade("");
    setTajweedScore("");
    setSurahMemoryScore("");
    setNotes("");
    setTamhidiStage("");
    setTilawahSection("");
    setHifdSection("");
    setTafsirScore("");
    setStabilityScore("");
    setShowExamForm(false);
    setSelectedStudentId("");
    setSelectedStudentLevel("");
    setStudentName("");
    setStudentExamHistory([]);
    setRecommendedExam(null);
    setManualInitialExam(false);
    setManualSection("");
  };

  const selectQueueExam = async (exam: QueueExam) => {
    if (!isExaminerView) {
      return;
    }

    if (!resultLabExaminerId) {
      toast({ title: "اختر اسم المختبر", description: "حدد اسمك في نموذج تسجيل النتيجة قبل بدء الاختبار", variant: "destructive" });
      return;
    }

    if (exam.exam_status === "queued") {
      const labExaminer = labExaminers.find((examiner) => examiner.id === resultLabExaminerId);
      if (!labExaminer) {
        toast({ title: "اسم مختبر غير صالح", description: "حدّث الصفحة واختر اسمًا من القائمة", variant: "destructive" });
        return;
      }

      const { data, error } = await supabase
        .from("student_exams")
        .update({
          exam_status: "in_progress",
          lab_examiner_id: labExaminer.id,
          lab_examiner_name: labExaminer.name,
        })
        .eq("id", exam.id)
        .eq("exam_status", "queued")
        .select("id")
        .maybeSingle();
      if (error || !data) {
        toast({ title: "تعذر بدء الاختبار", description: error?.message || "اختار مختبر آخر هذا الطالب للتو", variant: "destructive" });
        await fetchExamQueue();
        return;
      }
      exam = { ...exam, exam_status: "in_progress", lab_examiner_id: labExaminer.id, lab_examiner_name: labExaminer.name };
    } else if (exam.exam_status !== "in_progress" || exam.lab_examiner_id !== resultLabExaminerId) {
      toast({
        title: "الطالب قيد الاختبار",
        description: `بدأ المختبر ${exam.lab_examiner_name || "الآخر"} اختبار هذا الطالب بالفعل`,
        variant: "destructive",
      });
      return;
    }

    setSelectedQueueExam(exam);
    setSelectedStudentLevel(exam.students?.level || "");
    setStudentName(exam.students?.name || "");
    setTamhidiStage(exam.tamhidi_stage || "");
    setExamScore("");
    setGrade("");
    setTajweedScore("");
    setSurahMemoryScore("");
    setTafsirScore("");
    setStabilityScore("");
    setNotes("");
    const { data: completedHistory } = await supabase
      .from("student_exams")
      .select("exam_status, exam_kind, stage_name, manual_start, attempt_number, tamhidi_stage, juz_number, tilawah_section, hifd_section, grade")
      .eq("student_id", exam.student_id)
      .eq("exam_status", "completed");
    const currentAsPassed = { ...exam, exam_status: "completed", grade: "مقبول" };
    setNextAfterCurrentExam(getNextExam(exam.students?.level || "", [...(completedHistory || []), currentAsPassed]));
    await fetchExamQueue();
  };

  const releaseQueueExam = async () => {
    if (!selectedQueueExam) return;

    const { data, error } = await supabase
      .from("student_exams")
      .update({ exam_status: "queued", lab_examiner_id: null, lab_examiner_name: null })
      .eq("id", selectedQueueExam.id)
      .eq("exam_status", "in_progress")
      .eq("lab_examiner_id", resultLabExaminerId)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      toast({ title: "تعذر إعادة الطالب إلى الطابور", description: error?.message || "تحقق من اتصالك ثم حاول مجددًا", variant: "destructive" });
      return;
    }

    setSelectedQueueExam(null);
    await fetchExamQueue();
  };

  const saveQueueResult = async (event: React.FormEvent) => {
    event.preventDefault();
    const labExaminer = labExaminers.find((examiner) => examiner.id === resultLabExaminerId);
    if (!isExaminerView || !selectedQueueExam || !labExaminer || selectedQueueExam.lab_examiner_id !== resultLabExaminerId) {
      toast({ title: "اختر اسم المختبر", description: "يجب اختيار اسم المختبر الذي أجرى الاختبار", variant: "destructive" });
      return;
    }

    if (!selectedQueueExam || !examScore || !grade) {
      toast({ title: "أدخل النتيجة", description: "العلامة مطلوبة قبل إنهاء الاختبار", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("student_exams")
      .update({
        exam_status: "completed",
        lab_examiner_id: labExaminer.id,
        lab_examiner_name: labExaminer.name,
        exam_score: Number(examScore),
        grade,
        tajweed_score: tajweedScore ? Number(tajweedScore) : null,
        surah_memory_score: surahMemoryScore ? Number(surahMemoryScore) : null,
        tafsir_score: tafsirScore ? Number(tafsirScore) : null,
        stability_score: stabilityScore ? Number(stabilityScore) : null,
        notes: notes || null,
      })
      .eq("id", selectedQueueExam.id)
      .eq("exam_status", "in_progress")
      .eq("lab_examiner_id", resultLabExaminerId)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      toast({ title: "فشل حفظ النتيجة", description: error?.message || "لم يعد هذا الاختبار مسندًا إلى المختبر المختار", variant: "destructive" });
      setLoading(false);
      return;
    }

    const examName = getExamDisplayName(selectedQueueExam, selectedStudentLevel);
    const { addExamPoints, addExamRetakePenalty } = await import("@/lib/generalPointsManager");
    if (grade === "إعادة") await addExamRetakePenalty(selectedQueueExam.student_id, selectedQueueExam.exam_date, examName);
    else await addExamPoints(selectedQueueExam.student_id, grade, selectedQueueExam.exam_date, examName);

    toast({ title: "حُفظت النتيجة", description: "تم تحديث سجل الطالب وتحديد اختباره القادم تلقائيًا" });
    setSelectedQueueExam(null);
    setLoading(false);
    await fetchExamQueue();
    if (activeTab === "records") fetchPreviousExams();
  };

  const pageContent = (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
        <TeacherNavbar />
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="islamic-card p-6 mb-8 text-center fade-in-up">
            <BookOpen className="w-12 h-12 text-primary mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-primary mb-2">
              {isExaminerView ? "طابور المختبر" : "إرسال الطلاب للاختبار"}
            </h1>
            <p className="text-muted-foreground">
              {isExaminerView ? "اختر طالبًا من الطابور، ثم سجل اسمك عند تسجيل النتيجة" : "إرسال طلاب حلقاتك إلى طابور الاختبار"}
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl" className="space-y-6">
            <TabsList className="grid w-full grid-cols-1">
              {isExaminerView ? (
                <TabsTrigger value="queue">طابور الاختبارات</TabsTrigger>
              ) : (
                <TabsTrigger value="new">إرسال طالب للاختبار</TabsTrigger>
              )}
            </TabsList>

            {!isExaminerView && <TabsContent value="new">
              {!showExamForm ? (
                <Card className="islamic-card">
                  <CardHeader>
                    <CardTitle className="text-center text-2xl text-primary">اختيار الطالب</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="circle" className="text-right block">اختر الحلقة *</Label>
                        <Select value={selectedCircleId} onValueChange={setSelectedCircleId}>
                          <SelectTrigger className="text-right bg-background">
                            <SelectValue placeholder="اختر الحلقة" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            {circles.map((circle) => (
                              <SelectItem key={circle.id} value={circle.id}>
                                {circle.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="student" className="text-right block">اختر الطالب *</Label>
                        <Select 
                          value={selectedStudentId} 
                          onValueChange={setSelectedStudentId}
                          disabled={!selectedCircleId || students.length === 0}
                        >
                          <SelectTrigger className="text-right bg-background">
                            <SelectValue placeholder={students.length === 0 ? "لا يوجد طلاب في هذه الحلقة" : "اختر الطالب"} />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            {students.map((student) => (
                              <SelectItem key={student.id} value={student.id}>
                                {student.name} - {student.level}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Button 
                        type="button"
                        onClick={handleStudentSelect}
                        className="w-full bg-primary hover:bg-primary/90"
                        disabled={!selectedStudentId}
                      >
                        <UserSearch className="w-4 h-4 ml-2" />
                        إدخال الاختبار
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="islamic-card">
                  <CardHeader>
                    <CardTitle className="text-center text-2xl text-primary">
                      اختبار الطالب: {studentName} - المستوى: {selectedStudentLevel}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <section className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-right">
                        <p className="text-sm text-muted-foreground">الاختبار التالي المحدد تلقائيًا</p>
                        {recommendedExam ? (
                          <>
                            <p className="mt-1 text-xl font-bold text-primary">
                              {manualInitialExam && manualSection
                                ? selectedStudentLevel === "تمهيدي" ? manualSection : `اختبار ${manualSection}`
                                : recommendedExam.label}
                            </p>
                            {recommendedExam.stageName && <p className="mt-1 text-sm">المرحلة: {recommendedExam.stageName}</p>}
                            {manualInitialExam
                              ? <p className="mt-1 text-sm">بداية يدوية، ثم يستمر النظام بالتسلسل تلقائيًا</p>
                              : recommendedExam.kind === "regular" && <p className="mt-1 text-sm">اختبار عادي حسب تسلسل الطالب</p>}
                          </>
                        ) : (
                          <p className="mt-1 font-semibold">أكمل الطالب جميع الاختبارات المحددة لمساره</p>
                        )}
                      </section>

                      {studentExamHistory.length === 0 && recommendedExam && (
                        <div className="space-y-3 rounded-lg border p-4 text-right">
                          <label className="flex min-h-11 items-center gap-3 font-medium">
                            <input
                              type="checkbox"
                              checked={manualInitialExam}
                              onChange={(event) => setManualInitialExam(event.target.checked)}
                              className="h-5 w-5 accent-primary"
                            />
                            تحديد الاختبار يدويًا لأول إرسال
                          </label>
                          {manualInitialExam && (
                            <Select value={manualSection} onValueChange={setManualSection}>
                              <SelectTrigger className="text-right bg-background"><SelectValue /></SelectTrigger>
                              <SelectContent className="bg-background">
                                {selectedStudentLevel === "تمهيدي"
                                  ? ["المرحلة الأولى والثانية", "المرحلة الثالثة", "المرحلة الرابعة", "مرحلة كامل"].map((stage) => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)
                                  : [...[60, 59, 58, 57].map((number) => `الحزب ${number}`), ...Array.from({ length: 28 }, (_, index) => `الجزء ${index + 1}`)].map((section) => <SelectItem key={section} value={section}>{section}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}

                      {/* حقول خاصة بالتمهيدي */}
                      {selectedStudentLevel === 'تمهيدي' && (
                        <div className="hidden space-y-2">
                          <Label htmlFor="tamhidiStage" className="text-right block">المرحلة *</Label>
                          <Select value={tamhidiStage} onValueChange={setTamhidiStage}>
                            <SelectTrigger className="text-right bg-background">
                              <SelectValue placeholder="اختر المرحلة" />
                            </SelectTrigger>
                            <SelectContent className="bg-background z-50">
                              {/* المراحل الأساسية */}
                              <SelectItem value="مرحلة الحروف">مرحلة الحروف</SelectItem>
                              <SelectItem value="مرحلة الحركات">مرحلة الحركات</SelectItem>
                              <SelectItem value="مرحلة السكون">مرحلة السكون</SelectItem>
                              <SelectItem value="مرحلة الشدة">مرحلة الشدة</SelectItem>
                              <SelectItem value="مرحلة التنوين">مرحلة التنوين</SelectItem>
                              <SelectItem value="مرحلة المدود">مرحلة المدود</SelectItem>
                              <SelectItem value="مرحلة همزة الوصل">مرحلة همزة الوصل</SelectItem>
                              <SelectItem value="مرحلة كامل">مرحلة كامل</SelectItem>
                              {/* المراحل كل 5 صفحات */}
                              <SelectItem value="المرحلة الأولى (1-5)">المرحلة الأولى (1-5)</SelectItem>
                              <SelectItem value="المرحلة الثانية (6-10)">المرحلة الثانية (6-10)</SelectItem>
                              <SelectItem value="المرحلة الثالثة (11-15)">المرحلة الثالثة (11-15)</SelectItem>
                              <SelectItem value="المرحلة الرابعة (16-20)">المرحلة الرابعة (16-20)</SelectItem>
                              <SelectItem value="المرحلة الخامسة (21-25)">المرحلة الخامسة (21-25)</SelectItem>
                              <SelectItem value="المرحلة السادسة (26-30)">المرحلة السادسة (26-30)</SelectItem>
                              <SelectItem value="المرحلة السابعة (31-35)">المرحلة السابعة (31-35)</SelectItem>
                              <SelectItem value="المرحلة الثامنة (36-40)">المرحلة الثامنة (36-40)</SelectItem>
                              <SelectItem value="المرحلة التاسعة (41-45)">المرحلة التاسعة (41-45)</SelectItem>
                              <SelectItem value="المرحلة العاشرة (46-50)">المرحلة العاشرة (46-50)</SelectItem>
                              <SelectItem value="المرحلة الحادية عشر (51-55)">المرحلة الحادية عشر (51-55)</SelectItem>
                              <SelectItem value="المرحلة الثانية عشر (56-60)">المرحلة الثانية عشر (56-60)</SelectItem>
                              <SelectItem value="أخرى">أخرى</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* حقول خاصة بالتلاوة */}
                      {selectedStudentLevel === 'تلاوة' && (
                        <div className="hidden space-y-2">
                          <Label htmlFor="tilawahSection" className="text-right block">القسم *</Label>
                          <Select value={tilawahSection} onValueChange={setTilawahSection}>
                            <SelectTrigger className="text-right bg-background">
                              <SelectValue placeholder="اختر القسم" />
                            </SelectTrigger>
                            <SelectContent className="bg-background z-50 max-h-[300px]">
                              {/* الأجزاء من 1 إلى 30 */}
                              {Array.from({ length: 30 }, (_, i) => i + 1).map((num) => (
                                <SelectItem key={`juz-${num}`} value={`الجزء ${num}`}>
                                  الجزء {num}
                                </SelectItem>
                              ))}
                              {/* المراحل كل 5 أجزاء */}
                              <SelectItem value="المرحلة الأولى (1-5)">المرحلة الأولى (1-5)</SelectItem>
                              <SelectItem value="المرحلة الثانية (6-10)">المرحلة الثانية (6-10)</SelectItem>
                              <SelectItem value="المرحلة الثالثة (11-15)">المرحلة الثالثة (11-15)</SelectItem>
                              <SelectItem value="المرحلة الرابعة (16-20)">المرحلة الرابعة (16-20)</SelectItem>
                              <SelectItem value="المرحلة الخامسة (21-25)">المرحلة الخامسة (21-25)</SelectItem>
                              <SelectItem value="المرحلة السادسة (26-30)">المرحلة السادسة (26-30)</SelectItem>
                              {/* الأحزاب الأخيرة */}
                              <SelectItem value="الحزب 57">الحزب 57</SelectItem>
                              <SelectItem value="الحزب 58">الحزب 58</SelectItem>
                              <SelectItem value="الحزب 59">الحزب 59</SelectItem>
                              <SelectItem value="الحزب 60">الحزب 60</SelectItem>
                              {/* السور */}
                              <SelectItem value="عم وتبارك">عم وتبارك</SelectItem>
                              {/* أخرى */}
                              <SelectItem value="أخرى">أخرى</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* حقول خاصة بالحفاظ */}
                      {selectedStudentLevel === 'حافظ' && (
                        <div className="hidden space-y-2">
                          <Label htmlFor="hifdSection" className="text-right block">القسم *</Label>
                          <Select value={hifdSection} onValueChange={setHifdSection}>
                            <SelectTrigger className="text-right bg-background">
                              <SelectValue placeholder="اختر القسم" />
                            </SelectTrigger>
                            <SelectContent className="bg-background z-50 max-h-[300px]">
                              {/* الأجزاء من 1 إلى 30 */}
                              {Array.from({ length: 30 }, (_, i) => i + 1).map((num) => (
                                <SelectItem key={`juz-${num}`} value={`الجزء ${num}`}>
                                  الجزء {num}
                                </SelectItem>
                              ))}
                              {/* المراحل كل 5 أجزاء */}
                              <SelectItem value="المرحلة الأولى (1-5)">المرحلة الأولى (1-5)</SelectItem>
                              <SelectItem value="المرحلة الثانية (6-10)">المرحلة الثانية (6-10)</SelectItem>
                              <SelectItem value="المرحلة الثالثة (11-15)">المرحلة الثالثة (11-15)</SelectItem>
                              <SelectItem value="المرحلة الرابعة (16-20)">المرحلة الرابعة (16-20)</SelectItem>
                              <SelectItem value="المرحلة الخامسة (21-25)">المرحلة الخامسة (21-25)</SelectItem>
                              <SelectItem value="المرحلة السادسة (26-30)">المرحلة السادسة (26-30)</SelectItem>
                              {/* السور */}
                              <SelectItem value="عم وتبارك">عم وتبارك</SelectItem>
                              {/* أخرى */}
                              <SelectItem value="أخرى">أخرى</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* تاريخ الاختبار */}
                      <div className="space-y-2">
                        <Label htmlFor="examDate" className="text-right block">تاريخ الاختبار *</Label>
                        <Input
                          id="examDate"
                          type="date"
                          value={examDate}
                          onChange={(e) => setExamDate(e.target.value)}
                          className="text-right"
                        />
                      </div>

                      {/* رقم المحاولة */}
                      <div className="hidden space-y-2">
                        <Label htmlFor="attemptNumber" className="text-right block">رقم المحاولة *</Label>
                        <Select value={attemptNumber} onValueChange={setAttemptNumber}>
                          <SelectTrigger className="text-right bg-background">
                            <SelectValue placeholder="اختر رقم المحاولة" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="1">المحاولة الأولى</SelectItem>
                            <SelectItem value="2">المحاولة الثانية</SelectItem>
                            <SelectItem value="3">المحاولة الثالثة</SelectItem>
                            <SelectItem value="4">المحاولة الرابعة</SelectItem>
                            <SelectItem value="100">المرحلة</SelectItem>
                            {selectedStudentLevel === 'حافظ' && (
                              <SelectItem value="200">التثبيت</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="hidden border-t pt-6 space-y-4">
                        <h3 className="text-lg font-bold text-primary text-right">النتيجة</h3>
                        
                        {/* رسالة توضيحية عن سلم التقديرات */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-right">
                          <p className="text-sm font-semibold text-blue-900 mb-2">📊 سلم التقديرات حسب المستوى:</p>
                          {selectedStudentLevel === "تمهيدي" && (
                            <div className="text-xs text-blue-800 space-y-1">
                              <p>• شرف: 100 | تفوق:98-99 | ممتاز: 97-96</p>
                              <p>• جيد جداً: 95-94 | جيد: 93-92 | مقبول: 90-91</p>
                            </div>
                          )}
                          {selectedStudentLevel === "حافظ" && (
                            <div className="text-xs text-blue-800 space-y-1">
                              <p>• شرف: 100 | تفوق: 97-99 | ممتاز: 96-94</p>
                              <p>• جيد جداً: 93-90 | جيد: 85-89 | مقبول: 81-80</p>
                            </div>
                          )}
                          {selectedStudentLevel === "تلاوة" && (
                            <div className="text-xs text-blue-800 space-y-1">
                              <p>• شرف: 100 | تفوق: 98-99 | ممتاز: 95-97</p>
                              <p>• جيد جداً: 92-94 | جيد: 89-91 | مقبول: 85-88</p>
                            </div>
                          )}
                          <p className="text-xs text-blue-700 mt-2 italic">* التقدير يُحسب تلقائياً عند إدخال العلامة</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* العلامة */}
                          <div className="space-y-2">
                            <Label htmlFor="examScore" className="text-right block">العلامة *</Label>
                            <Input
                              id="examScore"
                              type="number"
                              step="0.5"
                              min="0"
                              max="100"
                              value={examScore}
                              onChange={(e) => setExamScore(e.target.value)}
                              placeholder="أدخل العلامة"
                              className="text-right"
                            />
                          </div>

                          {/* التقييم - يتم حسابه تلقائياً */}
                          <div className="space-y-2">
                            <Label htmlFor="grade" className="text-right block">التقييم (تلقائي)</Label>
                            <Input
                              id="grade"
                              type="text"
                              value={grade}
                              readOnly
                              disabled
                              placeholder="يتم حسابه تلقائياً"
                              className="text-right bg-muted"
                            />
                          </div>

                          {/* علامة التجويد النظري (اختيارية) */}
                          <div className="space-y-2">
                            <Label htmlFor="tajweedScore" className="text-right block">علامة التجويد النظري (من 10) - اختياري</Label>
                            <Input
                              id="tajweedScore"
                              type="number"
                              step="0.5"
                              min="0"
                              max="10"
                              value={tajweedScore}
                              onChange={(e) => setTajweedScore(e.target.value)}
                              placeholder="أدخل علامة التجويد"
                              className="text-right"
                            />
                          </div>

                          {/* علامة حفظ السور (اختيارية) */}
                          <div className="space-y-2">
                            <Label htmlFor="surahMemoryScore" className="text-right block">علامة حفظ السور (من 10) - اختياري</Label>
                            <Input
                              id="surahMemoryScore"
                              type="number"
                              step="0.5"
                              min="0"
                              max="10"
                              value={surahMemoryScore}
                              onChange={(e) => setSurahMemoryScore(e.target.value)}
                              placeholder="أدخل علامة حفظ السور"
                              className="text-right"
                            />
                          </div>

                          {/* علامة التفسير للتلاوة (اختيارية) */}
                          {selectedStudentLevel === 'تلاوة' && (
                            <div className="space-y-2">
                              <Label htmlFor="tafsirScore" className="text-right block">علامة التفسير (من 10) - اختياري</Label>
                              <Input
                                id="tafsirScore"
                                type="number"
                                step="0.5"
                                min="0"
                                max="10"
                                value={tafsirScore}
                                onChange={(e) => setTafsirScore(e.target.value)}
                                placeholder="أدخل علامة التفسير"
                                className="text-right"
                              />
                            </div>
                          )}

                          {/* علامة الثبات للحفاظ (اختيارية) */}
                          {selectedStudentLevel === 'حافظ' && (
                            <div className="space-y-2">
                              <Label htmlFor="stabilityScore" className="text-right block">علامة الثبات (من 10) - اختياري</Label>
                              <Input
                                id="stabilityScore"
                                type="number"
                                step="0.5"
                                min="0"
                                max="10"
                                value={stabilityScore}
                                onChange={(e) => setStabilityScore(e.target.value)}
                                placeholder="أدخل علامة الثبات"
                                className="text-right"
                              />
                            </div>
                          )}
                        </div>

                        {/* ملاحظات */}
                        <div className="space-y-2">
                          <Label htmlFor="notes" className="text-right block">ملاحظات</Label>
                          <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="أدخل ملاحظات حول الاختبار"
                            className="text-right"
                            rows={3}
                          />
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <Button 
                          type="button"
                          onClick={resetForm}
                          variant="outline"
                          className="flex-1"
                        >
                          إلغاء
                        </Button>
                        <Button 
                          type="submit" 
                          className="flex-1 bg-primary hover:bg-primary/90"
                          disabled={loading || !recommendedExam}
                        >
                          <Save className="w-4 h-4 ml-2" />
                          {loading ? "جارٍ الإرسال..." : "إرسال الاختبار إلى الطابور"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}
            </TabsContent>}

            {isExaminerView && <TabsContent value="queue" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
                <Card className={selectedQueueExam ? "order-2 lg:order-1" : "order-1"}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-right">قائمة انتظار الاختبارات</CardTitle>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-muted px-3 py-1 text-sm font-semibold">{examQueue.length} اختبار</span>
                        <Button type="button" variant="outline" size="icon" onClick={fetchExamQueue} aria-label="تحديث قائمة الانتظار"><RefreshCw className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {loadingQueue ? (
                      <p className="py-8 text-center text-muted-foreground">جارٍ تحميل القائمة...</p>
                    ) : examQueue.length === 0 ? (
                      <div className="py-10 text-center text-muted-foreground">
                        <ListOrdered className="mx-auto mb-3 h-8 w-8" />
                        لا توجد اختبارات بانتظار التسجيل
                      </div>
                    ) : examQueue.map((exam, index) => (
                      <button
                        key={exam.id}
                        type="button"
                        onClick={() => selectQueueExam(exam)}
                        disabled={
                          !resultLabExaminerId ||
                          (!!selectedQueueExam && selectedQueueExam.id !== exam.id) ||
                          (exam.exam_status === "in_progress" && exam.lab_examiner_id !== resultLabExaminerId)
                        }
                        className={`w-full rounded-lg border p-4 text-right transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${selectedQueueExam?.id === exam.id ? "border-primary bg-primary/5" : "bg-background enabled:hover:border-primary/50 enabled:hover:bg-muted/40"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{index + 1}</span>
                            <div className="min-w-0">
                              <p className="truncate font-bold">{exam.students?.name || "طالب غير محدد"}</p>
                              <p className="mt-1 text-sm font-semibold text-primary">{getExamDisplayName(exam, exam.students?.level || "")}</p>
                            </div>
                          </div>
                          <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${exam.exam_status === "in_progress" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}`}>
                            {exam.exam_status === "in_progress" ? "قيد الاختبار" : "بانتظار البدء"}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
                          <span>الحلقة: {exam.students?.circles?.name || "غير محددة"}</span>
                          <span>الأستاذ: {exam.teacher_name || "غير محدد"}</span>
                          <span>المختبر: {exam.exam_status === "in_progress" ? exam.lab_examiner_name || "غير محدد" : "متاح"}</span>
                          <span>المستوى: {exam.students?.level || "غير محدد"}</span>
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                <Card className={`self-start ${selectedQueueExam ? "order-1 lg:order-2" : "order-2"}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-right">تسجيل النتيجة</CardTitle>
                    {selectedQueueExam && <Button type="button" variant="outline" size="sm" onClick={releaseQueueExam}><X className="ml-1 h-4 w-4" />إعادة إلى الطابور</Button>}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 space-y-2">
                      <Label htmlFor="result-lab-examiner">اسم المختبر لتسجيل النتيجة *</Label>
                      <Select value={resultLabExaminerId} onValueChange={setResultLabExaminerId} disabled={!!selectedQueueExam}>
                        <SelectTrigger id="result-lab-examiner" className="text-right">
                          <SelectValue placeholder={labExaminers.length === 0 ? "لا يوجد مختبرون" : "اختر اسمك"} />
                        </SelectTrigger>
                        <SelectContent>
                          {labExaminers.map((examiner) => (
                            <SelectItem key={examiner.id} value={examiner.id}>{examiner.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedQueueExam ? (
                      <form onSubmit={saveQueueResult} className="space-y-4">
                        <div className="rounded-lg bg-muted/60 p-3 text-right">
                          <p className="font-bold">{studentName}</p>
                          <p className="text-sm text-muted-foreground">{getExamDisplayName(selectedQueueExam, selectedStudentLevel)} · {selectedQueueExam.students?.circles?.name || "حلقة غير محددة"}</p>
                          {nextAfterCurrentExam && (
                            <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">التالي عند الاجتياز: <span className="font-semibold text-foreground">{nextAfterCurrentExam.label}</span></p>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor="queue-score">العلامة من 100</Label>
                            <Input id="queue-score" type="number" min="0" max="100" step="0.5" inputMode="decimal" value={examScore} onChange={(event) => setExamScore(event.target.value)} required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="queue-grade">التقدير</Label>
                            <Input id="queue-grade" value={grade} readOnly className="bg-muted" placeholder="يُحسب تلقائيًا" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="queue-tajweed">التجويد / 10</Label>
                            <Input id="queue-tajweed" type="number" min="0" max="10" step="0.5" inputMode="decimal" value={tajweedScore} onChange={(event) => setTajweedScore(event.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="queue-memory">حفظ السور / 10</Label>
                            <Input id="queue-memory" type="number" min="0" max="10" step="0.5" inputMode="decimal" value={surahMemoryScore} onChange={(event) => setSurahMemoryScore(event.target.value)} />
                          </div>
                          {selectedStudentLevel === "تلاوة" && (
                            <div className="space-y-2">
                              <Label htmlFor="queue-tafsir">التفسير / 10</Label>
                              <Input id="queue-tafsir" type="number" min="0" max="10" step="0.5" inputMode="decimal" value={tafsirScore} onChange={(event) => setTafsirScore(event.target.value)} />
                            </div>
                          )}
                          {selectedStudentLevel === "حافظ" && (
                            <div className="space-y-2">
                              <Label htmlFor="queue-stability">الثبات / 10</Label>
                              <Input id="queue-stability" type="number" min="0" max="10" step="0.5" inputMode="decimal" value={stabilityScore} onChange={(event) => setStabilityScore(event.target.value)} />
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="queue-notes">ملاحظات</Label>
                          <Textarea id="queue-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
                        </div>
                        <Button type="submit" className="min-h-12 w-full" disabled={loading || !grade}>
                          <Check className="ml-2 h-4 w-4" />
                          {loading ? "جارٍ حفظ النتيجة..." : "حفظ النتيجة وإنهاء الاختبار"}
                        </Button>
                      </form>
                    ) : (
                      <div className="py-10 text-center text-sm text-muted-foreground">
                        <Play className="mx-auto mb-3 h-8 w-8" />
                        اختر طالبًا من القائمة لبدء الاختبار وتسجيل نتيجته
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>}

            {!isExaminerView && <TabsContent value="records">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center flex-wrap gap-4">
                    <CardTitle className="text-right">سجل الاختبارات</CardTitle>
                    <div className="flex gap-4 items-center flex-wrap">
                      <div className="w-64">
                        <Input
                          type="text"
                          placeholder="🔍 البحث عن طالب..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="text-right"
                        />
                      </div>
                      <div className="w-64">
                        <Select value={filterCircleId} onValueChange={setFilterCircleId}>
                          <SelectTrigger className="text-right bg-background">
                            <SelectValue placeholder="فلترة حسب الحلقة" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="all">جميع الحلقات</SelectItem>
                            {circles.map((circle) => (
                              <SelectItem key={circle.id} value={circle.id}>
                                {circle.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto" dir="rtl">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">#</TableHead>
                          <TableHead className="text-right">التاريخ</TableHead>
                          <TableHead className="text-right">الطالب</TableHead>
                          <TableHead className="text-right">المستوى</TableHead>
                          <TableHead className="text-right">الحلقة</TableHead>
                          <TableHead className="text-right">القسم/المرحلة</TableHead>
                          <TableHead className="text-right">المحاولة</TableHead>
                          <TableHead className="text-right">العلامة</TableHead>
                          <TableHead className="text-right">التقييم</TableHead>
                          <TableHead className="text-right">التجويد</TableHead>
                          <TableHead className="text-right">حفظ السور</TableHead>
                          <TableHead className="text-right">إضافي</TableHead>
                          <TableHead className="text-right">ملاحظات</TableHead>
                          <TableHead className="text-right">إجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loadingExams ? (
                          <TableRow>
                            <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                              جاري تحميل السجلات...
                            </TableCell>
                          </TableRow>
                        ) : filteredExams.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                              لا توجد سجلات اختبارات
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredExams.map((exam, index) => (
                            <TableRow key={exam.id}>
                              <TableCell className="text-right font-bold text-primary">
                                {index + 1}
                              </TableCell>
                              <TableCell className="text-right">
                                {new Date(exam.exam_date).toLocaleDateString('ar-EG')}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {exam.student_name}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                  {exam.student_level}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">{exam.circle_name}</TableCell>
                              <TableCell className="text-right font-medium">
                                {getExamSection(exam)}
                              </TableCell>
                              <TableCell className="text-right">{exam.attempt_number}</TableCell>
                              <TableCell className="text-right">
                                {exam.exam_score !== null ? exam.exam_score : '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  exam.grade === 'ممتاز' ? 'bg-green-100 text-green-800' :
                                  exam.grade === 'جيد جداً' ? 'bg-blue-100 text-blue-800' :
                                  exam.grade === 'جيد' ? 'bg-yellow-100 text-yellow-800' :
                                  exam.grade === 'مقبول' ? 'bg-orange-100 text-orange-800' :
                                  exam.grade === 'إعادة' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {exam.grade || '-'}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                {exam.tajweed_score !== null ? `${exam.tajweed_score}/10` : '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                {exam.surah_memory_score !== null ? `${exam.surah_memory_score}/10` : '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                {exam.student_level === 'تلاوة' && exam.tafsir_score !== null ? (
                                  <span className="text-xs">تفسير: {exam.tafsir_score}/10</span>
                                ) : exam.student_level === 'حافظ' && exam.stability_score !== null ? (
                                  <span className="text-xs">ثبات: {exam.stability_score}/10</span>
                                ) : '-'}
                              </TableCell>
                              <TableCell className="text-right max-w-xs truncate">
                                {exam.notes || '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditClick(exam)}
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteClick(exam.id)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>}
          </Tabs>

          {/* Edit Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-right">تعديل بيانات الاختبار</DialogTitle>
                <DialogDescription className="text-right">
                  قم بتعديل بيانات الاختبار للطالب: {examToEdit?.student_name}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="exam_date" className="text-right">تاريخ الاختبار</Label>
                  <Input
                    id="exam_date"
                    type="date"
                    value={editFormData.exam_date || ''}
                    onChange={(e) => setEditFormData({...editFormData, exam_date: e.target.value})}
                    className="text-right"
                  />
                </div>

                {examToEdit?.student_level === 'حافظ' && (
                  <div className="grid gap-2">
                    <Label htmlFor="juz_number" className="text-right">رقم الجزء</Label>
                    <Input
                      id="juz_number"
                      type="number"
                      min="1"
                      max="30"
                      value={editFormData.juz_number || ''}
                      onChange={(e) => setEditFormData({...editFormData, juz_number: parseInt(e.target.value) || null})}
                      className="text-right"
                    />
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="attempt_number" className="text-right">رقم المحاولة</Label>
                  <Input
                    id="attempt_number"
                    type="number"
                    min="1"
                    value={editFormData.attempt_number || 1}
                    onChange={(e) => setEditFormData({...editFormData, attempt_number: parseInt(e.target.value) || 1})}
                    className="text-right"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="exam_score" className="text-right">العلامة الكلية</Label>
                  <Input
                    id="exam_score"
                    type="number"
                    min="0"
                    max="100"
                    value={editFormData.exam_score || ''}
                    onChange={(e) => setEditFormData({...editFormData, exam_score: parseFloat(e.target.value) || null})}
                    className="text-right"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="grade" className="text-right">التقييم</Label>
                  <Select 
                    value={editFormData.grade || ''} 
                    onValueChange={(value) => setEditFormData({...editFormData, grade: value})}
                  >
                    <SelectTrigger className="text-right">
                      <SelectValue placeholder="اختر التقييم" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ممتاز">ممتاز</SelectItem>
                      <SelectItem value="جيد جداً">جيد جداً</SelectItem>
                      <SelectItem value="جيد">جيد</SelectItem>
                      <SelectItem value="مقبول">مقبول</SelectItem>
                      <SelectItem value="إعادة">إعادة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="tajweed_score" className="text-right">التجويد النظري (من 10)</Label>
                  <Input
                    id="tajweed_score"
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={editFormData.tajweed_score || ''}
                    onChange={(e) => setEditFormData({...editFormData, tajweed_score: parseFloat(e.target.value) || null})}
                    className="text-right"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="surah_memory_score" className="text-right">حفظ السور (من 10)</Label>
                  <Input
                    id="surah_memory_score"
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={editFormData.surah_memory_score || ''}
                    onChange={(e) => setEditFormData({...editFormData, surah_memory_score: parseFloat(e.target.value) || null})}
                    className="text-right"
                  />
                </div>

                {examToEdit?.student_level === 'تلاوة' && (
                  <div className="grid gap-2">
                    <Label htmlFor="tafsir_score" className="text-right">التفسير (من 10)</Label>
                    <Input
                      id="tafsir_score"
                      type="number"
                      min="0"
                      max="10"
                      step="0.5"
                      value={editFormData.tafsir_score || ''}
                      onChange={(e) => setEditFormData({...editFormData, tafsir_score: parseFloat(e.target.value) || null})}
                      className="text-right"
                    />
                  </div>
                )}

                {examToEdit?.student_level === 'حافظ' && (
                  <div className="grid gap-2">
                    <Label htmlFor="stability_score" className="text-right">الثبات (من 10)</Label>
                    <Input
                      id="stability_score"
                      type="number"
                      min="0"
                      max="10"
                      step="0.5"
                      value={editFormData.stability_score || ''}
                      onChange={(e) => setEditFormData({...editFormData, stability_score: parseFloat(e.target.value) || null})}
                      className="text-right"
                    />
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="notes" className="text-right">ملاحظات</Label>
                  <Textarea
                    id="notes"
                    value={editFormData.notes || ''}
                    onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                    className="text-right min-h-[100px]"
                    placeholder="أضف ملاحظات إضافية..."
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  <X className="w-4 h-4 ml-2" />
                  إلغاء
                </Button>
                <Button onClick={handleEditSave} className="bg-primary">
                  <Save className="w-4 h-4 ml-2" />
                  حفظ التعديلات
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Dialog */}
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-right">تأكيد الحذف</AlertDialogTitle>
                <AlertDialogDescription className="text-right">
                  هل أنت متأكد من حذف سجل الاختبار هذا؟ لا يمكن التراجع عن هذا الإجراء.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex gap-2">
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteConfirm}
                  className="bg-red-600 hover:bg-red-700"
                >
                  حذف
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </main>
      </div>
  );

  return isExaminerView ? pageContent : <ProtectedTeacherRoute>{pageContent}</ProtectedTeacherRoute>;
};

export default ExamManagement;
