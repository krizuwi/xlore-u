# Google AdSense setup

Added 21 October 2026 using the owner's supplied publisher and responsive display-unit code.

## Verification and publisher script

- `index.html` includes `google-adsense-account` with `ca-pub-8222864305978009`.
- `public/ads.txt` authorizes `google.com, pub-8222864305978009, DIRECT, f08c47fec0942fa0`.
- These are public identifiers, not passwords or API secrets. Existing Search Console verification is preserved.
- At the owner's explicit request, the supplied async `adsbygoogle.js` publisher script is now included once in the HTML head, with `crossorigin="anonymous"`. The manual unit reuses it instead of injecting a duplicate.
- This global script loads on all SPA entry pages, including sign-in/account/admin pages and local/preview builds. It contacts Google regardless of the manual-unit switch. Keep Auto ads off in AdSense until placement and privacy/consent review are complete. This code does not enforce account-side Auto ads exclusions.

After deploying the frontend, check the actual HTML at `https://www.xloreu.com/` for the meta tag and the **plain text body** at `https://www.xloreu.com/ads.txt`. A 200 response with the SPA's HTML is not a working ads.txt file. Check the apex redirect too.

In AdSense, select the **AdSense code snippet**, **Meta tag** or **Ads.txt** verification method for `xloreu.com`, verify, then request review. The dashboard is the authority for review/approval status. Installing code is not approval, submission of review, or a guarantee of earnings.

## Responsive display ad (disabled by default)

The supplied slot `3234621623` is prepared in `HomepageAd.jsx`. It is a clearly labeled, single homepage placement before the assessment CTA, separate from navigation and school-card buttons. It uses the supplied `auto` format and full-width responsive setting. There are no timed refreshes or programmatic clicks. A failed/blocked script must not break the page.

The manual homepage unit requires **all** of:

- `VITE_ADSENSE_ENABLED=true` at build time (missing/false means no manual slot or blank space; it does not stop the global publisher script).
- A production build running on exactly `www.xloreu.com` or `xloreu.com`.
- The homepage `/` and no signed-in Xlore U account.

Localhost, preview URLs, login/signup, account pages, assessment/results, school-community feeds, institution editing and admin screens do not mount ad units. Once loaded on a public homepage, Google's script can remain in the browser document during SPA navigation; hiding the component does not erase third-party state or replace a consent system. Keep Auto ads off; this implementation does not configure Google account-side placements or Auto ads.

## Before switching on

1. Confirm site approval and completed owner/payment setup in AdSense. Do not use another person's identity or invent payment information.
2. Finish the existing draft Privacy Policy: real public contact, retention, safeguards for younger students, Google/partner advertising cookies and identifiers, data uses and third-party links/opt-outs. Do not treat the account agreement as ad consent or silently mark existing users as accepting new uses.
3. Configure and publish an appropriate consent solution in AdSense **Privacy & messaging**. Review Google's certified CMP requirements for EEA/UK/Switzerland visitors and other regional obligations. This code does not itself implement a CMP, age check, or consent handling; an environment switch is not consent.
4. Review the school's copyrighted images/descriptions, original content quality and public pages against AdSense policies. Do not put ads beside unmoderated student comments or private data.
5. Enable only after these checks, rebuild and deploy; review placement using Google's tools without clicking live ads or generating automated impressions. Turn the flag off and redeploy to stop the manual unit. To stop all future publisher-script loads, also remove the HTML head snippet and review Auto ads settings. Existing browser tabs may need refreshing.

Never reward ad views/clicks, ask classmates to click, or use paid/prize-based traffic as an ad-interaction scheme. Organic use and genuine engagement are separate from ad clicks.

References: [site connection](https://support.google.com/adsense/answer/7584263?hl=en), [ads.txt](https://support.google.com/adsense/answer/12171612?hl=en), [responsive tags](https://support.google.com/adsense/answer/9183460?hl=en), [privacy disclosures](https://support.google.com/adsense/answer/1348695?hl=en), [CMP requirements](https://support.google.com/adsense/answer/13554020?hl=en).
