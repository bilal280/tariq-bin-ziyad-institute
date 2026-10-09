import { useState, useEffect } from "react";
import { BookOpen, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import TeacherNavbar from "@/components/TeacherNavbar";
import ProtectedTeacherRoute from "@/components/ProtectedTeacherRoute";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Student {
  id: string;
  name: string;
}

interface MonthlyReview {
  student_id: string;
  score: number | null;
  notes: string;
}

const MonthlyReview = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [reviews, setReviews] = useState<Map<string, MonthlyReview>>(new Map());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    if (students.length > 0) {
      fetchExistingReviews();
    }
  }, [selectedMonth, selectedYear, students]);

  const fetchStudents = async () => {
    try {
      const teacherData = localStorage.getItem('teacher');
      
      if (!teacherData) {
        console.log('No teacher data found');
        return;
      }

      const teacher = JSON.parse(teacherData);
      console.log('Teacher:', teacher);

      // جلب الحلقات التابعة للمعلم
      const { data: circles, error: circlesError } = await supabase
        .from('circles')
        .select('id')
        .eq('teacher_id', teacher.id);

      console.log('Circles:', circles);
      console.log('Circles Error:', circlesError);

      if (circlesError) throw circlesError;

      const circleIds = circles?.map(c => c.id) || [];

      if (circleIds.length === 0) {
        console.log('No circles found for this teacher');
        return;
      }

      // جلب طلاب الحلقات التابعة للمعلم
      const { data, error } = await supabase
        .from('students')
        .select('id, name')
        .in('circle_id', circleIds)
        .order('name');

      console.log('Students:', data);
      console.log('Students Error:', error);

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchExistingReviews = async () => {
    try {
      const monthNum = parseInt(selectedMonth) + 1;
      const yearNum = parseInt(selectedYear);

      // @ts-ignore - monthly_reviews table will be added after migration
      const { data, error } = await (supabase as any)
        .from('monthly_reviews')
        .select('*')
        .eq('month', monthNum)
        .eq('year', yearNum)
        .in('student_id', students.map(s => s.id));

      if (error) throw error;

      const reviewsMap = new Map<string, MonthlyReview>();
      // @ts-ignore
      data?.forEach(review => {
        reviewsMap.set(review.student_id, {
          student_id: review.student_id,
          score: review.score,
          notes: review.notes || ''
        });
      });

      // إضافة الطلاب الذين ليس لديهم مذاكرة
      students.forEach(student => {
        if (!reviewsMap.has(student.id)) {
          reviewsMap.set(student.id, {
            student_id: student.id,
            score: null,
            notes: ''
          });
        }
      });

      setReviews(reviewsMap);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  const updateReview = (studentId: string, field: 'score' | 'notes', value: any) => {
    const newReviews = new Map(reviews);
    const review = newReviews.get(studentId) || { student_id: studentId, score: null, notes: '' };
    
    if (field === 'score') {
      const scoreValue = value === '' ? null : parseInt(value);
      if (scoreValue !== null && (scoreValue < 0 || scoreValue > 100)) {
        toast({
          title: "خطأ",
          description: "الدرجة يجب أن تكون بين 0 و 100",
          variant: "destructive",
        });
        return;
      }
      review.score = scoreValue;
    } else {
      review.notes = value;
    }
    
    newReviews.set(studentId, review);
    setReviews(newReviews);
  };

  const saveReviews = async () => {
    setLoading(true);
    try {
      const monthNum = parseInt(selectedMonth) + 1;
      const yearNum = parseInt(selectedYear);

      const reviewsToSave = Array.from(reviews.values())
        .filter(review => review.score !== null)
        .map(review => ({
          student_id: review.student_id,
          month: monthNum,
          year: yearNum,
          score: review.score,
          notes: review.notes || null
        }));

      if (reviewsToSave.length === 0) {
        toast({
          title: "تنبيه",
          description: "لا توجد نسب بر لحفظها",
          variant: "destructive",
        });
        return;
      }

      // @ts-ignore - monthly_reviews table will be added after migration
      const { error } = await (supabase as any)
        .from('monthly_reviews')
        .upsert(reviewsToSave, {
          onConflict: 'student_id,month,year'
        });

      if (error) throw error;

      toast({
        title: "تم بنجاح",
        description: `تم حفظ نسبة البر لـ ${reviewsToSave.length} طالب`,
      });

      fetchExistingReviews();
    } catch (error) {
      console.error('Error saving reviews:', error);
      toast({
        title: "خطأ",
        description: "فشل في حفظ نسبة البر",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const months = [
    { value: "0", label: "يناير" },
    { value: "1", label: "فبراير" },
    { value: "2", label: "مارس" },
    { value: "3", label: "أبريل" },
    { value: "4", label: "مايو" },
    { value: "5", label: "يونيو" },
    { value: "6", label: "يوليو" },
    { value: "7", label: "أغسطس" },
    { value: "8", label: "سبتمبر" },
    { value: "9", label: "أكتوبر" },
    { value: "10", label: "نوفمبر" },
    { value: "11", label: "ديسمبر" },
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <ProtectedTeacherRoute>
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background islamic-pattern">
        <TeacherNavbar />
        
        <main className="container mx-auto px-4 py-8">
          <div className="islamic-card p-6 fade-in-up">
            <div className="flex items-center gap-4 mb-6">
              <BookOpen className="w-12 h-12 text-primary" />
              <div>
                <h1 className="text-3xl font-bold text-primary mb-2">بر الوالدين</h1>
                <p className="text-muted-foreground">تسجيل نسبة برّ الطالب بوالديه شهريًا بناءً على تواصل المعلم مع ولي الأمر</p>
              </div>
            </div>

            <Card className="p-6 mb-6">
              <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center mb-6">
                <div className="flex-1">
                  <Label className="text-base font-semibold">الشهر</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="mt-2 bg-background">
                      <SelectValue placeholder="اختر الشهر" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((month) => (
                        <SelectItem key={month.value} value={month.value}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1">
                  <Label className="text-base font-semibold">السنة</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="mt-2 bg-background">
                      <SelectValue placeholder="اختر السنة" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button onClick={saveReviews} disabled={loading} className="gap-2">
                    <Save className="w-4 h-4" />
                    {loading ? "جاري الحفظ..." : "حفظ نسب البر"}
                  </Button>
                </div>
              </div>

              {students.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-muted-foreground mb-2">لا يوجد طلاب</h3>
                  <p className="text-muted-foreground">
                    لا توجد طلاب مسجلين في حلقتك حالياً
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto" dir="rtl">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">اسم الطالب</TableHead>
                        <TableHead className="text-center">نسبة البر (%)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student) => {
                        const review = reviews.get(student.id);
                        const score = review?.score;
                        const indicatorClass = score === null || score === undefined
                          ? "bg-muted-foreground/40"
                          : score >= 80
                            ? "bg-green-600"
                            : score >= 50
                              ? "bg-yellow-500"
                              : "bg-red-600";
                        const indicatorLabel = score === null || score === undefined
                          ? "غير مسجل"
                          : score >= 80
                            ? "مرتفع"
                            : score >= 50
                              ? "متوسط"
                              : "منخفض";
                        return (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">{student.name}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-3">
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="1"
                                  inputMode="numeric"
                                  value={review?.score ?? ''}
                                  onChange={(e) => updateReview(student.id, 'score', e.target.value)}
                                  placeholder="0-100"
                                  aria-label={`نسبة بر ${student.name}`}
                                  className="w-24 text-center"
                                />
                                <span className="inline-flex min-w-16 items-center justify-start gap-1.5 text-sm text-muted-foreground" aria-label={`مؤشر النسبة: ${indicatorLabel}`}>
                                  <span className={`h-3 w-3 shrink-0 rounded-full ${indicatorClass}`} />
                                  {indicatorLabel}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </div>
        </main>
      </div>
    </ProtectedTeacherRoute>
  );
};

export default MonthlyReview;
