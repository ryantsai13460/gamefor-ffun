# Media sources

The YouTube section preserves the 24 original Unstable SMP and Minecraft creator videos and includes a larger static catalog of gaming Shorts and standard YouTube videos in `assets/media-curated.js`. The curated library requires no API key. Titles and creators were verified through YouTube's oEmbed metadata. Gaming Shorts link to their YouTube Shorts pages. Thumbnails load from YouTube's own CDN, with title placeholders when the browser cannot fetch an image.

| Section | Sources |
| --- | --- |
| Minecraft Shorts | [camman18](https://www.youtube.com/@camman18/shorts), [Minecraft Wiki's Mojang Shorts index](https://minecraft.wiki/w/Mojang_shorts) |
| Expanded Roblox Shorts | Official YouTube upload metadata for Robert Noob, GaminGO X 001, and Frozen Liquid |
| More gaming Shorts | [camman18](https://www.youtube.com/@camman18/shorts), [KreekCraft](https://www.youtube.com/@KreekCraft/shorts), and creators and publishers covering Apex Legends, Among Us, Brawl Stars, Clash, Fortnite, Pokémon, Rocket League, Subway Surfers, and Valorant. Candidate Shorts came from creator indexes and were checked against YouTube oEmbed. |
| Expanded full videos | Official YouTube video links from [Minecraft](https://www.minecraft.net/en-us/articles), [Roblox](https://corp.roblox.com/newsroom), [Fortnite](https://www.fortnite.com/news), and [Nintendo](https://www.nintendo.com/us/whatsnew/), verified against YouTube oEmbed |
| More creator videos | Gaming uploads discovered through creator indexes and checked against YouTube oEmbed, including Fortnite, Minecraft, Roblox, Valorant, and Rocket League |
| Violin videos and Shorts | 64 full videos and 52 Shorts, including lessons and performances from nine creators. Entries were discovered through vidIQ’s creator indexes and checked against YouTube oEmbed. [vidIQ](https://vidiq.com/) · [YouTube oEmbed](https://www.youtube-nocookie.com/oembed) |
| Explore video expansion | 250 standard videos and 250 Shorts from 166 creators, covering gaming, music, science, technology, nature, history, arts, food, travel, and sports. Public creator indexes establish the format, and YouTube oEmbed verifies each title, creator, and thumbnail. [vidIQ](https://vidiq.com/) · [YouTube oEmbed](https://www.youtube-nocookie.com/oembed) |
| Latest video additions | 50 standard videos and 50 Shorts from 79 creators across the ten topics. Creator indexes establish format, and YouTube oEmbed verifies the title, creator, and thumbnail. [vidIQ](https://vidiq.com/) · [YouTube oEmbed](https://www.youtube-nocookie.com/oembed) |
| Roblox Shorts | [Shedletsky's Roblox HQ Short](https://www.youtube.com/shorts/ftnaXStTPBY), [Bloxify's Roblox moments](https://www.youtube.com/shorts/WILeRgKUUvk), [WarmBlox's Roblox Obby Escape](https://www.youtube.com/shorts/JFl6u1rsFLw) |
| Unstable SMP and creator picks | [Wemmbu](https://www.youtube.com/@wemmbumc), [Parrot](https://www.youtube.com/@ParrotX2), [Spoke](https://www.youtube.com/@SpokeIsHere), [FlameFrags](https://www.youtube.com/@FlameFragsMC) |
| A Minecraft Movie | [Mojang's official artwork](https://www.minecraft.net/en-us/article/a-minecraft-movie-out-now), [Warner Bros. trailer](https://www.youtube.com/watch?v=wJO_vIDZn-I), [Apple TV listing](https://tv.apple.com/us/movie/a-minecraft-movie/umc.cmc.1od4a1ayyjqn43uz8fel7ei5e) |
| Blender films | [Wing It!](https://studio.blender.org/projects/wing-it/), [Charge](https://studio.blender.org/projects/charge/), [Sprite Fright](https://studio.blender.org/projects/sprite-fright/), [Sintel](https://studio.blender.org/projects/sintel/), [Caminandes: Llamigos](https://studio.blender.org/projects/caminandes-3/), [Spring](https://studio.blender.org/projects/spring/), [Big Buck Bunny](https://studio.blender.org/projects/big-buck-bunny/) |

Movie files and artwork are served by the respective rights holders. Embedded trailers and most open films use YouTube's official privacy-enhanced player. Commercial playback opens the provider. Each film card links to its source and credits. Blender publishes terms for each open movie in the project credits, project pages, or in the film.

The cinema library has 17 Blender Open Movies, 19 animated shorts, and 12 studio trailers. The National Film Board of Canada shorts use the NFB’s own player. Studio trailers use official uploads. Film art, viewing links, and credits lead to the rights holders or authorized viewing providers. [Blender Studio Projects](https://studio.blender.org/projects/) · [National Film Board of Canada](https://www.nfb.ca/) · [Pixar Films](https://www.pixar.com/feature-films) · [DreamWorks Movies](https://www.dreamworks.com/movies)

## Music library

The chart lyrics catalog contains 550 distinct songs from the Billboard Hot 100 and Apple Music national Top Songs charts dated November 21, 2026. Each row displays the rank on its source chart. The Watch lyrics view includes 42 verified official uploads that show lyrics on screen, played through YouTube’s embedded player. Other rows link to a title-and-artist lyric video search on YouTube. Apple Music may require sign-in or a subscription to show song lyrics. [Billboard Hot 100](https://ca.billboard.com/charts/hot-100/2026-11-21) · [Apple Music chart feeds](https://rss.marketingtools.apple.com/)

The Music videos collection uses official artist and label uploads through YouTube’s embedded player.

## Creator library and search service

Creator imports use the official YouTube Data API and a site-restricted key entered by the user. The importer keeps public video metadata and finished creator catalogs in browser storage. It uses the key in memory during the request and clears the key field before the import begins. Import and export are also available as a local JSON file.

The optional connected search setting supports the previous endpoint format. On a search, it issues a GET with `q`, `safeSearch=strict`, and `videoEmbeddable=true`. The endpoint must return JSON in the form `{"items":[{"id":"a YouTube video ID","title":"Video title","creator":"Channel name"}]}`. Cross-origin endpoints need to permit browser requests from the deployed site. The static build includes local search and a link to search on YouTube. The connected search service and its credentials run separately.
