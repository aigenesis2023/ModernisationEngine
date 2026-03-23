/**
 * Dynamic Component Registry
 *
 * Maps Adapt component type strings to React components.
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

const REGISTRY = {
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
  'assessmentResults': TextBlock, // Fallback for now
};

export function getComponent(type) {
  return REGISTRY[type] || TextBlock;
}

export function getRegisteredTypes() {
  return Object.keys(REGISTRY);
}

export default REGISTRY;
