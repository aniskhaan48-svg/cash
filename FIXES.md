# أهم الإصلاحات المنفذة

1. تحويل المشروع إلى Monorepo نظيف ومناسب للرفع إلى GitHub.
2. إزالة أي اعتماد على Vercel أو ملفات نشر خاصة به.
3. إضافة `railway.json` مستقل لكل من Backend وFrontend.
4. تثبيت Node.js على السلسلة `20.x` لثبات البناء على Railway.
5. تجهيز Backend ليستخدم `PORT` الذي توفره Railway تلقائيًا.
6. إضافة `/health` كمسار فحص صحة للـ Backend.
7. إبقاء بيانات TiDB و`JWT_SECRET` خارج GitHub عبر Environment Variables فقط.
8. تغيير اتصال الواجهة بالـ Backend إلى Proxy داخل Next.js عند `/api/backend/*`.
9. جعل رابط الـ Backend متغيرًا سريًا وقت التشغيل باسم `BACKEND_URL` بدل نشره داخل JavaScript للمتصفح.
10. إبقاء JWT في Authorization header وتمريره عبر الـ Proxy بدون تغيير.
11. دعم GET/POST/PUT/PATCH/DELETE/OPTIONS في الـ Proxy.
12. إضافة `.gitignore` مركزي يمنع رفع `.env` و`node_modules` وملفات البناء.
13. إضافة README يشرح رفع GitHub وإنشاء خدمتين منفصلتين على Railway من نفس المستودع.
14. الحفاظ على النظام المالي الحالي، الصناديق، التقارير، Excel/PDF، المستخدمين والمخزون دون تغيير منطق البيانات.
