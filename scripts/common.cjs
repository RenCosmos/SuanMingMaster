'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Temporal } = require('@js-temporal/polyfill');
const { Solar, Lunar } = require('lunar-typescript');
const ROOT = path.resolve(__dirname, '..');
class InputError extends Error {}
function check(condition, message) { if (!condition) throw new InputError(message); }
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  return value;
}
function digest(value) { return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function fields(obj, allowed, label) {
  check(obj && typeof obj === 'object' && !Array.isArray(obj), `${label} 必须是对象`);
  for (const k of Object.keys(obj)) check(allowed.includes(k), `${label} 中不支持字段 ${k}；请检查拼写和版本`);
}
function enumValue(obj, name, allowed, fallback) {
  const v = obj[name] === undefined ? fallback : obj[name];
  check(allowed.includes(v), `${name} 只能为 ${allowed.join(' / ')}`); return v;
}
function isoDate(value, label) {
  check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), `${label} 须为 YYYY-MM-DD`);
  try { return Temporal.PlainDate.from(value, {overflow: 'reject'}); } catch { throw new InputError(`${label} 日期不存在`); }
}
function asSolar(dt) { return Solar.fromYmdHms(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second); }
function normalize(input) {
  fields(input, ['mode','birth','options','target_date','label'], '输入');
  const mode = enumValue(input, 'mode', ['both','bazi','ziwei'], 'both');
  if (input.label !== undefined) check(typeof input.label === 'string' && input.label.length <= 80 && !/[\r\n\x00-\x1f]/.test(input.label), 'label 最长 80 字且不能含控制字符');
  const b = input.birth;
  fields(b, ['calendar','date','time','gender','timezone','is_leap_month','longitude','longitude_source'], 'birth');
  const calendar = enumValue(b, 'calendar', ['solar','lunar']);
  check(typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date), 'birth.date 须为 YYYY-MM-DD');
  let [year, month, day] = b.date.split('-').map(Number);
  check(year >= 1900 && year <= 2100, '第一版支持出生年份 1900–2100');
  if (b.is_leap_month !== undefined) check(typeof b.is_leap_month === 'boolean', 'is_leap_month 必须是布尔值');
  const leap = b.is_leap_month === true;
  check(calendar === 'lunar' || !leap, '公历不能设置 is_leap_month=true');
  if (calendar === 'lunar') {
    check(month >= 1 && month <= 12 && day >= 1 && day <= 30, '农历月须为 1–12，日须为 1–30');
    try {
      const l = Lunar.fromYmd(year, leap ? -month : month, day);
      const s = l.getSolar(); const rt = s.getLunar();
      check(rt.getYear() === year && rt.getMonth() === (leap ? -month : month) && rt.getDay() === day, '农历日期或闰月不存在');
      year = s.getYear(); month = s.getMonth(); day = s.getDay();
    } catch (e) { throw new InputError(`农历日期无效：${e.message}`); }
  }
  check(typeof b.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(b.time), '须提供已知出生时间 HH:mm 或 HH:mm:ss；第一版不能补造未知时辰');
  check(['male','female'].includes(b.gender), 'birth.gender 须为 male 或 female（传统排运规则输入）');
  check(typeof b.timezone === 'string' && b.timezone.length > 0, '必须明确 birth.timezone，如 Asia/Shanghai 或 +08:00');
  const [hour, minute, second = 0] = b.time.split(':').map(Number);
  let zoned;
  try {
    zoned = Temporal.ZonedDateTime.from({year,month,day,hour,minute,second,timeZone:b.timezone}, {disambiguation:'reject',overflow:'reject'});
  } catch { throw new InputError('出生日期、时区无效，或该钟表时间处于夏令时跳时/重复区间；请提供核实后的 UTC 偏移量'); }
  const options = input.options === undefined ? {} : input.options;
  fields(options, ['time_basis','bazi_day_boundary','bazi_hour_stem_rule','ziwei_day_boundary','ziwei_year_boundary','ziwei_leap_adjust','ziwei_algorithm','dayun_count','annual_count'], 'options');
  const opt = {
    time_basis: enumValue(options, 'time_basis', ['clock','true_solar'], 'clock'),
    bazi_day_boundary: enumValue(options, 'bazi_day_boundary', ['midnight','late_zi'], 'midnight'),
    bazi_hour_stem_rule: enumValue(options, 'bazi_hour_stem_rule', ['day_stem','library'], 'day_stem'),
    ziwei_day_boundary: enumValue(options, 'ziwei_day_boundary', ['midnight','late_zi'], 'late_zi'),
    ziwei_year_boundary: enumValue(options, 'ziwei_year_boundary', ['lunar_new_year','lichun'], 'lunar_new_year'),
    ziwei_algorithm: enumValue(options, 'ziwei_algorithm', ['default','zhongzhou'], 'default'),
    ziwei_leap_adjust: options.ziwei_leap_adjust === undefined ? true : options.ziwei_leap_adjust,
    dayun_count: options.dayun_count === undefined ? 8 : options.dayun_count,
    annual_count: options.annual_count === undefined ? 5 : options.annual_count,
  };
  check(typeof opt.ziwei_leap_adjust === 'boolean', 'ziwei_leap_adjust 必须是布尔值');
  check(Number.isInteger(opt.dayun_count) && opt.dayun_count >= 1 && opt.dayun_count <= 12, 'dayun_count 须为 1–12 的整数');
  check(Number.isInteger(opt.annual_count) && opt.annual_count >= 1 && opt.annual_count <= 20, 'annual_count 须为 1–20 的整数');
  let target = null;
  if (input.target_date !== undefined) {
    target = isoDate(input.target_date, 'target_date');
    check(target.year >= 1900 && target.year + opt.annual_count - 1 <= 2200, '流年范围须在 1900–2200 内');
    check(Temporal.PlainDate.compare(target, zoned.toPlainDate()) >= 0, 'target_date 不能早于出生日期');
  }
  const local = zoned.toPlainDateTime(); const beijing = zoned.withTimeZone('+08:00').toPlainDateTime();
  check(beijing.year >= 1900 && beijing.year <= 2100, '转换后的北京时间超出第一版支持范围');
  if(b.longitude!==undefined)check(typeof b.longitude==='number'&&Number.isFinite(b.longitude)&&b.longitude>=-180&&b.longitude<=180,'birth.longitude 须为 -180 至 180 的数字，东经为正、西经为负');
  if(b.longitude_source!==undefined)check(b.longitude!==undefined&&typeof b.longitude_source==='string'&&b.longitude_source.length>0&&b.longitude_source.length<=400&&!/[\x00-\x1f]/.test(b.longitude_source),'longitude_source 须随经度提供，最长 400 字且无控制字符');
  check(opt.time_basis!=='true_solar'||b.longitude!==undefined,'真太阳时需要 birth.longitude；请提供或核实出生地经度');
  check(mode!=='ziwei'||opt.time_basis==='clock','time_basis 真太阳时用于八字；仅紫微模式使用 clock');
  const solar=b.longitude!==undefined&&mode!=='ziwei'?require('./solar-time.cjs').solarTime(zoned,b.longitude):null;
  if(solar)check(solar.local.year>=1900&&solar.local.year<=2100,'校正后的太阳日期超出 1900–2100，请核对输入范围');
  const warnings = [opt.time_basis==='true_solar'?'八字日/时柱使用经度与均时差校正后的太阳钟面日期时间，原始出生 UTC 瞬间不变。':'八字日/时柱使用出生地钟表日期时间。',
    '八字年/月柱与起运按真实出生瞬间对应的北京时间节气；紫微沿用出生地钟表日期时间。'];
  if (calendar === 'lunar' && zoned.offset !== '+08:00') warnings.push('农历生日按中国农历转换成公历日期，再作为所填出生地的钟表日期；海外农历记载的日期口径须先核对。');
  if(b.timezone==='Asia/Shanghai' && zoned.offset!=='+08:00') warnings.push(opt.time_basis==='true_solar'?'该历史日期的实际时区偏移已参与太阳时校正；没有再次减去夏令时。':'该历史日期的上海时区偏移不是 +08:00；日/时柱保留输入钟表时间。');
  if (hour === 23) warnings.push('23 点附近两套体系采用各自的换日配置，请核对 bazi_day_boundary 与 ziwei_day_boundary。');
  if (hour === 0 || hour % 2 === 1 && minute < 5 || hour % 2 === 0 && minute >= 55) warnings.push('出生时间接近时辰或日期边界；若记录有误差，应分别运行候选时间比较结果。');
  return {mode, options:opt, zoned, local, beijing, target, warnings,solar,
    input: {mode, label:input.label || '未命名', birth:{calendar,date:b.date,time:b.time,gender:b.gender,timezone:b.timezone,is_leap_month:leap,...(b.longitude!==undefined?{longitude:b.longitude}:{}),...(b.longitude_source!==undefined?{longitude_source:b.longitude_source}:{})},options:opt,...(target?{target_date:target.toString()}:{})},
    normalized: {solar_date:local.toPlainDate().toString(),local_datetime:local.toString(),timezone:b.timezone,utc_offset:zoned.offset,utc_instant:zoned.toInstant().toString(),beijing_datetime:beijing.toString(),time_basis:opt.time_basis,...(solar?{solar_time:solar.record}:{}),bazi_hour_stem_rule:opt.bazi_hour_stem_rule}};
}
function packageVersion(name) {
  const entry = require.resolve(name);
  let dir = path.dirname(entry);
  for (;;) {
    const p = path.join(dir,'package.json');
    if (fs.existsSync(p)) { const m=readJson(p); if(m.name===name) return m.version; }
    const parent=path.dirname(dir); if(parent===dir) throw new Error(`无法确定 ${name} 版本`); dir=parent;
  }
}
module.exports = {ROOT, InputError, check, stable, digest, readJson, writeJson, normalize, asSolar, packageVersion, Temporal};
