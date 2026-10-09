import { useEffect, useState } from "react";
import { Gift, ImagePlus, Pencil, Trash2, Upload } from "lucide-react";
import AdminNavbar from "@/components/AdminNavbar";
import ProtectedAdminRoute from "@/components/ProtectedAdminRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface GiftItem {
  id: string;
  name: string;
  star_price: number;
  image_url: string;
}

const AdminGifts = () => {
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [name, setName] = useState("");
  const [starPrice, setStarPrice] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => { fetchGifts(); }, []);

  const fetchGifts = async () => {
    const { data, error } = await supabase.from("gifts").select("id, name, star_price, image_url").order("star_price");
    if (error) toast({ title: "خطأ", description: "فشل تحميل الهدايا", variant: "destructive" });
    else setGifts((data || []) as GiftItem[]);
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      toast({ title: "صورة غير صالحة", description: "اختر صورة أقل من 5 ميجابايت", variant: "destructive" });
      return;
    }
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const resetForm = () => {
    setName(""); setStarPrice(""); setImageFile(null); setPreview(""); setEditingId(null);
  };

  const uploadImage = async (file: File) => {
    const extension = file.name.split(".").pop() || "jpg";
    const path = `gifts/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("student-photos").upload(path, file, { upsert: false, cacheControl: "3600" });
    if (error) throw error;
    return supabase.storage.from("student-photos").getPublicUrl(path).data.publicUrl;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !Number.isInteger(Number(starPrice)) || Number(starPrice) < 1 || (!editingId && !imageFile)) {
      toast({ title: "بيانات ناقصة", description: "أدخل اسم الهدية وسعرها واختر صورة", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const current = gifts.find((gift) => gift.id === editingId);
      const imageUrl = imageFile ? await uploadImage(imageFile) : current?.image_url;
      if (!imageUrl) throw new Error("الصورة مطلوبة");
      const payload = { name: name.trim(), star_price: Number(starPrice), image_url: imageUrl };
      const query = editingId
        ? supabase.from("gifts").update(payload).eq("id", editingId)
        : supabase.from("gifts").insert(payload);
      const { error } = await query;
      if (error) throw error;
      toast({ title: "تم الحفظ", description: editingId ? "تم تعديل الهدية" : "تمت إضافة الهدية" });
      resetForm();
      fetchGifts();
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message || "فشل حفظ الهدية", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const editGift = (gift: GiftItem) => { setEditingId(gift.id); setName(gift.name); setStarPrice(String(gift.star_price)); setPreview(gift.image_url); setImageFile(null); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const deleteGift = async (gift: GiftItem) => {
    if (!window.confirm(`هل تريد حذف هدية ${gift.name}؟`)) return;
    const { error } = await supabase.from("gifts").delete().eq("id", gift.id);
    if (error) toast({ title: "خطأ", description: "فشل حذف الهدية", variant: "destructive" });
    else { toast({ title: "تم الحذف", description: "تم حذف الهدية" }); fetchGifts(); }
  };

  return <ProtectedAdminRoute><div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background islamic-pattern"><AdminNavbar /><main className="container mx-auto px-4 py-8 space-y-8">
    <Card className="islamic-card max-w-2xl mx-auto"><CardHeader><CardTitle className="flex items-center gap-3 text-right text-3xl text-primary"><Gift className="h-8 w-8" />{editingId ? "تعديل هدية" : "إضافة هدية"}</CardTitle></CardHeader><CardContent><form onSubmit={handleSubmit} className="space-y-5">
      <div><Label htmlFor="gift-name">اسم الهدية</Label><Input id="gift-name" value={name} onChange={(event) => setName(event.target.value)} className="mt-2 text-right" placeholder="مثال: حقيبة الطالب" /></div>
      <div><Label htmlFor="gift-price">السعر بالنجوم</Label><Input id="gift-price" type="number" min="1" step="1" value={starPrice} onChange={(event) => setStarPrice(event.target.value)} className="mt-2 text-right" placeholder="مثال: 15" /></div>
      <div><Label htmlFor="gift-image">صورة الهدية</Label><Input id="gift-image" type="file" accept="image/*" onChange={handleImageChange} className="mt-2 cursor-pointer" />{preview && <img src={preview} alt="معاينة الهدية" className="mt-3 h-40 w-full rounded-xl object-cover" />}</div>
      <div className="flex gap-3"><Button type="submit" disabled={loading} className="flex-1"><Upload className="h-4 w-4" />{loading ? "جاري الحفظ..." : "حفظ الهدية"}</Button>{editingId && <Button type="button" variant="outline" onClick={resetForm}>إلغاء التعديل</Button>}</div>
    </form></CardContent></Card>
    <section><h2 className="mb-5 flex items-center gap-2 text-2xl font-bold text-primary"><ImagePlus className="h-6 w-6" />الهدايا الحالية</h2><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{gifts.map((gift) => <Card key={gift.id} className="overflow-hidden"><img src={gift.image_url} alt={gift.name} className="h-44 w-full object-cover" /><CardContent className="space-y-3 p-4 text-right"><h3 className="font-bold">{gift.name}</h3><p className="text-sm text-muted-foreground">{gift.star_price} نجوم</p><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => editGift(gift)}><Pencil className="h-4 w-4" />تعديل</Button><Button size="sm" variant="destructive" onClick={() => deleteGift(gift)}><Trash2 className="h-4 w-4" />حذف</Button></div></CardContent></Card>)}</div></section>
  </main></div></ProtectedAdminRoute>;
};

export default AdminGifts;