#!/bin/bash
# ============================================================
# سكريبت تنظيف jaola-os — آمن (ينقل بدلاً من الحذف الفوري)
# ============================================================
set -e

cd "$(dirname "$0")"
ARCHIVE="_archive_to_delete"
mkdir -p "$ARCHIVE"

move_safe() {
    if [ -e "$1" ]; then
        mkdir -p "$ARCHIVE/$(dirname "$1")"
        mv "$1" "$ARCHIVE/$1"
        echo "  ✓ نُقل: $1"
    fi
}

echo "════════════════════════════════════════"
echo "  1. وكلاء غير مستخدمين (backend/agents/)"
echo "════════════════════════════════════════"
move_safe "backend/agents/agentFactory.js"
move_safe "backend/agents/architect.agent.js"
move_safe "backend/agents/autoFix.agent.js"
move_safe "backend/agents/buildGuardian.agent.js"
move_safe "backend/agents/ceo.agent.js"
move_safe "backend/agents/clarification.agent.js"
move_safe "backend/agents/coder.agent.js"
move_safe "backend/agents/coderPro.agent.js"
move_safe "backend/agents/contextResolver.agent.js"
move_safe "backend/agents/conversation.agent.js"
move_safe "backend/agents/debuggerAgent.js"
move_safe "backend/agents/ecommerceAgent.js"
move_safe "backend/agents/educator.agent.js"
move_safe "backend/agents/memory.agent.js"
move_safe "backend/agents/planner.agent.js"
move_safe "backend/agents/plannerTemplates.js"
move_safe "backend/agents/projectInitializer.agent.js"
move_safe "backend/agents/reasoning.agent.js"
move_safe "backend/agents/reviewer.agent.js"
move_safe "backend/agents/sales.agent.js"
move_safe "backend/agents/test-agents.js"
move_safe "backend/agents/toolSelector.agent.js"
move_safe "backend/agents/travel.agent.js"
move_safe "backend/agents/runtime.js"
move_safe "backend/agents/templates.json"

# نسخ مكررة من server.js / coderAgent.js في الجذر (وليس backend/)
move_safe "backend/coderAgent.js"

echo ""
echo "════════════════════════════════════════"
echo "  2. Dashboard/Frontend مهجورة"
echo "════════════════════════════════════════"
move_safe "archive"
move_safe "public/js"
move_safe "public/utils"
move_safe "public/legacy"
move_safe "src"
move_safe "frontend/src/components/Dashboard.jsx"
move_safe "frontend/TimeMachineComponent.jsx"
move_safe "ِApp.jsx"   # الملف بحرف عربي
move_safe "App.jsx"    # نسخة الجذر القديمة

echo ""
echo "════════════════════════════════════════"
echo "  3. routes/ في الجذر (غير مستوردة في server.js)"
echo "════════════════════════════════════════"
move_safe "routes"

echo ""
echo "════════════════════════════════════════"
echo "  4. services مكررة غير مستخدمة"
echo "════════════════════════════════════════"
move_safe "backend/services/auth.js"           # يستخدم SQLite غير مستخدم
move_safe "backend/services/groq.service.js"   # baseAgent يستخدم groq-sdk مباشرة
move_safe "backend/services/groqService.js"

echo ""
echo "════════════════════════════════════════"
echo "  5. ملفات اختبار وأدوات متفرقة في الجذر"
echo "════════════════════════════════════════"
move_safe "test-agents.js"
move_safe "test_api.js"
move_safe "test-gorg.js"
move_safe "test-groq.js"
move_safe "fix-database.js"
move_safe "fileEditor.js"
move_safe "knowledgeBase.json"
move_safe "knowledgeService.js"
move_safe "prompts.js"
move_safe "taskExecutor.js"
move_safe "utils.js"

echo ""
echo "════════════════════════════════════════"
echo "  ✅ انتهى — كل شيء في: $ARCHIVE/"
echo "════════════════════════════════════════"
echo ""
echo "الخطوة التالية:"
echo "  1. شغّل الخادم وتأكد أن كل شيء يعمل:"
echo "     cd backend && node server.js"
echo "  2. إذا كل شيء سليم بعد يوم أو يومين، احذف الأرشيف نهائياً:"
echo "     rm -rf $ARCHIVE"
echo "  3. إذا ظهرت مشكلة، أعد أي ملف بـ:"
echo "     mv $ARCHIVE/path/to/file path/to/file"
