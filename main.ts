import puppeteer from 'https://deno.land/x/puppeteer@v9.1.1';
import StealthPlugin from 'https://deno.land/x/puppeteer_extra@v1.4.0/plugin/stealth';
import { Page } from 'https://deno.land/x/puppeteer@v9.1.1/puppeteer.d.ts';

const targetUrl = 'https://doujindesu.tv/'; // Replace with your desired URL

async function scrapeDoujindesu() {
  try {
    const puppeteer = await puppeteer.launch({ headless: false }); // Adjust headless mode as needed
    const browser = await puppeteer.browser();
    const page = await browser.newPage();

    // Add StealthPlugin for enhanced anti-detection (optional)
    await StealthPlugin().use(browser);

    await page.goto(targetUrl);

    // Wait for page to load (adjust selectors based on doujindesu.tv's structure)
    await page.waitForSelector('.manga-list-item'); // Replace with appropriate selector

    const scrapedData = await page.evaluate(() => {
      const mangaItems = document.querySelectorAll('.manga-list-item'); // Replace with appropriate selector
      const results: { title: string; url: string }[] = [];

      mangaItems.forEach((item) => {
        const titleElement = item.querySelector('.manga-title'); // Replace with appropriate selector
        const urlElement = item.querySelector('.manga-link'); // Replace with appropriate selector

        if (titleElement && urlElement) {
          results.push({
            title: titleElement.textContent.trim(),
            url: urlElement.getAttribute('href'),
          });
        }
      });

      return results;
    });

    console.log('Scraped Data:', scrapedData);

    await browser.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

scrapeDoujindesu();
