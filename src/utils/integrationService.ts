/**
 * Integration Service
 *
 * Handles cross-module financial integrations:
 * - Income → Asset: Auto-increase asset balance when income is received
 * - Expense → Liability: Auto-decrease liability balance when debt is paid
 * - Savings Goal → Asset: Track goal progress from linked asset balance
 */

import { getAssets, updateAsset, getLiabilities, updateLiability } from './financeDataService'
import { Asset, Liability } from '../types/finance'

// ============================================================================
// TYPES
// ============================================================================

export interface IntegrationResult {
  success: boolean
  message: string
  updatedValue?: number
}

// ============================================================================
// INCOME → ASSET INTEGRATION
// ============================================================================

/**
 * Process income with linked asset - increases the asset's value
 * @param assetId - The ID of the asset to credit
 * @param amount - The income amount to add
 * @param _currency - The currency of the income (reserved for future currency conversion)
 * @returns IntegrationResult
 */
export async function processIncomeWithAsset(
  assetId: string,
  amount: number,
  _currency: string
): Promise<IntegrationResult> {
  try {
    // Get the current asset
    const assets = await getAssets()
    const asset = assets.find(a => a.id === assetId)

    if (!asset) {
      return { success: false, message: 'Asset not found' }
    }

    // TODO: Handle currency conversion if currencies don't match
    // For now, we assume same currency or let the UI handle conversion
    const newValue = asset.value + amount

    // Update the asset
    const result = await updateAsset(assetId, { value: newValue })

    if (result) {
      return {
        success: true,
        message: `Asset "${asset.name}" credited with ${amount}`,
        updatedValue: newValue
      }
    }

    return { success: false, message: 'Failed to update asset' }
  } catch (error) {
    console.error('Error processing income with asset:', error)
    return { success: false, message: 'Integration error' }
  }
}

/**
 * Reverse an income-asset link (for edits/deletes)
 */
export async function reverseIncomeAssetLink(
  assetId: string,
  amount: number
): Promise<IntegrationResult> {
  try {
    const assets = await getAssets()
    const asset = assets.find(a => a.id === assetId)

    if (!asset) {
      return { success: false, message: 'Asset not found' }
    }

    const newValue = Math.max(0, asset.value - amount) // Don't go negative
    const result = await updateAsset(assetId, { value: newValue })

    if (result) {
      return {
        success: true,
        message: `Asset "${asset.name}" debited by ${amount}`,
        updatedValue: newValue
      }
    }

    return { success: false, message: 'Failed to update asset' }
  } catch (error) {
    console.error('Error reversing income asset link:', error)
    return { success: false, message: 'Integration error' }
  }
}

// ============================================================================
// EXPENSE → LIABILITY INTEGRATION
// ============================================================================

/**
 * Process debt payment - decreases the liability's current balance
 * @param liabilityId - The ID of the liability to pay down
 * @param amount - The payment amount
 * @returns IntegrationResult
 */
export async function processDebtPayment(
  liabilityId: string,
  amount: number
): Promise<IntegrationResult> {
  try {
    // Get the current liability
    const liabilities = await getLiabilities()
    const liability = liabilities.find(l => l.id === liabilityId)

    if (!liability) {
      return { success: false, message: 'Liability not found' }
    }

    // Calculate new balance (don't go negative)
    const newBalance = Math.max(0, liability.current_balance - amount)

    // Update the liability
    const result = await updateLiability(liabilityId, { current_balance: newBalance })

    if (result) {
      const isPaidOff = newBalance === 0
      return {
        success: true,
        message: isPaidOff
          ? `Congratulations! "${liability.name}" is fully paid off!`
          : `Payment of ${amount} applied to "${liability.name}"`,
        updatedValue: newBalance
      }
    }

    return { success: false, message: 'Failed to update liability' }
  } catch (error) {
    console.error('Error processing debt payment:', error)
    return { success: false, message: 'Integration error' }
  }
}

/**
 * Reverse a debt payment (for edits/deletes)
 */
export async function reverseDebtPayment(
  liabilityId: string,
  amount: number
): Promise<IntegrationResult> {
  try {
    const liabilities = await getLiabilities()
    const liability = liabilities.find(l => l.id === liabilityId)

    if (!liability) {
      return { success: false, message: 'Liability not found' }
    }

    // Add the payment back (don't exceed principal)
    const newBalance = Math.min(
      liability.principal_amount,
      liability.current_balance + amount
    )

    const result = await updateLiability(liabilityId, { current_balance: newBalance })

    if (result) {
      return {
        success: true,
        message: `Payment reversal applied to "${liability.name}"`,
        updatedValue: newBalance
      }
    }

    return { success: false, message: 'Failed to update liability' }
  } catch (error) {
    console.error('Error reversing debt payment:', error)
    return { success: false, message: 'Integration error' }
  }
}

// ============================================================================
// SAVINGS GOAL → ASSET INTEGRATION
// ============================================================================

/**
 * Get the balance of a linked asset for savings goal tracking
 * @param assetId - The ID of the linked asset
 * @returns The asset's current value or null if not found
 */
export async function getLinkedAssetBalance(assetId: string): Promise<number | null> {
  try {
    const assets = await getAssets()
    const asset = assets.find(a => a.id === assetId)
    return asset?.value ?? null
  } catch (error) {
    console.error('Error getting linked asset balance:', error)
    return null
  }
}

/**
 * Get asset details for linking
 * @param assetId - The ID of the asset
 */
export async function getAssetForLinking(assetId: string): Promise<Asset | null> {
  try {
    const assets = await getAssets()
    return assets.find(a => a.id === assetId) || null
  } catch (error) {
    console.error('Error getting asset for linking:', error)
    return null
  }
}

/**
 * Get liability details for linking
 * @param liabilityId - The ID of the liability
 */
export async function getLiabilityForLinking(liabilityId: string): Promise<Liability | null> {
  try {
    const liabilities = await getLiabilities()
    return liabilities.find(l => l.id === liabilityId) || null
  } catch (error) {
    console.error('Error getting liability for linking:', error)
    return null
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get assets suitable for income deposits
 * Returns all active assets - users can choose any account
 */
export async function getLiquidAssets(): Promise<Asset[]> {
  try {
    const assets = await getAssets()
    // Return all active assets - let user decide where to deposit
    return assets.filter(a => a.is_active !== false)
  } catch (error) {
    console.error('Error getting liquid assets:', error)
    return []
  }
}

/**
 * Get assets suitable for savings goal linking
 * Returns all active assets - users can link goals to any account
 */
export async function getSavingsAssets(): Promise<Asset[]> {
  try {
    const assets = await getAssets()
    // Return all active assets - let user decide which to link
    return assets.filter(a => a.is_active !== false)
  } catch (error) {
    console.error('Error getting savings assets:', error)
    return []
  }
}

/**
 * Get active liabilities for debt payment linking
 */
export async function getActiveDebtLiabilities(): Promise<Liability[]> {
  try {
    const liabilities = await getLiabilities()
    return liabilities.filter(l => l.current_balance > 0)
  } catch (error) {
    console.error('Error getting active debt liabilities:', error)
    return []
  }
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Sync savings goal progress from linked asset balance
 * This is called when viewing savings goals to get current balance
 * @param _goalId - The goal ID (reserved for future audit/logging)
 * @param linkedAssetId - The linked asset ID
 */
export async function syncSavingsGoalFromAsset(
  _goalId: string,
  linkedAssetId: string
): Promise<{ balance: number; assetName: string } | null> {
  try {
    const assets = await getAssets()
    const asset = assets.find(a => a.id === linkedAssetId)

    if (!asset) {
      return null
    }

    return {
      balance: asset.value,
      assetName: asset.name
    }
  } catch (error) {
    console.error('Error syncing savings goal from asset:', error)
    return null
  }
}
