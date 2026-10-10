import { useEffect, useState } from "react";
import { Gift, ImageOff, Star } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import PageHero from "@/components/PageHero";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { supabase } from "@/integrations/supabase/client";

interface GiftItem {
  id: string;
  name: string;
  star_price: number;
  image_url: string;
}

const Gifts = () => {
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const { register } = useScrollReveal();

  useEffect(() => {
    const fetchGifts = async () => {
      const { data, error } = await supabase
        .from("gifts")
        .select("id, name, star_price, image_url")
        .order("star_price", { ascending: true });

      if (error) {
        console.error("Error loading gifts:", error);
        setLoadError(true);
      } else {
        setGifts((data || []) as GiftItem[]);
      }
      setLoading(false);
    };

    fetchGifts();
  }, []);

  return (
    <PublicLayout>
      <PageHero
        badge="متجر الإنجاز"
        icon={Gift}
        title="الهدايا"
        highlight="والنجوم"
        subtitle=""
      />

      <section
        ref={register("gifts")}
        className="container mx-auto px-4 pb-20"
      >
        <div className="mx-auto mb-10 flex max-w-6xl flex-col items-center justify-between gap-4 rounded-2xl border border-secondary/30 bg-secondary/10 p-5 text-center sm:flex-row sm:text-right">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-secondary/25 p-3"><Star className="h-7 w-7 fill-secondary-dark text-secondary-dark" /></div><div><p className="font-bold text-primary">رصيدك يصنع الفرق</p><p className="text-sm text-muted-foreground">كل يوم حضور يضيف نجمة إلى رحلة إنجازك</p></div></div>
          <span className="rounded-full bg-card px-4 py-2 text-sm font-bold text-primary shadow-sm">النجوم = فرصتك للاختيار</span>
        </div>

        {loading ? (
          <p className="py-12 text-center text-muted-foreground">جاري تحميل الهدايا...</p>
        ) : loadError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 py-12 text-center text-red-700">
            تعذر تحميل الهدايا حاليًا. يرجى تحديث الصفحة والمحاولة مرة أخرى.
          </div>
        ) : gifts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-primary/20 py-12 text-center text-muted-foreground">ستظهر الهدايا هنا قريبًا.</div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {gifts.map(({ id, name, star_price, image_url }) => (
              <article
                key={id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-primary/10 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="relative flex h-48 w-full items-center justify-center overflow-hidden bg-gradient-to-br from-primary/5 to-secondary/5">
                  {failedImages.has(id) ? (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ImageOff className="h-10 w-10" />
                      <span className="text-sm">صورة الهدية غير متاحة</span>
                    </div>
                  ) : (
                    <img
                      src={image_url}
                      alt={name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={() => setFailedImages((previous) => new Set(previous).add(id))}
                    />
                  )}
                </div>
                <div className="flex flex-col p-5 text-right">
                  <h2 className="mb-2 text-lg font-bold text-primary">{name}</h2>
                  <div className="flex items-center justify-between border-t border-border pt-4">
                    <span className="text-sm text-muted-foreground">السعر</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/20 px-3 py-1.5 font-black text-secondary-dark">
                      <Star className="h-4 w-4 fill-secondary-dark" />
                      {star_price} نجوم
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </PublicLayout>
  );
};

export default Gifts;