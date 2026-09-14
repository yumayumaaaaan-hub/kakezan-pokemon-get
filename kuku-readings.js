/**
 * 九九の「問題部分」だけの読み方（ひらがな・「・」なし）
 * 例: 9×9 → くく / 2×3 → にさん
 */
const KUKU_SQUARE_READINGS = {
  1: "いんいん",
  2: "ににんし",
  3: "さざん",
  4: "しし",
  5: "ごう",
  6: "ろくろく",
  7: "しちしち",
  8: "はっぱく",
  9: "くく",
};

const KUKU_DAN_PREFIX = [
  null,
  "いん",
  "に",
  "さん",
  "し",
  "ご",
  "ろく",
  "しち",
  "はち",
  "く",
];

const KUKU_NUM = [
  null,
  "いち",
  "に",
  "さん",
  "し",
  "ご",
  "ろく",
  "しち",
  "はち",
  "く",
];

function getProblemKukuReading(a, b) {
  if (a < 1 || a > 9 || b < 1 || b > 9) return "";

  if (a === b) {
    return KUKU_SQUARE_READINGS[a];
  }

  if (a === 1) {
    return KUKU_DAN_PREFIX[1] + KUKU_NUM[b];
  }

  return KUKU_DAN_PREFIX[a] + KUKU_NUM[b];
}
