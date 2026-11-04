// Stands in for the server in the design preview. Nothing is uploaded, and these
// rows are made up. A file named "mismatch" shows the balance warning.
export async function readStatementPdf(asset) {
  await new Promise(resolve => setTimeout(resolve, 600));
  return {
    rows: [
      ['01/10/2026', 'Sample salary', 0, 450000],
      ['03/10/2026', 'Sample Shoprite', 12400, 0],
      ['05/10/2026', 'Sample electricity token', 15000, 0],
    ],
    skipped: /mismatch/i.test(asset.name) ? 2 : 0,
    balanced: /mismatch/i.test(asset.name) ? false : true,
  };
}
