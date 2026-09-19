#!/usr/bin/env node
/**
 * 石钟乳工坊 数值模拟器 (R1)
 * 策略: 边际收益购买 + 2次/秒点击。
 * 旋钮: IP_PER_M, REQ_BASE, REQ_EXP, CLICKS_PER_SEC
 */
const IP_PER_M = 3;       // ipGain 系数: IP = ceil(3 × (m - req/2))
const REQ_BASE = 0.1;
const REQ_EXP = 6;
const CLICKS_PER_SEC = 2;
const IP_SQRT = true; // ipMul = 1+0.1*sqrt(iso)
const ADAPTIVE_GATE = true; // 门槛 = 0.1 × ipMul^3 (自适应)
const SIM_MAX_H = 6;
const TARGET_ERA = 10;

const UPGRADES = [
 {id:'rain',   base:15,    mult:1.15, click:1,  dps:0},
 {id:'crack',  base:50,    mult:1.18, click:0,  dps:0.5},
 {id:'soil',   base:300,   mult:1.25, clickMul:2},
 {id:'river',  base:2000,  mult:1.22, click:0,  dps:10},
 {id:'time',   base:20000, mult:5,    globalMul:3, max:5},
 {id:'deep',   base:10000, mult:1.20, dps:100,  reqP:1},
 {id:'geoth',  base:80000, mult:1.25, clickMul:5, reqP:2},
];

function simulate() {
  let iso = 0, prestige = 0;
  const eraStats = [];
  for (let era = 0; era < TARGET_ERA; era++) {
    let calcite = 0, total = 0;
    const owned = {};
    const req = ADAPTIVE_GATE ? REQ_BASE * Math.pow(1 + 0.10*Math.sqrt(iso), 3) : REQ_BASE * Math.pow(REQ_EXP, prestige);
    const ipMul = () => IP_SQRT ? 1 + 0.10*Math.sqrt(iso) : 1 + iso * 0.10;
    const cnt = id => owned[id] || 0;
    const globalMul = () => Math.pow(3, cnt('time')) * ipMul();
    const clickPower = () => {
      let p = 1 + cnt('rain');
      p *= Math.pow(2, cnt('soil'));
      p *= Math.pow(5, cnt('geoth'));
      return p * globalMul();
    };
    const dps = () => (0.5*cnt('crack') + 10*cnt('river') + 100*cnt('deep')) * globalMul();
    const cost = u => Math.ceil(u.base * Math.pow(u.mult, cnt(u.id)));
    const lenM = () => total * 0.01 / 1000;
    const eff = u => {
      if (u.reqP && prestige < u.reqP) return 0;
      if (u.max && cnt(u.id) >= u.max) return 0;
      const c = cost(u);
      if (u.clickMul) return (clickPower()*(u.clickMul-1)*CLICKS_PER_SEC) / c;
      if (u.click)    return (u.click * globalMul() * CLICKS_PER_SEC) / c;
      if (u.dps)      return (u.dps * globalMul()) / c;
      if (u.globalMul)return (dps()*(u.globalMul-1) + clickPower()*(u.globalMul-1)*CLICKS_PER_SEC) / c;
      return 0;
    };
    const dt = 0.1; let t = 0; let stalled = false;
    const FARM_CAP = req * 1.2;   // 最优策略: 挂到封顶点再转
    while (lenM() < FARM_CAP) {
      const gain = (dps() + clickPower()*CLICKS_PER_SEC) * dt;
      calcite += gain; total += gain;
      let best = null, bestEff = 0;
      for (const u of UPGRADES) { const e = eff(u); if (e > bestEff && calcite >= cost(u)) { best = u; bestEff = e; } }
      if (best) { calcite -= cost(best); owned[best.id] = cnt(best.id)+1; }
      t += dt;
      if (t > SIM_MAX_H*3600) { stalled = true; break; }
    }
    const m = Math.min(lenM(), FARM_CAP);
    const ip = m >= req ? Math.ceil(IP_PER_M * (m - req*0.5)) : 0;
    iso += ip; prestige++;
    eraStats.push({era: prestige, minutes: t/60, ip, stalled, len: lenM().toFixed(3)});
  }
  return eraStats;
}

function run(label) {
  console.log(`\n===== ${label} =====`);
  console.log('纪元 | 耗时(min) | 本轮IP | 累计IP | 状态');
  let isoSum = 0, prev = 0;
  for (const r of simulate()) {
    isoSum += r.ip;
    const ratio = prev > 0 ? (r.minutes/prev).toFixed(2) : '-';
    console.log(`  ${r.era}   | ${r.minutes.toFixed(1).padStart(8)} | ${String(r.ip).padStart(5)} | ${String(isoSum).padStart(5)} | x${ratio} ${r.stalled ? '⚠️断档' : 'OK'} (门槛 ${r.len}m)`);
    prev = r.minutes;
  }
}

run('当前参数 IP=10/m 门槛=0.1×2^N');
