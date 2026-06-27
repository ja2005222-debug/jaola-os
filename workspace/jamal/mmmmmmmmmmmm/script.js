// تفعيل أداء الصفحة
window.addEventListener('load', () => {
    console.log('الصفحة готова!');
});

// تفعيل زر معلومات أكثر لفتح الرابط
const moreInfoButton = document.querySelector('button');
moreInfoButton.addEventListener('click', () => {
    window.open('https://ar.wikipedia.org/wiki/%D8%AB%D9%88%D8%B1%D8%A7%D9%86', '_blank');
});
