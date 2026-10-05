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
  assert.equal(m.formaterMontant(-1200).replace(/\s/g, ' '), '−12,00 €');
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
  assert.equal(d.deMois('2026-10'), 'd’octobre');
  assert.equal(d.deMois('2026-03'), 'de mars');
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
  assert.deepEqual(c.calculerTotaux(oct), { revenus: 20000, depenses: 49890, epargne: 0, solde: -29890 });
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

const io = await import(R + 'io.js');
const donneesIO = {
  categories: [
    { id: 'courses', nom: 'Courses', emoji: '🛒', type: 'depense', couleur: 2 },
    { id: 'job', nom: 'Job', emoji: '💼', type: 'revenu', couleur: 1 },
  ],
  transactions: [
    { id: 'b', type: 'depense', montant: 1890, categorieId: 'courses', date: '2026-10-05', note: 'Lidl; "promo"', recurrenteId: null, creeLe: 2 },
    { id: 'a', type: 'revenu', montant: 80000, categorieId: 'job', date: '2026-10-01', note: '=SOMME(A1)', recurrenteId: 'r1', creeLe: 1 },
  ],
  recurrentes: [{ id: 'r1', type: 'revenu', montant: 80000, categorieId: 'job', jour: 1, note: '', dernierMois: '2026-10' }],
  budgets: { courses: 25000 },
  budgetGlobal: null,
  objectifs: {},
};
test('export CSV', () => {
  const lignes = io.genererCSV(donneesIO).split('\r\n');
  assert.equal(lignes[0], '﻿Date;Type;Catégorie;Montant (€);Note;Mensuelle');
  assert.equal(lignes[1], "2026-10-01;Revenu;Job;800,00;'=SOMME(A1);oui"); // formule neutralisée
  assert.equal(lignes[2], '2026-10-05;Dépense;Courses;-18,90;"Lidl; ""promo""";non'); // guillemets échappés
});
test('import : export JSON puis réimport identique', () => {
  const r = io.validerImport(JSON.parse(io.genererJSON(donneesIO)));
  assert.equal(r.ok, true);
  assert.deepEqual(r.donnees, donneesIO);
});
test('import : fichiers invalides refusés avec un message clair', () => {
  assert.equal(io.validerImport([]).ok, false);
  assert.equal(io.validerImport({ foo: 1 }).ok, false);
  const montantFlottant = structuredClone(donneesIO);
  montantFlottant.transactions[0].montant = 18.9;
  assert.match(io.validerImport(montantFlottant).erreur, /montant invalide/);
  const categorieInconnue = structuredClone(donneesIO);
  categorieInconnue.transactions[0].categorieId = 'xxx';
  assert.match(io.validerImport(categorieInconnue).erreur, /catégorie inconnue/);
  const mauvaiseDate = structuredClone(donneesIO);
  mauvaiseDate.transactions[0].date = '2026-02-30';
  assert.match(io.validerImport(mauvaiseDate).erreur, /date invalide/);
});

const mouvementsEpargne = [
  { id: 'r', type: 'revenu', montant: 100000, categorieId: 'job', date: '2026-10-01', creeLe: 1 },
  { id: 'd', type: 'depense', montant: 30000, categorieId: 'courses', date: '2026-10-02', creeLe: 2 },
  { id: 'v1', type: 'epargne', montant: 20000, categorieId: 'livret', date: '2026-09-15', creeLe: 3 },
  { id: 'v2', type: 'epargne', montant: 15000, categorieId: 'livret', date: '2026-10-03', creeLe: 4 },
  { id: 'v3', type: 'epargne', montant: 5000, categorieId: 'voyage', date: '2026-10-04', creeLe: 5 },
  { id: 'x1', type: 'retrait', montant: 4000, categorieId: 'livret', date: '2026-10-10', creeLe: 6 },
];
test('épargne : le solde du mois déduit l’épargne nette', () => {
  const oct = c.transactionsDuMois(mouvementsEpargne, '2026-10');
  // épargne nette = 150 + 50 − 40 = 160 € ; solde = 1000 − 300 − 160 = 540 €
  assert.deepEqual(c.calculerTotaux(oct), { revenus: 100000, depenses: 30000, epargne: 16000, solde: 54000 });
});
test('épargne : solde de chaque compte, à une date et en excluant une transaction', () => {
  const soldes = c.calculerSoldesEpargne(mouvementsEpargne);
  assert.equal(soldes.get('livret'), 20000 + 15000 - 4000);
  assert.equal(soldes.get('voyage'), 5000);
  assert.equal(c.calculerSoldesEpargne(mouvementsEpargne, '2026-09-30').get('livret'), 20000);
  assert.equal(c.calculerSoldesEpargne(mouvementsEpargne, undefined, 'x1').get('livret'), 35000);
  assert.equal(c.typeDeCategorie('retrait'), 'epargne');
  assert.equal(m.formaterMontantSigne(4000, 'retrait').replace(/\s/g, ' '), '+40,00 €');
  assert.equal(m.formaterMontantSigne(4000, 'epargne').replace(/\s/g, ' '), '−40,00 €');
});
const donneesEpargne = {
  ...structuredClone(donneesIO),
  categories: [...donneesIO.categories, { id: 'livret', nom: 'Livret A', emoji: '🏦', type: 'epargne', couleur: 1 }],
  transactions: [
    { id: 'v', type: 'epargne', montant: 5000, categorieId: 'livret', date: '2026-10-06', note: '', recurrenteId: null, creeLe: 3 },
    { id: 'x', type: 'retrait', montant: 1000, categorieId: 'livret', date: '2026-10-07', note: '', recurrenteId: null, creeLe: 4 },
  ],
  objectifs: { livret: 100000 },
};
test('épargne : CSV et aller-retour JSON', () => {
  const lignes = io.genererCSV(donneesEpargne).split('\r\n');
  assert.equal(lignes[1], '2026-10-06;Épargne (versement);Livret A;-50,00;;non');
  assert.equal(lignes[2], '2026-10-07;Épargne (retrait);Livret A;10,00;;non');
  const r = io.validerImport(JSON.parse(io.genererJSON(donneesEpargne)));
  assert.equal(r.ok, true);
  assert.deepEqual(r.donnees, donneesEpargne);
});
test('import : une transaction doit viser une catégorie du bon type', () => {
  const incoherent = structuredClone(donneesEpargne);
  incoherent.transactions[0].categorieId = 'courses'; // versement d'épargne dans « Courses »
  assert.match(io.validerImport(incoherent).erreur, /catégorie d'un autre type/);
  const ancien = structuredClone(donneesIO); // fichier d'avant l'épargne : accepté
  delete ancien.objectifs;
  assert.equal(io.validerImport(ancien).ok, true);
});
