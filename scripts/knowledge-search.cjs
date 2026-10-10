'use strict';
const DICTIONARY=require('../references/knowledge/search-terms.json');
const DOMAINS=['bazi','ziwei','liuyao','spirit','practice','folklore','other'];
const from='財殺雜傷見幹氣綱祿緣護學該麼為強無禮記經傳書說問訣陰陽觀論語統應動變剋納實紅鸞戀愛歲運時齡對擇曖昧親侶會沖貴劫宮雙貞後頭義解釋請怎樣臺灣鬥數與斷';
const to='财杀杂伤见干气纲禄缘护学该么为强无礼记经传书说问诀阴阳观论语统应动变克纳实红鸾恋爱岁运时龄对择暧昧亲侣会冲贵劫宫双贞后头义解释请怎样台湾斗数与断';
const traditional=new RegExp('['+from+']','g');
function normalize(text){return String(text??'').normalize('NFKC').toLowerCase().replace(traditional,c=>to[from.indexOf(c)]).replace(/[\s\p{P}]/gu,'');}
const GENERIC_TERMS=new Set(['八字','子平','四柱','紫微','六爻','卜卦','纳甲']);
const AMBIGUOUS_ALIASES=new Set(DICTIONARY.terms.flatMap(t=>t.ambiguous_aliases??[]).map(normalize));
function positiveMention(text,term){
 let pos=text.indexOf(term);while(pos>=0){
  // A contrast such as "不是八字的喜用神" is not a definition of that concept.
  if(!/(?:不是|不等同|不混同|不同于|区别于).{0,6}$/.test(text.slice(Math.max(0,pos-10),pos)))return true;
  pos=text.indexOf(term,pos+1);
 }return false;
}
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
function referenceMatch(topic,q,quoted){
 const book=normalize(topic.book),chapter=normalize(String(topic.chapter??'').split(/[·•/（(]/)[0]);
 const titles=[...String(topic.name??'').matchAll(/《([^》]+)》/g)].map(m=>normalize(m[1]));
 const qualified=[...titles,...(book&&chapter?[book+chapter]:[])].filter(t=>t.length>=2);
 const full=qualified.find(t=>q.includes(t));if(full)return {score:240,title:full};
 if(book.length>=2&&q.includes(book))return {score:40,title:book};
 if(chapter.length>=2&&quoted.includes(chapter))return {score:160,title:chapter};
 return null;
}
function plan(query,domain,topics=[]){
 const q=normalize(query),hits=[],covered=[];
 const explicit=[];if(/八字|子平|四柱/.test(q))explicit.push('bazi');if(/紫微|斗数|斗數/.test(q))explicit.push('ziwei');if(/六爻|卜卦|纳甲/.test(q))explicit.push('liuyao');
 const contextDomain=domain??(explicit.length===1?explicit[0]:null);
 const candidates=DICTIONARY.terms.flatMap(t=>[t.term,...t.aliases].map(alias=>({term:t.term,domain:t.domain,alias:normalize(alias),ambiguous:(t.ambiguous_aliases??[]).includes(alias)}))).sort((a,b)=>b.alias.length-a.alias.length);
 for(const c of candidates){if(c.ambiguous&&contextDomain&&c.domain!==contextDomain)continue;let pos=q.indexOf(c.alias);while(pos>=0){const end=pos+c.alias.length;
  if(!covered.some(([s,e])=>s<=pos&&end<=e)){covered.push([pos,end]);if(!hits.some(h=>h.term===c.term))hits.push({...c,ambiguous:c.ambiguous&&!contextDomain});}
  pos=q.indexOf(c.alias,pos+1);
 }}
 const quoted=[...String(query).matchAll(/《([^》]+)》/g)].map(m=>normalize(m[1]));
 const references=topics.map(t=>({topic:t,match:referenceMatch(t,q,quoted)})).filter(t=>t.match);
 const referenceDomains=[...new Set(references.flatMap(t=>domains(t.topic)))];
 const inferred=referenceDomains.length?referenceDomains:explicit.length?explicit:[...new Set(hits.filter(h=>!h.ambiguous).map(h=>h.domain))];
 const selected=domain??(inferred.length===1?inferred[0]:null);
 const terms=[...new Set(hits.filter(h=>!h.ambiguous).map(h=>normalize(h.term)))];
 const fallback=q.replace(/^(?:请问|請問|请解释|請解釋|如何判断|如何判斷|怎么判断|怎麼判斷|什么叫|什麼叫|什么是|什麼是|如何|怎样|怎樣|怎么|怎麼)/,'').replace(/(?:是什么意思|是什麼意思|的含义|的含義|的意思|怎么理解|如何理解|吗|嗎|呢)$/,'');
 return {query:q,domain:selected,domain_source:domain?'explicit':referenceDomains.length?'reference':selected?'inferred':'unspecified',filter_domain:domain??null,
  reference_titles:[...new Set(references.map(r=>r.match.title))],quoted,terms,fallback:fallback!==q&&fallback.length>=2?fallback:null};
}
function search(topics,query,limit,read,domain){
 const p=plan(query,domain,topics);
 function pass(extra){return topics.filter(t=>!p.filter_domain||domains(t).includes(p.filter_domain)).map(t=>{
  const content=read(t),body=normalize(content),title=normalize([t.name,t.slug,...t.tags,t.subtitle].join(' '));
  // Once a specific term is known, a domain word alone is not evidence of relevance.
  const rawTerms=query.trim().toLowerCase().split(/\s+/),terms=[...new Set([...rawTerms.map(normalize),...p.terms,...extra])].filter(term=>term&&!(p.terms.length&&GENERIC_TERMS.has(term)));let score=0;
  for(const term of terms){if(positiveMention(title,term))score+=10;if(positiveMention(body,term))score+=1;}
  const aliases=(t.aliases??[]).map(normalize).filter(a=>!p.domain||!AMBIGUOUS_ALIASES.has(a)||domains(t).includes(p.domain));
  if(aliases.some(a=>a.length>=2&&p.query.includes(a)))score+=30;
  for(const tag of t.tags){const value=normalize(tag);if(value.length>=2&&p.query.includes(value)&&!terms.includes(value)&&!(p.terms.length&&GENERIC_TERMS.has(value))&&!p.terms.some(term=>term.length>value.length&&term.includes(value)))score+=4;}
  for(const term of p.terms)if(normalize(t.name).includes(term)||aliases.includes(term))score+=60;
  score+=referenceMatch(t,p.query,p.quoted)?.score??0;
  // Automatic domain inference is a ranking hint, never an exclusion or a fabricated hit.
  if(score>0&&p.domain&&domains(t).includes(p.domain))score+=4;
  const first=terms.find(term=>body.includes(term));let snippet=t.subtitle;
  // Exact text, not normalized text, is returned as a reference snippet.
  const index=first?content.toLowerCase().indexOf(first):-1;if(index>=0)snippet=content.slice(Math.max(0,index-40),index+180);
  return {...t,domains:domains(t),score,snippet};
 }).filter(t=>t.score>0).sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id))).slice(0,limit);}
 let matches=pass([]),fallbackUsed=false;if(!matches.length&&p.fallback){matches=pass([p.fallback]);fallbackUsed=true;}
 return {matches,retrieval:{domain:p.domain,domain_source:p.domain_source,filter_domain:p.filter_domain,reference_titles:p.reference_titles,terms:p.terms,fallback_used:fallbackUsed,attempts:fallbackUsed?2:1}};
}
module.exports={DOMAINS,normalize,domains,plan,search};
