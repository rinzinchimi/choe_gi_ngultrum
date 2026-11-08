/**
 * Rule-based Flagging Engine for Choe Gi Ngultrum
 *
 * Principles:
 * - A "Requires Review" flag is NOT an accusation.
 * - Flags trigger calm, routine administrative review to ensure accuracy.
 *
 * 4 Core Rules:
 * 1. The amount was edited after creation.
 * 2. The amount is above a per-category threshold.
 * 3. A duplicate purpose + amount exists.
 * 4. The category's total spend exceeds its allocated budget.
 */

const DEFAULT_CATEGORY_THRESHOLDS = {
  1: 40000, // Student Activities
  2: 45000, // Sports
  3: 50000, // Events
  4: 35000, // Clubs
  5: 60000, // Infrastructure
  6: 50000, // Academic
  7: 35000, // Maintenance
  8: 30000  // Other
};

const DEFAULT_GLOBAL_THRESHOLD = 50000;

function evaluateFlags({
  isEdit = false,
  previousAmount = null,
  newAmount,
  categoryId,
  purpose,
  duplicateCount = 0,
  currentCategorySpend = 0,
  categoryBudget = null,
  customThreshold = null
}) {
  const reasons = [];
  const amount = Number(newAmount);

  // Rule 1: The amount was edited after creation
  if (isEdit && previousAmount !== null && Number(previousAmount) !== amount) {
    reasons.push(
      `Amount adjusted from Nu. ${Number(previousAmount).toLocaleString()} to Nu. ${amount.toLocaleString()} after initial record creation`
    );
  }

  // Rule 2: Amount is above per-category threshold
  const threshold = customThreshold ||
    DEFAULT_CATEGORY_THRESHOLDS[categoryId] ||
    Number(process.env.FLAG_AMOUNT_THRESHOLD) ||
    DEFAULT_GLOBAL_THRESHOLD;

  if (amount >= threshold) {
    reasons.push(
      `Expenditure amount (Nu. ${amount.toLocaleString()}) reaches or exceeds the category review threshold (Nu. ${threshold.toLocaleString()})`
    );
  }

  // Rule 3: Duplicate purpose + amount exists
  if (duplicateCount > 0) {
    reasons.push(
      `Identified ${duplicateCount} other record(s) with identical purpose and amount for verification against duplicate entry`
    );
  }

  // Rule 4: Category spend exceeds budget
  if (categoryBudget !== null && categoryBudget !== undefined) {
    const projectedSpend = Number(currentCategorySpend) + amount;
    if (projectedSpend > Number(categoryBudget)) {
      reasons.push(
        `Projected category spending (Nu. ${projectedSpend.toLocaleString()}) exceeds total category budget allocation (Nu. ${Number(categoryBudget).toLocaleString()})`
      );
    }
  }

  return {
    shouldFlag: reasons.length > 0,
    reasons
  };
}

/**
 * Persists flags in the database within a transaction
 */
async function recordFlags(t, expenditureId, reasons, actorId = null) {
  if (!reasons || reasons.length === 0) return;

  // Set status to requires_review
  await t.none(
    `UPDATE expenditures 
     SET status = 'requires_review', is_published = false, updated_at = NOW() 
     WHERE id = $1`,
    [expenditureId]
  );

  for (const reason of reasons) {
    await t.none(
      `INSERT INTO review_flags (expenditure_id, reason, raised_by, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [expenditureId, reason, actorId]
    );
  }

  // Log in audit_log
  await t.none(
    `INSERT INTO audit_log (entity_type, entity_id, action, actor_id, before, after, created_at)
     VALUES ($1, $2, 'flagged', $3, $4, $5, NOW())`,
    [
      'expenditure',
      expenditureId,
      actorId,
      JSON.stringify({ status: 'pending' }),
      JSON.stringify({ status: 'requires_review', reasons })
    ]
  );
}

module.exports = {
  DEFAULT_CATEGORY_THRESHOLDS,
  DEFAULT_GLOBAL_THRESHOLD,
  evaluateFlags,
  recordFlags
};

