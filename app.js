const KEY="dbdChallengeStateRUv2";
const CONFIG={maxLevel:15,perksPerBuild:4,victoryGain:1,killerVictoryMinKills:3};
let gameState={
 challengeId:null,status:"idle",mode:null,players:[],currentPlayer:0,currentPerk:0,currentQuestion:0,
 level:1,maxLevel:15,builds:{},firstAttemptFailed:false,cursedBuild:false,matchResult:null,
 history:[],ready:[],lastSavedAt:null,questionPool:[],usedQuestionIds:[]
};

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function challengeSnapshot(){
  return {
    challengeId:gameState.challengeId,status:gameState.status,mode:gameState.mode,
    players:gameState.players,level:gameState.level,maxLevel:gameState.maxLevel,
    builds:gameState.builds,firstAttemptFailed:gameState.firstAttemptFailed,
    cursedBuild:gameState.cursedBuild,matchResult:gameState.matchResult,
    ready:gameState.ready,currentPlayer:gameState.currentPlayer,currentPerk:gameState.currentPerk,
    currentQuestion:gameState.currentQuestion,lastSavedAt:gameState.lastSavedAt,
    questionPool:gameState.questionPool,usedQuestionIds:gameState.usedQuestionIds
  };
}
function upsertHistorySnapshot(){
  if(!gameState.challengeId)return;
  const snap=challengeSnapshot();
  const idx=gameState.history.findIndex(h=>h.challengeId===gameState.challengeId);
  const base={
    challengeId:gameState.challengeId,date:new Date().toLocaleString("ru-RU"),
    mode:gameState.mode,players:gameState.players.map(p=>p.name),status:gameState.status,
    level:gameState.level,levelFrom:gameState.level,levelTo:gameState.level,
    result:gameState.matchResult||null,detail:"Сохранённый прогресс",
    snapshot:snap
  };
  if(idx>=0) gameState.history[idx]={...gameState.history[idx],...base,snapshot:snap};
  else gameState.history.unshift(base);
}
function saveGame(){
  gameState.lastSavedAt=new Date().toISOString();
  upsertHistorySnapshot();
  localStorage.setItem(KEY,JSON.stringify(gameState));
}
function loadGame(){try{const x=JSON.parse(localStorage.getItem(KEY));if(x)gameState={...gameState,...x}}catch{}}
function resetGame(){if(confirm("Сбросить весь сохранённый прогресс и историю матчей?")){localStorage.removeItem(KEY);location.reload()}}
function exitToMenu(save=true){
  if(save && gameState.status==="active")saveGame();
  show("splash");
}
function show(id){$$(".screen").forEach(s=>s.classList.remove("active"));const el=$("#"+id);el.classList.add("active");window.scrollTo(0,0)}
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1800)}
function shuffle(a){return [...a].sort(()=>Math.random()-.5)}
function pick(pool){return shuffle(pool)[0]}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function rolePools(){
  return gameState.mode==="killer"
    ? {good:PERK_CATEGORIES.killerGood,bad:PERK_CATEGORIES.killerBad}
    : {good:PERK_CATEGORIES.survivorGood,bad:PERK_CATEGORIES.survivorBad};
}
function freshPlayer(name){return{name,progress:0,build:[],correctForPerk:0,wrongForPerk:0,activeQuestionId:null}}
function initQuestionPool(){
  gameState.questionPool=shuffle(QUESTIONS.map((q,i)=>q.id??i));
  gameState.usedQuestionIds=[];
}
function getQuestionById(id){return QUESTIONS.find((q,i)=>(q.id??i)===id)}
function nextUniqueQuestion(){
  if(!Array.isArray(gameState.questionPool))gameState.questionPool=[];
  if(!Array.isArray(gameState.usedQuestionIds))gameState.usedQuestionIds=[];
  if(!gameState.questionPool.length){
    // One complete randomized pass finished. Start a new randomized cycle.
    // Questions are never repeated inside the same cycle.
    gameState.questionPool=shuffle(QUESTIONS.map((q,i)=>q.id??i).filter(id=>!gameState.usedQuestionIds.includes(id)));
    if(!gameState.questionPool.length){
      return null;
    }
  }
  const id=gameState.questionPool.shift();
  gameState.usedQuestionIds.push(id);
  return getQuestionById(id);
}
function initParticles(){const p=$("#particles");for(let i=0;i<70;i++){const e=document.createElement("i");e.className="particle";e.style.left=Math.random()*100+"%";e.style.animationDuration=(7+Math.random()*15)+"s";e.style.animationDelay=(-Math.random()*15)+"s";p.append(e)}}
function tilt(){$$(".tilt").forEach(el=>{el.addEventListener("pointermove",e=>{const r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;el.style.transform=`perspective(700px) rotateY(${x*8}deg) rotateX(${-y*8}deg) translateY(-6px)`});el.addEventListener("pointerleave",()=>el.style.transform="")})}

function renderSetup(){
 const c=$("#setupContent"); let title="",body="";
 if(gameState.mode==="party"){
  title="СКОЛЬКО ИГРОКОВ?"; body=`<div class="choice-grid">${[2,3,4].map(n=>`<button class="choice ${gameState.partyCount===n?"selected":""}" data-count="${n}">${n} ИГРОКА</button>`).join("")}</div><div id="partyFields"></div>`;
 }else{
  title=gameState.mode==="killer"?"ВВЕДИ СВОЙ НИК":"ВВЕДИ НИК ВЫЖИВШЕГО";
  body=`<input id="singleName" class="setup-input" maxlength="24" placeholder="Твой ник"><button class="btn primary" id="setupContinue">ПРОДОЛЖИТЬ</button>`;
 }
 c.innerHTML=`<p class="eyebrow">02 // ИДЕНТИФИКАЦИЯ</p><h2>${title}</h2>${body}`;
 $$("[data-count]").forEach(b=>b.onclick=()=>{gameState.partyCount=+b.dataset.count;renderSetup();renderPartyFields()});
 if(gameState.mode==="party")renderPartyFields();
 $("#setupContinue")?.addEventListener("click",()=>{const n=$("#singleName").value.trim();if(!n)return toast("ВВЕДИ НИК");gameState.players=[freshPlayer(n)];begin()});
}
function renderPartyFields(){
 if(gameState.mode!=="party")return;const c=$("#partyFields");if(!gameState.partyCount){c.innerHTML="";return}
 c.innerHTML=`<div class="player-fields">${Array.from({length:gameState.partyCount},(_,i)=>`<input class="setup-input p-name" maxlength="24" placeholder="ИГРОК ${i+1}">`).join("")}</div><button class="btn primary" id="partyContinue">ПРОДОЛЖИТЬ</button>`;
 $("#partyContinue").onclick=()=>{const ns=$$(".p-name").map(x=>x.value.trim());if(ns.some(n=>!n))return toast("ВВЕДИ ВСЕ НИКИ");gameState.players=ns.map(freshPlayer);begin()};
}
function begin(){
 gameState.challengeId="CH-"+Date.now()+"-"+Math.random().toString(36).slice(2,7).toUpperCase();
 gameState.status="active";
 gameState.currentPlayer=0;gameState.currentPerk=0;gameState.currentQuestion=0;gameState.builds={};gameState.ready=[];
 gameState.firstAttemptFailed=false;gameState.cursedBuild=false;gameState.matchResult=null;
 initQuestionPool();
 saveGame();show("quiz");loadQuestion();
}
function currentPlayer(){return gameState.players[gameState.currentPlayer]}
function loadQuestion(){
 const p=currentPlayer();
 let q=p.activeQuestionId!=null?getQuestionById(p.activeQuestionId):null;
 if(!q){
   q=nextUniqueQuestion();
   if(!q){toast("НЕТ ДОСТУПНЫХ ВОПРОСОВ");return;}
   p.activeQuestionId=q.id??QUESTIONS.indexOf(q);
 }
 gameState.currentQuestion=(gameState.currentQuestion||0)+1;
 $("#quizRole").textContent=gameState.mode==="killer"?"// УБИЙЦА":"// ВЫЖИВШИЙ";
 $("#levelHud").textContent=`УР. ${gameState.level}`;
 $("#playerHud").textContent=gameState.players.length>1?`${escapeHtml(p.name)} // ИГРОК ${gameState.currentPlayer+1}`:"";
 $("#qNumber").textContent=`ВОПРОС ${gameState.currentQuestion}`;
 $("#perkCount").textContent=`ПЕРК ${gameState.currentPerk+1} / ${CONFIG.perksPerBuild} · ${p.correctForPerk} ✓ / ${p.wrongForPerk} ✕`;
 $("#qProgress").style.width=Math.min(100,(p.correctForPerk+p.wrongForPerk)/4*100)+"%";
 $("#category").textContent=`${q.category} // ${q.difficulty}`;
 $("#question").textContent=q.text;$("#feedback").textContent="";$("#feedback").className="feedback";
 $("#answers").innerHTML=q.answers.map((a,i)=>`<button class="answer" data-answer="${i}"><b>${String.fromCharCode(65+i)}</b>&nbsp; ${escapeHtml(a)}</button>`).join("");
 $$(".answer").forEach(b=>b.onclick=()=>answerQuestion(+b.dataset.answer));renderPlayerProgress();renderMiniLadder();
}
function answerQuestion(index){
 const p=currentPlayer(),q=getQuestionById(p.activeQuestionId),correct=index===q.correct;
 $$(".answer").forEach((b,i)=>{b.disabled=true;if(i===q.correct)b.classList.add("correct");if(i===index&&!correct)b.classList.add("wrong")});
 if(correct){p.correctForPerk++;$("#feedback").textContent="✓ ПРАВИЛЬНО — ЕЩЁ ОДИН ПРАВИЛЬНЫЙ ОТВЕТ НУЖЕН ДЛЯ ПЕРКА";$("#feedback").className="feedback good"}
 else{p.wrongForPerk++;$("#feedback").textContent="✕ НЕПРАВИЛЬНО — ЕЩЁ ОДНА ОШИБКА НУЖНА ДЛЯ ПЛОХОГО ПЕРКА";$("#feedback").className="feedback bad"}
 p.progress++;p.activeQuestionId=null;
 saveGame();
 setTimeout(()=>{
   if(p.correctForPerk>=2){unlockPerk("good")}
   else if(p.wrongForPerk>=2){unlockPerk("bad")}
   else loadQuestion();
 },650);
}
function unlockPerk(type){
 const p=currentPlayer(),pools=rolePools(),pool=type==="good"?pools.good:pools.bad;
 const used=p.build.map(x=>x.name);let available=pool.filter(x=>!used.includes(x.name));if(!available.length)available=pool;
 const perk={...pick(available),type};
 p.build.push(perk);p.correctForPerk=0;p.wrongForPerk=0;
 gameState.builds[p.name]=p.build;saveGame();showPerkReveal(perk);
}
function showPerkReveal(perk){
 $("#revealLevel").textContent=`УР. ${gameState.level}`;
 $("#revealEyebrow").textContent=perk.type==="good"?"2 ПРАВИЛЬНЫХ ОТВЕТА":"2 НЕПРАВИЛЬНЫХ ОТВЕТА";
 $("#revealTitle").textContent=perk.type==="good"?"ХОРОШИЙ ПЕРК +":"ПЛОХОЙ ПЕРК +";
 const img=perk.image?`<img src="${perk.image}" alt="" onerror="this.style.display='none'">`:"";
 $("#revealedPerk").innerHTML=`${img}<div class="perk-icon">${perk.icon}</div><strong>${escapeHtml(perk.name)}</strong><small>${escapeHtml(perk.desc)}</small>`;
 show("perkReveal");
}
function continuePerk(){
 const p=currentPlayer();
 if(p.build.length>=CONFIG.perksPerBuild){
   if(gameState.currentPlayer<gameState.players.length-1){gameState.currentPlayer++;gameState.currentPerk=0;gameState.currentQuestion=0;show("quiz");loadQuestion()}
   else showBuildForAll();
 }else{gameState.currentPerk=p.build.length;show("quiz");loadQuestion()}
}
function renderPlayerProgress(){
 $("#playerProgress").innerHTML=gameState.players.map((p,i)=>`<div class="pbar">${escapeHtml(p.name)}<i style="width:${Math.min(100,p.build.length/4*100)}%"></i><small>${p.build.length}/4 перков</small></div>`).join("");
}
function renderMiniLadder(){$("#miniLadder").innerHTML=Array.from({length:15},(_,i)=>`<b class="${i+1===gameState.level?"current":""}">УРОВЕНЬ ${i+1}</b>`).join("")}
function showBuildForAll(){
 const p=currentPlayer();$("#buildEyebrow").textContent=gameState.players.length>1?"ВСЕ БИЛДЫ СОБРАНЫ":"ТВОЙ БИЛД";$("#buildTitle").textContent="4 ПЕРКА ОТКРЫТЫ";$("#buildLevel").textContent=`УР. ${gameState.level}`;
 const cards=gameState.players.flatMap((x,pi)=>x.build.map((k,ki)=>({k,pi,ki})));
 $("#perkGrid").innerHTML=`<div class="build-note">Если какого-то из этих перков у тебя нет, просто играй с тем, что есть. Слот можно оставить пустым — заменять отсутствующий перк не нужно.</div>`+cards.map(({k,pi,ki})=>{const img=k.image?`<img src="${k.image}" alt="" onerror="this.style.display='none'">`:"";return `<div class="perk ${k.type==="bad"?"bad":""}" style="animation-delay:${(pi*4+ki)*.08}s">${img}<div class="perk-icon">${k.icon}</div><strong>${escapeHtml(k.name)}</strong><small>${escapeHtml(k.desc)}</small>${gameState.players.length>1?`<small>${escapeHtml(gameState.players[pi].name)}</small>`:""}</div>`}).join("");
 show("build");
}
function continueBuild(){if(gameState.players.length>1){gameState.ready=gameState.players.map(()=>false);renderReady();show("ready")}else startMatch()}
function renderReady(){$("#readyList").innerHTML=gameState.players.map((p,i)=>`<div class="ready-row ${gameState.ready[i]?"ready":""}"><span>${escapeHtml(p.name)}</span><b>${gameState.ready[i]?"✓ ГОТО":"ОЖИДАНИЕ"}</b></div>`).join("");$("#readyBtn").textContent=gameState.ready.every(Boolean)?"НАЧАТЬ МАТЧ":"ГОТО"}
$("#readyBtn").onclick=()=>{if(gameState.ready.every(Boolean))startMatch();else{const i=gameState.ready.findIndex(x=>!x);gameState.ready[i]=true;renderReady()}};
function startMatch(){
 show("match");let html="";
 if(gameState.mode==="killer")html=`<p class="eyebrow">СКОЛЬКО ВЫЖИВШИХ УБИТО?</p><div class="kill-grid">${[0,1,2,3,4].map(k=>`<button class="kill" data-kills="${k}">${k}</button>`).join("")}</div>`;
 else if(gameState.mode==="solo")html=`<p class="eyebrow">ТЫ СБЕЖАЛ ИЛИ ПОГИБ?</p><div class="choice-grid"><button class="choice" data-escaped="yes">ДА, СБЕЖАЛ</button><button class="choice" data-escaped="no">НЕТ, ПОГИБ</button></div>`;
 else html=`<p class="eyebrow">СКОЛЬКО ИГРОКОВ СБЕЖАЛО?</p><div class="kill-grid">${Array.from({length:gameState.players.length+1},(_,k)=>`<button class="kill" data-escaped-count="${k}">${k}</button>`).join("")}</div>`;
 html+=`<div class="result-buttons"><button class="btn primary" id="matchSubmit">ПОДТВЕРДИТЬ РЕЗУЛЬТАТ</button></div>`;
 $("#matchExtra").innerHTML=html;let selected=null;
 $$(["[data-kills]"].join()).forEach(b=>b.onclick=()=>{ $$('[data-kills]').forEach(x=>x.classList.remove("selected"));b.classList.add("selected");selected=+b.dataset.kills});
 $$('[data-escaped]').forEach(b=>b.onclick=()=>{selected=b.dataset.escaped==="yes";$$('[data-escaped]').forEach(x=>x.classList.remove("selected"));b.classList.add("selected")});
 $$('[data-escaped-count]').forEach(b=>b.onclick=()=>{selected=+b.dataset.escapedCount;$$('[data-escaped-count]').forEach(x=>x.classList.remove("selected"));b.classList.add("selected")});
 $("#matchSubmit").onclick=()=>{if(selected===null)return toast("СНАЧАЛА УКАЖИ РЕЗУЛЬТАТ");processMatchResult(selected)};
}
function resetPlayersForAttempt(){
 gameState.currentPlayer=0;gameState.currentPerk=0;gameState.currentQuestion=0;
 gameState.players=gameState.players.map(p=>{const n=freshPlayer(p.name);return {...n,progress:p.progress||0}});
 gameState.builds={};gameState.ready=[];
}
function buildCursedPerks(){
 const pools=rolePools();
 gameState.players=gameState.players.map(old=>{
   const used=[];const build=[];
   for(let i=0;i<CONFIG.perksPerBuild;i++){
     let available=pools.bad.filter(x=>!used.includes(x.name));
     if(!available.length)available=pools.bad;
     const perk={...pick(available),type:"bad"};build.push(perk);used.push(perk.name);
   }
   return {...old,build,correctForPerk:0,wrongForPerk:0,progress:old.progress||0};
 });
 gameState.builds={};gameState.players.forEach(p=>gameState.builds[p.name]=p.build);
}
function continueAfterResult(){
 if(gameState.status!=="active")return newChallenge();
 if(gameState.firstAttemptFailed && gameState.cursedBuild){
   showBuildForAll();
   return;
 }
 resetPlayersForAttempt();
 saveGame();show("quiz");loadQuestion();
}
function processMatchResult(selected){
 let victory;
 if(gameState.mode==="killer"){
   victory=selected>=CONFIG.killerVictoryMinKills;
 }else if(gameState.mode==="solo"){
   victory=selected===true;
 }else{
   const count=gameState.players.length;
   victory=count===2 ? selected===2 : count===3 ? selected===3 : count===4 ? selected>=3 : false;
 }
 gameState.matchResult=victory?"victory":"defeat";
 const old=gameState.level;
 const detail=gameState.mode==="killer"?`${selected} убийств`:gameState.mode==="solo"?(victory?"СБЕЖАЛ":"ПОГИБ"):`СБЕЖАЛО ${selected}/${gameState.players.length}`;

 if(victory){
   const wasExtraAttempt=gameState.firstAttemptFailed && gameState.cursedBuild;
   gameState.firstAttemptFailed=false;gameState.cursedBuild=false;
   if(wasExtraAttempt){
     gameState.status="active";
     resetPlayersForAttempt();
     showResult("ПОБЕДА В ДОП. ПОПЫТКЕ","УРОВЕНЬ СОХРАНЁН","✦",`Победа: ${detail}. Дополнительная попытка с плохим билдом пройдена. Ты остаёшься на уровне ${old} и продолжаешь челлендж с обычным билдом.`,old,old);
   }else{
     gameState.level=Math.min(CONFIG.maxLevel,gameState.level+CONFIG.victoryGain);
     if(gameState.level>=CONFIG.maxLevel){
       gameState.status="completed";
       gameState.matchResult="victory";
       showResult("МАКСИМАЛЬНЫЙ УРОВЕНЬ","ЧЕЛЛЕНДЖ ЗАВЕРШЁН","✦",`Победа: ${detail}. Уровень повышен на +1. Ты достиг максимального уровня ${CONFIG.maxLevel}. Этот челлендж больше нельзя продолжить.`,old,gameState.level);
     }else{
       gameState.status="active";
       resetPlayersForAttempt();
       showResult("ПОБЕДА","УРОВЕНЬ ПОВЫШЕН","✦",`Победа: ${detail}. Следующий уровень начинается с нового обычного билда.`,old,gameState.level);
     }
   } }else if(!gameState.firstAttemptFailed){
   gameState.firstAttemptFailed=true;gameState.cursedBuild=true;gameState.status="active";
   buildCursedPerks();
   showResult("ПОРАЖЕНИЕ","ДОП. ПОПЫТКА — ПЛОХОЙ БИЛД","☠",`Результат: ${detail}. Это дополнительная попытка на уровне ${old}. Если победишь — останешься на этом же уровне; если проиграешь — опустишься на 1 уровень.`,old,old);
 }else{
   const nextLevel=Math.max(0,old-1);
   gameState.firstAttemptFailed=false;gameState.cursedBuild=false;gameState.level=nextLevel;
   if(nextLevel===0){
     gameState.status="defeated";
     showResult("ЧЕЛЛЕНДЖ ПРОИГРАН","ВТОРОЕ ПОРАЖЕНИЕ","✕",`Результат: ${detail}. Второе поражение на 1 уровне опускает челлендж до 0 — он завершён.`,old,nextLevel);
   }else{
     gameState.status="active";
     resetPlayersForAttempt();
     showResult("УРОВЕНЬ СНИЖЕН","ЧЕЛЛЕНДЖ ПРОДОЛЖАЕТСЯ","↘",`Результат: ${detail}. Второе поражение: уровень снижен на 1. Новый уровень начинается с обычного первого билда.`,old,nextLevel);
   }
 }
 saveGame();
}
function showResult(title,text,icon,desc,from,to){
 $("#resultIcon").textContent=icon;
 $("#resultEyebrow").textContent=gameState.cursedBuild?"ПРОКЛЯТЫЙ ПРОТОКОЛ":"РЕЗУЛЬТАТ МАТЧА";
 $("#resultTitle").textContent=title;$("#resultText").textContent=text+" — "+desc;
 $("#resultLevel").textContent=from===to?`УРОВЕНЬ ${to}`:`УРОВЕНЬ ${from} → ${to}`;
 const box=$("#resultActions");
 if(gameState.status==="active") box.innerHTML=`<button class="btn primary" data-action="continueChallenge">ПРОДОЛЖИТЬ ЧЕЛЛЕНДЖ</button><button class="btn" data-action="saveExit">В МЕНЮ С СОХРАНЕНИЕМ</button><button class="btn" data-action="newChallenge">НОВЫЙ ЧЕЛЛЕНДЖ</button>`;
 else box.innerHTML=`<button class="btn" data-action="saveExit">В МЕНЮ С СОХРАНЕНИЕМ</button><button class="btn primary" data-action="newChallenge">НОВЫЙ ЧЕЛЛЕНДЖ</button>`;
 show("result");
}
function newChallenge(){
 if(gameState.status==="active" && gameState.challengeId && gameState.players.length && !confirm("Текущий челлендж ещё можно продолжить из истории. Начать новый?")) return;
 gameState.currentPlayer=0;gameState.currentPerk=0;gameState.currentQuestion=0;
 gameState.players=gameState.players.map(p=>freshPlayer(p.name));gameState.builds={};gameState.matchResult=null;
 initQuestionPool();
 gameState.firstAttemptFailed=false;gameState.cursedBuild=false;gameState.ready=[];
 gameState.challengeId="CH-"+Date.now()+"-"+Math.random().toString(36).slice(2,7).toUpperCase();
 gameState.status="active";gameState.level=1;saveGame();show("quiz");loadQuestion();
}
function resumeChallenge(id){
 const h=gameState.history.find(x=>x.challengeId===id);
 if(!h||!h.snapshot)return toast("ЧЕЛЛЕНДЖ НЕ НАЙДЕН");
 gameState={...gameState,...h.snapshot,history:gameState.history};
 if(gameState.status!=="active")return toast("ЭТОТ ЧЕЛЛЕНДЖ УЖЕ ЗАВЕРШЁН");
 if(!Array.isArray(gameState.questionPool))gameState.questionPool=[];
 if(!Array.isArray(gameState.usedQuestionIds))gameState.usedQuestionIds=[];
 show("quiz");
 loadQuestion();
}
function showHistory(){
 const list=$("#historyList");
 list.innerHTML=gameState.history.length?gameState.history.slice(0,30).map((h,i)=>{
   const resumable=h.status==="active";
   const finished=h.status==="completed"||h.status==="defeated";
   const statusText=h.status==="completed"?"ЗАВЕРШЁН":h.status==="defeated"?"ПРОИГРАН":"ПРОГРЕСС СОХРАНЁН";
   return `<div class="history-item ${resumable?"resumable":""}">
     <div><b>ЧЕЛЛЕНДЖ #${gameState.history.length-i}</b><br>
     <small>${h.mode==="killer"?"УБИЙЦА":h.mode==="solo"?"ОДИНОЧНЫЙ ВЫЖИВШИЙ":"КОМАНДА"} · ${escapeHtml((h.players||[]).join(", "))}</small><br>
     <small>УРОВЕНЬ ${h.level??0} · ${statusText}</small></div>
     <div class="history-actions">
       ${resumable?`<button class="btn small" data-resume="${escapeHtml(h.challengeId)}">ПРОДОЛЖИТЬ</button>`:""}
       ${finished?`<b>${h.status==="completed"?"✓ ЗАВЕРШЁН":"✕ ПРОИГРАН"}`:""}
     </div>
   </div>`;
 }).join(""):`<div class="panel glass"><p class="eyebrow">НЕТ ЗАПИСЕЙ</p><h2>ИСТОРИЯ ЧЕЛЛЕНДЖЕЙ ПУСТА</h2></div>`;
 show("history");
}
document.addEventListener("click",e=>{
 const resume=e.target.closest("[data-resume]");
 if(resume){resumeChallenge(resume.dataset.resume);return}
 const a=e.target.closest("[data-action]");if(!a)return;
 const act=a.dataset.action;
 if(act==="start")show("mode");
 if(act==="mode")show("mode");
 if(act==="history")showHistory();
 if(act==="continueBuild")continueBuild();
 if(act==="continueChallenge")continueAfterResult();
 if(act==="continuePerk")continuePerk();
 if(act==="newChallenge")newChallenge();
 if(act==="saveExit")exitToMenu(true);
 if(act==="reset")resetGame();
});
$$("[data-mode]").forEach(b=>b.onclick=()=>{gameState.mode=b.dataset.mode;gameState.partyCount=null;show("setup");renderSetup()});
loadGame();initParticles();tilt();
