// Reveal the real control in whichever adaptive region currently contains it.
export async function openBankMore(page) {
 const details=page.locator('.bank-advanced-filters');
 if(await details.isVisible() && await details.evaluate(n=>!n.open||n.dataset.motionClosing==='true')) {
  await details.locator('> summary').click(); await page.waitForTimeout(230);
 }
}
export async function revealBankFilter(page,selector) {
 const field=page.locator(selector).first(),inside=await field.evaluate(n=>!!n.closest('.bank-advanced-filters'));
 const details=page.locator('.bank-advanced-filters');
 if(inside)await openBankMore(page);
 else if(await details.evaluate(n=>n.open&&n.dataset.motionClosing!=='true')) {
  await details.locator('> summary').click();await page.waitForTimeout(230);
 }
 await field.scrollIntoViewIfNeeded();return field;
}
