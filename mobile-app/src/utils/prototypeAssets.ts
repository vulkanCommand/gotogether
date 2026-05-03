import { ImageSourcePropType } from 'react-native';

export const prototypeImages = {
  onboarding: require('../../assets/prototype/onboarding-illustration.png') as ImageSourcePropType,
  tripHero: require('../../assets/prototype/trip-hero.jpg') as ImageSourcePropType,
  santorini: require('../../assets/prototype/destination-santorini.jpg') as ImageSourcePropType,
  bali: require('../../assets/prototype/destination-bali.jpg') as ImageSourcePropType,
  alps: require('../../assets/prototype/destination-alps.jpg') as ImageSourcePropType,
};

export const prototypeDestinationIdeas = [
  { id: 'bali', name: 'Bali', region: 'Indonesia', image: prototypeImages.bali },
  { id: 'santorini', name: 'Santorini', region: 'Greece', image: prototypeImages.santorini },
  { id: 'alps', name: 'Swiss Alps', region: 'Switzerland', image: prototypeImages.alps },
];
