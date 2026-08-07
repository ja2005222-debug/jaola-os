/**
 * ☁️ r2Storage.js — تخزين ملفات الفيديو في Cloudflare R2 (متوافق مع S3)
 *
 * لماذا R2 تحديداً: **بلا رسوم نقل بيانات صادر (egress)** — والفيديو ملف
 * كبير يُنزَّل مراراً، فرسوم الصادر لدى S3 التقليدي هي البند الذي يفاجئ
 * الفاتورة. الواجهة هنا S3 قياسية، فأي مزوّد S3 آخر يعمل بتغيير
 * S3_ENDPOINT وحده.
 *
 * لا رابط عام دائم أبداً: الدلو يبقى خاصاً، والتنزيل يمر بمسار الخدمة
 * الذي يتحقق من ملكية المهمة ثم يوقّع رابطاً صالحاً دقائق معدودة.
 */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// سقف حجم الملف المنسوخ — حارس ضد استنزاف الذاكرة/التخزين بملف شاذ.
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export function createR2Storage({
    accountId, accessKeyId, secretAccessKey, bucket,
    endpoint, signedUrlTtlSec = 600, clientFactory, fetchImpl = fetch,
}) {
    if (!bucket) throw new Error('R2_BUCKET مطلوب لتخزين الفيديو.');
    if (!accessKeyId || !secretAccessKey) throw new Error('مفاتيح R2 مطلوبة (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY).');
    const resolvedEndpoint = endpoint || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null);
    if (!resolvedEndpoint) throw new Error('R2_ACCOUNT_ID أو S3_ENDPOINT مطلوب.');

    const client = clientFactory ? clientFactory() : new S3Client({
        region: 'auto', // R2 لا مناطق لها — 'auto' هو المتفق عليه في واجهتها
        endpoint: resolvedEndpoint,
        credentials: { accessKeyId, secretAccessKey },
    });

    return {
        name: 'r2',

        /**
         * ينسخ فيديو من رابط المزوّد إلى التخزين ويُرجع المفتاح.
         * يرمي عند الفشل — المستدعي يقرر (نُبقي رابط المزوّد كاحتياط).
         */
        async mirrorFromUrl(sourceUrl, key) {
            const res = await fetchImpl(sourceUrl);
            if (!res.ok) throw new Error(`تعذّر جلب الفيديو من المزوّد (HTTP ${res.status}).`);

            const declared = Number(res.headers.get('content-length') || 0);
            if (declared > MAX_VIDEO_BYTES) {
                throw new Error(`حجم الفيديو (${declared} بايت) يتجاوز الحد المسموح.`);
            }
            const body = Buffer.from(await res.arrayBuffer());
            if (body.byteLength > MAX_VIDEO_BYTES) {
                // بعض المزودين لا يعلنون content-length — نفحص الحجم الفعلي أيضاً
                throw new Error(`حجم الفيديو الفعلي يتجاوز الحد المسموح.`);
            }

            await client.send(new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: body,
                ContentType: res.headers.get('content-type') || 'video/mp4',
            }));
            return { key, bytes: body.byteLength };
        },

        /**
         * يرفع محتوى جاهزاً في الذاكرة (صورة مرجعية من جهاز المستخدم) —
         * بخلاف mirrorFromUrl الذي يجلب من رابط. التحقق من النوع والحجم
         * مسؤولية المستدعي (server.js يفحص magic bytes قبل الوصول هنا).
         */
        async putObject(key, body, contentType) {
            await client.send(new PutObjectCommand({
                Bucket: bucket, Key: key, Body: body, ContentType: contentType,
            }));
            return { key, bytes: body.byteLength };
        },

        /** رابط تنزيل موقّع قصير الأجل — لا يُخزَّن ولا يُعاد استخدامه. */
        async signedUrl(key, ttlSec = signedUrlTtlSec) {
            return getSignedUrl(
                client,
                new GetObjectCommand({ Bucket: bucket, Key: key }),
                { expiresIn: ttlSec }
            );
        },

        async remove(key) {
            await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        },
    };
}
