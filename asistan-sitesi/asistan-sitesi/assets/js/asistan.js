document.addEventListener("DOMContentLoaded", () => {
    const dropdown = document.querySelector(".dropdown");
    const btn = dropdown.querySelector(".dropdown-btn");
    const mailinput = document.querySelector(".giris-input");
    const content = dropdown.querySelector(".dropdown-content");
    const items = content.querySelectorAll("div");

    const hamburgerMenum = document.getElementById("hamburger-butonum");
    const hamburgerMenuKismi = document.getElementById("asistan-menu2");
    const kapatmaButonu = document.getElementById("kapatma-butonu");
    const overlay = document.getElementById("overlay");
  

    hamburgerMenum.addEventListener("click", function () {
      hamburgerMenuKismi.style.right = '10px';
        overlay.style.right="0px";
    });

    kapatmaButonu.addEventListener("click", function(){
      hamburgerMenuKismi.style.right = '-400px';
      overlay.style.right="-400px";
    })


    // Menü aç/kapa
    btn.addEventListener("click", () => {
      dropdown.classList.toggle("open");
    });
  
    // Seçim yapıldığında
    items.forEach(item => {
      item.addEventListener("click", () => {
        btn.innerHTML ='<h6>'+ item.textContent + '</h6> <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M297.4 566.6C309.9 579.1 330.2 579.1 342.7 566.6L502.7 406.6C515.2 394.1 515.2 373.8 502.7 361.3C490.2 348.8 469.9 348.8 457.4 361.3L352 466.7L352 96C352 78.3 337.7 64 320 64C302.3 64 288 78.3 288 96L288 466.7L182.6 361.3C170.1 348.8 149.8 348.8 137.3 361.3C124.8 373.8 124.8 394.1 137.3 406.6L297.3 566.6z"/></svg>';
       
        dropdown.classList.remove("open");
      });
    });
  
    // Dışarı tıklayınca kapanma
    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove("open");
      }
    });
  });


