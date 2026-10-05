// Tests des fonctions pures (montants, dates, calculs). Lancement : npm test (ou node --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
const R = '../js/';
const m = await import(R + 'money.js');
const d = await import(R + 'dates.js');
const c = await import(R + 'calculs.js');

test('parserMontant', () => {
  assert.equal(m.parserMontant('12'), 1200);
  assert.equal(m.parserMontant('12,5'), 1250);
  assert.equal(m.parserMontant('12.50'), 1250);
  assert.equal(m.parserMontant('1 234,56'), 123456);
  assert.equal(m.parserMontant('0,1'), 10);
  assert.equal(m.parserMontant('0,29'), 29); // 0.29*100 = 28.999… en flottant !
  assert.equal(m.parserMontant('12,'), 1200);
  for (const mauvais of ['', '0', 'abc', '12,345', '-5', '1,2,3', '99999999999']) assert.equal(m.parserMontant(mauvais), null, mauvais);
});
test('formaterMontant', () => {
  assert.equal(m.formaterMontant(123456).replace(/\s/g, ' '), '1 234,56 €');
  assert.equal(m.formaterMontantCourt(25000).replace(/\s/g, ' '), '250 €');
  assert.equal(m.formaterMontantCourt(25050).replace(/\s/g, ' '), '250,50 €');
  assert.equal(m.formaterMontant(-1200).replace(/\s/g, ' '), '-12,00 €');
  assert.equal(m.centimesVersSaisie(1205), '12,05');
});
test('dates', () => {
  assert.equal(d.decalerMois('2026-12', 1), '2027-01');
  assert.equal(d.decalerMois('2026-01', -1), '2025-12');
  assert.equal(d.joursDansMois('2028-02'), 29);
  assert.equal(d.dateDansMois('2026-02', 31), '2026-02-28');
  assert.equal(d.nomDuMois('2026-10'), 'Octobre 2026');
  assert.equal(d.libelleJour('2026-10-04', '2026-10-05'), 'Hier');
  assert.equal(d.libelleJour('2026-10-01', '2026-10-05'), 'Jeudi 1 octobre');
  assert.ok(!d.estDateValide('2026-02-30'));
  assert.ok(d.estDateValide('2026-02-28'));
});
const tx = [
  { type: 'revenu', montant: 80000, categorieId: 'job', date: '2026-09-28', creeLe: 1 },
  { type: 'depense', montant: 45000, categorieId: 'logement', date: '2026-10-05', creeLe: 2 },
  { type: 'depense', montant: 1890, categorieId: 'courses', date: '2026-10-05', creeLe: 3 },
  { type: 'depense', montant: 3000, categorieId: 'courses', date: '2026-10-02', creeLe: 4 },
  { type: 'revenu', montant: 20000, categorieId: 'aides', date: '2026-10-01', creeLe: 5 },
];
test('totaux et soldes', () => {
  const oct = c.transactionsDuMois(tx, '2026-10');
  assert.deepEqual(c.calculerTotaux(oct), { revenus: 20000, depenses: 49890, solde: -29890 });
  assert.equal(c.calculerSoldeCumule(tx, '2026-10'), 80000 - 29890);
  assert.equal(c.calculerSoldeCumule(tx, '2026-09'), 80000);
  assert.deepEqual(c.calculerTotalParCategorie(oct), [{ categorieId: 'logement', total: 45000 }, { categorieId: 'courses', total: 4890 }]);
  const g = c.grouperParJour(oct);
  assert.deepEqual(g.map((x) => x.date), ['2026-10-05', '2026-10-02', '2026-10-01']);
  assert.equal(g[0].transactions[0].creeLe, 3);
});
test('budgets : seuils 80 % et 100 %', () => {
  assert.equal(c.calculerEtatBudget(18000, 25000).niveau, 'ok'); // 72 %
  assert.equal(c.calculerEtatBudget(18000, 25000).pourcentage, 72);
  assert.equal(c.calculerEtatBudget(19999, 25000).niveau, 'ok');
  assert.equal(c.calculerEtatBudget(20000, 25000).niveau, 'alerte'); // pile 80 %
  assert.equal(c.calculerEtatBudget(25000, 25000).niveau, 'depasse');
  assert.equal(c.calculerEtatBudget(27000, 25000).reste, -2000);
});
test('récurrences', () => {
  const modeles = [{ id: 'loyer', type: 'depense', montant: 45000, categorieId: 'logement', jour: 31, note: 'Loyer', dernierMois: '2026-07' }];
  const r = c.genererOccurrences(modeles, '2026-10-05');
  assert.deepEqual(r.nouvelles.map((t) => t.date), ['2026-08-31', '2026-09-30']); // octobre 31 pas encore arrivé
  assert.deepEqual(r.derniersMois, { loyer: '2026-09' });
  modeles[0].dernierMois = '2026-09';
  assert.equal(c.genererOccurrences(modeles, '2026-10-05').nouvelles.length, 0);
  assert.equal(c.genererOccurrences(modeles, '2026-10-31').nouvelles.length, 1);
});
test('couleur automatique', () => {
  const cats = [{ type: 'depense', couleur: 1 }, { type: 'depense', couleur: 2 }, { type: 'revenu', couleur: 3 }];
  assert.equal(c.choisirCouleur(cats, 'depense'), 3);
});
