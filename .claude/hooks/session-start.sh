#!/bin/bash
# 🧰 SessionStart — تثبيت اعتماديات كل الخدمات قبل بدء الجلسة.
#
# لماذا؟ المستودع أربع حزم npm مستقلّة (لا workspaces)، وتثبيتٌ جزئي لأيٍّ
# منها يُسقط اختباراتٍ **بلا أن يكون في الكود عطب**. حدث فعلاً (٢٠ أغسطس
# ٢٠٢٦): backend/node_modules وصل بلا react و@babel/standalone فسقطت 4
# اختبارات، وvideo-service/node_modules كان فارغاً تماماً (٧ من ٧ مفقودة)
# — بينما CI أخضر لأنه يثبّت كل حزمة على حدة. ساعةٌ ضاعت في تشخيص «فشلٍ»
# لا وجود له.
#
# ⚠️ الباك-إند بـ--ignore-scripts عمداً: postinstall فيه يبني الواجهة
# (`cd ../frontend && npm install && npm run build`) — بناءٌ ثقيل يُعاد
# لكل خدمة وقد يُجهض التثبيت. الواجهة تُثبَّت أدناه بنفسها. وهذا نفس ما
# يفعله CI حرفياً (.github/workflows/ci.yml).
#
# ⚠️ والواجهة **بلا** --ignore-scripts: esbuild خلف vite يجلب ثنائيّته في
# postinstall، فتعطيله يكسر اللينتر والبناء معاً.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

install_pkg() {
    local dir="$1"; shift
    [ -f "$dir/package.json" ] || { echo "⏭️  $dir: لا package.json"; return 0; }
    echo "📦 $dir …"
    ( cd "$dir" && npm install --no-audit --no-fund "$@" )
}

# الترتيب مقصود: الواجهة أولاً كي لا يحاول أحدٌ بناءها قبل اكتمالها
install_pkg frontend
install_pkg backend --ignore-scripts
install_pkg travel-service
install_pkg video-service

echo "✅ اكتمل تثبيت اعتماديات الخدمات الأربع."
