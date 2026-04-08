function applyDiscount(price, discount) {
  return price * (1 - discount / 100);
}

module.exports = { applyDiscount };
