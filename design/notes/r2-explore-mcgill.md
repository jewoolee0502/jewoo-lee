# R2 exploration: McGill mug prop and wordmark

Research date: 2026-10-19. Web sources only. Items marked UNCONFIRMED could not be verified.

## 1. Official McGill mugs

- The official McGill merchandise retailer is Le James (formerly the McGill Bookstore). Its drinkware page lists a "McGill Bistro Mug with Pewter Crest": ceramic, 15 oz, handcrafted pewter McGill crest, black or white body. Price $19.99 on the McGill Campus Store site.
  - https://mcgillcampusstore.ca/index.php/mcgill-bistro-mug-with-pewter-crest
  - https://www.lejames.mcgill.ca/drinkware
  - https://mcgillcampusstore.ca/drinkware
- The product copy mentions only the pewter crest on the body. It does not describe any printed wordmark text. Absence is not explicitly stated.
- NOT FOUND: a red McGill mug, a mug with the "McGill" wordmark printed on it, a mug with "UNIVERSITY", "1821" or "Montreal" text, and a tall/diner-style McGill mug. A "Montreal-themed mug" is mentioned in search results but its details were not fetched.
- Archive item: a 1914 McGill Science mug in McGill's archives (not retail): https://archivalcollections.library.mcgill.ca/index.php/mcgill-mug
- Third-party Etsy/Redbubble McGill mugs exist but are not official: https://www.redbubble.com/shop/mcgill+university+mugs

Implication: there is no official McGill-red, wordmark-printed mug to copy. A red mug with a wordmark would be a design invention, not a reproduction of an official product.

## 2. Wordmark typography and brand colours

Source: McGill Visual Identity Guide, https://www.mcgill.ca/visual-identity/visual-identity-guide

- Wordmark: "custom-designed" and "based on the Garamond typeface." The six letters are designed as a single image.
- The guide says it "is not possible to reproduce the wordmark with standard printing typefaces and other typefaces may not be substituted." It cannot be typed as a word.
- Usage rules: "Except in rare circumstances, it is always required to use the full logo rather than one or the other of its parts." The shield, wordmark and logo "must not be modified in any way."
- Clear space: at least 0.5x, where x is half the shield width.
- Minimum sizes: shield not under 0.25 in wide; wordmark generally not under 1 in.
- Reverse (white wordmark) version is for red or dark backgrounds. Black version for monochrome/duotone.

McGill red (same guide, same URL):
- HEX #ed1b2f
- RGB 237 27 47
- CMYK 0 100 90 0
- Pantone Solid 185 (for one- or two-colour printing)
- Dark McGill red (secondary): HEX #9E0918, CMYK 0 100 90 40, RGB 158 9 24

Secondary colours are described as "not official" but "suggested" (full table in the guide). Examples: Black #000000, Cool grey #5D6770, Bright yellow #FFD400, Dark purple #673567.

Text typefaces (same guide):
- Official family: McGill Sans and McGill Serif (designed to be used interchangeably). These are not on Google Fonts and not published as web fonts in the sources found. The guide says to substitute Arial/Times New Roman (Windows) or Helvetica/Times (macOS) when McGill typefaces are unavailable.
- Web body text minimum 16 px.

Not confirmed: the exact name of the serif wordmark font ("McGill Serif" is only referred to indirectly), and whether a font named exactly that is distributed publicly.

## 3. Freely licensed font candidates (Google Fonts)

Basis: the wordmark is documented as Garamond-based, so Garamond-family revivals are the closest match. The guide does not name a specific Garamond, and no source compares letterforms directly. Matching is therefore a reasoned inference, not a verified comparison.

1. EB Garamond (recommended first choice)
   - Google Fonts family name: "EB Garamond". Variable font with a wght axis; files EBGaramond[wght].ttf and EBGaramond-Italic[wght].ttf. License: OFL.txt (SIL Open Font License) per the google/fonts repo.
   - Based on Claude Garamont's mid-16th-century romans, scanned from the 1592 Berner specimen. Closest to a classical Garamond in a font the site can load.
   - Sources: https://fonts.google.com/specimen/EB+Garamond ; https://github.com/google/fonts/tree/main/ofl/ebgaramond ; description: https://raw.githubusercontent.com/google/fonts/main/ofl/ebgaramond/DESCRIPTION.en_us.html
   - Suggested use: weight 500 to 600, small caps via font-variant if needed.

2. Cormorant Garamond
   - Google Fonts family name: "Cormorant Garamond". Variable font with wght axis; OFL.txt per the google/fonts repo.
   - Higher contrast and more delicate than EB Garamond, with a smaller x-height. Could read as too thin at mug size, but may suit a high-contrast logo look better. Weights to try: 600 to 700.
   - Sources: https://fonts.google.com/specimen/Cormorant+Garamond ; https://github.com/google/fonts/tree/main/ofl/cormorantgaramond

3. Not yet fetched (fallback only): Crimson Pro or Cardo, not verified here. Do not use without checking their specimen and license pages.

Caveats: the page fetch did not show the OFL copyright line or the full description for Cormorant Garamond, so its design history is not confirmed here. Neither candidate was rendered next to the McGill wordmark, so visual match is UNCONFIRMED until a side-by-side check.

## 4. Logo artwork (SVG) availability and terms

- No official SVG download was confirmed. The mcgill.ca pages describe logos and fonts as available for download, but list no file formats (SVG, EPS, PNG not named).
  - https://mcgill.ca/graphic-design/clients/get-mcgill-assets : says the site "provides faculty and staff with downloadable resources such as McGill logos, fonts, and branded templates" and mentions requests for third-party logo use. It gives no formats or terms.
  - The Visual Identity Guide says there is a "Download a logo" page with "various formats and versions," but the guide does not specify formats or licence terms.
- Faculty and staff can download; others must submit a permission form. Third-party use needs "written authorization" or a "written agreement" (Visual Identity Guide). The governing document is the McGill Trademark Policy (not read in full here).
- Third-party site logotyp.us lists an SVG/PNG, but it is unofficial and says commercial use should be verified with McGill. Not usable as a source.

## Recommendations and risks for the prop

- Do not retype or use the wordmark as a logo. The guide prohibits reproducing it in standard typefaces, and says the logo must not be modified.
- A "McGill" text on a red mug in EB Garamond would be a stylised lookalike of a trademark, not an official asset. Since third-party use of McGill marks needs written permission (per the guide and Trademark Policy), this is a point to decide with the user before building it. The user asked for the same font and style, so this needs an explicit yes/no from the user, or a non-trademark alternative (e.g. generic "University" text, or a plain mug).
- If the user wants the real artwork, the route is to submit the McGill permission form, not to scrape a logo.
- Open questions for the user (per their memory preference to ask rather than guess): (a) keep a red mug with a McGill lookalike wordmark even though no official red mug exists, or use the official black/white bistro design; (b) accept a Garamond lookalike rather than the real wordmark artwork.
