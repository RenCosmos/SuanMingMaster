'use strict';
const DICTIONARY=require('../references/knowledge/search-terms.json');
const DOMAINS=['bazi','ziwei','liuyao','spirit','practice','folklore','other'];
const from='財殺雜傷見幹氣綱祿緣護學該麼為強無';
const to='财杀杂伤见干气纲禄缘护学该么为强无';
function normalize(text){return String(text??'').normalize('NFKC').toLowerCase().replace(/[財殺雜傷見幹氣綱祿緣護學該麼為強無]/g,c=>to[from.indexOf(c)]).replace(/[\s\p{P}]/gu,'');}
function domains(topic){
 if(topic.domain)return [topic.domain];
 const text=[topic.slug,topic.name,...topic.tags].join(' '),out=[];
 if(/八字|子平|四柱|ziping|bazi|喜用/.test(text))out.push('bazi');
 if(/紫微|ziwei/.test(text))out.push('ziwei');
 if(/六爻|liuyao/.test(text))out.push('liuyao');
 if(topic.tradition||topic.slug.startsWith('spirit-'))out.push('spirit');
 if(topic.path.includes('/practice/'))out.push('practice');
 if(topic.path.includes('/folklore/'))out.push('folklore');
 return out.length?out:['other'];
}
function plan(query,domain){
 const q=normalize(query),hits=[],covered=[];
 const candidates=DICTIONARY.terms.flatMap(t=>[t.term,...t.aliases].map(alias=>({term:t.term,domain:t.domain,alias:normalize(alias),ambiguous:(t.ambiguous_aliases??[]).includes(alias)}))).sort((a,b)=>b.alias.length-a.alias.length);
 for(const c of candidates){let pos=q.indexOf(c.alias);while(pos>=0){const end=pos+c.alias.length;
  if(!covered.some(([s,e])=>s<=pos&&end<=e)){covered.push([pos,end]);if(!hits.some(h=>h.term===c.term))hits.push(c);}
  pos=q.indexOf(c.alias,pos+1);
 }}
 const explicit=[];if(/八字|子平|四柱/.test(q))explicit.push('bazi');if(/紫微|斗数|斗數/.test(q))explicit.push('ziwei');if(/六爻|卜卦|纳甲|納甲/.test(q))explicit.push('liuyao');
 const inferred=explicit.length?explicit:[...new Set(hits.filter(h=>!h.ambiguous).map(h=>h.domain))];
 const selected=domain??(inferred.length===1?inferred[0]:null);
 const terms=[...new Set(hits.filter(h=>!selected||h.domain===selected).map(h=>normalize(h.term)))];
 const fallback=q.replace(/^(?:请问|請問|请解释|請解釋|如何判断|如何判斷|怎么判断|怎麼判斷|什么叫|什麼叫|什么是|什麼是|如何|怎样|怎樣|怎么|怎麼)/,'').replace(/(?:是什么意思|是什麼意思|的含义|的含義|的意思|怎么理解|如何理解|吗|嗎|呢)$/,'');
 return {query:q,domain:selected,domain_source:domain?'explicit':selected?'inferred':'unspecified',terms,fallback:fallback!==q&&fallback.length>=2?fallback:null};
}
function search(topics,query,limit,read,domain){
 const p=plan(query,domain);
 function pass(extra){return topics.filter(t=>!p.domain||domains(t).includes(p.domain)).map(t=>{
  const content=read(t),body=normalize(content),title=normalize([t.name,t.slug,...t.tags,t.subtitle].join(' '));
  const rawTerms=query.trim().toLowerCase().split(/\s+/),terms=[...new Set([...rawTerms.map(normalize),...p.terms,...extra])];let score=0;
  for(const term of terms){if(title.includes(term))score+=10;if(body.includes(term))score+=1;}
  if((t.aliases??[]).some(a=>normalize(a).length>=2&&p.query.includes(normalize(a))))score+=30;
  for(const tag of t.tags){const value=normalize(tag);if(value.length>=2&&p.query.includes(value)&&!terms.includes(value))score+=4;}
  for(const term of p.terms)if(normalize(t.name).includes(term)||(t.aliases??[]).some(a=>normalize(a)===term))score+=60;
  const first=terms.find(term=>body.includes(term));let snippet=t.subtitle;
  // Exact text, not normalized text, is returned as a reference snippet.
  const index=first?content.toLowerCase().indexOf(first):-1;if(index>=0)snippet=content.slice(Math.max(0,index-40),index+180);
  return {...t,domains:domains(t),score,snippet};
 }).filter(t=>t.score>0).sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id))).slice(0,limit);}
 let matches=pass([]),fallbackUsed=false;if(!matches.length&&p.fallback){matches=pass([p.fallback]);fallbackUsed=true;}
 return {matches,retrieval:{domain:p.domain,domain_source:p.domain_source,terms:p.terms,fallback_used:fallbackUsed,attempts:fallbackUsed?2:1}};
}
module.exports={DOMAINS,normalize,domains,plan,search};
