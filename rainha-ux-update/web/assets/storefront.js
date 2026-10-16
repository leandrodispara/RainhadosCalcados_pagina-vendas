'use strict';
let catalog=[],department='all',carouselTimer=null;
const mainBanner=document.getElementById('main-banner');
const mainFallback=mainBanner.innerHTML;
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const node=(tag,cls,text)=>{const item=document.createElement(tag);if(cls)item.className=cls;if(text!==undefined)item.textContent=text;return item;};
const imagesOf=product=>Array.isArray(product.images)&&product.images.length?product.images:(product.image?[product.image]:[]);
const departmentOf=product=>{
 const audience=product.audience==='Masculino'?'Masculino':'Feminino';
 if(product.category==='Calçados')return audience==='Masculino'?'calcados-masculinos':'calcados-femininos';
 return audience==='Masculino'?'perfumes-masculinos':'perfumes-femininos';
};
const groups=[
 {key:'calcados-femininos',title:'Calçados femininos',description:'Modelos para acompanhar o seu estilo.',class:'feminine',category:'Calçados',audience:'Feminino'},
 {key:'calcados-masculinos',title:'Calçados masculinos',description:'Escolha cor e numeração no detalhe do produto.',class:'masculine',category:'Calçados',audience:'Masculino'},
 {key:'perfumes-femininos',title:'Perfumes femininos',description:'Sua essência, no tamanho que combina com você.',class:'feminine',category:'Perfumes',audience:'Feminino'},
 {key:'perfumes-masculinos',title:'Perfumes masculinos',description:'Encontre sua fragrância e veja as opções disponíveis.',class:'masculine',category:'Perfumes',audience:'Masculino'}
];

function productCard(product){
 const card=node('article','product product-card');
 const link=node('a','product-link');link.href='/produto.html?id='+encodeURIComponent(product.id);link.setAttribute('aria-label','Ver detalhes de '+product.name);
 const photo=node('div','product-photo');const cover=imagesOf(product)[0];
 if(cover){const image=node('img');image.src=cover;image.alt=product.name;image.loading='lazy';photo.append(image);}
 else photo.append(node('div','no-photo','Consulte fotos com a loja'));
 const kind=product.category==='Perfumes'?'Perfume '+(product.audience||'').toLowerCase():'Calçados '+(product.audience||'').toLowerCase();
 link.append(photo,node('p','category',kind),node('h3','',product.name),node('span','details-link','Ver detalhes →'));
 card.append(link);return card;
}

function render(){
 const root=document.getElementById('products');root.replaceChildren();
 const query=normalize(document.getElementById('query').value.trim());let count=0;
 for(const group of groups){
  if(department!=='all'&&department!==group.key)continue;
  const items=catalog.filter(product=>departmentOf(product)===group.key&&normalize(product.name+' '+product.brand+' '+product.description).includes(query));
  count+=items.length;
  if(!items.length&&department==='all')continue;
  const section=node('section','product-section');section.id='categoria-'+group.key;
  const heading=node('div','category-band '+group.class);
  heading.append(node('p','eyebrow','Rainha dos Calçados'),node('h2','',group.title),node('p','',group.description));section.append(heading);
  const grid=node('div','products');
  if(items.length)items.forEach(product=>grid.append(productCard(product)));
  else grid.append(node('p','empty','Estamos preparando esta seleção. Fale com a loja pelo WhatsApp.'));
  section.append(grid);root.append(section);
 }
 document.getElementById('count').textContent=count+' produto(s)';
 if(!root.children.length)root.append(node('p','empty',query?'Nenhum produto encontrado. Experimente outra busca.':'Estamos preparando novos produtos para a vitrine. Fale com a loja pelo WhatsApp.'));
}

function bannerContent(banner){
 const image=node('img');
 image.src=banner.image;
 image.alt=banner.title||'Destaque da Rainha dos Calçados';
 image.loading='eager';
 if(!banner.link)return image;
 const link=node('a','banner-link');
 link.href=banner.link;link.setAttribute('aria-label',banner.title||'Abrir destaque');link.append(image);
 return link;
}

function renderPromotion(area,banner){
 if(!banner?.image){
  area.replaceChildren();area.classList.remove('has-banner');area.hidden=true;return false;
 }
 area.replaceChildren(bannerContent(banner));
 area.classList.add('has-banner');area.hidden=false;
 return true;
}

function renderHighlights(area,source){
 if(carouselTimer){clearInterval(carouselTimer);carouselTimer=null;}
 const items=(Array.isArray(source)?source:[]).filter(item=>item?.image);
 if(!items.length){
  area.classList.remove('has-highlights');
  area.innerHTML=mainFallback;
  area.hidden=false;
  return false;
 }

 let current=0;
 const carousel=node('div','highlight-carousel');
 carousel.setAttribute('role','region');
 carousel.setAttribute('aria-roledescription','carrossel');
 carousel.setAttribute('aria-label','Destaques da loja');
 const slides=node('div','highlight-slides');
 const slideItems=items.map((item,index)=>{
  const slide=node('article','highlight-slide');
  slide.setAttribute('aria-label','Destaque '+(index+1)+' de '+items.length);
  slide.append(bannerContent(item));slides.append(slide);return slide;
 });
 carousel.append(slides);

 const show=index=>{
  current=(index+items.length)%items.length;
  slideItems.forEach((slide,position)=>{
   const active=position===current;
   slide.hidden=!active;slide.setAttribute('aria-hidden',String(!active));
  });
  carousel.querySelectorAll('[data-highlight-dot]').forEach((dot,position)=>dot.setAttribute('aria-current',String(position===current)));
 };

 const stop=()=>{if(carouselTimer){clearInterval(carouselTimer);carouselTimer=null;}};
 const start=()=>{
  if(items.length<2||window.matchMedia('(prefers-reduced-motion: reduce)').matches||carouselTimer)return;
  carouselTimer=window.setInterval(()=>show(current+1),6000);
 };

 if(items.length>1){
  const controls=node('div','highlight-controls');
  const previous=node('button','highlight-arrow highlight-previous','‹');
  previous.type='button';previous.setAttribute('aria-label','Mostrar destaque anterior');previous.onclick=()=>{stop();show(current-1);start();};
  const next=node('button','highlight-arrow highlight-next','›');
  next.type='button';next.setAttribute('aria-label','Mostrar próximo destaque');next.onclick=()=>{stop();show(current+1);start();};
  const dots=node('div','highlight-dots');
  items.forEach((_,index)=>{
   const dot=node('button','highlight-dot');
   dot.type='button';dot.dataset.highlightDot=String(index);dot.setAttribute('aria-label','Mostrar destaque '+(index+1));
   dot.onclick=()=>{stop();show(index);start();};dots.append(dot);
  });
  controls.append(previous,dots,next);carousel.append(controls);
  carousel.addEventListener('pointerenter',stop);
  carousel.addEventListener('pointerleave',start);
  carousel.addEventListener('focusin',stop);
  carousel.addEventListener('focusout',()=>setTimeout(()=>{if(!carousel.contains(document.activeElement))start();},0));
 }

 area.replaceChildren(carousel);
 area.classList.add('has-highlights');area.hidden=false;
 show(0);start();
 return true;
}

function setDepartment(next){
 department=next;
 document.querySelectorAll('button[data-department]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.department===department)));
 render();
}

document.querySelectorAll('[data-department]').forEach(element=>element.onclick=()=>setDepartment(element.dataset.department));
document.getElementById('search').onsubmit=event=>{event.preventDefault();render();document.getElementById('catalogo').scrollIntoView({block:'start'});};
document.getElementById('query').oninput=render;

fetch('/api/catalog',{cache:'no-store'}).then(async response=>{
 if(!response.ok)throw Error();
 const data=await response.json();
 catalog=Array.isArray(data.products)?data.products:[];
 render();
 const banners=data.banners||{};
 const highlights=Array.isArray(banners.highlights)?banners.highlights:(banners.main?[banners.main]:[]);
 renderHighlights(mainBanner,highlights);
 renderPromotion(document.getElementById('promotion'),banners.promotion||data.banner||null);
}).catch(()=>{
 document.getElementById('products').replaceChildren(node('p','empty','Não foi possível carregar a vitrine. Fale com a loja pelo WhatsApp ou tente novamente.'));
 document.getElementById('count').textContent='';
});
