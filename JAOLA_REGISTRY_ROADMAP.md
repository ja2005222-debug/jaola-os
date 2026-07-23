# 🏛️ خارطة طريق: JAOLA Registry — «إعادة التركيب لا التوليد»

> قرار معماريّ (المستخدم كرئيس معماريّ): JAOLA تبني أي منتج (SaaS، متجر، سفر،
> ERP، CRM، Cinema…) عبر **إعادة تركيب مكوّنات احترافية جاهزة ثم تخصيصها** —
> لا توليد كل شيء من الصفر (أبطأ وأقلّ جودة).
>
> التوصية المحورية: **لا** نربط JAOLA بعشرات المواقع مباشرةً (تعقيد وصيانة).
> بل نبني **JAOLA Registry** مملوكاً محلّياً: يستورد أولاً من المصادر المفتوحة،
> ثم يخزّن نسخة **مصنّفة ومختبَرة** محلّياً — فيصبح أصلاً تقنيّاً لـ JAOLA:
> جودة ثابتة، سرعة أعلى، بلا اعتماد خارجيّ في كل بناء.

---

## دور الذكاء الجديد
```
اختيار أفضل مكوّن → تخصيصه → دمجه → اختباره → تشغيله
```
لا «كتابة كل شيء».

## بنية الـ Registry
```
JAOLA Registry
├── Components   (أزرار/نوافذ/بطاقات…)
├── Blocks/Sections (Hero/Features/Pricing/FAQ/CTA/Footer…)  ← نبدأ هنا
├── Templates/Starters (Marketplace/SaaS/CRM/ERP/Travel/Cinema/…)
├── Layouts
├── Dashboards (Tremor/Recharts/TanStack Table)
├── Charts
├── Forms (React Hook Form + Zod)
├── Icons (Lucide/Heroicons/Tabler/Phosphor)
├── Animations (Framer Motion/Lottie)
├── Maps/Editors (MapLibre/Leaflet · Monaco/TipTap/Lexical)
├── APIs
└── Agents
```

## الطبقات وأولوياتها (من المستخدم)
| الأولوية | الفئة |
|---|---|
| ⭐⭐⭐⭐⭐ | UI Components · Templates · **Blocks/Sections** |
| ⭐⭐⭐⭐ | Icons · Dashboards · Animations · CMS |
| ⭐⭐⭐ | Design Systems (لاحقاً) |

مصادر مرشّحة للاستيراد: shadcn/ui · Magic UI · Aceternity · Origin UI · Flowbite ·
Preline · HyperUI · Meraki · DaisyUI · Tremor · Recharts · TanStack Table.

---

## ملاحظة معماريّة صادقة (توتّر يجب إدارته)
رؤية المصادر أعلاه **React/Tailwind/shadcn** — وهذا مسار «المشروع الكبير» الذي
كان **الأقلّ موثوقية** في JAOLA (فشل «متجر عطور» الذي بنى إدارة مشاريع كان على
مسار React). بينما المسار **المكتفي ذاتياً** (قوالبنا التي تجتاز jsdom) هو الأمتن.

**لذا نُنفّذ على مراحل، نبدأ بما هو مُثبت:**
1. **Blocks/Sections مكتفية ذاتياً** (HTML/CSS، بلا build، تجتاز التحقّق) → إعادة
   تركيب فوريّ لصفحات هبوط/تسويق. *(المرحلة الحالية)*
2. تعميق الـ Starters المحلّية (لدينا 13 قالباً عاملاً = طبقة Templates).
3. **خطّ أنابيب React/Tailwind** (build + معاينة) — شرطٌ لاستيعاب shadcn/Magic UI
   بجودة. يُبنى قبل الاعتماد على تلك المصادر.
4. **مُستورِد الـ Registry**: يجلب من OSS مرّة، يخزّن نسخة مصنّفة+مختبَرة محلّياً.
5. **بحث المستودعات** (GitHub/npm/shadcn Registry) → «وجدت 14، سأستخدم أفضل 3، أدمجها».
   (لدينا أساسه: `starterFetch.js` — أدمن حالياً.)

---

## المرحلة الحالية (منجزة كأول لبنة)
**`blockRegistry.js`**: سجلّ أقسام مكتفية ذاتياً (Nav/Hero/Logos/Features/Stats/
Pricing/Testimonials/FAQ/CTA/Footer) + `composePage()` يركّب صفحة كاملة مخصّصة
(علامة + لون) من أقسام مختارة، تجتاز التحقّق البنيوي. هذه نواة «إعادة التركيب».

---

## أول شريحة تالية موصى بها
ربط `composePage` بمسار البناء: طلب صفحة هبوط/تسويق → يختار الذكاء الأقسام
المناسبة من السجلّ → يركّبها → يضع البصمة (علامة/لون/بيانات) → يُلمّع → يُعاين.

---

_سُجّلت كقرار معماريّ مرجعيّ. الاستثمار في Registry مملوك أثمن على المدى الطويل
من الاعتماد المباشر على مصادر متعدّدة في كل طلب._
