import puppeteer from 'https://deno.land/x/puppeteer@16.2.0/mod.ts';

async function scrapeDoujinDesu() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('https://doujindesu.tv');

    // Seleksi elemen yang ingin Anda ekstrak data
    const titles = await page.$$eval('.manga-list-name', elements => {
        return elements.map(element => element.textContent);
    });

    console.log(titles);

    await browser.close();
}

scrapeDoujinDesu();
