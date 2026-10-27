# Sofa Factory Outlet — site capture for rebuild

Captured 2026-10-27 from https://www.sofafactoryoutlet.lk/

## What's here
| Path | Contents |
|---|---|
| `assets/brand/` | Logo (2560×740 PNG), site icon (512×512), trust badges, feature icons (SVG) |
| `download-images.ps1` | **Run this once** — pulls all 84 original images (~9.7 MB) into `assets/uploads/`, keeping WordPress's year/month folders |
| `data/products.json` / `products.csv` | All 35 products: name, slug, prices, categories, descriptions (HTML), attributes, image URLs |
| `data/categories.json` | 6 product categories |
| `data/pages.json` + `pages/*.html` | Content of the 6 WordPress pages (Home, About Us, Shop, Cart, Checkout, My account) |
| `data/media.json` | Media library index — URL, type, alt text, dimensions |

## Current stack (what you're replacing)
WordPress 6.9 · WooCommerce · **Woodmart** theme · Elementor + Elementor Pro · Click-to-Chat for WhatsApp.
The homepage is Elementor markup, so `pages/home.html` is noisy — treat it as a content source, not a template.

## Categories
| Name | Slug | Products |
|---|---|---|
| Beds | `beds` | 1 |
| Chair | `chair` | 7 |
| Ottoman | `ottoman` | 1 |
| Pillows | `pillows` | 1 |
| sofa | `sofa` | 22 |
| Table | `table` | 4 |

## Site map
Home · Shop · Categories (sofa, beds, table, chair, ottoman, pillows, coffee) · About Us · Cart · Checkout · My account (login/register/lost password) · Wishlist.
"Location", "offers" and "Contact us" in the menu all point to the same Google Maps share link — there is no real contact page yet.

## Homepage sections (top to bottom)
1. Animated headline — "Sri Lanka's Leading Furniture Brand"
2. Hero H1 — "Sofas in Sri Lanka | Factory Price Sofas"
3. Category tiles (7 square 1080×1080 PNGs: sofa, table, pillows, ottoman, coffee table, chair, beds)
4. "Shop Premium Sofas in Sri Lanka" — product grid
5. "Best Selling Sofa Collections" — L-Shape, Recliner, Sofa Sets, Fabric & Leather tiles
6. Featured products carousel
7. "What Our Customers Say" — testimonial carousel
8. Trust badges + feature icons, footer

## Design tokens (measured from the live page)
- **Brand accent:** maroon `#842323` (buttons/highlights)
- **Text:** `#333333` headings · `#767676` body · `#242424` dark
- **Neutrals:** `#FFFFFF`, `#E9E9E9`, `#CCD6DF` (borders), `#A5A5A5`
- **Fonts:** Lato (body, 400/600/900) · Poppins (headings/UI, 400–700) · Roboto (Elementor widgets)
- **Radius:** 12px · **Header:** 104px desktop / 60px mobile & sticky · top bar 42px
- Elementor's global colours (`#6EC1E4`, `#61CE70`) are leftover defaults and aren't really used.

## ⚠ Before reusing images in the new site
These files' names suggest they came from other brands' catalogues or stock sites rather than the client's own photography — check with the client before reusing them:
- `2025/09/91511e23f4da2af02ac826096bf61ee9.jpg`
- `2025/09/Slider_0_131267_bebitalia_table_Allure-O_09_3.jpg`
- `2025/09/Slider_0_145_project_office_AC-Executive_03_5.jpg`
- `2025/09/Slider_0_235335_bebitalia_sofa_Le-Bambole-22_32_1.jpg`
- `2025/09/Slider_0_308_bebitalia_sofa_Diesis-2024_01.jpg`
- `2025/09/Slider_0_322_bebitalia_chair_El_05_3.jpg`
- `2025/09/Slider_0_339_bebitalia_complement_Harry-Large_01_2.jpg`
- `2025/09/Slider_0_347_bebitalia_chair_Iuta-14_01_1.jpg`
- `2025/09/Slider_0_378_bebitalia_sofa_Naviglio_01_1.jpg`
- `2025/09/Slider_0_380_bebitalia_table_Oskar_01_3.jpg`
- `2025/09/Slider_0_384_bebitalia_complement_P60_02_4.jpg`
- `2025/09/Slider_0_401_bebitalia_table_Seven_01.jpg`
- `2025/09/Slider_0_418_bebitalia_sofa_Tufty-Too_01_4.jpg`
- `2025/09/Slider_0_444887_bebitalia_chair_Heri-O_06.jpg`
- `2025/09/Slider_0_444888_bebitalia_chair_Flair-O-Couture_04_1.jpg`
- `2025/09/Slider_0_53068_project_sofa_AC-Lounge_01_3.jpg`
- `2025/09/Slider_0_630677_bebitalia_modular-sofa_Dambodue_01_4.jpg`
- `2025/09/Slider_1_141_outdoor_complement_Tramae_02_1.jpg`
- `2025/09/Slider_1_53135_bebitalia_complement_Mirto-Indoor-1_01_1.jpg`
- `2025/09/Slider_2_299_bebitalia_sofa_Charles_09_5_6.jpg`
- `2025/09/Slider_4_298_bebitalia_sofa_Camaleonda_11_1.jpg`
- `2025/09/atkin-and-thyme-sloane-sofa-mustard-at2312_1.webp`

The feature icons (`*-svgrepo-com.svg`) and `pngtree-…` ribbon come from free icon/stock sites — check each one's licence, or swap in an icon set like Lucide.

## Data notes
- **34 of 35 products are priced LKR 0** (one is LKR 12,490) — the store mostly hides prices, so you'll need real prices from the client.
- Product descriptions are HTML in `products.json` (with SEO-style titles like "… | Furniture Colombo").
- 22 products have no category in the API response even though the "sofa" category reports 22 items — reassign categories when importing.
- `sofa.zip` (2.9 MB) is in the media library; the script downloads it too, but it isn't used on the site.
