import {test,expect} from '@playwright/test';
test('slow catalogue does not block input or shift the upload control',async({page})=>{
 let finish;const gate=new Promise(r=>finish=r);await page.route('**/api/formats',async route=>{await gate;await route.continue();});
 await page.goto('/ru/');await expect(page.locator('body')).toHaveClass(/catalog-loading/);const before=await page.locator('#choose').boundingBox();await expect(page.locator('#choose')).toBeEnabled();await page.locator('#example').click();await expect(page.locator('.file-row')).toHaveCount(1);await page.locator('#clear').click();finish();await expect(page.locator('body')).not.toHaveClass(/catalog-loading/);const after=await page.locator('#choose').boundingBox();expect(Math.abs(before.y-after.y)).toBeLessThanOrEqual(1);expect(Math.abs(before.height-after.height)).toBeLessThanOrEqual(1);
});
test('mascot animation stays constant on hover; reduced motion stops decoration',async({page})=>{
 await page.goto('/en/');const duration=await page.locator('.mascot svg').first().evaluate(e=>getComputedStyle(e).animationDuration);await page.locator('#converter').hover();expect(await page.locator('.mascot svg').first().evaluate(e=>getComputedStyle(e).animationDuration)).toBe(duration);await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('.mascot svg').first().evaluate(e=>getComputedStyle(e).animationName)).toBe('none');expect(await page.locator('.loading-helper svg').evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
});
