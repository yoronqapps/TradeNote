import { computeAdvancedStats } from '../src/utils/advancedStats.js'
import assert from 'node:assert/strict'
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`)

const base = 1700000000 // 2023-11-14 22:13:20 UTC = Tue 17:13 New York
const day = 86400
const mk = (i, pnl, dayOffset, size = 100) => ({
  tradesCount: 1, td: base - (base % day) + dayOffset * day,
  entryTime: base + dayOffset * day + i * 600, exitTime: base + dayOffset * day + i * 600 + 120,
  netProceeds: pnl, grossProceeds: pnl + 2, commission: 1, sec: 0.5, taf: 0.25, nscc: 0.25, nasdaq: 0,
  buyQuantity: size, sellQuantity: size,
})
const trades = [
  mk(0, 100, 0), mk(1, -50, 0), mk(2, 200, 1), mk(3, -100, 1), mk(4, -100, 2), mk(5, 50, 2),
  { tradesCount: 0, openPosition: true, td: 1, entryTime: base, exitTime: 0, netProceeds: 999, grossProceeds: 999 }, // open: must be ignored
]
const r = computeAdvancedStats(trades, { amountCase: 'net', timeZone: 'America/New_York' })

assert.equal(r.n, 6)
close(r.totalPnl, 100)
assert.equal(r.winCount, 3); assert.equal(r.lossCount, 3)
close(r.avgWin, 350 / 3); close(r.avgLoss, 250 / 3)
close(r.payoffRatio, (350 / 3) / (250 / 3))
close(r.expectancy, 100 / 6)
close(r.kelly, 0.5 - 0.5 / 1.4)
close(r.medianTrade, (-50 + 50) / 2)  // sorted: -100,-100,-50,50,100,200 -> (-50+50)/2 = 0
assert.equal(r.bestTrade, 200); assert.equal(r.worstTrade, -100)
assert.equal(r.maxWinStreak, 1); assert.equal(r.maxLossStreak, 2)
assert.equal(r.currentStreakType, 'win'); assert.equal(r.currentStreakLength, 1)
close(r.maxDrawdown, 200)           // equity 100,50,250,150,50,100 -> peak 250, trough 50
close(r.maxDrawdownPctOfPeak, 0.8)
close(r.currentDrawdown, 150)       // 250 peak, now 100
// daily: 50, 100, -50 -> equity 50,150,100 ; max daily DD = 50
assert.equal(r.tradingDays, 3)
close(r.maxDailyDrawdown, 50)
close(r.profitableDaysPct, 2 / 3)
assert.equal(r.bestDay, 100); assert.equal(r.worstDay, -50)
close(r.avgHoldWinSeconds, 120)
close(r.totalFees, 6 * 2)           // 1+.5+.25+.25 = 2 per trade
close(r.feesPctOfGrossWins, 12 / (102 + 202 + 52))  // gross wins = 100+2, 200+2, 50+2
// timezone: 22:13 UTC Tue -> 17:xx New York, Tue = index 1  (first trade entry; others +10min steps => 17:13..18:03 on various days)
const cell = r.heatmap.cells.find(c => c.hour === 17 && c.weekday === 1)
assert.ok(cell, 'expected a Tue 17h cell')
// behaviour: day0 [100,-50] -> second after win; day1 [200,-100] -> after win; day2 [-100,50] -> after loss
assert.equal(r.behavior.afterWin.count, 2); assert.equal(r.behavior.afterLoss.count, 1)
close(r.behavior.afterLoss.avgPnl, 50)
assert.equal(r.behavior.firstOfDay.count, 3)
// gross switch
const g = computeAdvancedStats(trades, { amountCase: 'gross' })
close(g.totalPnl, 112)
// empty + bad timezone do not throw
assert.equal(computeAdvancedStats([], {}).n, 0)
assert.equal(computeAdvancedStats(trades, { amountCase: 'net', timeZone: 'Not/AZone' }).n, 6)
// zero losses: no division blow-ups
const allWin = computeAdvancedStats([mk(0, 10, 0), mk(1, 20, 0)], { amountCase: 'net' })
assert.equal(allWin.payoffRatio, null); assert.equal(allWin.kelly, null); assert.equal(allWin.maxDrawdown, 0)
// size terciles need >= 9 trades
const many = Array.from({ length: 9 }, (_, i) => mk(i, i % 2 ? -10 : 20, i, (i + 1) * 100))
const m = computeAdvancedStats(many, { amountCase: 'net' })
assert.equal(m.behavior.bySize.length, 3)
assert.equal(m.behavior.bySize[0].count, 3)
assert.deepEqual(r.distribution.counts.reduce((a, b) => a + b, 0), 6)
console.log('ALL TESTS PASSED')
