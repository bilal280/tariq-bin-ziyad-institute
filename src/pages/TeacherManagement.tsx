import { useState, useEffect } from "react";
import AdminNavbar from "@/components/AdminNavbar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, UserCheck, Eye, EyeOff } from "lucide-react";

interface Teacher {
  id: string;
  name: string;
  password: string;
  circlesCount: number;
  studentsCount: number;
}

interface LabExaminer {
  id: string;
  name: string;
}

const LabExaminersManagement = () => {
  const [examiners, setExaminers] = useState<LabExaminer[]>([]);
  const [name, setName] = useState("");
  const [editingExaminer, setEditingExaminer] = useState<LabExaminer | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchExaminers();
  }, []);

  const fetchExaminers = async () => {
    const { data, error } = await supabase
      .from('lab_examiners')
      .select('id, name')
      .order('name');

    if (error) {
      toast({ title: "خطأ", description: "فشل تحميل المختبرين", variant: "destructive" });
      return;
    }

    setExaminers(data || []);
  };

  const resetForm = () => {
    setName("");
    setEditingExaminer(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;

    const query = editingExaminer
      ? supabase.from('lab_examiners').update({ name: name.trim() }).eq('id', editingExaminer.id)
      : supabase.from('lab_examiners').insert({ name: name.trim() });
    const { error } = await query;

    if (error) {
      toast({ title: "خطأ", description: error.message.includes('duplicate') ? "اسم المختبر موجود مسبقاً" : "فشل حفظ المختبر", variant: "destructive" });
      return;
    }

    toast({ title: "تم بنجاح", description: editingExaminer ? "تم تعديل المختبر" : "تم إضافة المختبر" });
    setDialogOpen(false);
    resetForm();
    fetchExaminers();
  };

  const deleteExaminer = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا المختبر؟")) return;
    const { error } = await supabase.from('lab_examiners').delete().eq('id', id);
    if (error) {
      toast({ title: "خطأ", description: "فشل حذف المختبر", variant: "destructive" });
      return;
    }
    toast({ title: "تم الحذف", description: "تم حذف المختبر" });
    fetchExaminers();
  };

  return (
    <Card className="mt-8">
      <CardHeader className="flex flex-row items-center justify-between">
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-amber-600 hover:bg-amber-700"><Plus className="w-4 h-4 mr-2" />إضافة مختبر</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="text-right">{editingExaminer ? "تعديل اسم المختبر" : "إضافة مختبر جديد"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="lab-examiner-name" className="text-right block">اسم المختبر</Label><Input id="lab-examiner-name" value={name} onChange={(event) => setName(event.target.value)} className="text-right" required /></div>
              <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button><Button type="submit" className="bg-amber-600 hover:bg-amber-700">{editingExaminer ? "تحديث" : "إضافة"}</Button></div>
            </form>
          </DialogContent>
        </Dialog>
        <CardTitle className="text-right">إدارة المختبرين</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-right text-sm text-gray-600 mb-4">المختبرون مستقلون عن حسابات الأساتذة، ويظهر اختيارهم عند تسجيل اختبار جديد.</p>
        <Table>
          <TableHeader><TableRow><TableHead className="text-right">الإجراءات</TableHead><TableHead className="text-right">اسم المختبر</TableHead></TableRow></TableHeader>
          <TableBody>
            {examiners.map((examiner) => (
              <TableRow key={examiner.id}>
                <TableCell><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setEditingExaminer(examiner); setName(examiner.name); setDialogOpen(true); }}><Edit className="w-4 h-4" /></Button><Button size="sm" variant="outline" className="text-red-600" onClick={() => deleteExaminer(examiner.id)}><Trash2 className="w-4 h-4" /></Button></div></TableCell>
                <TableCell className="text-right font-medium">{examiner.name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

const TeacherManagement = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const { toast } = useToast();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [showPasswords, setShowPasswords] = useState<{[key: string]: boolean}>({});
  const [formData, setFormData] = useState({
    name: "",
    password: ""
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    try {
      const { data: teachersData, error } = await supabase
        .from('teachers')
        .select('*');

      if (error) throw error;

      // Get circles count for each teacher
      const teachersWithCounts = await Promise.all(
        teachersData.map(async (teacher) => {
          const { data: circlesData } = await supabase
            .from('circles')
            .select('id')
            .eq('teacher_id', teacher.id);

          const { data: studentsData } = await supabase
            .from('students')
            .select('id')
            .in('circle_id', circlesData?.map(c => c.id) || []);

          return {
            ...teacher,
            circlesCount: circlesData?.length || 0,
            studentsCount: studentsData?.length || 0
          };
        })
      );

      setTeachers(teachersWithCounts);
    } catch (error) {
      console.error('Error fetching teachers:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء جلب بيانات الأساتذة",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (editingTeacher) {
        // Update existing teacher
        const { error } = await supabase
          .from('teachers')
          .update({
            name: formData.name,
            password: formData.password
          })
          .eq('id', editingTeacher.id);

        if (error) throw error;

        toast({
          title: "تم التحديث بنجاح",
          description: "تم تحديث بيانات الأستاذ",
        });
      } else {
        // Add new teacher
        const { error } = await supabase
          .from('teachers')
          .insert({
            name: formData.name,
            password: formData.password
          });

        if (error) throw error;

        toast({
          title: "تم الإضافة بنجاح",
          description: "تم إضافة الأستاذ الجديد",
        });
      }

      setFormData({
        name: "",
        password: ""
      });
      setIsAddDialogOpen(false);
      setEditingTeacher(null);
      
      // Refresh teachers list
      fetchTeachers();
    } catch (error) {
      console.error('Error saving teacher:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ البيانات",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      name: teacher.name,
      password: teacher.password
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('teachers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "تم الحذف بنجاح",
        description: "تم حذف الأستاذ",
      });

      // Refresh teachers list
      fetchTeachers();
    } catch (error) {
      console.error('Error deleting teacher:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حذف الأستاذ",
        variant: "destructive",
      });
    }
  };

  const togglePasswordVisibility = (teacherId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [teacherId]: !prev[teacherId]
    }));
  };

  const resetForm = () => {
    setFormData({
      name: "",
      password: ""
    });
    setEditingTeacher(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNavbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" />
                إضافة أستاذ جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-right">
                  {editingTeacher ? "تعديل بيانات الأستاذ" : "إضافة أستاذ جديد"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-right block">اسم الأستاذ</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="أدخل اسم الأستاذ"
                    className="text-right"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-right block">كلمة المرور</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    placeholder="أدخل كلمة المرور"
                    className="text-right"
                    required
                  />
                </div>

                <div className="flex justify-end space-x-2 space-x-reverse pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    إلغاء
                  </Button>
                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={isLoading}>
                    {isLoading ? "جاري الحفظ..." : (editingTeacher ? "تحديث" : "إضافة")}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <h2 className="text-3xl font-bold text-gray-900 text-right">
            إدارة الأساتذة
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <UserCheck className="w-8 h-8 text-emerald-600" />
                <div className="text-right">
                  <p className="text-2xl font-bold">{teachers.length}</p>
                  <p className="text-sm text-gray-600">إجمالي الأساتذة</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <UserCheck className="w-8 h-8 text-blue-600" />
                <div className="text-right">
                  <p className="text-2xl font-bold">
                    {teachers.reduce((sum, teacher) => sum + teacher.circlesCount, 0)}
                  </p>
                  <p className="text-sm text-gray-600">إجمالي الحلقات</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <UserCheck className="w-8 h-8 text-purple-600" />
                <div className="text-right">
                  <p className="text-2xl font-bold">
                    {teachers.reduce((sum, teacher) => sum + teacher.studentsCount, 0)}
                  </p>
                  <p className="text-sm text-gray-600">إجمالي الطلاب</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-right">قائمة الأساتذة</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الإجراءات</TableHead>
                  <TableHead className="text-right">عدد الطلاب</TableHead>
                  <TableHead className="text-right">عدد الحلقات</TableHead>
                  <TableHead className="text-right">كلمة المرور</TableHead>
                  <TableHead className="text-right">اسم الأستاذ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((teacher) => (
                  <TableRow key={teacher.id}>
                    <TableCell>
                      <div className="flex space-x-2 space-x-reverse">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(teacher)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(teacher.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{teacher.studentsCount}</TableCell>
                    <TableCell className="text-right">{teacher.circlesCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => togglePasswordVisibility(teacher.id)}
                        >
                          {showPasswords[teacher.id] ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                        <span className="font-mono">
                          {showPasswords[teacher.id] ? teacher.password : "••••••"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{teacher.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <LabExaminersManagement />
      </div>
    </div>
  );
};

export default TeacherManagement;