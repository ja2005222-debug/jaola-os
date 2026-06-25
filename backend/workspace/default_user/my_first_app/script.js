console.log("JAOLA OS");

// إضافة حدث عند الضغط على زر الاتصال بنا
const contactButton = document.querySelector("a[href='#']");
contactButton.addEventListener("click", function() {
  alert("اتصل بنا");
});