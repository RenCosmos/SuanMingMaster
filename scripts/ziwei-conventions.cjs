'use strict';
const {digest}=require('./common.cjs');
const FIELDS=['natal_year_boundary','horoscope_year_boundary','horoscope_month_boundary','year_boundary_scope'];
function annotations(c){return {natal_year_boundary:c.year_boundary,horoscope_year_boundary:'lunar_new_year',horoscope_month_boundary:'lunar_month',year_boundary_scope:'natal_only'};}
// Only align newly added labels absent from a legacy artifact. Never drop a
// pre-existing field, calendar result or supplied label, nor alter the old file.
function alignLegacyMetadata(fresh,previous){
 const out=structuredClone(fresh);
 function visit(node,old){
  if(!node||typeof node!=='object'||!old||typeof old!=='object')return false;
  let changed=false;
  for(const key of Object.keys(node))if(key!=='checksum')changed=visit(node[key],old[key])||changed;
  if(node.schema_version==='bazi-ziwei/v1'&&old.schema_version===node.schema_version&&node.ziwei&&old.ziwei){
   const c=node.ziwei.chart.conventions,p=old.ziwei.chart.conventions;
   for(const key of FIELDS)if(!Object.hasOwn(p,key)&&Object.hasOwn(c,key)){delete c[key];changed=true;}
  }
  if(changed&&node.checksum?.algorithm==='sha256-canonical-json'){const {checksum,...payload}=node;node.checksum={...checksum,value:digest(payload)};}
  return changed;
 }
 visit(out,previous);return out;
}
module.exports={annotations,alignLegacyMetadata,FIELDS};
