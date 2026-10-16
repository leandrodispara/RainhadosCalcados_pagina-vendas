'use strict';
const productId=new URLSearchParams(location.search).get('id');
const money=value=>value===null||value===undefined?'Consulte o valor':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
const node=(tag,cls,text)=>{const element=document.createElement(tag);if(cls)element.className=cls;if(text!==undefined)element.textContent=text;return element;};
const imagesOf=product=>Array.isArray(product.images)&&product.images.length?product.images:(product.image?[product.image]:[]);
const variation=(variant,product)=>product.category==='Perfumes'?[variant.ml+' ml',variant.concentration].filter(Boolean).join(' · '):[variant.color,variant.size].filter(Boolean).join(' · ');
function showProblem(message){const root=document.getElementById('product-detail');root.replaceChildren(node('section','product-problem',message),Object.assign(node('a','btn','Voltar para a vitrine'),{href:'/'}));}
function renderProduct(product){
 document.title=product.name+' | Rainha dos Calçados';
 const root=document.getElementById('product-detail');root.replaceChildren();
 const images=imagesOf(product);const layout=node('article','product-detail-layout');
 const gallery=node('section','product-gallery');const main=node('div','product-main-photo');
 if(images.length){const image=node('img');image.src=images[0];image.alt=product.name;main.append(image);
  if(images.length>1){const thumbs=node('div','product-thumbnails');images.forEach((url,index)=>{const button=node('button','thumbnail');button.type='button';button.setAttribute('aria-label','Ver foto '+(index+1));const thumb=node('img');thumb.src=url;thumb.alt='';button.append(thumb);button.setAttribute('aria-pressed',String(index===0));button.onclick=()=>{image.src=url;image.alt=product.name+' — foto '+(index+1);thumbs.querySelectorAll('button').forEach(item=>item.setAttribute('aria-pressed','false'));button.setAttribute('aria-pressed','true');};thumbs.append(button);});gallery.append(main,thumbs);}else gallery.append(main);
 }else{main.append(node('div','no-photo','Fotos disponíveis pelo WhatsApp'));gallery.append(main);}
 const info=node('section','product-info');const type=product.category==='Perfumes'?'Perfume '+product.audience.toLowerCase():'Calçados '+product.audience.toLowerCase();
 info.append(node('p','eyebrow',type),node('h1','',product.name));
 if(product.brand)info.append(node('p','product-brand',product.brand));
 if(product.description)info.append(node('p','product-description',product.description));
 const divider=node('div','detail-divider');const optionTitle=product.category==='Perfumes'?'Escolha volume e concentração':'Escolha cor e numeração';divider.append(node('h2','',optionTitle));
 const label=node('label','detail-option-label',optionTitle);const select=node('select','detail-select');select.setAttribute('aria-label',optionTitle);
 const variants=Array.isArray(product.variants)?product.variants:[];let selected=variants.find(variant=>variant.quantity>0)||null;
 variants.forEach((variant,index)=>{const option=node('option','',variation(variant,product)+(variant.quantity===0?' — indisponível':''));option.value=String(index);option.disabled=variant.quantity===0;select.append(option);});
 if(selected)select.value=String(variants.indexOf(selected));else select.selectedIndex=-1;
 label.append(select);divider.append(label);
 const priceBox=node('div','detail-price');const priceLabel=node('span','price-label','Valor da opção');const priceValue=node('strong','price-value');priceBox.append(priceLabel,priceValue);divider.append(priceBox);
 const availability=node('p','detail-availability');divider.append(availability);
 const action=node('a','btn detail-action');action.target='_blank';action.rel='noopener';divider.append(action);info.append(divider,node('p','detail-note','Para concluir a compra, fale diretamente com a equipe pelo WhatsApp.'));
 function update(){
  const value=selected?.price??product.price;priceValue.textContent=money(value);
  if(!selected){availability.textContent='Não há opções disponíveis no momento.';action.removeAttribute('href');action.setAttribute('aria-disabled','true');action.textContent='Indisponível';return;}
  availability.textContent='Disponibilidade confirmada pela loja no atendimento.';action.removeAttribute('aria-disabled');action.textContent='Comprar pelo WhatsApp ↗';
  const message='Olá! Tenho interesse em '+product.name+'. Opção: '+variation(selected,product)+'.'+(value!==null&&value!==undefined?' Valor exibido: '+money(value)+'.':'');
  action.href='https://wa.me/5544999087669?text='+encodeURIComponent(message);
 }
 select.onchange=()=>{selected=variants[Number(select.value)]||null;update();};update();
 layout.append(gallery,info);root.append(layout);
}
if(!productId)showProblem('Produto não encontrado. Volte para a vitrine e escolha um item.');
else fetch('/api/catalog',{cache:'no-store'}).then(async response=>{if(!response.ok)throw Error();const data=await response.json();const product=(data.products||[]).find(item=>item.id===productId);if(!product)throw Error('not-found');renderProduct(product);}).catch(error=>showProblem(error.message==='not-found'?'Este produto não está mais disponível na vitrine.':'Não foi possível carregar este produto. Tente novamente ou fale com a loja pelo WhatsApp.'));
