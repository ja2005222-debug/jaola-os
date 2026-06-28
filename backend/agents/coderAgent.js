import { deepseek } from './baseAgent.js';

/**
 * تحليل استجابة النموذج إلى كائنات ملفات { name, content }
 * يفترض أن الاستجابة تحتوي على أقسام محددة مثل:
 * // FILE: index.html
 * المحتوى ...
 * // FILE: styles.css
 * المحتوى ...
 */
function parseResponseToFiles(responseText) {
    const files = [];
    const fileRegex = /\/\/\s*FILE:\s*(\S+)\s*\n([\s\S]*?)(?=\/\/\s*FILE:|$)/g;
    let match;
    while ((match = fileRegex.exec(responseText)) !== null) {
        files.push({
            name: match[1],
            content: match[2].trim()
        });
    }
    // إذا لم نجد أي ملفات، نعيد المصفوفة فارغة
    if (files.length === 0) {
        // ربما النموذج أرجع HTML مباشرة، نحاول استخراج وسوم <html> ... </html>
        const htmlMatch = responseText.match(/<html[\s\S]*?<\/html>/i);
        if (htmlMatch) {
            files.push({ name: 'index.html', content: htmlMatch[0] });
        }
    }
    return files;
}

/**
 * توليد خطة الكود باستخدام DeepSeek Coder
 * @param {string} prompt - وصف المستخدم للمشروع
 * @param {string} currentCodeContext - محتوى الملفات الحالية (إن وجدت)
 * @param {string} visualIdentity - الهوية البصرية المفضلة
 * @param {Array} images - صور مطلوبة (غير مستخدمة عادة في هذه الدالة)
 * @param {Function} onChunk - callback للبث المباشر (اختياري)
 * @returns {Promise<{files: Array, images: Array} | {error: boolean, details: string}>}
 */
export async function coreGenerateCodePlan(prompt, currentCodeContext, visualIdentity, images, onChunk) {
    const systemMessage = `أنت خبير برمجة مواقع ويب متكاملة. أنشئ كود HTML/CSS/JavaScript حديثاً وجميلاً ومتجاوباً مع جميع الأجهزة.

اتبع التعليمات بدقة:
- التصميم يجب أن يكون عصرياً، باستخدام ألوان متناسقة، وتأثيرات زجاجية (glassmorphism) أو نيون حسب الطلب: "${visualIdentity || 'عصري نظيف'}".
- اجعل الموقع متجاوباً (responsive) ويعمل على الهواتف والأجهزة اللوحية.
- استخدم خطوط عصرية (مثل Google Fonts) ورموز تعبيرية عند الحاجة.
- أضف تعليقات توضيحية بالعربية في الكود.
- هيكل الكود يجب أن يكون نظيفاً ومنظماً.

مخرجاتك يجب أن تكون على الشكل التالي بالضبط (استخدم التعليقات كما هي):

// FILE: index.html
(كود HTML كاملاً)

// FILE: styles.css
(كود CSS كاملاً)

// FILE: script.js
(كود JavaScript كاملاً)

لا تكتب أي شيء خارج هذه الملفات.`;

    const userMessage = `المشروع المطلوب: ${prompt}\n\nالكود الحالي للمشروع (إن وجد):\n${currentCodeContext || 'لا يوجد كود سابق'}`;

    try {
        // إذا كان هناك دالة onChunk، نفعل البث المباشر
        if (onChunk) {
            const stream = await deepseek.chat.completions.create({
                model: "deepseek-coder",
                messages: [
                    { role: "system", content: systemMessage },
                    { role: "user", content: userMessage }
                ],
                temperature: 0.3,
                max_tokens: 4096,
                stream: true,
            });

            let fullResponse = '';
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    fullResponse += content;
                    onChunk(content); // بث مباشر للواجهة
                }
            }

            const files = parseResponseToFiles(fullResponse);
            return { files, images: [] };
        } else {
            // بدون بث
            const completion = await deepseek.chat.completions.create({
                model: "deepseek-coder",
                messages: [
                    { role: "system", content: systemMessage },
                    { role: "user", content: userMessage }
                ],
                temperature: 0.3,
                max_tokens: 4096,
                stream: false,
            });

            const responseText = completion.choices[0].message.content;
            const files = parseResponseToFiles(responseText);
            return { files, images: [] };
        }
    } catch (error) {
        console.error('DeepSeek Coder Error:', error);
        return { error: true, details: error.message };
    }
}
