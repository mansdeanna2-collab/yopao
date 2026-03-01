// ── Testimonial Slider ────────────────────────────────────────────────────
var slider=document.getElementById('testimonial-slider'),dots=document.querySelectorAll('.testimonial-dot'),cur=0,total=3,auto;
function go(i){cur=i;slider.style.transform='translateX(-'+(i*100)+'%)';dots.forEach(function(d,x){d.classList.toggle('active',x===i);});}
dots.forEach(function(d){d.addEventListener('click',function(){go(parseInt(this.getAttribute('data-index')));clearInterval(auto);auto=setInterval(function(){go((cur+1)%total);},4000);});});
go(0);
auto=setInterval(function(){go((cur+1)%total);},4000);
