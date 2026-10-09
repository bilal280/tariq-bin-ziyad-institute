import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Save, RefreshCw, User, UserCheck, UserX, ShieldCheck, Plus, BookOpen } from "lucide-react";
import TeacherNavbar from "@/components/TeacherNavbar";
import ProtectedTeacherRoute from "@/components/ProtectedTeacherRoute";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { getEffectiveDate } from "@/lib/utils";
import { manageStudentAttendance } from "@/lib/attendanceManager";

interface Student {
  id: string;
  name: string;
  level: string;
  photo_url?: string;
  student_number?: number;
}

interface Circle {
  id: string;
  name: string;
}

interface BeginnerRecitation {
  pageNumber: string;
  selectedLines: number[];
  grade: string;
}

interface RegularRecitation {
  pageNumbers: string; // أرقام الصفحات مفصولة بفواصل (مثل: 201,202,203)
  grade: string;
}

interface StudentData {
  // للطلاب العاديين - دعم صفحات متعددة
  regularRecitations: RegularRecitation[];
  reviewPages: string;
  reviewGrade: string;
  behaviorGrade: string;
  notes: string;
  // للطلاب التمهيديين - دعم صفحات متعددة
  beginnerRecitations: BeginnerRecitation[];
  // الحضور
  attendance: 'present' | 'absent' | 'excused' | null;
}

const normalizeGrade = (grade: string | null | undefined) => grade === 'مقبول' ? '' : grade || '';

const normalizeAttendance = (status: unknown): StudentData['attendance'] =>
  status === 'present' || status === 'absent' || status === 'excused' ? status : null;

const QuickDataEntry = () => {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentData, setStudentData] = useState<Record<string, StudentData>>({});
  const [lastPages, setLastPages] = useState<Record<string, string>>({}); // آخر صفحة لكل طالب
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingTodayData, setLoadingTodayData] = useState(false);
  const [dataWasLoaded, setDataWasLoaded] = useState(false); // لتتبع ما إذا تم تحميل البيانات
  const isMobile = useIsMobile();
  const { toast } = useToast();

  // حفظ تلقائي في LocalStorage
  useEffect(() => {
    if (Object.keys(studentData).length > 0) {
      const today = getEffectiveDate();
      localStorage.setItem(getStorageKey(today), JSON.stringify(studentData));
      console.log('✅ تم حفظ البيانات تلقائياً في LocalStorage');
    }
  }, [studentData, selectedCircleId]);

  useEffect(() => {
    fetchStudents();
  }, []);

  const getStorageKey = (date: string) => `quickEntry_${selectedCircleId || 'unknown'}_${date}`;

  const fetchStudents = async (circleId?: string) => {
    try {
      const teacherData = localStorage.getItem('teacher');
      if (!teacherData) return;
      
      const teacher = JSON.parse(teacherData);

      const { data: circles } = await supabase
        .from('circles')
        .select('id, name')
        .eq('teacher_id', teacher.id)
        .order('name');

      const teacherCircles = circles || [];
      setCircles(teacherCircles);

      const activeCircleId = circleId || (teacherCircles.length === 1 ? teacherCircles[0].id : null);
      if (!activeCircleId) {
        setLoading(false);
        return;
      }

      setSelectedCircleId(activeCircleId);

      const { data, error } = await supabase
        .from('students')
        .select('id, name, level, photo_url, student_number')
        .eq('circle_id', activeCircleId)
        .order('name');

      if (error) throw error;

      // استثناء المنقطعين
      const { data: discontinuedStudents } = await supabase
        .from('discontinued_students')
        .select('id');
      
      const discontinuedIds = new Set(discontinuedStudents?.map(s => s.id) || []);
      const activeStudents = data?.filter(s => !discontinuedIds.has(s.id)) || [];

      setStudents(activeStudents);

      // تهيئة البيانات وجلب الحضور اليوم
      const today = getEffectiveDate();
      const { data: attendanceData } = await supabase
        .from('student_attendance')
        .select('student_id, status')
        .eq('date', today)
        .in('student_id', activeStudents.map(s => s.id));

      const attendanceMap = new Map(attendanceData?.map(a => [a.student_id, normalizeAttendance(a.status)]) || []);

      // التحقق من وجود بيانات محفوظة قبل التهيئة
      const savedData = localStorage.getItem(getStorageKey(today));
      let initialData: Record<string, StudentData> = {};

      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          // استخدام البيانات المحفوظة إذا وجدت
          initialData = parsed;
          console.log('✅ استخدام البيانات المحفوظة من LocalStorage');
        } catch (error) {
          console.error('Error parsing saved data:', error);
          localStorage.removeItem(getStorageKey(today));
        }
      }

      // إضافة الطلاب الجدد أو المفقودين
      activeStudents.forEach(student => {
        if (!initialData[student.id]) {
          initialData[student.id] = {
            regularRecitations: [{ pageNumbers: '', grade: '' }],
            reviewPages: '',
            reviewGrade: '',
            behaviorGrade: '',
            notes: '',
            beginnerRecitations: [{ pageNumber: '', selectedLines: [], grade: '' }],
            attendance: attendanceMap.get(student.id) || null
          };
        } else {
          // تحديث حالة الحضور من قاعدة البيانات
          initialData[student.id].attendance = attendanceMap.get(student.id) || normalizeAttendance(initialData[student.id].attendance);
        }

        const data = initialData[student.id];
        data.regularRecitations = (data.regularRecitations || []).map(rec => ({ ...rec, grade: normalizeGrade(rec.grade) }));
        data.beginnerRecitations = (data.beginnerRecitations || []).map(rec => ({ ...rec, grade: normalizeGrade(rec.grade) }));
        data.reviewGrade = normalizeGrade(data.reviewGrade);
        data.behaviorGrade = normalizeGrade(data.behaviorGrade);
        if (!data.behaviorGrade && data.attendance !== 'absent' && data.attendance !== 'excused') {
          data.behaviorGrade = 'ممتاز';
        }
      });

      setStudentData(initialData);
      
      // جلب آخر صفحة سمّعها كل طالب
      fetchLastPages(activeStudents);
      
      // إظهار رسالة إذا كانت هناك بيانات محفوظة
      if (savedData) {
        toast({
          title: "📥 تم استرجاع البيانات",
          description: "تم استرجاع البيانات المحفوظة مسبقاً. يمكنك المتابعة من حيث توقفت.",
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل الطلاب",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCircleSelect = (circleId: string) => {
    setSelectedCircleId(circleId);
    setStudents([]);
    setStudentData({});
    setLoading(true);
    fetchStudents(circleId);
  };

  const handleChangeCircle = () => {
    setSelectedCircleId(null);
    setStudents([]);
    setStudentData({});
  };

  // دالة لجلب آخر صفحة سمّعها كل طالب
  const fetchLastPages = async (students: Student[]) => {
    try {
      const lastPagesMap: Record<string, string> = {};
      
      for (const student of students) {
        if (student.level === 'تمهيدي') {
          // للطلاب التمهيديين - جلب آخر صفحة من student_beginner_recitations
          const { data } = await supabase
            .from('student_beginner_recitations')
            .select('page_number')
            .eq('student_id', student.id)
            .order('date', { ascending: false })
            .order('page_number', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (data) {
            lastPagesMap[student.id] = data.page_number.toString();
          }
        } else {
          // للطلاب العاديين - جلب آخر صفحات من student_daily_work
          const { data } = await supabase
            .from('student_daily_work')
            .select('new_recitation_page_numbers')
            .eq('student_id', student.id)
            .not('new_recitation_page_numbers', 'is', null)
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (data && data.new_recitation_page_numbers) {
            // أخذ آخر رقم من الصفحات
            const pages = data.new_recitation_page_numbers.split(',').map((p: string) => p.trim());
            const lastPage = pages[pages.length - 1];
            lastPagesMap[student.id] = lastPage;
          }
        }
      }
      
      setLastPages(lastPagesMap);
      setStudentData(prev => {
        const updated = { ...prev };
        students.forEach(student => {
          const lastPage = lastPagesMap[student.id];
          const data = updated[student.id];
          if (!lastPage || !data) return;

          if (student.level === 'تمهيدي') {
            updated[student.id] = {
              ...data,
              beginnerRecitations: data.beginnerRecitations.map((rec, index) =>
                index === 0 && !rec.pageNumber ? { ...rec, pageNumber: lastPage } : rec
              )
            };
          } else {
            updated[student.id] = {
              ...data,
              regularRecitations: data.regularRecitations.map((rec, index) =>
                index === 0 && !rec.pageNumbers ? { ...rec, pageNumbers: lastPage } : rec
              )
            };
          }
        });
        return updated;
      });
    } catch (error) {
      console.error('Error fetching last pages:', error);
    }
  };

  // دالة لحساب "اليوم الفعلي" بناءً على الساعة
  // تم نقلها إلى utils.ts

  const loadTodayData = async () => {
    setLoadingTodayData(true);
    try {
      const today = getEffectiveDate();

      // جلب بيانات اليوم للطلاب العاديين
      const { data: dailyWorkData } = await supabase
        .from('student_daily_work')
        .select('*')
        .eq('date', today)
        .in('student_id', students.map(s => s.id));

      // جلب بيانات التمهيديين
      const { data: beginnerData } = await supabase
        .from('student_beginner_recitations')
        .select('*')
        .eq('date', today)
        .in('student_id', students.map(s => s.id));

      const updatedData = { ...studentData };

      students.forEach(student => {
        const work = dailyWorkData?.find(w => w.student_id === student.id);
        
        if (student.level === 'تمهيدي') {
          const studentBeginnerWork = beginnerData?.filter(b => b.student_id === student.id) || [];
          
          if (studentBeginnerWork.length > 0) {
            updatedData[student.id].beginnerRecitations = studentBeginnerWork.map(b => ({
              pageNumber: b.page_number.toString(),
              selectedLines: b.line_numbers ? b.line_numbers.split(',').map((n: string) => parseInt(n.trim())) : [],
              grade: normalizeGrade(b.grade)
            }));
          }
          
          if (work) {
            updatedData[student.id].behaviorGrade = normalizeGrade(work.behavior_grade);
            updatedData[student.id].notes = work.teacher_notes || '';
          }
        } else {
          if (work) {
            // تحويل أرقام الصفحات إلى تسميعات
            if (work.new_recitation_page_numbers) {
              updatedData[student.id].regularRecitations = [{
                pageNumbers: work.new_recitation_page_numbers,
                  grade: normalizeGrade(work.new_recitation_grade)
              }];
            }
            
            updatedData[student.id].reviewPages = work.review_pages?.toString() || '';
              updatedData[student.id].reviewGrade = normalizeGrade(work.review_grade);
              updatedData[student.id].behaviorGrade = normalizeGrade(work.behavior_grade);
            updatedData[student.id].notes = work.teacher_notes || '';
          }
        }
      });

      students.forEach(student => {
        const data = updatedData[student.id];
        if (!data.behaviorGrade && data.attendance !== 'absent' && data.attendance !== 'excused') {
          data.behaviorGrade = 'ممتاز';
        }
      });

      setStudentData(updatedData);
      setDataWasLoaded(true); // تم تحميل البيانات

      toast({
        title: "تم التحميل",
        description: "تم تحميل بيانات اليوم بنجاح",
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل بيانات اليوم",
        variant: "destructive",
      });
    } finally {
      setLoadingTodayData(false);
    }
  };

  const updateStudentData = (studentId: string, field: keyof StudentData, value: string | number[]) => {
    // التحقق من صحة أرقام صفحات المراجعة
    if (field === 'reviewPages' && typeof value === 'string') {
      // السماح فقط بالأرقام والفواصل والمسافات
      const validPattern = /^[0-9,\s]*$/;
      if (!validPattern.test(value)) {
        toast({
          title: "إدخال غير صحيح",
          description: "يُسمح فقط بالأرقام والفواصل (مثل: 1,2,3)",
          variant: "destructive",
        });
        return;
      }
    }

    setStudentData(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
  };

  const getNextPageNumber = (studentId: string, currentPageEntries: string[]) => {
    const recordedPage = Number.parseInt(lastPages[studentId] || '', 10);
    const enteredPages = currentPageEntries.flatMap(value => (value.match(/\d+/g) || []).map(Number));
    const knownPages = [recordedPage, ...enteredPages].filter(Number.isFinite);
    return knownPages.length > 0 ? String(Math.max(...knownPages) + 1) : '';
  };

  // للطلاب العاديين
  const addRegularRecitation = (studentId: string) => {
    setStudentData(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        regularRecitations: [
          ...prev[studentId].regularRecitations,
          { pageNumbers: getNextPageNumber(studentId, prev[studentId].regularRecitations.map(rec => rec.pageNumbers)), grade: '' }
        ]
      }
    }));
  };

  const removeRegularRecitation = (studentId: string, index: number) => {
    setStudentData(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        regularRecitations: prev[studentId].regularRecitations.filter((_, i) => i !== index)
      }
    }));
  };

  const updateRegularRecitation = (studentId: string, index: number, field: keyof RegularRecitation, value: any) => {
    // التحقق من صحة أرقام الصفحات
    if (field === 'pageNumbers') {
      // السماح فقط بالأرقام والفواصل والمسافات والشرطة
      const validPattern = /^[0-9,\s-]*$/;
      if (!validPattern.test(value)) {
        toast({
          title: "إدخال غير صحيح",
          description: "يُسمح فقط بالأرقام والفواصل والشرطة (مثل: 10-15 أو 201,202)",
          variant: "destructive",
        });
        return;
      }
    }

    setStudentData(prev => {
      const updated = [...prev[studentId].regularRecitations];
      updated[index] = { ...updated[index], [field]: value };
      return {
        ...prev,
        [studentId]: {
          ...prev[studentId],
          regularRecitations: updated
        }
      };
    });
  };

  // دالة لتوسيع النطاقات عند الانتهاء من الكتابة
  const expandPageRanges = (studentId: string, index: number) => {
    const rec = studentData[studentId].regularRecitations[index];
    if (!rec.pageNumbers) return;

    let value = rec.pageNumbers;
    
    // البحث عن نطاقات (مثل 10-15)
    const rangePattern = /(\d+)\s*-\s*(\d+)/g;
    const ranges = [...value.matchAll(rangePattern)];
    
    if (ranges.length > 0) {
      let expandedPages: string[] = [];
      let remainingText = value;
      
      ranges.forEach(match => {
        const start = parseInt(match[1]);
        const end = parseInt(match[2]);
        
        if (start <= end) {
          // توليد جميع الأرقام في النطاق
          for (let i = start; i <= end; i++) {
            expandedPages.push(i.toString());
          }
        }
        
        // إزالة النطاق من النص
        remainingText = remainingText.replace(match[0], '');
      });
      
      // إضافة أي أرقام أخرى موجودة
      const otherPages = remainingText.split(',')
        .map(p => p.trim())
        .filter(p => p && /^\d+$/.test(p));
      
      expandedPages = [...expandedPages, ...otherPages];
      const processedValue = expandedPages.join(',');
      
      // تحديث القيمة
      setStudentData(prev => {
        const updated = [...prev[studentId].regularRecitations];
        updated[index] = { ...updated[index], pageNumbers: processedValue };
        return {
          ...prev,
          [studentId]: {
            ...prev[studentId],
            regularRecitations: updated
          }
        };
      });
    }
  };

  // للطلاب التمهيديين
  const addBeginnerRecitation = (studentId: string) => {
    setStudentData(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        beginnerRecitations: [
          ...prev[studentId].beginnerRecitations,
          { pageNumber: getNextPageNumber(studentId, prev[studentId].beginnerRecitations.map(rec => rec.pageNumber)), selectedLines: [], grade: '' }
        ]
      }
    }));
  };

  const removeBeginnerRecitation = (studentId: string, index: number) => {
    setStudentData(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        beginnerRecitations: prev[studentId].beginnerRecitations.filter((_, i) => i !== index)
      }
    }));
  };

  const updateBeginnerRecitation = (studentId: string, index: number, field: keyof BeginnerRecitation, value: any) => {
    setStudentData(prev => {
      const updated = [...prev[studentId].beginnerRecitations];
      updated[index] = { ...updated[index], [field]: value };
      return {
        ...prev,
        [studentId]: {
          ...prev[studentId],
          beginnerRecitations: updated
        }
      };
    });
  };

  const toggleLineNumber = (studentId: string, recitationIndex: number, lineNum: number) => {
    setStudentData(prev => {
      const updated = [...prev[studentId].beginnerRecitations];
      const currentLines = updated[recitationIndex].selectedLines;
      updated[recitationIndex].selectedLines = currentLines.includes(lineNum)
        ? currentLines.filter(l => l !== lineNum)
        : [...currentLines, lineNum].sort((a, b) => a - b);
      
      return {
        ...prev,
        [studentId]: {
          ...prev[studentId],
          beginnerRecitations: updated
        }
      };
    });
  };

  const handleAttendance = async (studentId: string, status: 'present' | 'absent' | 'excused') => {
    try {
      const teacherData = localStorage.getItem('teacher');
      if (!teacherData) throw new Error('يجب تسجيل الدخول');
      
      const teacher = JSON.parse(teacherData);
      const today = getEffectiveDate();

      // استخدام الدالة المركزية لإدارة الحضور
      const result = await manageStudentAttendance(studentId, teacher.id, status, today);

      if (!result.success) {
        throw new Error(result.message);
      }

      // تحديث الحالة المحلية
      setStudentData(prev => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          attendance: status,
          behaviorGrade: status === 'present' ? prev[studentId].behaviorGrade || 'ممتاز' : ''
        }
      }));

      toast({
        title: "تم بنجاح",
        description: result.message,
      });
    } catch (error: any) {
      console.error('Error:', error);
      toast({
        title: "خطأ",
        description: error.message || "فشل في تسجيل الحضور",
        variant: "destructive",
      });
    }
  };

  const clearSavedData = () => {
    const today = getEffectiveDate();
    localStorage.removeItem(getStorageKey(today));
    
    // إعادة تعيين البيانات
    const resetData: Record<string, StudentData> = {};
    students.forEach(student => {
      resetData[student.id] = {
        regularRecitations: [{ pageNumbers: '', grade: '' }],
        reviewPages: '',
        reviewGrade: '',
        behaviorGrade: 'ممتاز',
        notes: '',
        beginnerRecitations: [{ pageNumber: '', selectedLines: [], grade: '' }],
        attendance: null
      };
    });
    setStudentData(resetData);
    
    toast({
      title: "تم المسح",
      description: "تم مسح جميع البيانات المحفوظة",
    });
  };

  const handleSave = async () => {
    const missingAttendance = students.filter(student => !studentData[student.id]?.attendance);
    if (missingAttendance.length > 0) {
      toast({
        title: "الحضور غير مكتمل",
        description: "يجب تسجيل حالة الحضور لجميع الطلاب قبل الحفظ",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const teacherData = localStorage.getItem('teacher');
      if (!teacherData) {
        toast({
          title: "خطأ",
          description: "يجب تسجيل الدخول أولاً",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }
      
      const teacher = JSON.parse(teacherData);
      const today = getEffectiveDate();

      // التحقق من التقديرات الإجبارية وصحة البيانات
      const missingGrades: string[] = [];
      const invalidData: string[] = [];
      
      for (const student of students) {
        const data = studentData[student.id];
        if (!data) continue;
        if (data.attendance !== 'present') continue;

        if (student.level === 'تمهيدي') {
          const hasRecitationWithoutGrade = data.beginnerRecitations.some(
            rec => rec.pageNumber && !rec.grade
          );
          if (hasRecitationWithoutGrade) {
            missingGrades.push(student.name);
          }
        } else {
          // التحقق من صحة أرقام الصفحات
          const hasInvalidPageNumbers = data.regularRecitations.some(rec => {
            if (!rec.pageNumbers) return false;
            const validPattern = /^[0-9,\s]*$/;
            return !validPattern.test(rec.pageNumbers);
          });
          
          if (hasInvalidPageNumbers) {
            invalidData.push(`${student.name} (أرقام صفحات غير صحيحة)`);
          }

          // التحقق من صحة صفحات المراجعة
          if (data.reviewPages) {
            const validPattern = /^[0-9,\s]*$/;
            if (!validPattern.test(data.reviewPages)) {
              invalidData.push(`${student.name} (صفحات مراجعة غير صحيحة)`);
            }
          }

          const hasRecitationWithoutGrade = data.regularRecitations.some(
            rec => rec.pageNumbers && !rec.grade
          );
          if (hasRecitationWithoutGrade) {
            missingGrades.push(student.name);
          }
        }
      }

      if (invalidData.length > 0) {
        toast({
          title: "بيانات غير صحيحة",
          description: `يُسمح فقط بالأرقام والفواصل: ${invalidData.join(', ')}`,
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      if (missingGrades.length > 0) {
        toast({
          title: "تقديرات مفقودة",
          description: `يجب إضافة تقدير التسميع للطلاب: ${missingGrades.join(', ')}`,
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      let savedCount = 0;
      let errorCount = 0;
      let skippedCount = 0;

      console.log(`[بدء الحفظ] إجمالي الطلاب: ${students.length}`);
      console.log(`[studentData keys]`, Object.keys(studentData).length);

      for (const student of students) {
        try {
          const data = studentData[student.id];
          
          if (!data) {
            console.warn(`[⚠️ تخطي] الطالب: ${student.name} (${student.id}) - لا توجد بيانات في studentData`);
            skippedCount++;
            continue;
          }

          if (data.attendance !== 'present') {
            savedCount++;
            continue;
          }

          // تسجيل البيانات المتاحة للطالب
          if (student.level === 'تمهيدي') {
            const hasRecitations = data.beginnerRecitations.some(r => r.pageNumber && r.grade);
            const hasBehavior = !!data.behaviorGrade;
            const hasNotes = !!data.notes;
            console.log(`[بيانات ${student.name}] تسميعات: ${hasRecitations}, سلوك: ${hasBehavior}, ملاحظات: ${hasNotes}`);
          }
        
        if (student.level === 'تمهيدي') {
          // معالجة الطلاب التمهيديين - دعم صفحات متعددة
          const validRecitations = data.beginnerRecitations.filter(
            rec => rec.pageNumber && rec.grade && !isNaN(parseInt(rec.pageNumber))
          );
          
          const hasAnyData = validRecitations.length > 0 || data.behaviorGrade || data.notes;
          
          if (hasAnyData) {
            console.log(`[حفظ تمهيدي] الطالب: ${student.name}, عدد التسميعات: ${validRecitations.length}`);
            
            // حفظ كل صفحة
            if (validRecitations.length > 0) {
              // إذا تم تحميل البيانات → حذف القديمة واستبدالها
              // إذا لم يتم تحميل البيانات → إضافة فقط
              if (dataWasLoaded) {
                const { error: deleteError } = await supabase
                  .from('student_beginner_recitations')
                  .delete()
                  .eq('student_id', student.id)
                  .eq('date', today);

                if (deleteError) {
                  console.error(`[خطأ حذف] الطالب: ${student.name}`, deleteError);
                  throw deleteError;
                }
              }

              // إدراج التسميعات الجديدة
              const recitationsToInsert = validRecitations.map(rec => {
                const lineNumbers = rec.selectedLines.length > 0 ? rec.selectedLines.join(',') : '1,2,3,4,5,6,7,8,9,10';
                const lineCount = rec.selectedLines.length > 0 ? rec.selectedLines.length : 10;
                
                return {
                  student_id: student.id,
                  date: today,
                  page_number: parseInt(rec.pageNumber),
                  line_numbers: lineNumbers,
                  line_count: lineCount,
                  grade: rec.grade
                };
              });

              console.log(`[إدراج تسميعات] الطالب: ${student.name}`, recitationsToInsert);

              const { error: insertError, data: insertedData } = await supabase
                .from('student_beginner_recitations')
                .insert(recitationsToInsert)
                .select();

              if (insertError) {
                console.error(`[خطأ إدراج] الطالب: ${student.name}`, insertError);
                console.error('البيانات المحاولة:', recitationsToInsert);
                throw insertError;
              }

              console.log(`[نجح الإدراج] الطالب: ${student.name}, عدد السجلات: ${insertedData?.length || 0}`);
              
              // إضافة خصم إعادة التسميع للصفحات التي تقديرها "إعادة"
              const retakePages = validRecitations.filter(r => r.grade === 'إعادة');
              if (retakePages.length > 0) {
                const { addRecitationRetakePenalty } = await import("@/lib/generalPointsManager");
                // خصم -5 لكل صفحة إعادة
                for (const retake of retakePages) {
                  await addRecitationRetakePenalty(student.id, today);
                }
              }
            }

            // حفظ السلوك والملاحظات
            if (data.behaviorGrade || data.notes || validRecitations.length > 0) {
              const { data: existingWork, error: selectError } = await supabase
                .from('student_daily_work')
                .select('*')
                .eq('student_id', student.id)
                .eq('date', today)
                .maybeSingle();

              if (selectError) {
                console.error('Error selecting daily work:', selectError);
                throw selectError;
              }

              if (existingWork) {
                const { error: updateError } = await supabase
                  .from('student_daily_work')
                  .update({
                    behavior_grade: data.behaviorGrade || existingWork.behavior_grade,
                    teacher_notes: data.notes || existingWork.teacher_notes,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', existingWork.id);

                if (updateError) {
                  console.error('Error updating daily work:', updateError);
                  throw updateError;
                }
                
                // إضافة نقاط الأدب اليومي
                if (data.behaviorGrade) {
                  const { addBehaviorPoints } = await import("@/lib/generalPointsManager");
                  await addBehaviorPoints(student.id, data.behaviorGrade, today);
                }
              } else {
                const { error: insertError } = await supabase
                  .from('student_daily_work')
                  .insert({
                    student_id: student.id,
                    date: today,
                    behavior_grade: data.behaviorGrade || null,
                    teacher_notes: data.notes || null,
                    new_recitation_pages: 0,
                    review_pages: 0,
                  });

                if (insertError) {
                  console.error('Error inserting daily work:', insertError);
                  throw insertError;
                }
                
                // إضافة نقاط الأدب اليومي
                if (data.behaviorGrade) {
                  const { addBehaviorPoints } = await import("@/lib/generalPointsManager");
                  await addBehaviorPoints(student.id, data.behaviorGrade, today);
                }
              }
            }

            // تسجيل الحضور تلقائياً للطالب التمهيدي
            // إذا لم يكن غائباً (سواء كان حاضراً أو لم يتم تحديد حالته)
            if (data.attendance === 'present') {
              const { error: attendanceError } = await supabase
                .from('student_attendance')
                .upsert({
                  student_id: student.id,
                  status: 'present',
                  teacher_id: teacher.id,
                  date: today,
                });

              if (attendanceError) {
                console.error('Error upserting attendance:', attendanceError);
                // لا نرمي الخطأ هنا لأن الحضور ليس حرجاً
              }

              // إضافة نقطة حماسة إذا لم تكن موجودة
              const { data: existingPoints, error: pointsSelectError } = await supabase
                .from('student_points')
                .select('*')
                .eq('student_id', student.id)
                .eq('date', today)
                .eq('point_type', 'enthusiasm')
                .maybeSingle();

              if (pointsSelectError) {
                console.error('Error selecting points:', pointsSelectError);
              } else if (!existingPoints) {
                const { error: pointsInsertError } = await supabase
                  .from('student_points')
                  .insert({
                    student_id: student.id,
                    date: today,
                    point_type: 'enthusiasm',
                    points: 1,
                    reason: 'حضور'
                  });

                if (pointsInsertError) {
                  console.error('Error inserting points:', pointsInsertError);
                }
              }
            }

            console.log(`[✓ نجح الحفظ] الطالب التمهيدي: ${student.name}`);
            savedCount++;
          }
          
          // تسجيل الحضور تلقائياً للطالب التمهيدي (حتى لو لم تكن هناك بيانات)
          // إذا لم يكن غائباً (سواء كان حاضراً أو لم يتم تحديد حالته)
          if (data.attendance === 'present') {
            const { error: attendanceError } = await supabase
              .from('student_attendance')
              .upsert({
                student_id: student.id,
                status: 'present',
                teacher_id: teacher.id,
                date: today,
              });

            if (attendanceError) {
              console.error('Error upserting attendance:', attendanceError);
            }

            // إضافة نقطة حماسة إذا لم تكن موجودة
            const { data: existingPoints, error: pointsSelectError } = await supabase
              .from('student_points')
              .select('*')
              .eq('student_id', student.id)
              .eq('date', today)
              .eq('point_type', 'enthusiasm')
              .maybeSingle();

            if (pointsSelectError) {
              console.error('Error selecting points:', pointsSelectError);
            } else if (!existingPoints) {
              const { error: pointsInsertError } = await supabase
                .from('student_points')
                .insert({
                  student_id: student.id,
                  date: today,
                  point_type: 'enthusiasm',
                  points: 1,
                  reason: 'حضور'
                });

              if (pointsInsertError) {
                console.error('Error inserting points:', pointsInsertError);
              }
            }
          }
          
          if (!hasAnyData) {
            console.log(`[تخطي البيانات] الطالب التمهيدي: ${student.name} - لا توجد بيانات للحفظ، لكن تم تسجيل الحضور`);
          }
        } else {
          // معالجة الطلاب العاديين - دعم صفحات متعددة
          const validRecitations = data.regularRecitations?.filter(
            rec => rec.pageNumbers && rec.grade
          ) || [];
          
          const hasOtherData = (student.level === 'حافظ' && data.reviewPages ? data.reviewPages.trim() : false) || data.reviewGrade || data.behaviorGrade || data.notes;
          const hasAnyData = validRecitations.length > 0 || hasOtherData;

          if (hasAnyData) {
            const { data: existingWork } = await supabase
              .from('student_daily_work')
              .select('*')
              .eq('student_id', student.id)
              .eq('date', today)
              .maybeSingle();

          // حساب عدد الصفحات من أرقام الصفحات وتخزين التقديرات لكل صفحة
          let totalPages = 0;
          let allPageNumbers: string[] = [];
          let allPageGrades: string[] = []; // تقدير لكل صفحة
          
          validRecitations.forEach(rec => {
            const pages = rec.pageNumbers.split(',').map(p => p.trim()).filter(p => p);
            totalPages += pages.length;
            allPageNumbers = [...allPageNumbers, ...pages];
            // إضافة نفس التقدير لكل صفحة في هذا التسميع
            pages.forEach(() => {
              allPageGrades.push(rec.grade);
            });
          });

          const pageNumbersString = allPageNumbers.join(',');
          const pageGradesString = allPageGrades.join(','); // تقديرات مفصولة بفواصل

          if (existingWork) {
            // إذا تم تحميل البيانات → استبدال
            // إذا لم يتم تحميل البيانات → إضافة
            const shouldReplace = dataWasLoaded;
            
            let finalPages: number;
            let finalPageNumbers: string;
            let finalPageGrades: string;
            
            if (shouldReplace) {
              // استبدال البيانات
              finalPages = totalPages;
              finalPageNumbers = pageNumbersString;
              finalPageGrades = pageGradesString;
            } else {
              // إضافة البيانات الجديدة إلى القديمة
              const existingPages = existingWork.new_recitation_page_numbers ? 
                existingWork.new_recitation_page_numbers.split(',').filter((p: string) => p.trim()) : [];
              const existingGrades = existingWork.new_recitation_page_grades ?
                existingWork.new_recitation_page_grades.split(',').filter((g: string) => g.trim()) : [];
              finalPages = (existingWork.new_recitation_pages || 0) + totalPages;
              finalPageNumbers = [...existingPages, ...allPageNumbers].join(',');
              finalPageGrades = [...existingGrades, ...allPageGrades].join(',');
            }

            const newReviewPages = student.level === 'حافظ' && data.reviewPages ? 
              data.reviewPages.split(',').filter(p => p.trim()).length : 0;
            
            const finalReviewPages = shouldReplace 
              ? newReviewPages 
              : (existingWork.review_pages || 0) + newReviewPages;

            // حفظ أرقام صفحات المراجعة
            const reviewPageNumbers = student.level === 'حافظ' && data.reviewPages ? 
              data.reviewPages.trim() : null;

            const { error: updateError } = await supabase
              .from('student_daily_work')
              .update({
                new_recitation_pages: finalPages,
                new_recitation_page_numbers: finalPageNumbers,
                new_recitation_page_grades: finalPageGrades,
                new_recitation_grade: allPageGrades[allPageGrades.length - 1] || existingWork.new_recitation_grade,
                review_pages: finalReviewPages,
                review_page_numbers: shouldReplace ? reviewPageNumbers : 
                  (reviewPageNumbers ? 
                    (existingWork.review_page_numbers ? existingWork.review_page_numbers + ',' + reviewPageNumbers : reviewPageNumbers) : 
                    existingWork.review_page_numbers),
                review_grade: data.reviewGrade || existingWork.review_grade,
                behavior_grade: data.behaviorGrade || existingWork.behavior_grade,
                teacher_notes: data.notes || existingWork.teacher_notes,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingWork.id);

            if (updateError) {
              console.error('Error updating daily work:', updateError);
              throw updateError;
            }
            
            // إضافة خصم إعادة التسميع إذا كان التقدير "إعادة"
            const lastGrade = allPageGrades[allPageGrades.length - 1];
            if (lastGrade === 'إعادة') {
              const { addRecitationRetakePenalty } = await import("@/lib/generalPointsManager");
              await addRecitationRetakePenalty(student.id, today);
            }
            
            // إضافة نقاط الأدب اليومي
            if (data.behaviorGrade) {
              const { addBehaviorPoints } = await import("@/lib/generalPointsManager");
              await addBehaviorPoints(student.id, data.behaviorGrade, today);
            }
          } else {
            // حفظ أرقام صفحات المراجعة
            const reviewPageNumbers = student.level === 'حافظ' && data.reviewPages ? 
              data.reviewPages.trim() : null;

            const { error: insertError } = await supabase
              .from('student_daily_work')
              .insert({
                student_id: student.id,
                date: today,
                new_recitation_pages: totalPages,
                new_recitation_page_numbers: pageNumbersString,
                new_recitation_page_grades: pageGradesString,
                new_recitation_grade: allPageGrades[allPageGrades.length - 1] || null,
                review_pages: student.level === 'حافظ' && data.reviewPages ? 
                  data.reviewPages.split(',').filter(p => p.trim()).length : 0,
                review_page_numbers: reviewPageNumbers,
                review_grade: data.reviewGrade || null,
                behavior_grade: data.behaviorGrade || null,
                teacher_notes: data.notes || null,
              });

            if (insertError) {
              console.error('Error inserting daily work:', insertError);
              throw insertError;
            }
            
            // إضافة خصم إعادة التسميع إذا كان التقدير "إعادة"
            const lastGrade = allPageGrades[allPageGrades.length - 1];
            if (lastGrade === 'إعادة') {
              const { addRecitationRetakePenalty } = await import("@/lib/generalPointsManager");
              await addRecitationRetakePenalty(student.id, today);
            }
            
            // إضافة نقاط الأدب اليومي
            if (data.behaviorGrade) {
              const { addBehaviorPoints } = await import("@/lib/generalPointsManager");
              await addBehaviorPoints(student.id, data.behaviorGrade, today);
            }
          }

          savedCount++;
          }
          
          // تسجيل الحضور تلقائياً للطالب العادي (حتى لو لم تكن هناك بيانات)
          // إذا لم يكن غائباً (سواء كان حاضراً أو لم يتم تحديد حالته)
          if (data.attendance === 'present') {
            await supabase
              .from('student_attendance')
              .upsert({
                student_id: student.id,
                status: 'present',
                teacher_id: teacher.id,
                date: today,
              });

            // إضافة نقطة حماسة إذا لم تكن موجودة
            const { data: existingPoints } = await supabase
              .from('student_points')
              .select('*')
              .eq('student_id', student.id)
              .eq('date', today)
              .eq('point_type', 'enthusiasm')
              .maybeSingle();

            if (!existingPoints) {
              await supabase
                .from('student_points')
                .insert({
                  student_id: student.id,
                  date: today,
                  point_type: 'enthusiasm',
                  points: 1,
                  reason: 'حضور'
                });
            }
          }
          
          if (!hasAnyData) {
            console.log(`[تخطي البيانات] الطالب العادي: ${student.name} - لا توجد بيانات للحفظ، لكن تم تسجيل الحضور`);
          }
        }
        } catch (studentError: any) {
          console.error(`Error saving data for student ${student.name}:`, studentError);
          console.error('Error details:', studentError.message, studentError.details, studentError.hint);
          errorCount++;
        }
      }

      console.log(`[نتيجة الحفظ] نجح: ${savedCount}, فشل: ${errorCount}, تخطي: ${skippedCount}`);

      if (savedCount > 0) {
        const description = errorCount > 0 
          ? `تم حفظ ${savedCount} طالب، فشل ${errorCount}` 
          : skippedCount > 0 
            ? `تم حفظ ${savedCount} طالب، تخطي ${skippedCount} (لا توجد بيانات)`
            : `تم حفظ بيانات ${savedCount} طالب`;
        
        toast({
          title: "تم الحفظ بنجاح",
          description: description,
        });

        // مسح البيانات المحفوظة من LocalStorage فقط عند النجاح
        localStorage.removeItem(getStorageKey(today));
        
        // إعادة تعيين حالة تحميل البيانات
        setDataWasLoaded(false);

        // إعادة تعيين النموذج وتحديث حالة الحضور فقط عند النجاح
        const resetData: Record<string, StudentData> = {};
        students.forEach(student => {
          const currentData = studentData[student.id];
          // الحفاظ على حالة الحضور المحددة لكل طالب
          const wasDataSaved = student.level === 'تمهيدي' 
            ? currentData?.beginnerRecitations.some(rec => rec.pageNumber && rec.grade) || currentData?.behaviorGrade || currentData?.notes
            : currentData?.regularRecitations.some(rec => rec.pageNumbers && rec.grade) || currentData?.reviewPages || currentData?.behaviorGrade || currentData?.notes;
          
          const newAttendance = currentData?.attendance || (wasDataSaved ? 'present' : null);

          resetData[student.id] = {
            regularRecitations: [{ pageNumbers: '', grade: '' }],
            reviewPages: '',
            reviewGrade: '',
            behaviorGrade: newAttendance === 'present' ? 'ممتاز' : '',
            notes: '',
            beginnerRecitations: [{ pageNumber: '', selectedLines: [], grade: '' }],
            attendance: newAttendance
          };
        });
        setStudentData(resetData);
      } else if (errorCount > 0) {
        toast({
          title: "خطأ",
          description: `فشل في حفظ بيانات ${errorCount} طالب`,
          variant: "destructive",
        });
        // لا نحذف البيانات عند الفشل
      } else {
        toast({
          title: "تنبيه",
          description: "لا توجد بيانات للحفظ",
        });
      }

    } catch (error: any) {
      console.error('Error in handleSave:', error);
      toast({
        title: "خطأ",
        description: error.message || "فشل في حفظ البيانات",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const grades = ['ممتاز', 'جيد جداً', 'جيد', 'إعادة'];
  const behaviorGrades = ['ممتاز', 'جيد جداً', 'جيد'];
  const missingAttendanceCount = students.filter(student => !studentData[student.id]?.attendance).length;
  const renderBehaviorRatingButtons = (studentId: string) => (
    <div className="grid w-full grid-cols-3 gap-1">
      {behaviorGrades.map(grade => {
        const isSelected = studentData[studentId]?.behaviorGrade === grade;
        return (
          <Button
            key={grade}
            type="button"
            size="sm"
            variant={isSelected ? "default" : "outline"}
            aria-pressed={isSelected}
            onClick={() => updateStudentData(studentId, 'behaviorGrade', grade)}
            className={`h-10 w-full min-w-0 whitespace-nowrap px-1 text-[11px] sm:text-xs ${isSelected ? "bg-green-600 text-white hover:bg-green-700" : ""}`}
          >
            {grade}
          </Button>
        );
      })}
    </div>
  );

  if (!loading && !selectedCircleId) {
    return (
      <ProtectedTeacherRoute>
        <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
          <TeacherNavbar />
          <main className="container mx-auto px-4 py-8">
            <Card className="islamic-card p-8 max-w-4xl mx-auto text-center">
              <BookOpen className="w-14 h-14 text-primary mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-primary mb-2">اختر الحلقة</h1>
              <p className="text-muted-foreground mb-8">
                اختر الحلقة التي تريد تسجيل بياناتها اليومية
              </p>
              {circles.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {circles.map((circle) => (
                    <Button
                      key={circle.id}
                      type="button"
                      variant="outline"
                      onClick={() => handleCircleSelect(circle.id)}
                      className="h-auto min-h-20 p-5 text-lg border-2 border-primary/20 hover:border-primary hover:bg-primary/5"
                    >
                      <BookOpen className="w-5 h-5 text-primary" />
                      {circle.name}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">لا توجد حلقات مرتبطة بحسابك</p>
              )}
            </Card>
          </main>
        </div>
      </ProtectedTeacherRoute>
    );
  }

  return (
    <ProtectedTeacherRoute>
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
        <TeacherNavbar />
        
        <main className="container mx-auto px-4 py-8">
          <Card className="islamic-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-primary mb-2">إدخال البيانات السريع</h1>
                <p className="text-muted-foreground">
                  {circles.find(circle => circle.id === selectedCircleId)?.name || 'الحلقة'}
                  {' '} - أدخل بيانات طلاب الحلقة في جدول واحد
                </p>
                <p className="text-sm text-primary/70 mt-1">
                  📅 التاريخ الفعلي: {new Date(getEffectiveDate()).toLocaleDateString('ar-SA', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                  {new Date().getHours() < 18 && ' (قبل الساعة 6 مساءً - بيانات الأمس)'}
                </p>
              </div>
              
              <div className="flex gap-3 flex-wrap items-center">
                {circles.length > 1 && (
                  <Button onClick={handleChangeCircle} variant="outline" disabled={loading || saving}>
                    <BookOpen className="w-4 h-4 ml-2" />
                    تغيير الحلقة
                  </Button>
                )}
                <Button onClick={loadTodayData} variant="secondary" disabled={loadingTodayData || loading}>
                  <RefreshCw className={`w-4 h-4 ml-2 ${loadingTodayData ? 'animate-spin' : ''}`} />
                  {loadingTodayData ? 'جاري التحميل...' : 'تحميل بيانات اليوم'}
                </Button>
                <Button 
                  onClick={clearSavedData} 
                  variant="destructive" 
                  disabled={loading}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  <RefreshCw className="w-4 h-4 ml-2" />
                  مسح البيانات المحفوظة
                </Button>
                <Button onClick={handleSave} disabled={saving || missingAttendanceCount > 0} size="lg">
                  <Save className="w-4 h-4 ml-2" />
                  {saving ? 'جاري الحفظ...' : 'حفظ الكل'}
                </Button>
              </div>
            </div>

            {/* إشعار بوجود بيانات محفوظة */}
            {(() => {
              const today = getEffectiveDate();
              const savedData = localStorage.getItem(getStorageKey(today));
              return savedData ? (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-500 text-white rounded-full p-2">
                      <Save className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-blue-900">💾 يتم الحفظ التلقائي</p>
                      <p className="text-sm text-blue-700">
                        بياناتك محفوظة تلقائياً. حتى لو أغلقت الصفحة أو حدث Refresh، ستجد بياناتك هنا.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null;
            })()}

            {!loading && students.length > 0 && missingAttendanceCount > 0 && (
              <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800" role="status">
                لم تُسجّل حالة الحضور لـ {missingAttendanceCount} من الطلاب
              </div>
            )}

            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">جاري التحميل...</p>
              </div>
            ) : isMobile ? (
              // عرض الموبايل - كروت
              <div className="space-y-4">
                {students.map((student) => (
                  <Card key={student.id} className={`p-4 border-2 transition-all ${studentData[student.id]?.attendance ? 'hover:border-primary/50' : 'border-red-400 bg-red-50/40'}`}>
                    <div className="flex flex-col gap-3 mb-4 pb-3 border-b sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 border border-primary/20">
                          <AvatarImage src={student.photo_url} alt={student.name} />
                          <AvatarFallback className="bg-primary/10">
                            <User className="w-5 h-5 text-primary" />
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-lg font-bold text-primary">
                          {student.name}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant={studentData[student.id]?.attendance === 'present' ? "default" : "outline"}
                          onClick={() => handleAttendance(student.id, 'present')}
                          className={`px-2 ${studentData[student.id]?.attendance === 'present' ? "bg-green-600 text-white hover:bg-green-700" : "border-green-600 text-green-600 hover:bg-green-50"}`}
                        >
                          <UserCheck className="ml-1 h-4 w-4" />حضور
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={studentData[student.id]?.attendance === 'absent' ? "destructive" : "outline"}
                          onClick={() => handleAttendance(student.id, 'absent')}
                          className={`px-2 ${studentData[student.id]?.attendance === 'absent' ? "bg-red-600 text-white hover:bg-red-700" : "border-red-600 text-red-600 hover:bg-red-50"}`}
                        >
                          <UserX className="ml-1 h-4 w-4" />غياب
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={studentData[student.id]?.attendance === 'excused' ? "default" : "outline"}
                          onClick={() => handleAttendance(student.id, 'excused')}
                          className={`px-2 ${studentData[student.id]?.attendance === 'excused' ? "bg-amber-600 text-white hover:bg-amber-700" : "border-amber-600 text-amber-700 hover:bg-amber-50"}`}
                        >
                          <ShieldCheck className="ml-1 h-4 w-4" />غياب بإذن
                        </Button>
                      </div>
                    </div>
                    {!studentData[student.id]?.attendance && <p className="mb-3 text-xs font-medium text-red-700">لم تُسجّل حالة الحضور</p>}
                    
                    <div className="space-y-4">
                      {student.level === 'تمهيدي' ? (
                        // حقول الطلاب التمهيديين - صفحات متعددة
                        <>
                          {studentData[student.id]?.beginnerRecitations.map((rec, index) => (
                            <Card key={index} className="p-3 bg-muted/30">
                              <div className="flex items-center justify-between mb-3">
                                <Label className="text-sm font-bold">صفحة {index + 1}</Label>
                                {studentData[student.id].beginnerRecitations.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeBeginnerRecitation(student.id, index)}
                                    className="h-7 text-destructive"
                                  >
                                    حذف
                                  </Button>
                                )}
                              </div>
                              
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <Label className="text-xs mb-1">رقم الصفحة</Label>
                                    <Input
                                      type="number"
                                      min="1"
                                      placeholder="رقم الصفحة"
                                      value={rec.pageNumber}
                                      onChange={(e) => updateBeginnerRecitation(student.id, index, 'pageNumber', e.target.value)}
                                      className="text-center h-9"
                                    />
                                  </div>
                                  
                                  <div>
                                    <Label className="text-xs mb-1">التقييم</Label>
                                    <Select
                                      value={rec.grade}
                                      onValueChange={(value) => updateBeginnerRecitation(student.id, index, 'grade', value)}
                                    >
                                      <SelectTrigger className="h-9">
                                        <SelectValue placeholder="اختر" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {grades.map(grade => (
                                          <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                
                                <div>
                                  <Label className="text-xs mb-2">الأسطر</Label>
                                  <div className="grid grid-cols-5 gap-1">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(lineNum => (
                                      <Button
                                        key={lineNum}
                                        type="button"
                                        variant={rec.selectedLines.includes(lineNum) ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => toggleLineNumber(student.id, index, lineNum)}
                                        className="h-8 text-xs"
                                      >
                                        {lineNum}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </Card>
                          ))}
                          
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addBeginnerRecitation(student.id)}
                            className="w-full"
                          >
                            <Plus className="w-4 h-4 ml-2" />
                            إضافة صفحة أخرى
                          </Button>
                          
                          <div>
                            <Label className="text-sm font-semibold mb-1">تقييم الأدب</Label>
                            {renderBehaviorRatingButtons(student.id)}
                          </div>
                          
                          <div>
                            <Label className="text-sm font-semibold mb-1">ملاحظات</Label>
                            <Textarea
                              placeholder="أضف ملاحظات..."
                              value={studentData[student.id]?.notes || ''}
                              onChange={(e) => updateStudentData(student.id, 'notes', e.target.value)}
                              rows={2}
                            />
                          </div>
                        </>
                      ) : (
                        // حقول الطلاب العاديين - صفحات متعددة
                        <>
                          {studentData[student.id]?.regularRecitations.map((rec, index) => (
                            <Card key={index} className="p-3 bg-muted/30">
                              <div className="flex items-center justify-between mb-3">
                                <Label className="text-sm font-bold">تسميع {index + 1}</Label>
                                {studentData[student.id].regularRecitations.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeRegularRecitation(student.id, index)}
                                    className="h-7 text-destructive"
                                  >
                                    حذف
                                  </Button>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs mb-1">أرقام الصفحات</Label>
                                  <Input
                                    type="text"
                                    placeholder="201,202 أو 201-210"
                                    value={rec.pageNumbers}
                                    onChange={(e) => updateRegularRecitation(student.id, index, 'pageNumbers', e.target.value)}
                                    onBlur={() => expandPageRanges(student.id, index)}
                                    className="h-9"
                                  />
                                  <p className="text-xs text-muted-foreground mt-1">افصل بفاصلة أو استخدم - للنطاق (مثال: 10-15)</p>
                                </div>
                                
                                <div>
                                  <Label className="text-xs mb-1">التقييم</Label>
                                  <Select
                                    value={rec.grade}
                                    onValueChange={(value) => updateRegularRecitation(student.id, index, 'grade', value)}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue placeholder="اختر" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {grades.map(grade => (
                                        <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </Card>
                          ))}
                          
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addRegularRecitation(student.id)}
                            className="w-full"
                          >
                            <Plus className="w-4 h-4 ml-2" />
                            إضافة تسميع آخر
                          </Button>
                          
                          {student.level === 'حافظ' && (
                            <>
                              <div>
                                <Label className="text-sm font-semibold mb-1">أجزاء المراجعة</Label>
                                <Input
                                  type="text"
                                  placeholder="1,2,3"
                                  value={studentData[student.id]?.reviewPages || ''}
                                  onChange={(e) => updateStudentData(student.id, 'reviewPages', e.target.value)}
                                  className="text-center"
                                />
                                <p className="text-xs text-muted-foreground mt-1">أرقام الأجزاء مفصولة بفاصلة</p>
                              </div>
                              
                              <div>
                                <Label className="text-sm font-semibold mb-1">تقدير المراجعة</Label>
                                <Select
                                  value={studentData[student.id]?.reviewGrade || ''}
                                  onValueChange={(value) => updateStudentData(student.id, 'reviewGrade', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="اختر التقدير" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {grades.map(grade => (
                                      <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </>
                          )}
                          
                          <div>
                            <Label className="text-sm font-semibold mb-1">تقييم الأدب</Label>
                            {renderBehaviorRatingButtons(student.id)}
                          </div>
                          
                          <div>
                            <Label className="text-sm font-semibold mb-1">ملاحظات</Label>
                            <Textarea
                              placeholder="أضف ملاحظات..."
                              value={studentData[student.id]?.notes || ''}
                              onChange={(e) => updateStudentData(student.id, 'notes', e.target.value)}
                              rows={2}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              // عرض الكمبيوتر - جدول
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary/5">
                      <TableHead className="text-right font-bold min-w-[150px]">اسم الطالب</TableHead>
                      <TableHead className="text-center font-bold min-w-[120px]">الحضور</TableHead>
                      <TableHead className="text-center font-bold min-w-[100px]">التسميع</TableHead>
                      <TableHead className="text-center font-bold min-w-[120px]">التقييم</TableHead>
                      <TableHead className="text-center font-bold min-w-[100px]">المراجعة</TableHead>
                      <TableHead className="text-center font-bold min-w-[100px]">تقدير المراجعة</TableHead>
                      <TableHead className="text-center font-bold min-w-[220px]">الأدب</TableHead>
                      <TableHead className="text-center font-bold min-w-[200px]">ملاحظات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id} className={studentData[student.id]?.attendance ? "hover:bg-muted/50" : "bg-red-50/60 hover:bg-red-50"}>
                        <TableCell className="font-semibold">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-9 h-9 border border-primary/20">
                              <AvatarImage src={student.photo_url} alt={student.name} />
                              <AvatarFallback className="bg-primary/10">
                                <User className="w-4 h-4 text-primary" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span>{student.name}</span>
                              {student.level === 'تمهيدي' && (
                                <span className="text-xs text-primary">(تمهيدي)</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        
                        {/* خلية الحضور */}
                        <TableCell>
                          <div className="flex gap-1 justify-center">
                            <Button
                              type="button"
                              size="sm"
                              variant={studentData[student.id]?.attendance === 'present' ? "default" : "outline"}
                              onClick={() => handleAttendance(student.id, 'present')}
                              className={`h-8 px-2 ${studentData[student.id]?.attendance === 'present' ? 
                                "bg-green-600 hover:bg-green-700 text-white" : 
                                "border-green-600 text-green-600 hover:bg-green-50"
                              }`}
                            >
                              حضور
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={studentData[student.id]?.attendance === 'absent' ? "destructive" : "outline"}
                              onClick={() => handleAttendance(student.id, 'absent')}
                              className={`h-8 px-2 ${studentData[student.id]?.attendance === 'absent' ? 
                                "" : 
                                "border-red-600 text-red-600 hover:bg-red-50"
                              }`}
                            >
                              غياب
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={studentData[student.id]?.attendance === 'excused' ? "default" : "outline"}
                              onClick={() => handleAttendance(student.id, 'excused')}
                              className={`h-8 px-2 ${studentData[student.id]?.attendance === 'excused' ? "bg-amber-600 text-white hover:bg-amber-700" : "border-amber-600 text-amber-700 hover:bg-amber-50"}`}
                            >
                              غياب بإذن
                            </Button>
                          </div>
                        </TableCell>
                        
                        {student.level === 'تمهيدي' ? (
                          // صف للطالب التمهيدي
                          <>
                            <TableCell>
                              <div className="space-y-2">
                                {studentData[student.id]?.beginnerRecitations.map((rec, index) => (
                                  <div key={index} className="flex gap-2 items-center p-2 border rounded">
                                    <Input
                                      type="number"
                                      min="1"
                                      placeholder="صفحة"
                                      value={rec.pageNumber}
                                      onChange={(e) => updateBeginnerRecitation(student.id, index, 'pageNumber', e.target.value)}
                                      className="text-center w-20"
                                    />
                                    <div className="flex flex-wrap gap-1">
                                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(lineNum => (
                                        <Button
                                          key={lineNum}
                                          type="button"
                                          variant={rec.selectedLines.includes(lineNum) ? "default" : "outline"}
                                          size="sm"
                                          onClick={() => toggleLineNumber(student.id, index, lineNum)}
                                          className="h-6 w-6 p-0 text-xs"
                                        >
                                          {lineNum}
                                        </Button>
                                      ))}
                                    </div>
                                    {studentData[student.id].beginnerRecitations.length > 1 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeBeginnerRecitation(student.id, index)}
                                        className="h-6 text-destructive"
                                      >
                                        ×
                                      </Button>
                                    )}
                                  </div>
                                ))}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addBeginnerRecitation(student.id)}
                                  className="w-full h-7"
                                >
                                  + صفحة
                                </Button>
                              </div>
                            </TableCell>
                            
                            <TableCell>
                              {studentData[student.id]?.beginnerRecitations.map((rec, index) => (
                                <div key={index} className="mb-2">
                                  <Select
                                    value={rec.grade}
                                    onValueChange={(value) => updateBeginnerRecitation(student.id, index, 'grade', value)}
                                  >
                                    <SelectTrigger className="h-8">
                                      <SelectValue placeholder="اختر" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {grades.map(grade => (
                                        <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ))}
                            </TableCell>
                            
                            <TableCell className="text-center text-muted-foreground">-</TableCell>
                            
                            <TableCell className="text-center text-muted-foreground">-</TableCell>
                            
                            <TableCell>
                              {renderBehaviorRatingButtons(student.id)}
                            </TableCell>
                            
                            <TableCell>
                              <Input
                                placeholder="ملاحظات..."
                                value={studentData[student.id]?.notes || ''}
                                onChange={(e) => updateStudentData(student.id, 'notes', e.target.value)}
                              />
                            </TableCell>
                          </>
                        ) : (
                          // صف للطالب العادي - صفحات متعددة
                          <>
                            <TableCell>
                              <div className="space-y-2">
                                {studentData[student.id]?.regularRecitations.map((rec, index) => (
                                  <div key={index} className="flex gap-2 items-center">
                                    <Input
                                      type="text"
                                      placeholder="201,202"
                                      value={rec.pageNumbers}
                                      onChange={(e) => updateRegularRecitation(student.id, index, 'pageNumbers', e.target.value)}
                                      className="flex-1"
                                    />
                                    {studentData[student.id].regularRecitations.length > 1 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeRegularRecitation(student.id, index)}
                                        className="h-8 text-destructive"
                                      >
                                        ×
                                      </Button>
                                    )}
                                  </div>
                                ))}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addRegularRecitation(student.id)}
                                  className="w-full h-7"
                                >
                                  + تسميع
                                </Button>
                              </div>
                            </TableCell>
                            
                            <TableCell>
                              {studentData[student.id]?.regularRecitations.map((rec, index) => (
                                <div key={index} className="mb-2">
                                  <Select
                                    value={rec.grade}
                                    onValueChange={(value) => updateRegularRecitation(student.id, index, 'grade', value)}
                                  >
                                    <SelectTrigger className="h-8">
                                      <SelectValue placeholder="اختر" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {grades.map(grade => (
                                        <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ))}
                            </TableCell>
                            
                            <TableCell>
                              {student.level === 'حافظ' ? (
                                <Input
                                  type="text"
                                  placeholder="1,2,3"
                                  value={studentData[student.id]?.reviewPages || ''}
                                  onChange={(e) => updateStudentData(student.id, 'reviewPages', e.target.value)}
                                  className="text-center"
                                />
                              ) : (
                                <span className="text-center text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            
                            <TableCell>
                              {student.level === 'حافظ' ? (
                                <Select
                                  value={studentData[student.id]?.reviewGrade || ''}
                                  onValueChange={(value) => updateStudentData(student.id, 'reviewGrade', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="اختر" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {grades.map(grade => (
                                      <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-center text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            
                            <TableCell>
                              {renderBehaviorRatingButtons(student.id)}
                            </TableCell>
                            
                            <TableCell>
                              <Input
                                placeholder="ملاحظات..."
                                value={studentData[student.id]?.notes || ''}
                                onChange={(e) => updateStudentData(student.id, 'notes', e.target.value)}
                              />
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {!loading && students.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">لا يوجد طلاب</p>
              </div>
            )}
          </Card>
        </main>
      </div>
    </ProtectedTeacherRoute>
  );
};

export default QuickDataEntry;
