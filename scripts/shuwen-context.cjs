'use strict';
// Opt-in paged facade: legacy build(), complete CLI and file exports stay intact.
const {createHash}=require('node:crypto');
const {withInputLifecycle}=require('./input-lifecycle.cjs');
const budget=require('./output-budget.cjs');
const MAX_BYTES=budget.REFERENCE_BYTES;
function check(ok,message){if(!ok)throw new Error(message);}
function parse(argv){
 const legacy=[],options={offset:0,chars:1800},seen=new Set();
 for(let i=0;i<argv.length;i++){
  const arg=argv[i];
  if(['--bounded','--offset','--chars'].includes(arg)){
   check(!seen.has(arg),'分页参数不能重复：'+arg);seen.add(arg);
   if(arg==='--bounded')continue;
   const value=argv[++i];check(typeof value==='string'&&/^\d+$/.test(value),arg+' 须为非负整数');
   options[arg.slice(2)]=Number(value);
  }else{
   // Consume values with their legacy options; never interpret a value as a page flag.
   legacy.push(arg);
   if(['--input','--out','--format','--layout'].includes(arg))legacy.push(argv[++i]);
  }
 }
 check(seen.has('--bounded'),'疏文分页需 --bounded');
 check(Number.isSafeInteger(options.offset)&&options.offset>=0,'offset 超出正文范围');
 check(Number.isInteger(options.chars)&&options.chars>=200&&options.chars<=3000,'chars 须为 200–3000');
 return {legacy,...options};
}
function project(data,{offset=0,chars=1800}={}){
 check(Number.isSafeInteger(offset)&&offset>=0&&offset<=data.text.length,'offset 超出正文范围');
 check(Number.isInteger(chars)&&chars>=200&&chars<=3000,'chars 须为 200–3000');
 check(!(offset>0&&/[\uDC00-\uDFFF]/.test(data.text[offset])),'offset 位于 Unicode 字符中间，请使用返回的 next_offset');
 const {text,parts,schema_version,...metadata}=data;
 const document_sha256=createHash('sha256').update(JSON.stringify({schema_version,title:data.title,text,missing_fields:data.missing_fields,calendar:data.calendar,provenance:data.provenance})).digest('hex');
 let effective=chars;
 for(;;){
  let end=Math.min(text.length,offset+effective);
  if(end<text.length&&/[\uD800-\uDBFF]/.test(text[end-1]))end--;
  const next=end<text.length?end:null;
  const result={...metadata,schema_version:'suanming-shuwen-context/v1',document_schema_version:schema_version,document_sha256,
   text:text.slice(offset,end),text_page:{total_chars:text.length,offset,returned_chars:end-offset,next_offset:next,offset_unit:'utf16'},
   next_actions:next===null?[]:[{action:'continue_text',entrypoint:'scripts/mobile.sh',requires_same_input:true,
    argv:['--shuwen','--stdin','--bounded','--offset',String(next),'--chars',String(effective)]}],
   output:{max_bytes:MAX_BYTES,bytes:0,requested_chars:chars,effective_chars:effective,budget_adjusted:effective!==chars}};
  budget.stamp(result);
  if(budget.fits(result,MAX_BYTES,128))return result;
  if(effective===200)break;
  effective=Math.max(200,effective-200);
 }
 const e=new Error('疏文最小页面仍超过预算；请缩短标题、日期说明或导出路径。完整文稿可显式导出，不要把完整文件直接贴回工具输出。');e.code='context_budget_exceeded';throw e;
}
function projectOperation(argv,makeDocument){
 const options=parse(argv),data=(makeDocument??require('./shuwen.cjs').operation)(options.legacy);
 return typeof data==='string'||typeof data.text!=='string'?data:project(data,options);
}
function finish(result){return typeof result==='string'?result:budget.assertFits(budget.stamp(result),MAX_BYTES);}
function operation(argv){return finish(withInputLifecycle(argv,args=>projectOperation(args)));}
module.exports={parse,project,projectOperation,finish,operation,MAX_BYTES};
