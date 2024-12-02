import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { CSS, render } from "https://deno.land/x/gfm@0.1.22/mod.ts";

import { cheerio } from "https://deno.land/x/cheerio@1.0.7/mod.ts";
var base = "https://corss.deno.dev/"
var target = "https://doujindesu.tv"
function addCorsIfNeeded(response: Response) {
  const headers = new Headers(response.headers);

  if (!headers.has("access-control-allow-origin")) {
    headers.set("access-control-allow-origin", "*");
  }

  return headers;
}

function isUrl(url: string) {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return false;
  }

  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

async function handleRequest(request: Request) {
  const { pathname, search } = new URL(request.url);
  const url = target + pathname + search;

  if (isUrl(url)) {
    console.log("proxy to %s", url);
    const corsHeaders = addCorsIfNeeded(new Response());
    if (request.method.toUpperCase() === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    const response = await fetch(url, request)
    var text = await response.text()
    var tipe = response.headers.get("Content-Type")
    const headers = addCorsIfNeeded(response);
    
    const $ = cheerio.load(text);
      
    $("script:contains('mydomain'), script:contains('iframe'), script[src^='//']").remove()

    function crot(x, y){
    $(x).each( function(){
        var u = $(this).attr(y)
        if( u && u.startsWith(target) ){
          $(this).attr(y, u.replace(target, '') )
        }
    })
    }
    crot("link[rel='stylesheet']", "href")
    crot("script", "src")
    $("script#jquery-js").attr("src", "https://code.jquery.com/jquery-3.7.1.min.js")
    $("head > link:nth-child(34)").attr("href", "https://vangke.xtgem.com/text.css")
    var re = ""
    if ( tipe.includes("html") ){
        re = $.html();
      } else {
        re = decodeURIComponent(text)
    }
    
    var res = new Response( re, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }) 
    
       return res
    
  }
  /*
  const readme = await Deno.readTextFile("./README.md");
  const body = render(readme);
  const html = `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CORS Proxy</title>
        <style>
          body {
            margin: 0;
            background-color: var(--color-canvas-default);
            color: var(--color-fg-default);
          }
          main {
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem 1rem;
          }
          ${CSS}
        </style>
      </head>
      <body data-color-mode="auto" data-light-theme="light" data-dark-theme="dark">
        <main class="markdown-body">
          ${body}
        </main>
      </body>
    </html>`;
  return new Response(html, {
    headers: {
      "content-type": "text/html;charset=utf-8",
    },
  }); */
}

const port = Deno.env.get("PORT") ?? "8000";

serve(handleRequest, { port: Number(port) });
