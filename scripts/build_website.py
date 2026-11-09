"""Writes the FinSight website pages from one shared header, footer and sign-up band.
Edit the text here, then run from the repo root: python scripts/build_website.py website
styles.css, site.js and img/ in website/ are edited directly."""
import sys, pathlib

OUT = pathlib.Path(sys.argv[1])

LOGO = '<img class="brand-mark" src="img/logo.png" width="34" height="34" alt="">'
ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
NAV = [('how-it-works.html', 'How it works'), ('features.html', 'Features'), ('privacy.html', 'Privacy'), ('faq.html', 'FAQ')]
ARROW_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M8 7h9v9"/></svg>'

# Store links. Until the app is live they point to the waitlist and say "coming soon".
# When FinSight is on Google Play, put the listing URL here and change the label.
PLAY_URL = ''
APPSTORE_URL = ''
PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#00D7FE" d="M3.6 2.2c-.3.3-.4.7-.4 1.3v17c0 .6.1 1 .4 1.3l9.5-9.8z"/><path fill="#FFCE00" d="M16.3 15.2L13.1 12l3.2-3.2 3.8 2.2c1.1.6 1.1 1.6 0 2.2z"/><path fill="#FF3A44" d="M16.3 15.2L13.1 12l-9.5 9.8c.4.4.9.4 1.6.1z"/><path fill="#00F076" d="M16.3 8.8L5.2 2.1c-.7-.4-1.2-.3-1.6.1l9.5 9.8z"/></svg>'
APPLE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.72-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.75.73 1.05 1.6 2.24 2.73 2.2 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.32-3.5zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.68-.92 2.67.97.08 1.96-.49 2.56-1.22z"/></svg>'


def store(url, icon, small, big):
    href = url or '#join'
    return f'<a class="store" href="{href}">{icon}<span><small>{small}</small><b>{big}</b></span></a>'


STORES = ('<div class="stores">'
          + store(PLAY_URL, PLAY_ICON, 'Get it on' if PLAY_URL else 'Coming soon on', 'Google Play')
          + store(APPSTORE_URL, APPLE_ICON, 'Download on the' if APPSTORE_URL else 'Coming later on', 'App Store')
          + '</div>')

# Social accounts. Leave a URL empty until the account exists; it then shows as "coming soon".
SOCIAL = [
    ('X', '', '<path d="M4 4l16 16M20 4L4 20" stroke-width="2.2"/>'),
    ('Instagram', '', '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".6" fill="currentColor"/>'),
    ('TikTok', '', '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.4 2.6 2.2 4.4 5 4.6"/>'),
    ('Facebook', '', '<path d="M14.5 8H17V4.5h-2.5A4 4 0 0 0 10.5 8.5V11H8v3.5h2.5V21H14v-6.5h2.6l.4-3.5h-3v-2a1 1 0 0 1 1-1z"/>'),
    ('YouTube', '', '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10.5 9.5v5l4-2.5z" fill="currentColor"/>'),
    ('LinkedIn', '', '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>'),
]


def socials():
    out = []
    for name, url, glyph in SOCIAL:
        svg = f'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{glyph}</svg>'
        if url:
            out.append(f'<a class="social" href="{url}" rel="noopener" target="_blank" aria-label="FinSight on {name}">{svg}</a>')
        else:
            out.append(f'<span class="social soon" title="{name}: coming soon" aria-label="{name}: coming soon" role="img">{svg}</span>')
    return ''.join(out)


# The site's public address. Change this when FinSight gets its own domain, then rebuild.
SITE = 'https://finsight-ng-ten.vercel.app'
PAGES = []  # filled by page(); used for sitemap.xml


def page(file, title, description, body, current=None, index=True):
    url = SITE + '/' + ('' if file == 'index.html' else file)
    if index:
        PAGES.append(url)
    # The 404 page can be shown at any path, so its relative links resolve from the site root.
    robots = '' if index else '\n  <meta name="robots" content="noindex">\n  <base href="/">'

    links = '\n'.join(
        f'      <a href="{href}"{" aria-current=\"page\"" if href == current else ""}>{label}</a>' for href, label in NAV)
    join_href = '#join' if file == 'index.html' else 'index.html#join'
    html = f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <meta name="description" content="{description}">
  <meta name="theme-color" content="#120A11">
  <link rel="canonical" href="{url}">{robots}
  <meta property="og:site_name" content="FinSight">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{description}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{SITE}/img/og.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="FinSight: know where your money goes">
  <meta property="og:locale" content="en_NG">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title}">
  <meta name="twitter:description" content="{description}">
  <meta name="twitter:image" content="{SITE}/img/og.jpg">
  <link rel="icon" href="favicon-64.png" type="image/png" sizes="64x64">
  <link rel="apple-touch-icon" href="apple-touch-icon.png">
  <link rel="preload" href="fonts/PlusJakartaSans-400.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="fonts/ClashDisplay-600.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>

<header class="site-header">
  <div class="wrap">
    <a class="brand" href="./" aria-label="FinSight home">{LOGO}FinSight</a>
    <button class="menu-btn" type="button" aria-label="Menu" aria-expanded="false" aria-controls="nav"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
    <nav class="nav" id="nav" aria-label="Main">
{links}
      <a class="btn" href="#download">Get the app</a>
    </nav>
  </div>
</header>

<main id="main">
{body}
</main>

<footer class="site-footer">
  <img class="footer-mark" src="img/mark.webp" alt="" aria-hidden="true" width="480" height="382">
  <div class="wrap">
    <div class="footer-top">
      <div class="footer-lead">
        <p class="footer-tagline">Know where your money goes, before it's gone.</p>
        <form class="waitlist footer-form" id="join" data-waitlist novalidate>
          <label class="hp" aria-hidden="true">Leave this empty <input type="text" name="company" tabindex="-1" autocomplete="off"></label>
          <input type="email" name="email" placeholder="Email address" autocomplete="email" required aria-label="Email address">
          <button class="btn" type="submit">Join the waitlist {ARROW_UP}</button>
        </form>
        <p class="form-msg" role="status" aria-live="polite"></p>
        {STORES}
      </div>
      <nav class="footer-cols" aria-label="Footer">
        <div><h2>Product</h2><a href="how-it-works.html">How it works</a><a href="features.html">Features</a><a href="#download">Get the app</a></div>
        <div><h2>Help</h2><a href="faq.html">FAQs</a><a href="delete-account.html">Delete your account</a></div>
        <div><h2>Legal</h2><a href="privacy.html">Privacy notice</a></div>
      </nav>
    </div>
    <div class="footer-bottom">
      <p>© <span data-year>2026</span> Nerdolek. FinSight is built by Nerdolek.<br>All rights reserved.</p>
      <div class="socials">{socials()}</div>
    </div>
  </div>
</footer>

<script src="site.js" defer></script>
</body>
</html>
'''
    (OUT / file).write_text(html, encoding='utf-8', newline='\n')


def cta(heading='Get FinSight on your phone.', text="FinSight is coming to Google Play first, with iPhone to follow. Join the waitlist and we'll email you the day you can download it.", anchor=True):
    return f'''  <section{' id="download"' if anchor else ''}>
    <div class="wrap">
      <div class="cta-band" data-reveal>
        <span class="kicker">Get the app</span>
        <h2>{heading}</h2>
        <p>{text}</p>
        {STORES}
        <a class="btn btn-lg" href="#join" style="margin-top:28px">Join the waitlist {ARROW}</a>
      </div>
    </div>
  </section>'''


PHONE = '''<div class="phone-stage" aria-hidden="true">
          <div class="float-card float-a">
            <span class="scr-ico" style="background:#DDF6E8;color:#08603B">₦</span>
            <span><b>Salary received</b><small class="num">GTBank · +₦350,000</small></span>
          </div>
          <div class="phone">
            <i class="btn-power"></i><i class="btn-vol"></i>
            <div class="screen">
              <div class="scr-head">
                <div class="scr-status"><span>9:41</span><i class="island"></i><span class="sys"><i class="sig"><b></b><b></b><b></b><b></b></i><i class="bat"></i></span></div>
                <div class="scr-hi">Good morning, Tolu</div>
                <div class="scr-title">November</div>
              </div>
              <div class="scr-body">
                <div class="scr-card">
                  <div class="scr-label">Plan for your 25 Nov pay</div>
                  <div class="scr-big">₦142,800 <span style="font-size:13px;font-weight:500;color:#6A606B">free to spend</span></div>
                  <div class="scr-sub num">Of ₦350,000, after debts, budgets and savings · about ₦7,100 a day</div>
                  <div class="scr-bar"><span></span></div>
                </div>
                <div class="scr-card">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                    <b style="font-size:12.5px">New from your bank</b><span class="scr-pill">3 to check</span>
                  </div>
                  <div class="scr-row">
                    <span class="scr-ico" style="background:#FFEEDD;color:#A84607">F</span>
                    <span class="t"><b>Shoprite Lekki</b><small>Food · OPay</small></span>
                    <span class="scr-amt num">−₦18,450</span>
                  </div>
                  <div class="scr-row">
                    <span class="scr-ico" style="background:#FFE3EE;color:#A30E42">T</span>
                    <span class="t"><b>Bolt ride</b><small>Transport · Kuda</small></span>
                    <span class="scr-amt num">−₦3,200</span>
                  </div>
                  <div class="scr-row">
                    <span class="scr-ico" style="background:#DDF6E8;color:#08603B">I</span>
                    <span class="t"><b>Transfer from Ada</b><small>Income · Moniepoint</small></span>
                    <span class="scr-amt num in">+₦25,000</span>
                  </div>
                </div>
                <div class="scr-card">
                  <div class="scr-label">Food budget</div>
                  <div style="display:flex;justify-content:space-between;font-weight:700;font-variant-numeric:tabular-nums;margin-top:2px"><span>₦61,300 left</span><span style="color:#6A606B;font-weight:500">of ₦90,000</span></div>
                  <div class="scr-bar"><span style="width:32%;background:#0A7A4B"></span></div>
                </div>
              </div>
              <div class="scr-tabs">
                <span class="on"><svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/></svg>Home</span>
                <span><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>Activity</span>
                <span class="plus"><svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg></span>
                <span><svg viewBox="0 0 24 24"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>Plan</span>
                <span><svg viewBox="0 0 24 24"><path d="M4 17l6-6 4 4 6-7"/></svg>Grow</span>
              </div>
              <div class="home-bar"></div>
            </div>
          </div>
          <div class="float-card float-b">
            <span class="scr-ico" style="background:#FFE3EE;color:#A30E42">✦</span>
            <span><b>ARIA</b><small>You've spent ₦9,000 less on food than last month.</small></span>
          </div>
        </div>'''

SLIDES = [
    ('student', 'h1', 'Know where your money goes, <span class="grad">before it\'s gone.</span>',
     'FinSight turns the bank alerts already on your phone into budgets, savings and a plan for every pay. No typing. No bank login.'),
    ('professional', 'div', 'Payday to payday, <span class="grad">with a plan.</span>',
     "See what's free to spend after bills, debts and savings, and what that means for each day until your next pay."),
    ('trader', 'div', 'Your shop money, <span class="grad">kept apart.</span>',
     'Track sales, costs and who owes you, pay yourself, and set money aside for tax, without mixing it with personal spending.'),
]


def slides():
    out = []
    for i, (img, tag, head, sub) in enumerate(SLIDES):
        cls = ' class="h1"' if tag == 'div' else ''
        out.append(f'''        <div class="slide{' active' if i == 0 else ''}" role="group" aria-roledescription="slide" aria-label="{i + 1} of {len(SLIDES)}"{'' if i == 0 else ' aria-hidden="true"'}>
          <img src="img/{img}.webp" alt="" {'fetchpriority="high"' if i == 0 else 'loading="eager"'} width="1280" height="720">
          <div class="slide-copy">
            <span class="tag"><span class="dot"></span>Coming soon to Android</span>
            <{tag}{cls}>{head}</{tag}>
            <p>{sub}</p>
            <div class="hero-actions">
              <a class="btn btn-lg" href="#download"{'' if i == 0 else ' tabindex="-1"'}>Get the app {ARROW}</a>
              <a class="btn btn-lg btn-ghost" href="how-it-works.html"{'' if i == 0 else ' tabindex="-1"'}>How it works</a>
            </div>
          </div>
        </div>''')
    return '\n'.join(out)


BANKS = ['GTBank', 'Access Bank', 'OPay', 'PalmPay', 'Kuda', 'Moniepoint', 'Zenith Bank', 'First Bank', 'UBA', 'Wema Bank', 'Fidelity', 'Stanbic IBTC', 'Sterling', 'FCMB', 'Grey', 'Raenest', 'Payoneer', 'Wise']
bank_pills = ''.join(f'<span class="bank">{b}</span>' for b in BANKS)

# Feature icons: duotone (a soft filled shape plus a white line drawing) on a glossy colour tile.
# Each entry: (tone, svg). Shapes with class "f" are the soft fill.
ICONS = {
    'calendar': ('orange', '<rect class="f" x="3" y="5" width="18" height="16" rx="4"/><rect x="3" y="5" width="18" height="16" rx="4"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="8.5" cy="14.5" r="1.2" class="dot"/><circle cx="12" cy="14.5" r="1.2" class="dot"/><path d="M14.5 16.5l1.6 1.6 3-3.3"/>'),
    'budget': ('pink', '<path class="f" d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 2.5a7 7 0 0 1 6.5 6.5H15z" class="solid"/>'),
    'naira': ('green', '<rect class="f" x="2.5" y="6" width="19" height="12" rx="3"/><rect x="2.5" y="6" width="19" height="12" rx="3"/><path d="M9.5 15V9l5 6V9M8 11h8M8 13h8"/>'),
    'spark': ('violet', '<path class="f" d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/><path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/><path d="M19 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" class="solid"/>'),
    'shop': ('gold', '<path class="f" d="M4 10h16v10H4z"/><path d="M3 10l1.6-5h14.8L21 10"/><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12v8h14v-8M10 20v-5h4v5"/>'),
    'globe': ('blue', '<circle class="f" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
    'chart': ('teal', '<rect class="f" x="3" y="3" width="18" height="18" rx="4"/><path d="M7 17v-3M12 17V9M17 17V6"/><path d="M6 11l4-3 3 2 5-4" class="thin"/>'),
    'doc': ('indigo', '<path class="f" d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
    'bell': ('amber', '<path class="f" d="M6 9a6 6 0 1 1 12 0c0 6.5 2.5 8.5 2.5 8.5h-17S6 15.5 6 9z"/><path d="M6 9a6 6 0 1 1 12 0c0 6.5 2.5 8.5 2.5 8.5h-17S6 15.5 6 9z"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/><circle cx="18" cy="5" r="2.6" class="badge"/>'),
    'mic': ('rose', '<rect class="f" x="8.5" y="2.5" width="7" height="12" rx="3.5"/><rect x="8.5" y="2.5" width="7" height="12" rx="3.5"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5M9 21.5h6"/>'),
    'check': ('green', '<circle class="f" cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16.5 9"/>'),
}


def tile(name):
    tone, glyph = ICONS[name]
    return (f'<div class="tile tile-{tone}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{glyph}</svg></div>')


def link_card(href, title, text, go, img):
    return f'''        <a class="link-card" href="{href}" data-reveal>
          <div class="lc-img"><img src="img/{img}.webp" alt="" width="840" height="560" loading="lazy"></div>
          <div class="lc-body">
            <h3>{title}</h3>
            <p>{text}</p>
            <span class="go">{go} {ARROW}</span>
          </div>
        </a>'''


# ── Home ────────────────────────────────────────────────────────────
home = f'''  <div class="hero">
    <div class="wrap">
      <div class="slider" aria-roledescription="carousel" aria-label="FinSight highlights" style="--slide-ms:7000ms">
{slides()}
        <div class="slider-ui">
          <div class="dots" role="tablist" aria-label="Choose a slide"></div>
          <div class="slide-arrows">
            <button type="button" data-prev aria-label="Previous slide"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button>
            <button type="button" data-next aria-label="Next slide"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="strip">
    <div class="wrap">
      <p class="label">Reads alerts from <strong>25+ Nigerian banks and money apps</strong></p>
      <div class="marquee" aria-label="Supported banks include GTBank, Access Bank, OPay, PalmPay, Kuda, Moniepoint and more">
        <div class="marquee-track" aria-hidden="true">{bank_pills}{bank_pills}</div>
      </div>
    </div>
  </div>

  <section>
    <div class="wrap split">
      <div class="copy" data-reveal>
        <span class="kicker">Your money, sorted</span>
        <h2>Your bank already tells you everything.</h2>
        <p>Every debit and credit sends you an alert. FinSight reads those alerts on your phone, sorts them into food, transport, bills and more, and keeps your budgets and pay plan up to date.</p>
        <a class="btn btn-lg" href="how-it-works.html">See how it works {ARROW}</a>
      </div>
      <div data-reveal>
        {PHONE}
      </div>
    </div>
  </section>

  <section style="padding-top:0">
    <div class="wrap">
      <div class="cards">
{link_card('features.html', 'Everything inside', 'Pay plans, budgets, savings, debts, business money, dollars and ARIA, your money assistant.', 'See the features', 'card-features')}
{link_card('privacy.html', 'Private by design', "Your money data stays on your phone. No bank login, no ads, and FinSight can't move your money.", 'How we handle data', 'card-privacy')}
{link_card('faq.html', 'Questions answered', 'Which banks work, what happens when you change phones, and why Android comes first.', 'Read the FAQ', 'card-faq')}
      </div>
    </div>
  </section>

{cta(anchor=True)}'''
page('index.html', 'FinSight · Know where your money goes',
     'FinSight reads your bank alerts on your phone, so your spending, budgets and next pay plan stay up to date without typing. Built for Nigeria. Your data stays on your phone.',
     home)

# ── How it works ────────────────────────────────────────────────────
# Phone screens for the three "How it works" steps. Sample data only.
STATUS_DARK = '<div class="scr-status dark"><span>9:41</span><i class="island"></i><span class="sys"><i class="sig"><b></b><b></b><b></b><b></b></i><i class="bat"></i></span></div>'

SCREEN_ALLOW = f'''<div class="screen light">
              {STATUS_DARK}
              <div class="sheet-dim"></div>
              <div class="sheet">
                <i class="grab"></i>
                <b class="sheet-title">Allow FinSight to read bank alerts?</b>
                <p class="sheet-intro">FinSight can add transactions from your bank's notifications, so you don't have to type them.</p>
                <div class="sheet-pt"><b>What FinSight reads</b><span>Alerts from bank and money apps, and SMS from bank sender names. Everything else is ignored.</span></div>
                <div class="sheet-pt"><b>Is it shared?</b><span>No. Alert text never leaves your phone.</span></div>
                <div class="sheet-pt"><b>You stay in control</b><span>Turn it off any time.</span></div>
                <span class="m-btn">I agree, open phone settings</span>
                <span class="m-btn ghost">Not now</span>
              </div>
            </div>'''

SCREEN_CHECK = f'''<div class="screen">
              <div class="notif">
                <span class="n-ico">GT</span>
                <span class="n-txt"><b>GTBank <small>now</small></b><span>Debit: NGN18,450.00 POS Shoprite Lekki. Bal: NGN**,***</span></span>
              </div>
              <div class="scr-head short">
                {STATUS_DARK.replace(' dark', '')}
                <div class="scr-title" style="margin-top:12px">Home</div>
              </div>
              <div class="scr-body">
                <div class="scr-card">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                    <b style="font-size:12.5px">New from your bank</b><span class="scr-pill">1 to check</span>
                  </div>
                  <div class="scr-row">
                    <span class="scr-ico" style="background:#FFEEDD;color:#A84607">F</span>
                    <span class="t"><b>Shoprite Lekki</b><small>GTBank · just now</small></span>
                    <span class="scr-amt num">−₦18,450</span>
                  </div>
                  <div class="cat-row"><span class="chip on">Food</span><span class="chip">Shopping</span><span class="chip">Other</span></div>
                  <span class="m-btn sm">Confirm</span>
                </div>
                <div class="scr-card">
                  <div class="scr-label">Food budget</div>
                  <div style="display:flex;justify-content:space-between;font-weight:700;margin-top:2px"><span>₦61,300 left</span><span style="color:#6A606B;font-weight:500">of ₦90,000</span></div>
                  <div class="scr-bar"><span style="width:32%;background:#0A7A4B"></span></div>
                </div>
              </div>
            </div>'''

SCREEN_PLAN = f'''<div class="screen">
              <div class="scr-head">
                {STATUS_DARK.replace(' dark', '')}
                <div class="scr-hi">Good evening, Tolu</div>
                <div class="scr-title">Plan</div>
              </div>
              <div class="scr-body">
                <div class="scr-card">
                  <div class="scr-label">Plan for your 25 Nov pay</div>
                  <div class="scr-big">₦142,800 <span style="font-size:13px;font-weight:500;color:#6A606B">free to spend</span></div>
                  <div class="scr-sub num">About ₦7,100 a day for 20 days</div>
                  <div class="scr-bar"><span></span></div>
                </div>
                <div class="scr-card chat-card">
                  <div class="m-bubble me">How my money dey this month?</div>
                  <div class="m-bubble aria"><b>ARIA</b>You dey okay! You get ₦142,800 to spend till payday, about ₦7,100 a day. Food don use 68% of im budget.</div>
                </div>
              </div>
            </div>'''


def mode_card(img, title, text, chip):
    return f'''        <div class="mode" data-reveal>
          <div class="mode-img"><img src="img/mode-{img}.webp" alt="" width="560" height="700" loading="lazy"><span class="mode-chip" aria-hidden="true">{chip}</span></div>
          <div class="mode-body"><b>{title}</b><span>{text}</span></div>
        </div>'''


def zig_step(n, title, text, screen, flip=False):
    return f'''        <div class="zig-row{' flip' if flip else ''}">
          <div class="zig-copy" data-reveal><span class="n">{n}</span><h3>{title}</h3><p>{text}</p></div>
          <div class="zig-phone" data-reveal aria-hidden="true">
            <div class="phone mini">
              <i class="btn-power"></i><i class="btn-vol"></i>
              {screen}
            </div>
          </div>
        </div>'''


how = f'''  <div class="page-hero">
    <div class="wrap">
      <span class="kicker">How it works</span>
      <h1>Three steps. Then it runs itself.</h1>
      <p>FinSight works from the alerts your bank already sends to your phone. You never give it a bank login, and it never moves your money.</p>
    </div>
  </div>

  <section style="padding-top:56px">
    <div class="wrap">
      <h2 class="sr-only">The three steps</h2>
      <div class="zig">
{zig_step('01', 'Allow bank alerts', 'Turn on alert reading once in Settings. FinSight explains exactly what it reads before Android asks you. It only looks at notifications from bank and money apps, and SMS from bank sender names. Everything else is ignored and never kept.', SCREEN_ALLOW)}
{zig_step('02', 'Check each one', 'New transactions wait under "New from your bank", with the amount, whether money came in or went out, and a category already picked. Confirm with a tap, or change the category. Adverts from your bank are filtered out.', SCREEN_CHECK, flip=True)}
{zig_step('03', 'See your plan', "Budgets, savings goals, debts and what's free to spend until your next pay update as you go. ARIA can answer questions about it in English, Pidgin, Yoruba, Hausa or Igbo.", SCREEN_PLAN)}
      </div>
    </div>
  </section>

  <section style="padding-top:0">
    <div class="wrap split">
      <div data-reveal>
        {PHONE}
      </div>
      <div class="copy" data-reveal>
        <span class="kicker">No alerts? No problem</span>
        <h2>Other ways to add money in and out.</h2>
        <p>If your bank isn't supported yet, or you paid cash, add a transaction in seconds, say it out loud, or import a bank statement to bring in the past few months at once.</p>
        <a class="btn btn-lg btn-ghost" href="features.html">See all features {ARROW}</a>
      </div>
    </div>
  </section>

{cta()}'''
page('how-it-works.html', 'How it works · FinSight',
     'Allow bank alerts, check each one, and see your plan. FinSight works from the alerts your bank already sends, with no bank login.',
     how, 'how-it-works.html')

# ── Features ────────────────────────────────────────────────────────
feat = f'''  <div class="page-hero">
    <div class="wrap">
      <span class="kicker">Features</span>
      <h1>Everything to stay ahead of the month.</h1>
      <p>Built for how money really moves in Nigeria: transfers, POS, cash, side businesses, and salaries that don't always land on the same day.</p>
    </div>
  </div>

  <section style="padding-top:56px">
    <div class="wrap">
      <h2 class="sr-only">All features</h2>
      <div class="feature-grid">
        <div class="feature" data-reveal>{tile('calendar')}<h3>A plan for every pay</h3><p>Paid monthly, twice a month or when it varies? FinSight works out what's free to spend after debts, bills and savings, and what that means each day.</p></div>
        <div class="feature" data-reveal>{tile('budget')}<h3>Budgets that keep up</h3><p>Set a limit for food, transport or data. Spending from your alerts counts against it straight away, with a heads-up before you run out.</p></div>
        <div class="feature" data-reveal>{tile('naira')}<h3>Savings and debts</h3><p>Track goals like rent or a new laptop, and loans with a repayment calculator that shows the real cost, reducing or flat interest.</p></div>
        <div class="feature wide" data-reveal>
          <div>{tile('spark')}<h3>Ask ARIA, in your language</h3><p>ARIA is FinSight's money assistant. Ask anything about your spending and get a straight answer based on your own numbers.</p>
            <div class="langs"><span>English</span><span>Pidgin</span><span>Yoruba</span><span>Hausa</span><span>Igbo</span></div>
          </div>
          <div class="chat" aria-label="Example conversation with ARIA">
            <div class="bubble me">Abeg, how much I don spend for transport this month?</div>
            <div class="bubble aria">You don spend ₦27,400 for transport so far, ₦4,100 pass last month. Na Bolt carry most of am.</div>
          </div>
        </div>
        <div class="feature" data-reveal>{tile('shop')}<h3>Business and personal, apart</h3><p>See profit, pay yourself, record cash sales, track who owes you and set money aside for tax, without mixing it with personal spending.</p></div>
        <div class="feature" data-reveal>{tile('globe')}<h3>Dollars and pounds too</h3><p>Paid through Grey, Raenest, Payoneer or Wise? Each amount keeps its own currency with that day's rate, or your own rate.</p></div>
        <div class="feature" data-reveal>{tile('chart')}<h3>Your FinScore</h3><p>One number for how your money is doing, with a plain explanation of what moves it. Fair even if your income isn't regular.</p></div>
        <div class="feature" data-reveal>{tile('doc')}<h3>Import a statement</h3><p>Bring in a bank statement and FinSight sorts the past few months, so your budgets start with real numbers.</p></div>
        <div class="feature" data-reveal>{tile('bell')}<h3>Reminders that help</h3><p>Bills coming up, money people owe you, and a short weekly summary of how the week went.</p></div>
        <div class="feature" data-reveal>{tile('mic')}<h3>Say it, it's added</h3><p>Paid cash? Tap the microphone and say what you spent. FinSight fills it in for you to check.</p></div>
      </div>
    </div>
  </section>

  <section style="padding-top:0">
    <div class="wrap">
      <div class="section-head" data-reveal>
        <span class="kicker">Made for how you earn</span>
        <h2>Salary, side hustle or both.</h2>
        <p>Tell FinSight how you use your money and it shapes Home around you.</p>
      </div>
      <div class="modes">
{mode_card('salary', 'Salary', 'A plan from payday to payday, with bills and savings taken out first.', '<small>Until payday</small><b class="num">₦7,100 a day</b>')}
{mode_card('business', 'Business', 'Sales, costs and profit, with your own pay kept separate.', '<small>Profit this month</small><b class="num pos">₦86,500</b>')}
{mode_card('both', 'Both', 'Your job and your business side by side, never mixed up.', '<span class="pair"><span><small>Job</small><b class="num">₦280k</b></span><span><small>Shop</small><b class="num">₦64k</b></span></span>')}
{mode_card('tracking', 'Just tracking', 'No income set up needed. See where your money goes.', '<small>Top spend · Food</small><b class="num">₦42,300</b>')}
      </div>
    </div>
  </section>

{cta()}'''
page('features.html', 'Features · FinSight',
     'Pay plans, budgets, savings, debts, business money, foreign currency, FinScore and ARIA, your money assistant in five languages.',
     feat, 'features.html')

# ── Privacy ─────────────────────────────────────────────────────────
POINTS = [
    ('Your money data stays on your phone', 'Transactions, budgets and goals are stored on your phone, encrypted.'),
    ('Bank alerts never leave it', 'Only if you allow it, and only from bank and money apps. Alert text is read on your phone and never sent anywhere.'),
    ('Backups only if you turn them on', 'With an account, a copy is kept with Google Firebase so you can restore it on another phone.'),
    ('AI only when you use it', 'Your ARIA question and a summary of your finances, or a statement you import, go to Anthropic to get the answer. Not kept by FinSight, and not used to train AI.'),
    ('Crash reports without personal details', 'Amounts, names and transactions are removed before a report is sent to Sentry.'),
    ('Never sold, no ads', "We don't sell your data, show ads, or share it with lenders. FinSight can't move your money."),
]
points = '\n'.join(f'        <div data-reveal><h3>{t}</h3><p>{d}</p></div>' for t, d in POINTS)
priv = f'''  <div class="page-hero">
    <div class="wrap">
      <span class="kicker">Privacy</span>
      <h1>Your money data stays on your phone.</h1>
      <p>FinSight never asks for your bank login, can't move your money and doesn't show ads. Here's how your information is handled, in plain words. The full privacy policy will be published here before launch.</p>
    </div>
  </div>

  <section style="padding-top:56px">
    <div class="wrap">
      <h2 class="sr-only">In short</h2>
      <div class="privacy-grid">
{points}
      </div>
      <div class="prose">
        <h2>The waitlist</h2>
        <p>If you join the waitlist on this website, we keep your email address only to tell you when FinSight is available. We don't share it, and you can ask us to remove it at any time.</p>
        <h2>Deleting your data</h2>
        <p>You can delete everything from inside the app. See <a href="delete-account.html">how to delete your account</a>.</p>
      </div>
    </div>
  </section>

{cta()}'''
page('privacy.html', 'Privacy · FinSight',
     'How FinSight handles your information: what stays on your phone, what is sent and why, and how to delete it.',
     priv, 'privacy.html')

# ── FAQ ─────────────────────────────────────────────────────────────
FAQS = [
    ('Do I need to give FinSight my bank login?', 'No. FinSight never asks for bank logins, PINs or card details. It works from the alerts your bank already sends to your phone.'),
    ('Which banks does it work with?', 'Alerts from over 25 Nigerian banks and money apps, including GTBank, Access, Zenith, First Bank, UBA, OPay, PalmPay, Kuda and Moniepoint, plus dollar accounts like Grey and Raenest. If yours is missing, you can still add transactions yourself or by voice.'),
    ('Can FinSight move or spend my money?', 'No. FinSight can only read and organise information. It has no way to make payments or transfers.'),
    ('Does it work on iPhone?', 'Not yet. FinSight launches on Android first, because reading bank alerts on the phone is only possible there.'),
    ('What happens if I change phones?', 'Turn on backups in Settings before you switch, then sign in on the new phone to restore. Without a backup, your data stays only on the old phone.'),
    ('Does it work if my income changes every month?', 'Yes. Choose "varies" as your pay schedule, or "just tracking" if you don\'t want to set up income at all. Your FinScore stays fair either way.'),
    ('I run a business. Will it mix my sales with my personal spending?', 'No. Business categories keep business money apart, so your personal budgets only count personal spending. You can see profit and pay yourself from the business.'),
]
faqs = '\n'.join(f'        <details data-reveal><summary>{q}</summary><p>{a}</p></details>' for q, a in FAQS)
faq = f'''  <div class="page-hero">
    <div class="wrap">
      <span class="kicker">FAQ</span>
      <h1>Good to know.</h1>
      <p>Short answers to what people ask most. Can't find yours? It will be answered here before launch.</p>
    </div>
  </div>

  <section style="padding-top:40px">
    <div class="wrap">
      <div class="faq">
{faqs}
      </div>
    </div>
  </section>

{cta()}'''
page('faq.html', 'FAQ · FinSight', 'Answers about bank logins, supported banks, safety, iPhone, changing phones and business money.', faq, 'faq.html')

# ── Delete account ──────────────────────────────────────────────────
delete = f'''  <div class="page-hero">
    <div class="wrap">
      <span class="kicker">Your data</span>
      <h1>Delete your FinSight account.</h1>
      <p>You can delete your account and your data yourself, at any time, from inside the app.</p>
    </div>
  </div>

  <section style="padding-top:32px">
    <div class="wrap prose">
      <h2>Delete your account and backup</h2>
      <ol>
        <li>Open FinSight and unlock it.</li>
        <li>Go to <strong>Settings</strong>, then <strong>Cloud backup</strong>.</li>
        <li>Tap <strong>Delete account</strong>, enter your password and confirm.</li>
      </ol>
      <p>This removes your account, your profile and the backup copy kept with Google Firebase. It can't be undone. If you never turned on cloud backup, there is no account to delete.</p>

      <h2>Clear everything on your phone</h2>
      <p>In <strong>Settings</strong>, tap <strong>Delete everything</strong> to remove all transactions, budgets, goals and settings stored on your phone. Uninstalling the app also removes them.</p>

      <h2>What is deleted, and what isn't</h2>
      <ul>
        <li><strong>Deleted straight away:</strong> your account, your backup, and everything stored on your phone.</li>
        <li><strong>Not kept in the first place:</strong> bank alert text (it never leaves your phone) and ARIA conversations (FinSight doesn't store them).</li>
        <li><strong>Crash reports</strong> contain no personal details and are deleted automatically by Sentry within 90 days.</li>
      </ul>

      <h2>Can't open the app?</h2>
      <p class="note">If you no longer have the app or the phone, email us from the address on your account and we'll delete it for you. <strong>The address will be added here before launch.</strong></p>
    </div>
  </section>

{cta()}'''
page('delete-account.html', 'Delete your account · FinSight', 'How to delete your FinSight account and the data kept with it.', delete)

# ── 404 ─────────────────────────────────────────────────────────────
notfound = f'''  <div class="page-hero" style="padding-bottom:120px">
    <div class="wrap">
      <span class="kicker">Page not found</span>
      <h1>This page has gone missing.</h1>
      <p>The link may be old or mistyped. Everything else is where you left it.</p>
      <div class="hero-actions" style="margin-top:32px">
        <a class="btn btn-lg" href="/">Go to the home page {ARROW}</a>
        <a class="btn btn-lg btn-ghost" href="/faq.html">Read the FAQ</a>
      </div>
    </div>
  </div>'''
page('404.html', 'Page not found · FinSight', 'This page could not be found.', notfound, index=False)

# ── Sitemap and robots ──────────────────────────────────────────────
NL = '\n'
sitemap = ('<?xml version="1.0" encoding="UTF-8"?>' + NL
           + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + NL
           + ''.join(f'  <url><loc>{u}</loc></url>{NL}' for u in PAGES)
           + '</urlset>' + NL)
(OUT / 'sitemap.xml').write_text(sitemap, encoding='utf-8', newline=NL)
(OUT / 'robots.txt').write_text(f'User-agent: *{NL}Allow: /{NL}{NL}Sitemap: {SITE}/sitemap.xml{NL}', encoding='utf-8', newline=NL)

print('ok')
