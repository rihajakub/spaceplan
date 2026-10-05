# Spaceplan

Společný obsahový kalendář pro Facebook, Instagram a LinkedIn. Rozhraní je v češtině a počítá s časovým pásmem Europe/Prague.

## Nasazení na Vercel

1. V projektu ve Vercelu vytvoř databázi Postgres přes **Storage → Create Database → Postgres**. Marketplace integrace (např. Neon) přidá proměnnou `POSTGRES_URL`.
2. Ve stejné sekci vytvoř **Blob** úložiště pro náhledové obrázky. Připojené úložiště přidá `BLOB_READ_WRITE_TOKEN`.
3. Push do větve `main` spustí produkční nasazení. Tabulka `content_posts` se vytvoří automaticky při prvním otevření aplikace.
4. Zapni Vercel Deployment Protection nebo ochranu heslem, pokud nemá být aplikace veřejně dostupná.

Data jsou společná pro všechny návštěvníky nasazené aplikace. Obrázky jsou uloženy v Vercel Blob; URL obrázku není určena ke sdílení mimo aplikaci.

## Lokální spuštění

Použij `vercel dev` s proměnnými staženými pomocí `vercel env pull`. Samotný soubor `index.html` bez API zobrazuje rozhraní, ale společná data vyžadují Vercel API a databázi.
