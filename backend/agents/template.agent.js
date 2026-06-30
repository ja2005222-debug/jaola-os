import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import AdmZip from 'adm-zip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatesDb = JSON.parse(fs.readFileSync(path.join(__dirname, 'templates.json'), 'utf-8'));

// ========== القوالب الافتراضية المضمّنة ==========
const EMBEDDED_TEMPLATES = {
  medical: {
    html: `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="color-scheme" content="light">
    <title>عيادة طبية</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header>
        <h1>مرحباً بكم في عيادتنا</h1>
        <nav>
            <a href="#">الرئيسية</a>
            <a href="#">خدماتنا</a>
            <a href="#">الأطباء</a>
            <a href="#">اتصل بنا</a>
        </nav>
    </header>
    <main>
        <section class="hero">
            <h2>رعاية صحية متميزة</h2>
            <p>نقدم أفضل الخدمات الطبية باستخدام أحدث التقنيات</p>
        </section>
        <section class="services">
            <div class="card">
                <h3>استشارات</h3>
                <p>استشر أمهر الأطباء في جميع التخصصات</p>
            </div>
            <div class="card">
                <h3>طوارئ</h3>
                <p>خدمة طوارئ 24 ساعة</p>
            </div>
            <div class="card">
                <h3>صيدلية</h3>
                <p>صيدلية متكاملة داخل العيادة</p>
            </div>
        </section>
    </main>
    <footer>
        <p>&copy; 2024 العيادة الطبية. جميع الحقوق محفوظة.</p>
    </footer>
    <script src="script.js"></script>
</body>
</html>`,
    css: `body { background: #ffffff; color: #111111; margin: 0; font-family: sans-serif; }
header { background: #0077b6; color: white; padding: 20px; text-align: center; }
nav a { color: white; margin: 0 10px; text-decoration: none; }
.hero { text-align: center; padding: 40px 20px; background: #e3f2fd; }
.services { display: flex; justify-content: center; gap: 20px; padding: 30px; }
.card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); width: 200px; }
footer { background: #f0f0f0; text-align: center; padding: 15px; margin-top: 40px; }`,
    js: `// JavaScript for future interactivity`
  },
  restaurant: {
    html: `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="color-scheme" content="light">
    <title>مطعم الذواق</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header>
        <h1>مطعم الذواق</h1>
        <nav>
            <a href="#">القائمة</a>
            <a href="#">العروض</a>
            <a href="#">اتصل بنا</a>
        </nav>
    </header>
    <main>
        <section class="hero">
            <h2>أشهى المأكولات</h2>
            <p>تجربة طعام لا تُنسى</p>
        </section>
        <section class="menu">
            <div class="item">
                <h3>بيتزا مارغريتا</h3>
                <p>طماطم، موزاريلا، ريحان</p>
                <span>20 ريال</span>
            </div>
            <div class="item">
                <h3>برجر كلاسيكي</h3>
                <p>لحم بقري، جبنة، خس</p>
                <span>25 ريال</span>
            </div>
            <div class="item">
                <h3>عصير طبيعي</h3>
                <p>برتقال، فراولة، مانجو</p>
                <span>10 ريال</span>
            </div>
        </section>
    </main>
    <footer>
        <p>&copy; 2024 مطعم الذواق</p>
    </footer>
    <script src="script.js"></script>
</body>
</html>`,
    css: `body { background: #ffffff; color: #111111; font-family: sans-serif; margin: 0; }
header { background: #d35400; color: white; padding: 20px; text-align: center; }
nav a { color: white; margin: 0 10px; text-decoration: none; }
.hero { text-align: center; padding: 30px; background: #fdebd0; }
.menu { display: flex; flex-wrap: wrap; gap: 20px; padding: 30px; justify-content: center; }
.item { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 10px; width: 220px; text-align: center; }
footer { background: #f0f0f0; text-align: center; padding: 15px; }`,
    js: `// interactive menu`
  },
  ecommerce: {
    html: `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="color-scheme" content="light">
    <title>متجر الأناقة</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header>
        <h1>متجر الأناقة</h1>
        <nav>
            <a href="#">المنتجات</a>
            <a href="#">سلة المشتريات</a>
            <a href="#">اتصل بنا</a>
        </nav>
    </header>
    <main>
        <section class="products">
            <div class="product">
                <img src="https://via.placeholder.com/150" alt="منتج">
                <h3>حذاء رياضي</h3>
                <p>مريح وعصري</p>
                <span>150 ريال</span>
                <button>أضف إلى السلة</button>
            </div>
            <div class="product">
                <img src="https://via.placeholder.com/150" alt="منتج">
                <h3>حقيبة يد</h3>
                <p>جلد طبيعي</p>
                <span>200 ريال</span>
                <button>أضف إلى السلة</button>
            </div>
            <div class="product">
                <img src="https://via.placeholder.com/150" alt="منتج">
                <h3>ساعة كلاسيكية</h3>
                <p>تصميم فاخر</p>
                <span>350 ريال</span>
                <button>أضف إلى السلة</button>
            </div>
        </section>
    </main>
    <footer>
        <p>&copy; 2024 متجر الأناقة</p>
    </footer>
    <script src="script.js"></script>
</body>
</html>`,
    css: `body { background: #ffffff; color: #111; font-family: sans-serif; }
header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
nav a { color: white; margin: 0 10px; }
.products { display: flex; flex-wrap: wrap; gap: 25px; padding: 40px; justify-content: center; }
.product { background: white; border: 1px solid #ddd; border-radius: 15px; padding: 15px; text-align: center; width: 200px; }
.product img { max-width: 100%; border-radius: 10px; }
button { background: #27ae60; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; }
footer { background: #f0f0f0; text-align: center; padding: 15px; }`,
    js: `// cart functionality placeholder`
  },
  business: {
    html: `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="color-scheme" content="light">
    <title>شركة الأعمال</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header>
        <h1>شركة النجاح</h1>
        <nav>
            <a href="#">من نحن</a>
            <a href="#">خدماتنا</a>
            <a href="#">اتصل بنا</a>
        </nav>
    </header>
    <main>
        <section class="about">
            <h2>حلول مبتكرة لأعمالك</h2>
            <p>نساعدك على تحقيق أهدافك بأحدث التقنيات</p>
        </section>
        <section class="features">
            <div class="feature">استشارات إدارية</div>
            <div class="feature">تسويق رقمي</div>
            <div class="feature">تطوير أعمال</div>
        </section>
    </main>
    <footer>
        <p>&copy; 2024 شركة النجاح</p>
    </footer>
    <script src="script.js"></script>
</body>
</html>`,
    css: `body { background: white; color: #111; font-family: sans-serif; }
header { background: #1e3799; color: white; padding: 20px; text-align: center; }
nav a { color: white; margin: 0 10px; text-decoration: none; }
.about { text-align: center; padding: 40px; background: #d5dbdb; }
.features { display: flex; justify-content: center; gap: 30px; padding: 30px; }
.feature { background: white; padding: 20px 40px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
footer { background: #f0f0f0; text-align: center; padding: 15px; }`,
    js: `// business logic`
  },
  personal: {
    html: `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="color-scheme" content="light">
    <title>موقعي الشخصي</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header>
        <h1>محمد العلي</h1>
        <p>مطور ويب ومصمم جرافيك</p>
    </header>
    <main>
        <section class="about">
            <h2>نبذة عني</h2>
            <p>أعمل في تطوير المواقع والتطبيقات بأحدث التقنيات.</p>
        </section>
        <section class="works">
            <h2>أعمالي</h2>
            <div class="work">مشروع موقع تجاري</div>
            <div class="work">تطبيق جوال</div>
            <div class="work">تصميم هوية</div>
        </section>
    </main>
    <footer>
        <p>&copy; 2024 محمد العلي</p>
    </footer>
    <script src="script.js"></script>
</body>
</html>`,
    css: `body { background: white; color: #111; font-family: sans-serif; }
header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 40px; text-align: center; }
.about { padding: 40px; text-align: center; }
.works { display: flex; justify-content: center; gap: 20px; padding: 30px; }
.work { background: white; padding: 25px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); width: 150px; }
footer { text-align: center; padding: 15px; background: #f0f0f0; }`,
    js: `// personal script`
  }
};

// ========== دوال مساعدة ==========

function selectBestTemplate(userPrompt) {
    const prompt = userPrompt.toLowerCase();
    let bestTemplate = null;
    let maxScore = 0;
    for (const template of templatesDb) {
        let score = 0;
        for (const keyword of template.keywords) {
            if (prompt.includes(keyword)) score++;
        }
        if (score > maxScore) {
            maxScore = score;
            bestTemplate = template;
        }
    }
    return bestTemplate || templatesDb.find(t => t.name === 'business') || templatesDb[0];
}

function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const options = { headers: { 'User-Agent': 'JAOLA-OS/1.0' } };
        const file = fs.createWriteStream(destPath);
        https.get(url, options, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                https.get(response.headers.location, options, (redirectRes) => {
                    redirectRes.pipe(file);
                    file.on('finish', () => { file.close(); resolve(); });
                }).on('error', reject);
            } else if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}`));
            } else {
                response.pipe(file);
                file.on('finish', () => { file.close(); resolve(); });
            }
        }).on('error', reject);
    });
}

async function tryDownloadTemplate(urls, projectPath) {
    const zipPath = path.join(projectPath, 'template.zip');
    for (const url of urls) {
        try {
            await downloadFile(url, zipPath);
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(projectPath, true);
            fs.unlinkSync(zipPath);
            const extractedFolder = findFirstFolder(projectPath);
            if (extractedFolder) {
                copyFolderRecursive(extractedFolder, projectPath);
                fs.rmSync(extractedFolder, { recursive: true, force: true });
            }
            injectBaseStyles(projectPath);
            return { success: true, template: templatesDb.find(t => t.urls.includes(url)).name, source: 'downloaded' };
        } catch (err) {
            console.log(`Failed ${url}: ${err.message}`);
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        }
    }
    return null;
}

function applyEmbeddedTemplate(templateName, projectPath) {
    const tpl = EMBEDDED_TEMPLATES[templateName];
    if (!tpl) return false;
    fs.writeFileSync(path.join(projectPath, 'index.html'), tpl.html);
    fs.writeFileSync(path.join(projectPath, 'styles.css'), tpl.css);
    fs.writeFileSync(path.join(projectPath, 'script.js'), tpl.js);
    return true;
}

function findFirstFolder(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (let entry of entries) {
        if (entry.isDirectory()) return path.join(dir, entry.name);
    }
    return null;
}

function copyFolderRecursive(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyFolderRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function injectBaseStyles(projectPath) {
    const cssFile = path.join(projectPath, 'styles.css');
    if (fs.existsSync(cssFile)) {
        let css = fs.readFileSync(cssFile, 'utf-8');
        const baseCSS = `body { background: #ffffff !important; color: #111111 !important; }`;
        if (!css.includes('background:')) {
            css = baseCSS + '\n' + css;
        }
        fs.writeFileSync(cssFile, css);
    } else {
        fs.writeFileSync(cssFile, `body { background: #ffffff; color: #111111; }`);
    }
    const htmlFile = path.join(projectPath, 'index.html');
    if (fs.existsSync(htmlFile)) {
        let html = fs.readFileSync(htmlFile, 'utf-8');
        html = html.replace(/<meta[^>]*color-scheme[^>]*>/gi, '');
        if (!html.includes('name="color-scheme"')) {
            html = html.replace('<head>', '<head><meta name="color-scheme" content="light">');
        }
        fs.writeFileSync(htmlFile, html);
    }
}

// ========== التصدير الرئيسي ==========
export async function applyTemplate(userPrompt, projectPath) {
    const template = selectBestTemplate(userPrompt);
    if (!template) return { success: false, error: 'No suitable template found' };

    // 1. محاولة التحميل من GitHub
    if (template.urls) {
        const result = await tryDownloadTemplate(template.urls, projectPath);
        if (result) {
            return result;
        }
    }

    // 2. استخدام القالب المضمّن المناسب
    const embeddedSuccess = applyEmbeddedTemplate(template.name, projectPath);
    if (embeddedSuccess) {
        return { success: true, template: template.name, source: 'embedded' };
    }

    return { success: false, error: 'Failed to apply any template' };
}
