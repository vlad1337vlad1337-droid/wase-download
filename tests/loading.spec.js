import {test,expect} from '@playwright/test';
test('cached catalogue keeps input ready while revalidation preserves queued files',async({page})=>{
 const catalog={groups:[['png','svg']],inputs:{png:0},categories:{png:'image',svg:'vector'},limits:{fileMB:100}};
 await page.route('**/api/formats',route=>route.fulfill({json:catalog}));
 await page.goto('/ru/');await expect(page.locator('#boot-screen')).toBeHidden();
 await page.unroute('**/api/formats');
 let finish;const gate=new Promise(resolve=>finish=resolve);
 await page.route('**/api/formats',async route=>{await gate;await route.fulfill({json:catalog});});
 try{
  await page.reload();await expect(page.locator('#boot-screen')).toBeHidden();
  const before=await page.locator('#choose').boundingBox();await expect(page.locator('#choose')).toBeEnabled();
  await page.locator('#example').click();await expect(page.locator('.file-row')).toHaveCount(1);
  const refreshed=page.waitForResponse('**/api/formats');finish();await refreshed;
  await expect(page.locator('.file-row')).toHaveCount(1);await expect(page.locator('#convert')).toBeEnabled();
  await page.locator('#clear').click();await expect(page.locator('.converter-shell')).not.toHaveClass(/queue-is-animating/);
  const after=await page.locator('#choose').boundingBox();expect(Math.abs(before.y-after.y)).toBeLessThanOrEqual(1);expect(Math.abs(before.height-after.height)).toBeLessThanOrEqual(1);
 }finally{finish();}
});
test('mascot animation stays constant on hover; reduced motion stops decoration',async({page})=>{
 await page.goto('/en/');await expect(page.locator('#boot-screen')).toBeHidden();const duration=await page.locator('.helper-figure>svg').first().evaluate(e=>getComputedStyle(e).animationDuration);await page.locator('#converter').hover();expect(await page.locator('.helper-figure>svg').first().evaluate(e=>getComputedStyle(e).animationDuration)).toBe(duration);await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('.helper-figure>svg').first().evaluate(e=>getComputedStyle(e).animationName)).toBe('none');expect(await page.locator('.loading-helper svg').evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
});
