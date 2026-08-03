/**
 * 🥞 pancakeSwapExecutor.js — منفذ التفاعل الوحيد مع PancakeSwap/BNB Chain.
 *
 * WBNB تم تحقيقه يدوياً من صاحب المشروع مباشرة على bscscan.com (٢ أغسطس ٢٠٢٦).
 * PANCAKE_ROUTER_V2 لا يزال يحتاج نفس التحقق اليدوي قبل أي استخدام حقيقي —
 * سجّل ذلك عبر addressesVerified في tradingBotConfig.js؛ البوت يرفض العمل
 * بدون هذا التأكيد.
 *
 * تصميم أساسي: tradingBotEngine.js لا يستدعي ethers.Contract مباشرة أبداً؛
 * كل تفاعل مع السلسلة يمرّ عبر الكائن الذي تُرجعه createChainClient — منفذ
 * الحقن الوحيد، فيسهل استبداله بكائن وهمي في الاختبارات (بلا سلسلة حقيقية).
 */
import { ethers } from 'ethers';

export const PANCAKE_ROUTER_V2 = '0x10ED43C718714eb63d5aA57B78B54704E256024'; // ⚠️ تحقّق يدوياً قبل الاستخدام الحقيقي
export const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'; // ✅ تحقّقه المستخدم يدوياً على bscscan.com

const ROUTER_ABI = [
    'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
    'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
    'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
];

const ERC20_ABI = [
    'function balanceOf(address account) external view returns (uint256)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function approve(address spender, uint256 amount) external returns (bool)',
];

const DEADLINE_SECONDS = 5 * 60; // 5 دقائق — نافذة كافية لتأكيد صفقة على BSC (~3 ثوانٍ للكتلة)

/** amountOut ناقص هامش الانزلاق المسموح (bps من 10000) — أبداً صفر/بلا حماية. */
export function applySlippage(amountOutBigInt, slippageBps = 75) {
    const bn = BigInt(amountOutBigInt);
    return bn - (bn * BigInt(slippageBps)) / 10000n;
}

/**
 * يبني كائن التفاعل مع السلسلة — provider للقراءة، signer (محفظة موقِّعة)
 * للمعاملات الفعلية. كل دالة هنا حتمية الشكل (نفس التوقيع دوماً) كي يسهل
 * تقليدها بكائن وهمي في الاختبارات.
 */
export function createChainClient({ provider, signer }) {
    const router = new ethers.Contract(PANCAKE_ROUTER_V2, ROUTER_ABI, signer || provider);

    return {
        async getBnbBalance(address) {
            const wei = await provider.getBalance(address);
            return wei; // BigInt
        },

        async tokenBalance(tokenAddress, ownerAddress) {
            const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
            return token.balanceOf(ownerAddress);
        },

        /** سعر الغاز الحالي (BigInt wei) — للتحقق من سقف maxGasPriceGwei قبل الشراء. */
        async gasPrice() {
            const fee = await provider.getFeeData();
            return fee.gasPrice ?? 0n;
        },

        /** يقتبس ناتج مبادلة amountIn (BigInt wei) عبر المسار المُعطى — قراءة فقط، بلا معاملة. */
        async quote(amountInWei, path) {
            const amounts = await router.getAmountsOut(amountInWei, path);
            return amounts[amounts.length - 1]; // BigInt — الناتج الأخير في المسار
        },

        /** شراء توكن مقابل BNB أصلي (يُغلَّف WBNB تلقائياً عبر الراوتر). */
        async buy({ tokenAddress, amountInWei, amountOutMin, toAddress }) {
            const tx = await router.swapExactETHForTokens(
                amountOutMin,
                [WBNB, tokenAddress],
                toAddress,
                Math.floor(Date.now() / 1000) + DEADLINE_SECONDS,
                { value: amountInWei },
            );
            return tx.hash;
        },

        /** يضمن سماحاً كافياً (allowance) للراوتر قبل بيع توكن — يتخطّى موافقة جديدة إن كانت الحالية كافية. */
        async ensureAllowance({ tokenAddress, ownerAddress, amountWei }) {
            const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
            const current = await token.allowance(ownerAddress, PANCAKE_ROUTER_V2);
            if (current >= BigInt(amountWei)) return null; // كافٍ بالفعل — لا معاملة إضافية
            const tx = await token.approve(PANCAKE_ROUTER_V2, amountWei);
            return tx.hash;
        },

        /** بيع توكن مقابل BNB أصلي — استدعِ ensureAllowance أولاً دوماً. */
        async sell({ tokenAddress, amountInWei, amountOutMin, toAddress }) {
            const tx = await router.swapExactTokensForETH(
                amountInWei,
                amountOutMin,
                [tokenAddress, WBNB],
                toAddress,
                Math.floor(Date.now() / 1000) + DEADLINE_SECONDS,
            );
            return tx.hash;
        },

        /**
         * ينتظر تأكيد معاملة حقيقياً — لا يفترض النجاح أبداً عند انتهاء المهلة.
         * يُرجع {confirmed:true, status, gasUsed} أو {confirmed:false, timedOut:true}.
         */
        async waitForReceipt(txHash, confirmations = 2, timeoutMs = 60_000) {
            try {
                const receipt = await provider.waitForTransaction(txHash, confirmations, timeoutMs);
                if (!receipt) return { confirmed: false, timedOut: true };
                return {
                    confirmed: true, status: receipt.status, gasUsed: receipt.gasUsed,
                    gasPrice: receipt.gasPrice ?? 0n, blockNumber: receipt.blockNumber,
                };
            } catch {
                return { confirmed: false, timedOut: true };
            }
        },
    };
}
