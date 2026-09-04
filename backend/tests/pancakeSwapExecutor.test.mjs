// 🥞 أول تغطيةٍ لمنفذ التداول — الوحدة الوحيدة التي تلمس مالاً حقيقياً
// على السلسلة.
//
// 🔴 كان ثابت `PANCAKE_ROUTER_V2` **٣٩ خانة** لا ٤٠: عنوانٌ ناقصٌ محرفاً
// واحداً. ولم يعترض شيء — `new ethers.Contract` يبنيه، ثم تعامل ethers
// النصَّ المشوَّه **اسمَ ENS** لا عنواناً. فلا يظهر العطب إلا عند أول
// صفقة، بعد أن يكون المالك قد أقرّ `addressesVerified` ومَوَّل المحفظة.
// وإقرارُ إنسانٍ نظر إلى أربعين خانةً لا يرى واحدةً ناقصة.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import {
    PANCAKE_ROUTER_V2, WBNB, applySlippage, createChainClient,
    assertChainAddress, chainAddressConstantsValid,
} from '../services/pancakeSwapExecutor.js';

const provider = { getBalance: async () => 0n, getFeeData: async () => ({ gasPrice: 1n }) };
const signer = { sendTransaction: async () => ({ hash: '0x1' }), provider,
    getAddress: async () => '0x' + '1'.repeat(40) };

test('🔗 كل ثابت عقدٍ عنوانٌ صالحٌ بخانة تحقّق — الحارس الذي كان غائباً', () => {
    for (const [name, value] of [['PANCAKE_ROUTER_V2', PANCAKE_ROUTER_V2], ['WBNB', WBNB]]) {
        const hex = value.replace(/^0x/, '');
        assert.equal(hex.length, 40, `${name}: ${hex.length} خانة لا 40`);
        assert.equal(ethers.getAddress(value), value, `${name}: خانة التحقّق لا تطابق`);
    }
    assert.equal(chainAddressConstantsValid(), true);
});

test('🪤 الفخّ: ethers لا ترفض العنوان المشوَّه — تفسّره اسمَ ENS', () => {
    const malformed = '0x10ED43C718714eb63d5aA57B78B54704E256024';   // ٣٩ خانة: الثابت القديم حرفياً
    assert.equal(malformed.replace(/^0x/, '').length, 39);
    assert.throws(() => ethers.getAddress(malformed), 'المرجع: getAddress ترفضه فعلاً');
    // ومع ذلك يُبنى العقد بلا اعتراض — ولهذا لزم حارسٌ من عندنا.
    assert.doesNotThrow(() => new ethers.Contract(malformed, [], null),
        'لو رفضته ethers عند البناء لَما لزم assertChainAddress');
});

test('🛡️ عميل السلسلة لا يُبنى ولا يتحرّك على عنوانٍ مشوَّه', async () => {
    assert.throws(() => assertChainAddress('x', '0x10ED43C718714eb63d5aA57B78B54704E256024'),
        /عنوان غير صالح \(x\): 39 خانة/);
    const c = createChainClient({ provider, signer });
    for (const bad of ['0xnope', '', null, undefined, '0x' + '1'.repeat(39)]) {
        await assert.rejects(() => c.buy({ tokenAddress: bad, amountInWei: 1n, amountOutMin: 0n, toAddress: WBNB }),
            /عنوان غير صالح \(tokenAddress\)/, `شراء بعنوان ${JSON.stringify(bad)}`);
        await assert.rejects(() => c.sell({ tokenAddress: WBNB, amountInWei: 1n, amountOutMin: 0n, toAddress: bad }),
            /عنوان غير صالح \(toAddress\)/, `بيع إلى ${JSON.stringify(bad)}`);
    }
});

test('🛡️ والعناوين المكتشَفة آلياً تمرّ بالحارس نفسه (autoDiscovery بلا تحقّق يدوي)', async () => {
    const c = createChainClient({ provider, signer });
    await assert.rejects(() => c.tokenBalance('0xdeadbeef', WBNB), /عنوان غير صالح \(tokenAddress\)/);
    await assert.rejects(() => c.ensureAllowance({ tokenAddress: WBNB, ownerAddress: 'not-an-address', amountWei: 1n }),
        /عنوان غير صالح \(ownerAddress\)/);
});

test('📉 هامش الانزلاق يُنقص فعلاً ولا يُصفّر الحماية', () => {
    assert.equal(applySlippage(10000n, 75), 9925n);
    assert.equal(applySlippage(10000n, 0), 10000n);
    assert.equal(applySlippage(1000000n), 992500n, 'الافتراضي 75bps');
    assert.ok(applySlippage(10000n, 75) < 10000n, 'الحدّ الأدنى دون الاقتباس دوماً');
});
