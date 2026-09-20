# V10 — نشر البوابة فعليًا

## المتطلبات
- سيرفر Linux (يفضل Ubuntu 24.04 أو ما يعادله)
- Docker + Docker Compose
- اسم نطاق يشير إلى IP السيرفر
- فتح المنفذين 80 و443
- بريد يمكن استخدامه لشهادة TLS

## التشغيل
1. انسخ المشروع إلى السيرفر.
2. انسخ `.env.production.example` إلى `.env`.
3. ضع كلمة مرور PostgreSQL قوية جدًا.
4. عدّل `deploy/nginx.conf` واستبدل `YOUR_DOMAIN` باسم النطاق.
5. شغّل:
   `docker compose up -d --build`
6. ادخل إلى حاوية التطبيق وشغّل تهيئة قاعدة البيانات:
   `docker compose exec app sh scripts/db-init.sh`
7. أنشئ حساب الإدارة:
   `docker compose exec app node scripts/bootstrap_admin.js admin 'كلمة_مرور_قوية' admin`
8. اربط شهادة TLS عبر Let's Encrypt/Certbot، ثم حدّث إعداد Nginx ليستخدم 443 ويحوّل HTTP إلى HTTPS.
9. اختبر:
   `/api/health`
   ثم `/` و`/admin`.

## النسخ الاحتياطي
داخل حاوية التطبيق:
`docker compose exec app sh scripts/backup.sh`

للاستعادة:
`docker compose exec app sh scripts/restore.sh backups/file.dump`

## قبل فتح النظام للمرضى
- لا تستخدم كلمة مرور افتراضية.
- HTTPS إلزامي.
- لا تضع بيانات المرضى في Git أو ملفات عامة.
- راجع صلاحيات كل حساب.
- حدد سياسة الاحتفاظ ببيانات الحجوزات.
- فعّل نسخًا احتياطية خارج السيرفر واختبر الاستعادة.
- راجع ساعات دوام كل طبيب قبل تفعيل الحجز العام.
