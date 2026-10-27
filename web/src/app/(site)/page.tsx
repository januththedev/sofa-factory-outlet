import type { Metadata } from 'next';
import { Collections } from '@/components/landing/collections';
import { ColourExplorer } from '@/components/landing/colour-explorer';
import { FactoryStory } from '@/components/landing/factory-story';
import { Featured } from '@/components/landing/featured';
import { Hero } from '@/components/landing/hero';
import { Marquee } from '@/components/landing/marquee';
import { Proof } from '@/components/landing/proof';
import { Visit } from '@/components/landing/visit';
import { getApprovedReviews, getCollectionTiles, getColourSwatches, getFeaturedCards } from '@/lib/catalogue/cached';
import { siteImage, siteImageUrl } from '@/lib/images/site';
import { getSettings, mapsDirectionsUrl, mapsEmbedUrl, whatsappLink } from '@/lib/settings/get';
import { formatHours } from '@/lib/settings/hours';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default async function HomePage() {
  const [settings, tiles, swatches, featured, reviews] = await Promise.all([
    getSettings(),
    getCollectionTiles(),
    getColourSwatches(),
    getFeaturedCards(6),
    getApprovedReviews(),
  ]);
  const { business, hours, proof } = settings;

  const hero = siteImage('hero', 'A bright living room with a cream L-shaped sofa, an armchair and a round wooden coffee table');
  const heroTexture = siteImageUrl('hero', 1920);
  const showroom = siteImage('showroom');

  return (
    <>
      {hero && heroTexture ? <Hero picture={hero} textureUrl={heroTexture} /> : null}
      <Marquee />
      <FactoryStory />
      <Collections tiles={tiles} />
      <ColourExplorer swatches={swatches} />
      <Featured products={featured} />
      <Proof proof={proof} reviews={reviews} />
      <Visit
        picture={showroom}
        address={business.address}
        hoursLines={hours.confirmed ? formatHours(hours) : null}
        mapSrc={mapsEmbedUrl(business.address)}
        directionsUrl={mapsDirectionsUrl(business.address)}
        whatsappUrl={whatsappLink(business.whatsapp.number, 'Hi, I would like to visit the showroom.')}
      />
    </>
  );
}
