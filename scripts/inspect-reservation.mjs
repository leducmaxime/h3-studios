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

  // Track ALL network requests
  const apiCalls = [];
  const responseBodies = {};
  context.on('request', request => {
    if (request.url().includes('/api/')) {
      apiCalls.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData()?.substring(0, 500),
      });
    }
  });
  context.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/')) {
      try {
        const body = await response.text();
        responseBodies[url] = body.substring(0, 2000);
      } catch (e) {
        responseBodies[url] = '(error reading body)';
      }
    }
  });

  const page = await context.newPage();

  console.log('=== STEP 1: Navigation vers /reservation ===');
  await page.goto('https://staging.h3-studios.fr/reservation', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/tmp/reservation-01-initial.png', fullPage: true });
  console.log('Screenshot 1: reservation-01-initial.png');

  const initialText = await page.evaluate(() => document.body.innerText);
  console.log('\n=== PAGE TEXT (initial):');
  console.log(initialText.substring(0, 2000));

  console.log('\n=== STEP 2: Cliquer "Groupe" ===');
  
  await page.getByText('Groupe', { exact: true }).click();
  await page.waitForTimeout(1500);
  console.log('Clicked "Groupe"');

  const textAfterGroup = await page.evaluate(() => document.body.innerText);
  console.log('\n=== TEXT after group click:');
  console.log(textAfterGroup.substring(0, 1500));

  console.log('\n=== STEP 3: Cliquer une date ===');
  
  // Find day buttons: they contain "Lun", "Mar", etc. followed by a number
  // Use a more reliable approach - find the button with the first available day
  const dayButtons = page.locator('button').filter({ hasText: /Lun|Mar|Mer|Jeu|Ven|Sam|Dim/ });
  const dayCount = await dayButtons.count();
  console.log(`Day buttons found: ${dayCount}`);
  
  if (dayCount > 0) {
    // Click the first available day (Monday 25)
    await dayButtons.first().click();
    await page.waitForTimeout(2000);
    console.log('Clicked first day button');
  }

  const textAfterDate = await page.evaluate(() => document.body.innerText);
  console.log('\n=== TEXT after date click:');
  console.log(textAfterDate.substring(0, 4000));

  console.log('\n=== STEP 4: Screenshot after date selection ===');
  await page.screenshot({ path: '/tmp/reservation-02-after-selection.png', fullPage: true });
  console.log('Screenshot 2 (after date): reservation-02-after-selection.png');

  // Wait a bit more for any API calls
  await page.waitForTimeout(3000);

  console.log('\n=== STEP 5: Analyse des time slots / studios ===');
  
  const analysis = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    
    const hasLaScene = bodyText.includes('Scène') || bodyText.toLowerCase().includes('scène');
    const hasLePodium = bodyText.includes('Podium') || bodyText.toLowerCase().includes('podium');
    
    const timePattern = /\b\d{2}:\d{2}\b/g;
    const times = bodyText.match(timePattern);
    const uniqueTimes = times ? [...new Set(times)] : [];
    
    // Find anything that looks like a time slot grid
    const allEls = document.querySelectorAll('*');
    let timeSlotGrids = 0;
    let studioLabels = 0;
    
    allEls.forEach(el => {
      const text = el.textContent?.trim() || '';
      if (text.includes('Scène') || text.includes('Podium')) {
        studioLabels++;
      }
      // Look for time slot containers
      if (el.className && typeof el.className === 'string') {
        if (el.className.includes('grid') && el.children.length > 5) {
          timeSlotGrids++;
        }
      }
    });
    
    // Count elements with time-like content
    const timeContainers = document.querySelectorAll('[class*="time"], [class*="slot"], [class*="hour"], [class*="horair"]');
    
    // Check for any visible time slot UI
    const hasTimeSlots = uniqueTimes.length > 0 && hasLaScene;
    
    // Look for the booking flow step indicator - which step are we on?
    const stepIndicators = document.querySelectorAll('[class*="step"], [class*="stepper"]');
    
    return {
      hasLaScene,
      hasLePodium,
      timesFound: uniqueTimes.sort(),
      timeSlotContainerCount: timeContainers.length,
      studioLabelElements: studioLabels,
      hasTimeSlotsVisible: hasTimeSlots,
      stepIndicators: stepIndicators.length,
      // What section headers are visible?
      sections: bodyText.split('\n').filter(l => l.trim() && l.trim().length < 50).slice(0, 30),
    };
  });
  console.log('ANALYSIS:', JSON.stringify(analysis, null, 2));

  // More detailed DOM structure
  console.log('\n=== STEP 6: Current step in the booking flow ===');
  const stepInfo = await page.evaluate(() => {
    // Check which booking flow step is active
    const steps = document.querySelectorAll('[class*="step"], button[disabled], button:not([disabled])');
    const allDivs = document.querySelectorAll('div');
    let currentStep = 'unknown';
    
    // Check for common step indicators
    allDivs.forEach(d => {
      const text = d.textContent?.trim() || '';
      if (text === '1' || text === '2' || text === '3' || text === '4' || text === '5' || text === '6') {
        // Check if parent has special styling
        const parent = d.closest('[class*="step"]') || d.parentElement;
        if (parent) {
          const parentHTML = parent.innerHTML.substring(0, 200);
          // Check if this step is active (primary color)
          if (parentHTML.includes('primary') || parentHTML.includes('ring-2')) {
            currentStep = `Step ${text} (active)`;
          }
        }
      }
    });
    
    return { currentStep };
  });
  console.log('Step info:', JSON.stringify(stepInfo, null, 2));

  // Check what's visible in the viewport now
  console.log('\n=== STEP 7: Visible text in viewport ===');
  const visibleText = await page.evaluate(() => {
    const viewportHeight = window.innerHeight;
    const all = document.querySelectorAll('*');
    const visible = [];
    all.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top >= 0 && rect.top < viewportHeight && rect.width > 50 && rect.height > 20) {
        const text = el.textContent?.trim();
        if (text && text.length > 3 && text.length < 60 && !visible.some(v => v.text === text)) {
          visible.push({ text: text.substring(0, 50), tag: el.tagName, top: Math.round(rect.top) });
        }
      }
    });
    return visible.sort((a, b) => a.top - b.top).slice(0, 50);
  });
  console.log('Visible text elements:', JSON.stringify(visibleText, null, 2));

  console.log('\n=== STEP 8: Network API calls ===');
  console.log('Captured API requests:', JSON.stringify(apiCalls, null, 2));
  console.log('API response bodies:', JSON.stringify(responseBodies, null, 2));

  // Also try to see XHR/fetch calls via performance API
  const perfEntries = await page.evaluate(() => {
    return performance.getEntriesByType('resource')
      .filter(e => e.name.includes('/api/'))
      .map(e => ({
        name: e.name.substring(0, 200),
        type: e.initiatorType,
        duration: Math.round(e.duration),
        size: e.transferSize,
        status: e.responseStatus,
      }));
  });
  console.log('Performance API entries:', JSON.stringify(perfEntries, null, 2));

  // Check script content for API endpoints
  const apiEndpoints = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script:not([src])');
    const endpoints = new Set();
    scripts.forEach(s => {
      const text = s.textContent || '';
      const matches = text.match(/['"`][^'"`]*\/api\/[^'"`]*['"`]/g);
      if (matches) matches.forEach(m => endpoints.add(m.replace(/['"`]/g, '')));
    });
    return [...endpoints];
  });
  console.log('API endpoints found in scripts:', JSON.stringify(apiEndpoints, null, 2));

  await browser.close();
  
  console.log('\n=== DONE ===');
  console.log('Screenshots: /tmp/reservation-01-initial.png, /tmp/reservation-02-after-selection.png');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
