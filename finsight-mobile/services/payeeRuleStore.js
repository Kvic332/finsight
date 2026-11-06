import AsyncStorage from './dataStore';
import { applyPayeeRules, learnPayeeRule } from './payeeRules';

// Payee names are personal, so this key is encrypted and included in backups.
export const PAYEE_RULES_KEY = 'finsight_payee_rules';

export async function loadPayeeRules() {
  try {
    return JSON.parse(await AsyncStorage.getItem(PAYEE_RULES_KEY) || '{}');
  } catch { return {}; }
}

// Remembers a category the user chose, for later imports from the same payee.
export async function rememberCategory(desc, cat) {
  try {
    const rules = await loadPayeeRules();
    await AsyncStorage.setItem(PAYEE_RULES_KEY, JSON.stringify(learnPayeeRule(rules, desc, cat)));
  } catch { /* a missed rule only means asking again next time */ }
}

export async function withRememberedCategories(transactions) {
  return applyPayeeRules(transactions, await loadPayeeRules());
}
