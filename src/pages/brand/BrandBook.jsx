import Cover from './chapters/Cover';
import Mission from './chapters/Mission';
import The52 from './chapters/The52';
import ProductExperience from './chapters/ProductExperience';
import ByTheNumbers from './chapters/ByTheNumbers';
import AnatomyOfCard from './chapters/AnatomyOfCard';
import EditorialPrinciples from './chapters/EditorialPrinciples';
import PartnershipUseCases from './chapters/PartnershipUseCases';
import PartnershipAsk from './chapters/PartnershipAsk';
import Credibility from './chapters/Credibility';
import PressKit from './chapters/PressKit';
import './print.css';

export default function BrandBook() {
  return (
    <main className="bg-ink text-ivory" data-testid="brand-book" lang="mn">
      <Cover />
      <Mission />
      <The52 />
      <ProductExperience />
      <ByTheNumbers />
      <AnatomyOfCard />
      <EditorialPrinciples />
      <PartnershipUseCases />
      <PartnershipAsk />
      <Credibility />
      <PressKit />
    </main>
  );
}
