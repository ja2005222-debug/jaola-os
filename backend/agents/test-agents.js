// backend/agents/test-agents.js
import { ceoAgent, coderAgent } from './index.js';

async function runTests() {
  console.log('🚀 بدء اختبار JAOLA OS...');
  
  try {
    console.log('\n👔 جاري استدعاء الـ CEO...');
    const ceoResult = await ceoAgent('أعطني خطة عمل مختصرة لمتجر سفر إلكتروني.');
    console.log('CEO Response:', ceoResult);

    console.log('\n💻 جاري استدعاء الـ Coder...');
    const coderResult = await coderAgent('اكتب كود CSS بسيط لزر "احجز الآن" بستايل عصري.');
    console.log('Coder Response:', coderResult);

    console.log('\n✅ الاختبار اكتمل بنجاح!');
  } catch (error) {
    console.error('\n❌ فشل الاختبار:', error.message);
  }
}

runTests();
