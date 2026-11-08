const {
  evaluateFlags,
  DEFAULT_CATEGORY_THRESHOLDS
} = require('./flags');

describe('Flags Engine Unit Tests', () => {
  it('flags when amount is edited after creation (Rule 1)', () => {
    const result = evaluateFlags({
      isEdit: true,
      previousAmount: 45000,
      newAmount: 50000,
      categoryId: 2,
      purpose: 'Inter-class football kits'
    });
    expect(result.shouldFlag).toBe(true);
    expect(result.reasons.some(r => r.includes('adjusted from Nu. 45,000'))).toBe(true);
  });

  it('flags when amount exceeds category threshold (Rule 2)', () => {
    const sportsThreshold = DEFAULT_CATEGORY_THRESHOLDS[2]; // 45,000
    const result = evaluateFlags({
      newAmount: 50000,
      categoryId: 2,
      purpose: 'Tournament Equipment'
    });
    expect(result.shouldFlag).toBe(true);
    expect(result.reasons.some(r => r.includes('category review threshold'))).toBe(true);
  });

  it('flags when duplicate purpose and amount exist (Rule 3)', () => {
    const result = evaluateFlags({
      newAmount: 15000,
      categoryId: 1,
      purpose: 'Annual debate certificates',
      duplicateCount: 2
    });
    expect(result.shouldFlag).toBe(true);
    expect(result.reasons.some(r => r.includes('identical purpose and amount'))).toBe(true);
  });

  it('flags when spending exceeds category budget (Rule 4)', () => {
    const result = evaluateFlags({
      newAmount: 30000,
      categoryId: 8,
      purpose: 'Office equipment',
      currentCategorySpend: 390000,
      categoryBudget: 400000
    });
    // 390k + 30k = 420k > 400k
    expect(result.shouldFlag).toBe(true);
    expect(result.reasons.some(r => r.includes('exceeds total category budget allocation'))).toBe(true);
  });

  it('does not flag normal in-budget expenditures with no duplicates or edits', () => {
    const result = evaluateFlags({
      isEdit: false,
      newAmount: 12000,
      categoryId: 1,
      purpose: 'Student workshop handouts',
      duplicateCount: 0,
      currentCategorySpend: 100000,
      categoryBudget: 600000
    });
    expect(result.shouldFlag).toBe(false);
    expect(result.reasons.length).toBe(0);
  });
});

