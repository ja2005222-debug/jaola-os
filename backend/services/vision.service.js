import { chromium } from 'playwright';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function captureScreenshots(urls, outputDir = '/tmp/jaola-screenshots') {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const results = [];
    for (const url of urls) {
        try {
            await page.goto(url, { waitUntil: 'networkidle' });
            const screenshot = await page.screenshot({ fullPage: true });
            const filename = `${outputDir}/${url.replace(/[^a-z0-9]/gi, '_')}.png`;
            require('fs').writeFileSync(filename, screenshot);
            results.push({ url, screenshot: filename });
        } catch(e) { results.push({ url, error: e.message }); }
    }
    await browser.close();
    return results;
}

export async function reviewScreenshot(screenshotPath, expectation) {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const image = {
        inlineData: {
            data: Buffer.from(require('fs').readFileSync(screenshotPath)).toString('base64'),
            mimeType: 'image/png'
        }
    };
    const prompt = `You are a QA expert. Review this screenshot based on expectation: "${expectation}". Rate UI, layout, responsiveness (0-100). Return JSON: { uiScore, layoutScore, responsiveScore, issues: [] }`;
    const result = await model.generateContent([prompt, image]);
    const response = await result.response;
    const text = response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { uiScore: 70, layoutScore: 70, responsiveScore: 70, issues: ['Failed to parse'] };
}
