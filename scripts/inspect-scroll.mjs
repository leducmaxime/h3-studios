import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/nix/store/8cmbqjr9h38wbrniixqpgqmi9sl4xvdn-playwright-chromium/chrome-linux/chrome',
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  await page.goto('https://staging.h3-studios.fr/reservation', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Click Groupe
  await page.getByText('Groupe', { exact: true }).click();
  await page.waitForTimeout(1500);

  // Click first day
  const dayButtons = page.locator('button').filter({ hasText: /Lun|Mar|Mer|Jeu|Ven|Sam|Dim/ });
  await dayButtons.first().click();
  await page.waitForTimeout(3000);

  // Get the ENTIRE page content height
  const pageHeight = await page.evaluate(() => document.body.scrollHeight);
  console.log(`Full page height: ${pageHeight}px (viewport: 900px)`);

  // Find ALL time slot buttons across the full page
  const allSlotDetails = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    const slots = [];
    btns.forEach(b => {
      const text = b.textContent?.trim() || '';
      if (/^\d{1,2}h\d{0,2}$/.test(text) || /^\d{1,2}h$/.test(text)) {
        const rect = b.getBoundingClientRect();
        const par = b.closest('[class*="studio"], [class*="scene"], [class*="podium"]');
        const parentClass = par ? (par.className?.substring(0, 60) || 'none') : 'no-studio-container';
        slots.push({
          text,
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          parentClass: parentClass.substring(0, 60),
          parentTag: b.parentElement?.parentElement?.tagName,
          grandparentClass: b.parentElement?.parentElement?.className?.substring(0, 60),
        });
      }
    });
    return slots;
  });
  
  console.log('\n=== ALL TIME SLOT BUTTONS ===');
  const byY = {};
  for (const s of allSlotDetails) {
    const key = s.y;
    if (!byY[key]) byY[key] = [];
    byY[key].push(s);
  }
  for (const [y, slots] of Object.entries(byY).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    console.log(`\nRow y=${y} (${slots.length} slots):`);
    console.log(`  Parent: ${slots[0].parentClass}`);
    console.log(`  Parent tag: ${slots[0].parentTag}`);
    console.log(`  Grandparent: ${slots[0].grandparentClass}`);
    console.log(`  Slots: ${slots.map(s => s.text).join(', ')}`);
  }

  // Look at ALL children of the main content area
  console.log('\n=== MAIN CONTENT STRUCTURE ===');
  const mainStructure = await page.evaluate(() => {
    const mainEl = document.querySelector('main') || document.querySelector('[class*="min-h"]');
    if (!mainEl) return 'No main element found';
    
    function describe(el, depth = 0) {
      if (depth > 8) return '';
      const indent = '  '.repeat(depth);
      let result = '';
      const tag = el.tagName.toLowerCase();
      const cls = el.className && typeof el.className === 'string' ? el.className.substring(0, 40) : '';
      const txt = el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 
        ? ` "${el.textContent?.trim().substring(0, 30)}"` : '';
      const rect = el.getBoundingClientRect();
      const vis = rect.width > 0 && rect.height > 0 ? ` [${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.width)}x${Math.round(rect.height)}]` : ' [hidden]';
      result += `${indent}<${tag}${cls ? ` class="${cls}"` : ''}${txt}${vis}>\n`;
      for (let i = 0; i < Math.min(el.children.length, 6); i++) {
        result += describe(el.children[i], depth + 1);
      }
      if (el.children.length > 6) {
        result += `${indent}  ... (${el.children.length - 6} more)\n`;
      }
      return result;
    }
    
    // Find the TimeSlotPicker or its container
    const allDivs = mainEl.querySelectorAll('div');
    for (const div of allDivs) {
      const text = div.textContent || '';
      if (text.includes('Choisissez votre créneau') && div.getBoundingClientRect().width > 0) {
        return describe(div, 0);
      }
    }
    return 'TimeSlotPicker not found by text search';
  });
  console.log(mainStructure);

  // Scroll all the way down and check what's there
  console.log('\n=== SCROLLING TO BOTTOM ===');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);

  const bottomContent = await page.evaluate(() => {
    // Find visible elements near the bottom
    const vh = window.innerHeight;
    const scrollY = window.scrollY;
    const all = document.querySelectorAll('*');
    const results = [];
    all.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top > 0 && rect.top < vh && rect.width > 50 && rect.height > 20) {
        const text = el.textContent?.trim().substring(0, 50);
        if (text && text.length > 3) {
          results.push({ tag: el.tagName, text, y: Math.round(rect.top + scrollY) });
        }
      }
    });
    // Deduplicate by text
    const seen = new Set();
    return results.filter(r => {
      if (seen.has(r.text)) return false;
      seen.add(r.text);
      return true;
    }).sort((a, b) => a.y - b.y).slice(0, 30);
  });
  console.log('Content at bottom of page:');
  console.log(JSON.stringify(bottomContent, null, 2));

  await browser.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
