console.log('Welcome to our sweets site');

// Ajout d'un événement au clic sur le bouton "اطلب الان"
const orderButton = document.querySelector('.bg-gradient-to-r.from-cyan-500.to-indigo-600');
orderButton.addEventListener('click', () => {
  alert('Merci de votre commande !');
});