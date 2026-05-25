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

  console.log('=== NAVIGATION ===');
  await page.goto('https://staging.h3-studios.fr/reservation', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Click Groupe
  await page.getByText('Groupe', { exact: true }).click();
  await page.waitForTimeout(1500);

  // Click first available day
  const dayButtons = page.locator('button').filter({ hasText: /Lun|Mar|Mer|Jeu|Ven|Sam|Dim/ });
  await dayButtons.first().click();
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({ path: '/tmp/timeslots-detailed.png', fullPage: true });
  console.log('Full page screenshot: /tmp/timeslots-detailed.png');

  // Now fetch the EXACT HTML of the time slot picker section
  const timeSlotHTML = await page.evaluate(() => {
    // Find the time slot picker div
    const allDivs = document.querySelectorAll('div');
    let tsHtml = '';
    
    for (const div of allDivs) {
      const text = div.textContent || '';
      if (text.includes('Choisissez votre créneau') && text.includes('LA SCÈNE') && text.includes('LE PODIUM')) {
        tsHtml = div.innerHTML.substring(0, 8000);
        break;
      }
    }
    
    // If not found that way, look for studio labels
    if (!tsHtml) {
      const all = document.querySelectorAll('*');
      const studioLabels = [];
      all.forEach(el => {
        if (el.textContent?.trim() === 'LA SCÈNE' || el.textContent?.trim() === 'LE PODIUM') {
          studioLabels.push({
            tag: el.tagName,
            text: el.textContent?.trim(),
            class: el.className?.substring(0, 80),
            parentTag: el.parentElement?.tagName,
            visible: el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0,
            rect: el.getBoundingClientRect(),
          });
        }
      });
      tsHtml = JSON.stringify(studioLabels);
    }

    return tsHtml;
  });

  console.log('\n=== Time Slot Picker Studio Labels ===');
  console.log(timeSlotHTML.substring(0, 3000));

  // Dump all h4 elements
  const h4Content = await page.evaluate(() => {
    const h4s = document.querySelectorAll('h4');
    return Array.from(h4s).map(h => ({
      text: h.textContent?.trim(),
      class: h.className?.substring(0, 80),
      visible: h.getBoundingClientRect().width > 0,
      rect: h.getBoundingClientRect(),
    }));
  });
  console.log('\n=== All H4 elements ===');
  console.log(JSON.stringify(h4Content, null, 2));

  // Check all elements containing "SCÈNE" or "PODIUM"
  const sceneElements = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    const results = [];
    all.forEach(el => {
      const text = el.textContent?.trim() || '';
      if (text.includes('SCÈNE') || text.includes('PODIUM')) {
        results.push({
          tag: el.tagName,
          text: text.substring(0, 60),
          class: el.className?.substring(0, 60),
          rect: el.getBoundingClientRect(),
        });
      }
    });
    return results;
  });
  console.log('\n=== Elements containing SCÈNE or PODIUM ===');
  console.log(JSON.stringify(sceneElements, null, 2));

  // Count how many slot buttons and how they're grouped
  const slotButtons = await page.evaluate(() => {
    const timeSlots = document.querySelectorAll('button');
    const slots = [];
    timeSlots.forEach(b => {
      const text = b.textContent?.trim() || '';
      if (/^\d{1,2}h\d{0,2}$/.test(text) || /^\d{1,2}h$/.test(text)) {
        const rect = b.getBoundingClientRect();
        slots.push({ text, x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width) });
      }
    });
    // Group by row based on Y position
    return slots;
  });
  console.log('\n=== Slot button positions ===');
  const rows = {};
  for (const s of slotButtons) {
    const key = s.y;
    if (!rows[key]) rows[key] = [];
    rows[key].push(`${s.text}@${s.x}`);
  }
  for (const [y, slots] of Object.entries(rows)) {
    console.log(`  Row y=${y}: ${slots.join(', ')}`);
  }

  await browser.close();
  console.log('\n=== DONE ===');
  console.log('Screenshot: /tmp/timeslots-detailed.png');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
