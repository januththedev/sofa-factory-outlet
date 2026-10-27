# Downloads every original image from sofafactoryoutlet.lk into .\assets\uploads
# Run: right-click > Run with PowerShell  (or: powershell -ExecutionPolicy Bypass -File .\download-images.ps1)
# Add -NoPause to skip the closing prompt when running from a terminal or script.
param([switch]$NoPause)
$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$base = 'https://www.sofafactoryoutlet.lk/wp-content/uploads/'
$root = Join-Path $PSScriptRoot 'assets\uploads'
$files = @(
  '2025/09/1-scaled.jpg',
  '2025/09/1.png',
  '2025/09/2-scaled.jpg',
  '2025/09/2.png',
  '2025/09/3-scaled.jpg',
  '2025/09/3.png',
  '2025/09/4.png',
  '2025/09/5.png',
  '2025/09/6.png',
  '2025/09/7.png',
  '2025/09/91511e23f4da2af02ac826096bf61ee9.jpg',
  '2025/09/Mr.Amzar-Logo-Vector-file.ai_-1-scaled.png',
  '2025/09/Slider_0_131267_bebitalia_table_Allure-O_09_3.jpg',
  '2025/09/Slider_0_145_project_office_AC-Executive_03_5.jpg',
  '2025/09/Slider_0_235335_bebitalia_sofa_Le-Bambole-22_32_1.jpg',
  '2025/09/Slider_0_308_bebitalia_sofa_Diesis-2024_01.jpg',
  '2025/09/Slider_0_322_bebitalia_chair_El_05_3.jpg',
  '2025/09/Slider_0_339_bebitalia_complement_Harry-Large_01_2.jpg',
  '2025/09/Slider_0_347_bebitalia_chair_Iuta-14_01_1.jpg',
  '2025/09/Slider_0_378_bebitalia_sofa_Naviglio_01_1.jpg',
  '2025/09/Slider_0_380_bebitalia_table_Oskar_01_3.jpg',
  '2025/09/Slider_0_384_bebitalia_complement_P60_02_4.jpg',
  '2025/09/Slider_0_401_bebitalia_table_Seven_01.jpg',
  '2025/09/Slider_0_418_bebitalia_sofa_Tufty-Too_01_4.jpg',
  '2025/09/Slider_0_444887_bebitalia_chair_Heri-O_06.jpg',
  '2025/09/Slider_0_444888_bebitalia_chair_Flair-O-Couture_04_1.jpg',
  '2025/09/Slider_0_53068_project_sofa_AC-Lounge_01_3.jpg',
  '2025/09/Slider_0_630677_bebitalia_modular-sofa_Dambodue_01_4.jpg',
  '2025/09/Slider_1_141_outdoor_complement_Tramae_02_1.jpg',
  '2025/09/Slider_1_53135_bebitalia_complement_Mirto-Indoor-1_01_1.jpg',
  '2025/09/Slider_2_299_bebitalia_sofa_Charles_09_5_6.jpg',
  '2025/09/Slider_4_298_bebitalia_sofa_Camaleonda_11_1.jpg',
  '2025/09/atkin-and-thyme-sloane-sofa-mustard-at2312_1.webp',
  '2025/09/cropped-Mr.Amzar-Logo-Vector-file.ai_-1-scaled-1.png',
  '2025/09/product-jpeg-500x500-1.webp',
  '2025/09/sofa.zip',
  '2025/11/10_f49e7f19-338a-44d2-8241-028e3d547384.webp',
  '2025/11/15_5d45b1ef-e68f-484e-a739-5f8921881b9a.webp',
  '2025/11/1_57362730-7d6a-437c-a365-19aeb0f84362.webp',
  '2025/11/20241203-113830-1.webp',
  '2025/11/20241203-113830.webp',
  '2025/11/Fabric-Leather-Sofas.png',
  '2025/11/L-Shape-Sofas.png',
  '2025/11/Recliner-Sofas.png',
  '2025/11/SKU-17_459fa133-14c0-4146-9788-6ff75a12a196-1-1.webp',
  '2025/11/SKU-17_459fa133-14c0-4146-9788-6ff75a12a196-1.webp',
  '2025/11/SKU-17_459fa133-14c0-4146-9788-6ff75a12a196.webp',
  '2025/11/Sofa-Sets.png',
  '2025/11/dart-mission-goal-success-svgrepo-com.svg',
  '2025/11/free-delivery-free-svgrepo-com.svg',
  '2025/11/high-quality-svgrepo-com.svg',
  '2025/11/money-svgrepo-com.svg',
  '2025/11/pngtree-best-quality-ribbon-labels-vector-png-image_7353589.png',
  '2025/11/rocket-filled-svgrepo-com.svg',
  '2025/11/rocket-svgrepo-com.svg',
  '2025/11/shoplook01-scaled.jpg',
  '2025/11/shoplook03-scaled.jpg',
  '2025/11/sofa-premium-quality-materials-cover-images-1.jpg',
  '2025/11/sofa-premium-quality-materials-cover-images.jpg',
  '2025/11/sofa-svgrepo-com.svg',
  '2025/11/sofa_factory_outlet_image_01.jpg',
  '2025/11/support-online-center-svgrepo-com.svg',
  '2025/11/worker-builder-construction-hard-hat-jobsite-architecture-work-svgrepo-com-1.svg',
  '2025/12/trust01.png',
  '2025/12/trust02.png',
  '2025/12/trust03.png',
  '2025/12/trust04.png',
  '2025/12/trust05.png',
  '2025/12/trust06.png',
  '2026/06/Beige-Corduroy-L-Shape-Sofa-with-Ottoman-Furniture-Colombo.webp',
  '2026/06/Beige-Fabric-Sofa-Set-with-Ottomans-Living-Room-Furniture-Sri-Lanka.webp',
  '2026/06/Chesterfield-L-Shape-Sofa-Set-with-Wing-Chair-Colombo.webp',
  '2026/06/Cream-L-Shape-Sectional-Sofa-Modern-Luxury-Furniture-Colombo.webp',
  '2026/06/Dual-Tone-Velvet-Sofa-Set-Modern-Living-Room-Furniture-Colombo.webp',
  '2026/06/Maroon-Leather-Sofa-Set-321-Premium-Furniture-Colombo.webp',
  '2026/06/Premium-Modular-U-Shape-Sofa-in-Burnt-Orange-Velvet-by-Sofa-Factory-Outlet.webp',
  '2026/06/dusty-pink-velvet-L-shape-sectional-by-Sofa-Factory-Outlet.webp',
  '2026/06/grey-fabric-sofa-set-3-2-1-with-coffee-table-colombo-sri-lanka.webp',
  '2026/06/premium-Sofa-Collection-—-Royal-Blue-Velvet-Set-with-Wing-Chairs-by-Sofa-Factory-Outlet.webp',
  '2026/06/sofafactoryoutlet-1.webp',
  '2026/06/sofafactoryoutlet.webp',
  '2026/06/vibrant-Lime-Green-Striped-L-Shape-Sofa-by-Sofa-Factory-Outlet.webp',
  '2026/07/Emerald-Green-Velvet-L-Shape-Chaise-Sectional-by-Sofa-Factory-Outlet-🛋️💚.jpeg',
  'woocommerce-placeholder.webp'
)
$ok=0; $fail=@()
foreach ($f in $files) {
  $dest = Join-Path $root ($f -replace '/','\')
  New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
  if (Test-Path $dest) { $ok++; continue }
  # -join binds looser than +, so the joined path needs its own parentheses
  $url = $base + ((($f -split '/') | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/')
  try { Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing; $ok++; Write-Host "OK   $f" }
  catch { $fail += $f; Write-Host "FAIL $f" -ForegroundColor Red }
}
Write-Host "`nDone: $ok of $($files.Count) downloaded." -ForegroundColor Green
if ($fail.Count) { Write-Host 'Failed:' -ForegroundColor Red; $fail }
if (-not $NoPause) { Read-Host 'Press Enter to close' }