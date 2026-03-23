/**
 * Dynamic Component Registry
 *
 * Maps component type strings to React components.
 * 25 components total: 12 original + 13 new for V2.
 * Adding a new interaction = adding one file + one registry entry.
 */
import HeroSplash from './HeroSplash';
import TextBlock from './TextBlock';
import GraphicBlock from './GraphicBlock';
import GraphicText from './GraphicText';
import SilkyAccordion from './SilkyAccordion';
import MCQPro from './MCQPro';
import NarrativeSlider from './NarrativeSlider';
import DataTable from './DataTable';
import BentoGrid from './BentoGrid';
import MediaBlock from './MediaBlock';
import TextInputBlock from './TextInputBlock';
import BranchingCards from './BranchingCards';
// V2 new components
import TimelineStepper from './TimelineStepper';
import ComparisonTable from './ComparisonTable';
import StatCallout from './StatCallout';
import PullQuote from './PullQuote';
import KeyTerm from './KeyTerm';
import Checklist from './Checklist';
import TabPanel from './TabPanel';
import Flashcard from './Flashcard';
import LabeledImage from './LabeledImage';
import ProcessFlow from './ProcessFlow';
import ImageGallery from './ImageGallery';
import FullBleedImage from './FullBleedImage';
import VideoTranscript from './VideoTranscript';

const REGISTRY = {
  // Original 12
  'hero':              HeroSplash,
  'text':              TextBlock,
  'text-featured':     TextBlock,
  'graphic':           GraphicBlock,
  'graphic-text':      GraphicText,
  'accordion':         SilkyAccordion,
  'mcq':               MCQPro,
  'narrative':         NarrativeSlider,
  'data-table':        DataTable,
  'bento':             BentoGrid,
  'media':             MediaBlock,
  'textinput':         TextInputBlock,
  'branching':         BranchingCards,
  'assessmentResults': TextBlock,
  // V2 new 13
  'timeline':          TimelineStepper,
  'comparison':        ComparisonTable,
  'stat-callout':      StatCallout,
  'pullquote':         PullQuote,
  'key-term':          KeyTerm,
  'checklist':         Checklist,
  'tabs':              TabPanel,
  'flashcard':         Flashcard,
  'labeled-image':     LabeledImage,
  'process-flow':      ProcessFlow,
  'image-gallery':     ImageGallery,
  'full-bleed':        FullBleedImage,
  'video-transcript':  VideoTranscript,
};

export function getComponent(type) {
  return REGISTRY[type] || TextBlock;
}

export function getRegisteredTypes() {
  return Object.keys(REGISTRY);
}

export default REGISTRY;
