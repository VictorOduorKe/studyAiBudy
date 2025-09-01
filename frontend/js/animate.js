const far_bars=document.querySelector(".fa-bars")
const nav=document.querySelector("header nav");

far_bars.addEventListener("click",()=>{
    far_bars.classList.toggle("fa-times");
    nav.classList.toggle("display_nav")
})