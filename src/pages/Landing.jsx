import React from 'react';
import HeroSection from '@/components/khan/HeroSection';
import HowItWorks from '@/components/khan/HowItWorks';
import CardCollection from '@/components/khan/CardCollection';
import Features from '@/components/khan/Features';
import Pricing from '@/components/khan/Pricing';
import Footer from '@/components/khan/Footer';
import GoldDivider from '@/components/khan/GoldDivider';

export default function Landing() {
  return (
    <div className="min-h-screen" style={{ background: '#0a0c14' }}>
      <HeroSection />
      <HowItWorks />
      <GoldDivider />
      <CardCollection />
      <GoldDivider />
      <Features />
      <GoldDivider />
      <Pricing />
      <Footer />
    </div>
  );
}
