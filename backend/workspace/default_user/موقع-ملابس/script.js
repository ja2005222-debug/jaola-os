const hero = document.querySelector('.hero');
const offers = document.querySelector('.offers');

// إضافة حدث لزر التسوق
const shopButton = document.querySelector('button');
shopButton.addEventListener('click', () => {
  // إضافة Animations
  hero.classList.add('animate-out');
  offers.classList.add('animate-in');
});