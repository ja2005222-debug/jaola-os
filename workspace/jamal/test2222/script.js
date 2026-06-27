function orderPizza() {
    let pizzaPrice = 0;
    let pizzaType = prompt("حدد نوع البيتزا:
1- بيتزا مارغريتا
2- بيتزا هاواي
3- بيتزا مارينارا");
    if (pizzaType == "1") {
        pizzaPrice = 50;
    } else if (pizzaType == "2") {
        pizzaPrice = 60;
    } else if (pizzaType == "3") {
        pizzaPrice = 55;
    }
    document.getElementById("orderPrice").innerHTML = `سعر البيتزا المطلب هو ${pizzaPrice} ر.س`; 
    alert('تم إرسال طلبك بنجاح');
}