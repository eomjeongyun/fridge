const DB_NAME = 'fridge';
const DB_VERSION = 1;
const STORES = {fridge: 'fridgeItems', freezer: 'freezerItems'};
let db;
let currentLocation = 'fridge';
let selectedItem = null;
let selectedStore = null;

const CATEGORY_KEYWORDS = {
  '채소':['상추','시금치','깻잎','오이','호박','당근','양파','감자','대파','쪽파','파','마늘','브로콜리','배추','무','버섯','콩나물','숙주','고추','파프리카','양배추','샐러리','부추','가지','옥수수'],
  '과일':['사과','배','바나나','딸기','포도','귤','오렌지','복숭아','자두','수박','참외','키위','레몬','망고','블루베리','토마토','아보카도'],
  '유제품':['우유','치즈','요거트','요구르트','버터','생크림','크림치즈'],
  '육류/계란':['돼지고기','소고기','닭고기','삼겹살','목살','불고기','베이컨','햄','소시지','계란','달걀','오리고기'],
  '생선/해산물':['생선','고등어','갈치','연어','참치','오징어','새우','조개','멸치','문어','낙지','게','어묵'],
  '음료':['주스','음료','물','탄산','커피','차','두유','맥주','와인'],
  '소스/양념':['된장','고추장','간장','케첩','마요네즈','소스','드레싱','식초','참기름','들기름','쌈장','잼','꿀'],
  '밑반찬/기타':['김치','두부','만두','반찬','장아찌','피클','떡','밥','면','라면']
};
const SHELF_LIFE = [
  ['상추',5],['시금치',5],['깻잎',7],['오이',7],['애호박',7],['당근',21],['양파',30],['감자',30],['대파',10],['마늘',30],['브로콜리',7],['두부',5],['계란',21],['달걀',21],['우유',7],['요거트',14],['요구르트',14],['치즈',14],['김치',60],['돼지고기',3],['소고기',3],['닭고기',2],['생선',2],['고등어',2],['갈치',2],['연어',2],['어묵',7],['만두',5],['콩나물',3],['숙주',3],['버섯',7],['토마토',7],['사과',21],['딸기',4],['바나나',5],['햄',7],['소시지',7],['새우',2],['오징어',2],['생크림',5]
];
const CATEGORY_DAYS = {'채소':7,'과일':10,'유제품':10,'육류/계란':3,'생선/해산물':3,'음료':14,'소스/양념':30,'밑반찬/기타':7};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const upgradeDB = request.result;
      if (!upgradeDB.objectStoreNames.contains('fridgeItems')) upgradeDB.createObjectStore('fridgeItems', {keyPath:'id'});
      if (!upgradeDB.objectStoreNames.contains('freezerItems')) upgradeDB.createObjectStore('freezerItems', {keyPath:'id'});
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function getAll(store) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, 'readonly').objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function putItem(item, oldStore) {
  const newStore = STORES[item.location];
  const names = oldStore && oldStore !== newStore ? [oldStore,newStore] : [newStore];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, 'readwrite');
    if (oldStore && oldStore !== newStore) tx.objectStore(oldStore).delete(item.id);
    tx.objectStore(newStore).put(item);
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
}
function removeItem(store,id) {
  return new Promise((resolve,reject) => { const tx=db.transaction(store,'readwrite'); tx.objectStore(store).delete(id); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); });
}
function categoryFor(name) {
  const normalized = name.toLowerCase().replace(/\s/g,'');
  return Object.entries(CATEGORY_KEYWORDS).find(([,words]) => words.some(word => normalized.includes(word)))?.[0] || '밑반찬/기타';
}
function shelfDays(name, category) {
  const normalized=name.toLowerCase().replace(/\s/g,'');
  return SHELF_LIFE.find(([word]) => normalized.includes(word))?.[1] || CATEGORY_DAYS[category] || 7;
}
function addDays(dateString, days) {
  if (!dateString) return '';
  const date = new Date(`${dateString}T12:00:00`); date.setDate(date.getDate()+days);
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
function friendlyDate(value) { if(!value) return '기록 안 함'; const [,m,d]=value.split('-'); return `${Number(m)}월 ${Number(d)}일`; }
function daysUntil(value) { if(!value) return null; const today=new Date(); today.setHours(0,0,0,0); return Math.ceil((new Date(`${value}T00:00:00`)-today)/86400000); }
function expiryText(item) { const d=daysUntil(item.expiry); if(d===null)return '기한 없음'; if(d<0)return `${Math.abs(d)}일 지남`; if(d===0)return '오늘까지'; return `${d}일 남음`; }
function dDayLabel(d) { if(d===null)return ''; if(d<0)return `D+${Math.abs(d)}`; if(d===0)return 'D-DAY'; return `D-${d}`; }

function iconSVG(category) {
  const common='viewBox="0 0 80 80" aria-hidden="true"';
  const icons={
    '채소':`<svg ${common}><path d="M39 32 Q18 11 11 33 Q16 56 39 61 Q62 54 68 31 Q58 13 40 32" fill="#91bd84" stroke="#597a57" stroke-width="3"/><path d="M40 62 Q39 40 22 27 M39 44 Q52 30 61 27" fill="none" stroke="#66875f" stroke-width="3" stroke-linecap="round"/></svg>`,
    '과일':`<svg ${common}><path d="M20 40 Q20 20 39 19 Q62 20 63 42 Q61 66 40 68 Q18 64 20 40" fill="#ee806f" stroke="#9b554d" stroke-width="3"/><path d="M40 20 Q38 10 46 7 M42 14 Q54 8 59 16 Q49 22 42 17" fill="#91bd84" stroke="#5e805a" stroke-width="3" stroke-linecap="round"/></svg>`,
    '유제품':`<svg ${common}><path d="M24 20 L31 10 L52 11 L58 21 L58 68 Q40 72 22 67 Z" fill="#f5efe0" stroke="#7aa5b5" stroke-width="3"/><path d="M24 21 Q40 18 58 21 L57 37 Q40 40 23 36 Z" fill="#9fc7d6" stroke="#7aa5b5" stroke-width="3"/><path d="M33 10 L33 20" stroke="#7aa5b5" stroke-width="3"/></svg>`,
    '육류/계란':`<svg ${common}><path d="M21 43 Q20 20 38 13 Q54 18 60 41 Q63 64 41 69 Q19 66 21 43" fill="#fff2cf" stroke="#b9926f" stroke-width="3"/><ellipse cx="41" cy="47" rx="11" ry="13" fill="#f3c765" stroke="#d39b45" stroke-width="2"/></svg>`,
    '생선/해산물':`<svg ${common}><path d="M17 42 Q31 20 57 30 L69 20 L67 43 L69 61 L56 53 Q31 63 17 42" fill="#9fc7d6" stroke="#587d8c" stroke-width="3"/><circle cx="52" cy="36" r="2.5" fill="#654b43"/><path d="M29 33 Q35 41 29 52" fill="none" stroke="#587d8c" stroke-width="2"/></svg>`,
    '음료':`<svg ${common}><path d="M26 19 Q40 16 54 19 L58 67 Q40 72 22 67 Z" fill="#f3c765" stroke="#9b6352" stroke-width="3"/><path d="M29 11 L51 11 L53 20 L27 20 Z" fill="#ee806f" stroke="#9b6352" stroke-width="3"/><path d="M29 41 Q40 35 55 41" fill="none" stroke="#fff" stroke-width="3" opacity=".65"/></svg>`,
    '소스/양념':`<svg ${common}><path d="M24 26 Q40 22 57 26 L55 68 Q39 72 23 67 Z" fill="#ee806f" stroke="#925248" stroke-width="3"/><path d="M28 13 L52 13 L55 25 L25 26 Z" fill="#91bd84" stroke="#5f805a" stroke-width="3"/><path d="M29 43 Q40 38 51 44 L50 56 Q40 60 29 55 Z" fill="#fff2cf"/></svg>`,
    '밑반찬/기타':`<svg ${common}><path d="M19 31 Q40 26 62 31 L59 67 Q40 72 20 66 Z" fill="#fff2cf" stroke="#9b6352" stroke-width="3"/><path d="M17 27 Q40 20 64 27 L61 35 Q40 39 19 34 Z" fill="#91bd84" stroke="#5e805a" stroke-width="3"/><path d="M27 46 Q40 41 53 47" fill="none" stroke="#ee806f" stroke-width="4" stroke-linecap="round"/></svg>`
  };
  return icons[category] || icons['밑반찬/기타'];
}

async function renderAll() {
  const [fridge,freezer]=await Promise.all([getAll(STORES.fridge),getAll(STORES.freezer)]);
  $('#homeCount').textContent=`냉장고 ${fridge.length}개 · 냉동고 ${freezer.length}개`;
  renderShelves(currentLocation==='fridge'?fridge:freezer);
}
function renderShelves(items) {
  const wrap=$('#shelfWrap'); wrap.replaceChildren();
  if(!items.length){wrap.innerHTML='<div class="empty-state"><div class="empty-jar"></div><p>아직 놓인 식재료가 없어요</p><small>아래의 + 버튼으로 하나씩 담아보세요.</small></div>';return;}
  const sorted=[...items].sort((a,b)=>(a.expiry||'9999').localeCompare(b.expiry||'9999'));
  for(let i=0;i<sorted.length;i+=6){const shelf=document.createElement('div');shelf.className='shelf';sorted.slice(i,i+6).forEach(item=>{const button=document.createElement('button');button.className='food-item';button.dataset.id=item.id;const d=daysUntil(item.expiry);const badgeClass=d===null?'':d<0?'over':d<=3?'soon':'';const badge=d===null?'':`<span class="dday-badge ${badgeClass}">${dDayLabel(d)}</span>`;button.innerHTML=`<span class="food-icon-wrap"><span class="food-icon">${iconSVG(item.category)}</span>${badge}</span><span class="food-name">${escapeHTML(item.name)}</span><span class="food-expiry ${d!==null&&d<=3?'soon':''}">${expiryText(item)}</span>`;shelf.append(button)});wrap.append(shelf)}
}
async function refreshRecipeIngredients(){
  const [fridge,freezer]=await Promise.all([getAll(STORES.fridge),getAll(STORES.freezer)]);
  const names=[...new Set([...fridge,...freezer].map(item=>item.name.trim()).filter(Boolean))];
  const checklist=$('#ingredientChecklist');
  const links=$('#recipeLinks');
  checklist.replaceChildren();
  links.replaceChildren();
  if(!names.length){
    checklist.innerHTML='<div class="recipe-empty"><div class="search-doodle" aria-hidden="true"></div><p>먼저 식재료를 담아주세요</p><small>냉장고나 냉동고에 재료를 추가하면 여기에서 골라 검색할 수 있어요.</small></div>';
    $('#recipeNote').textContent='냉장고와 냉동고가 아직 비어 있어요.';
    $('#findRecipes').hidden=true;
    return;
  }
  names.forEach((name,index)=>{
    const label=document.createElement('label');
    label.className='ingredient-option';
    const input=document.createElement('input');
    input.type='checkbox'; input.value=name; input.checked=true; input.id=`recipeIngredient${index}`;
    const span=document.createElement('span'); span.textContent=name;
    label.append(input,span); checklist.append(label);
  });
  $('#findRecipes').hidden=false;
  $('#recipeNote').textContent=`냉장고·냉동고의 재료 ${names.length}가지를 모두 선택했어요.`;
}
function buildRecipeLinks(){
  const selected=$$('#ingredientChecklist input:checked').map(input=>input.value);
  const links=$('#recipeLinks');
  links.replaceChildren();
  if(!selected.length){
    $('#recipeNote').textContent='검색할 재료를 하나 이상 골라주세요.';
    return;
  }
  const heading=document.createElement('p');
  heading.className='search-ready';
  heading.textContent=`${selected.join(' · ')} 레시피를 어디에서 찾을까요?`;
  const actions=document.createElement('div'); actions.className='search-link-actions';
  const recipeLink=document.createElement('a');
  recipeLink.className='search-link recipe-site';
  recipeLink.href=`https://www.10000recipe.com/recipe/list.html?q=${encodeURIComponent(selected[0])}`;
  recipeLink.target='_blank'; recipeLink.rel='noopener noreferrer';
  recipeLink.textContent=`만개의레시피에서 ${selected[0]} 찾기`;
  const naverLink=document.createElement('a');
  naverLink.className='search-link web-search';
  naverLink.href=`https://search.naver.com/search.naver?query=${encodeURIComponent(`${selected.join(' ')} 레시피`)}`;
  naverLink.target='_blank'; naverLink.rel='noopener noreferrer';
  naverLink.textContent='네이버에서 선택 재료 모두 찾기';
  actions.append(recipeLink,naverLink); links.append(heading,actions);
  $('#recipeNote').textContent='아래 검색처를 누르면 새 창에서 최신 결과를 열어요.';
}
function escapeHTML(value){const span=document.createElement('span');span.textContent=value;return span.innerHTML}
function showView(name){$$('.view').forEach(v=>v.classList.remove('active'));$(`#${name}View`).classList.add('active');$$('.nav-button').forEach(b=>b.classList.toggle('active',b.dataset.view===name));if(name==='recipe')refreshRecipeIngredients();window.scrollTo(0,0)}
function showModal(id){const el=$(`#${id}`);el.hidden=false;document.body.style.overflow='hidden'}
function closeModal(id){$(`#${id}`).hidden=true;if(!$$('.backdrop:not([hidden])').length)document.body.style.overflow=''}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),1800)}
function updateEstimateHint(){const name=$('#itemName').value.trim(), purchased=$('#purchasedAt').value, expiry=$('#expiry').value;if(expiry){$('#estimateHint').textContent=`직접 적은 날짜 ${friendlyDate(expiry)}까지로 저장해요.`}else if(purchased){const category=categoryFor(name);const days=shelfDays(name,category);$('#estimateHint').textContent=`보관 기준으로 ${addDays(purchased,days)}까지 드시길 제안해요. (${days}일)`}else{$('#estimateHint').textContent='구매일을 적으면 먹기 좋은 날을 알려드려요.'}}
function openAdd(){selectedItem=null;selectedStore=null;$('#itemSheetTitle').textContent='식재료 담기';$('#itemForm').reset();$('#itemId').value='';$(`input[name="location"][value="${currentLocation}"]`).checked=true;updateEstimateHint();showModal('itemBackdrop');setTimeout(()=>$('#itemName').focus(),250)}
function openEdit(){const item=selectedItem;closeModal('detailBackdrop');$('#itemSheetTitle').textContent='식재료 고치기';$('#itemId').value=item.id;$('#itemName').value=item.name;$('#purchasedAt').value=item.purchasedAt||'';$('#expiry').value=item.expiryIsEstimated?'':(item.expiry||'');$(`input[name="amount"][value="${item.amount||'보통'}"]`).checked=true;$(`input[name="location"][value="${item.location}"]`).checked=true;updateEstimateHint();showModal('itemBackdrop')}
async function openDetail(id){const store=STORES[currentLocation];const items=await getAll(store);selectedItem=items.find(item=>item.id===id);selectedStore=store;if(!selectedItem)return;const item=selectedItem;$('#detailContent').innerHTML=`<div class="detail-hero"><span class="food-icon">${iconSVG(item.category)}</span><h2 id="detailName">${escapeHTML(item.name)}</h2><span class="category-pill">${item.category}</span></div><div class="detail-info"><div class="detail-row"><span>보관 장소</span><strong>${item.location==='fridge'?'냉장고':'냉동고'}</strong></div><div class="detail-row"><span>남은 정도</span><strong>${item.amount||'보통'}</strong></div><div class="detail-row"><span>구매일</span><strong>${friendlyDate(item.purchasedAt)}</strong></div><div class="detail-row"><span>${item.expiryIsEstimated?'추천 소비일':'유통기한'}</span><strong>${friendlyDate(item.expiry)}${item.expiryIsEstimated?' (예상)':''}</strong></div></div>`;showModal('detailBackdrop')}

async function saveForm(event){event.preventDefault();const name=$('#itemName').value.trim();if(!name)return;const purchasedAt=$('#purchasedAt').value;const enteredExpiry=$('#expiry').value;const category=categoryFor(name);const expiry=enteredExpiry||(purchasedAt?addDays(purchasedAt,shelfDays(name,category)):'');const now=new Date().toISOString();const location=$('input[name="location"]:checked').value;const id=$('#itemId').value;const item={id:id||(crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`),name,category,location,purchasedAt,expiry,expiryIsEstimated:!enteredExpiry&&Boolean(expiry),amount:$('input[name="amount"]:checked').value,createdAt:selectedItem?.createdAt||now,updatedAt:now};await putItem(item,selectedStore);currentLocation=location;$$('.location-tab').forEach(b=>b.classList.toggle('active',b.dataset.location===location));closeModal('itemBackdrop');await renderAll();toast(id?'수정했어요.':'냉장고에 담았어요.')}

async function exportDB(){const [fridgeItems,freezerItems]=await Promise.all([getAll('fridgeItems'),getAll('freezerItems')]);return {app:'fridge',exportedAt:new Date().toISOString(),fridgeItems,freezerItems}}
function scheduleBackup(){setTimeout(async()=>{const today=new Date().toLocaleDateString('sv-SE');if(localStorage.getItem('fridgeBackupDate')===today)return;try{const exportedData=await exportDB();const res=await fetch('https://appointee-unnoticed-donated.ngrok-free.dev/api/app-backup/fridge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(exportedData)});if(res.ok)localStorage.setItem('fridgeBackupDate',today)}catch{}},4000)}

async function init(){
  db=await openDB();
  if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
  await renderAll(); scheduleBackup();
  $$('.nav-button').forEach(button=>button.addEventListener('click',()=>showView(button.dataset.view)));
  $('#openFridge').addEventListener('click',()=>showView('inside'));
  $('#findRecipes').addEventListener('click',buildRecipeLinks);
  $$('.location-tab').forEach(button=>button.addEventListener('click',async()=>{currentLocation=button.dataset.location;$$('.location-tab').forEach(b=>b.classList.toggle('active',b===button));renderShelves(await getAll(STORES[currentLocation]))}));
  $('#addButton').addEventListener('click',openAdd);
  $('#shelfWrap').addEventListener('click',e=>{const item=e.target.closest('.food-item');if(item)openDetail(item.dataset.id)});
  $('#itemForm').addEventListener('submit',saveForm);
  ['itemName','purchasedAt','expiry'].forEach(id=>$(`#${id}`).addEventListener('input',updateEstimateHint));
  $$('[data-close]').forEach(button=>button.addEventListener('click',()=>closeModal(button.dataset.close)));
  $$('.backdrop').forEach(el=>el.addEventListener('click',e=>{if(e.target===el)closeModal(el.id)}));
  $('#editItem').addEventListener('click',openEdit);
  $('#deleteItem').addEventListener('click',()=>showModal('confirmBackdrop'));
  $('#confirmDelete').addEventListener('click',async()=>{if(!selectedItem)return;await removeItem(selectedStore,selectedItem.id);closeModal('confirmBackdrop');closeModal('detailBackdrop');await renderAll();toast('식재료를 지웠어요.')});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){const open=$$('.backdrop:not([hidden])').pop();if(open)closeModal(open.id)}});
}

if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{});let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)return;reloading=true;location.reload()})}
init().catch(()=>{document.body.insertAdjacentHTML('beforeend','<p class="no-recipes">저장 공간을 열지 못했어요. 앱을 다시 열어 주세요.</p>')});
