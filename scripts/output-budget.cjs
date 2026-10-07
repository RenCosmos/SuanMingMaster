'use strict';
// Match WorkspaceTools' JSON envelope, not just the inner stdout. Keep a
// conservative margin below RikkaHub 2.5.6's 32KB generic tool-output limit.
const WORKFLOW_BYTES=20*1024,REFERENCE_BYTES=12*1024,SHELL_BYTES=28*1024;
function measure(value){
 const stdout=JSON.stringify(value)+'\n';
 const wrapper=JSON.stringify({exitCode:0,stdout,stderr:'',timedOut:false});
 return {stdout_bytes:Buffer.byteLength(stdout),shell_bytes:Buffer.byteLength(wrapper)};
}
function fits(value,maxBytes,reserve=0){
 const size=measure(value);
 return size.stdout_bytes<=maxBytes-reserve&&size.shell_bytes<SHELL_BYTES-reserve;
}
function stamp(value){
 if(value.output)for(let i=0;i<3;i++)value.output.bytes=measure(value).stdout_bytes;
 return value;
}
function assertFits(value,maxBytes,message='最终响应超出预算；请减小页面或收窄选择，勿读取完整结果作为工具输出。'){
 if(!fits(value,maxBytes)){const e=new Error(message);e.code='context_budget_exceeded';throw e;}
 return value;
}
module.exports={WORKFLOW_BYTES,REFERENCE_BYTES,SHELL_BYTES,measure,fits,stamp,assertFits};
