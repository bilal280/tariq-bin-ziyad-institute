import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Facebook, LogIn, MessageCircle, Phone, Search, Send, ShieldCheck, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PublicLayout from "@/components/PublicLayout";

const palette = {
  primary: "#1B4B7A",
  primaryDark: "#123758",
  secondary: "#2FA3B0",
  gold: "#C9A857",
  goldLight: "#E8D49A",
  tealLight: "#D6EBF0",
  bg: "#F6F8F9",
  text: "#1A2A3A",
  textMuted: "#5B6B7A",
};

const PublicHome = () => {
  const navigate = useNavigate();
  const [showStudentDialog, setShowStudentDialog] = useState(false);
  const [studentNumber, setStudentNumber] = useState("");

  const handleStudentSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!studentNumber.trim()) return;
    navigate(`/student/${studentNumber.trim()}`);
    setShowStudentDialog(false);
    setStudentNumber("");
  };

  const features = [
    { icon: BookOpen, title: "متابعة الحفظ", text: "سجل واضح لمسيرة الطالب في حفظ القرآن الكريم والأحاديث." },
    { icon: Users, title: "إدارة الحلقات", text: "تنظيم الطلاب والحلقات ومتابعة الأعمال اليومية بسهولة." },
    { icon: ShieldCheck, title: "تواصل موثوق", text: "متابعة تربوية مستمرة بين المعهد والأسرة." },
  ];

  const contactLinks = [
    { icon: Facebook, label: "فيسبوك", href: "https://facebook.com/your-institute" },
    { icon: Send, label: "تلغرام", href: "https://t.me/your-channel" },
    { icon: MessageCircle, label: "واتساب", href: "https://wa.me/9647XXXXXXXXX" },
    { icon: Phone, label: "+964 7XX XXX XXXX", href: "tel:+9647XXXXXXXXX" },
  ];

  return (
    <PublicLayout>
      <div dir="rtl" className="min-h-screen" style={{ backgroundColor: palette.bg, color: palette.text, fontFamily: "'Tajawal', 'Cairo', sans-serif" }}>
        <section className="relative overflow-hidden px-5 pb-16 pt-8 text-white sm:pb-24 sm:pt-12" style={{ background: `linear-gradient(118deg, ${palette.primaryDark} 0%, ${palette.primary} 58%, ${palette.secondary} 140%)` }}>
          <div className="mx-auto max-w-6xl">
            <div className="flex items-center justify-between gap-4">
              <a href="#about" className="text-sm font-bold text-white/80 transition hover:text-white"></a>
            </div>
            <div className="grid items-center gap-12 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
              <div className="max-w-3xl text-right">
              <span className="mb-5 inline-flex items-center gap-2 text-sm font-bold" style={{ color: palette.goldLight }}>
                
              </span>
              <h1 className="max-w-2xl text-4xl font-black leading-tight sm:text-6xl">معهد جامع طارق بن زباد</h1>
              <div className="mt-7 h-px w-36" style={{ backgroundColor: palette.gold }} />
              <p className="mt-7 max-w-xl text-base leading-8 text-white/85 sm:text-lg">بيئة تربوية هادئة تعين أبناءنا على حفظ كتاب الله، وتنمية السلوك، ومتابعة التقدم بثقة ووضوح.</p>
              
              </div>
              <div className="relative mx-auto w-full max-w-sm rounded-3xl border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur-sm">
                <div className="absolute -top-3 right-8 rounded-full px-4 py-1 text-xs font-bold text-white shadow-md" style={{ backgroundColor: palette.gold }}>منذ جيلٍ إلى جيل</div>
                <div className="flex items-center gap-4 border-b border-white/15 pb-5">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2 shadow-md">
                    <img src="/institute-logo.jpg" alt="" className="h-full w-full rounded-xl object-cover" />
                  </div>
                  <div>
                    <p className="text-sm text-white/70">رسالتنا</p>
                    <p className="mt-1 text-lg font-bold">حفظٌ، تربيةٌ، متابعة</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-5 text-center">
                  <div><p className="text-2xl font-black" style={{ color: palette.goldLight }}>+100</p><p className="mt-1 text-xs text-white/70">طالب</p></div>
                  <div><p className="text-2xl font-black" style={{ color: palette.goldLight }}>+8</p><p className="mt-1 text-xs text-white/70">أستاذ</p></div>
                  <div><p className="text-2xl font-black" style={{ color: palette.goldLight }}>+6</p><p className="mt-1 text-xs text-white/70">حلقة</p></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <main className="mx-auto max-w-6xl px-5">
          <section id="about" className="grid gap-10 py-20 sm:py-28 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">
            <div>
              <span className="text-sm font-bold" style={{ color: palette.gold }}>01 / عن المعهد</span>
              <h2 className="mt-3 text-3xl font-black sm:text-4xl" style={{ color: palette.primary }}>رحلة تحفظ المعنى قبل الحروف</h2>
            </div>
            <p className="max-w-3xl text-base leading-9 sm:text-lg" style={{ color: palette.textMuted }}>معهد القرآن الكريم مؤسسة تعليمية إسلامية متخصصة في تحفيظ القرآن الكريم والأحاديث النبوية الشريفة. نعمل بمنهج يجمع بين جودة التعليم والعناية بالتربية، مع متابعة دقيقة لمسيرة كل طالب وتواصل مستمر مع الأسرة.</p>
          </section>

          <section className="border-t py-20 sm:py-28" style={{ borderColor: `${palette.goldLight}66` }}>
            <div className="mb-10"><span className="text-sm font-bold" style={{ color: palette.gold }}>02 / خدماتنا</span><h2 className="mt-3 text-3xl font-black sm:text-4xl" style={{ color: palette.primary }}>نظام يرافق الطالب</h2></div>
            <div className="grid gap-5 md:grid-cols-3">
              {features.map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-2xl border-t-4 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-md" style={{ borderColor: palette.gold }}>
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: palette.tealLight }}><Icon className="h-6 w-6" style={{ color: palette.secondary }} /></div>
                  <h3 className="text-xl font-bold" style={{ color: palette.primary }}>{title}</h3>
                  <p className="mt-3 text-sm leading-7" style={{ color: palette.textMuted }}>{text}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="contact" className="border-t py-20 sm:py-28" style={{ borderColor: `${palette.goldLight}66` }}>
            <div className="grid gap-10 sm:grid-cols-[1fr_auto] sm:items-end">
              <div><span className="text-sm font-bold" style={{ color: palette.gold }}>03 / تواصل معنا</span><h2 className="mt-3 text-3xl font-black sm:text-4xl" style={{ color: palette.primary }}>نبقى قريبين منكم</h2><p className="mt-4 max-w-xl leading-8" style={{ color: palette.textMuted }}>للاستفسار أو متابعة أخبار المعهد، يسعدنا تواصلكم عبر القنوات التالية.</p></div>
              <Button variant="outline" onClick={() => setShowStudentDialog(true)} className="h-11 rounded-xl border-2 px-5 font-bold" style={{ borderColor: palette.primary, color: palette.primary }}><Search className="ml-2 h-4 w-4" />عرض تقرير طالب</Button>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {contactLinks.map(({ icon: Icon, label, href }) => <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"><span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: palette.tealLight }}><Icon className="h-5 w-5" style={{ color: palette.secondary }} /></span><span className="font-bold" style={{ color: palette.primary }}>{label}</span></a>)}
            </div>
          </section>
        </main>

        <Dialog open={showStudentDialog} onOpenChange={setShowStudentDialog}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader><DialogTitle style={{ color: palette.primary }}>عرض تقرير الطالب</DialogTitle><DialogDescription>أدخل رقم الطالب للوصول إلى تقريره الشامل</DialogDescription></DialogHeader>
            <form onSubmit={handleStudentSearch} className="mt-4 space-y-4">
              <Label htmlFor="studentNumber">رقم الطالب</Label>
              <div className="relative"><Search className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2" style={{ color: palette.textMuted }} /><Input id="studentNumber" value={studentNumber} onChange={(event) => setStudentNumber(event.target.value)} placeholder="أدخل رقم الطالب" className="h-11 pr-10" autoFocus /></div>
              <Button type="submit" className="h-11 w-full rounded-xl font-bold text-white" style={{ backgroundColor: palette.primary }}>عرض التقرير</Button>
            </form>
            <button type="button" aria-label="إغلاق" onClick={() => setShowStudentDialog(false)} className="absolute left-4 top-4 opacity-60 hover:opacity-100"><X className="h-4 w-4" /></button>
          </DialogContent>
        </Dialog>
      </div>
    </PublicLayout>
  );
};

export default PublicHome;
