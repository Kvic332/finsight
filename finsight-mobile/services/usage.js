// How someone uses FinSight. It shapes Home and what FinSight asks for.
// Older profiles have no usage set; they used FinSight for a salary.
export const USAGES = [
  { value: 'salary', label: 'I earn a salary', about: 'Plan each pay to last until payday.', icon: 'briefcase-outline' },
  { value: 'business', label: 'I run a business', about: 'Income that varies, from trading, a shop or freelance work.', icon: 'storefront-outline' },
  { value: 'both', label: 'Both', about: 'A salary and a business or side hustle.', icon: 'layers-outline' },
  { value: 'tracking', label: 'Just track my spending', about: 'See where your money goes. No income or payday needed.', icon: 'receipt-outline' },
];

export const usageOf = user => USAGES.find(u => u.value === user?.usage)?.value || 'salary';
export const isTrackingOnly = user => usageOf(user) === 'tracking';
export const usageLabel = user => USAGES.find(u => u.value === usageOf(user)).label;
