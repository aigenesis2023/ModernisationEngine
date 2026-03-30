/**
 * Component registry — maps component type strings to Preact components.
 * Replaces the switch statement in build-course.js fillComponentVariant().
 */
import type { ComponentType } from 'preact';
import { Hero } from './Hero.js';
import { Text } from './Text.js';
import { Accordion } from './Accordion.js';
import { MCQ } from './MCQ.js';
import { GraphicText } from './GraphicText.js';
import { Tabs } from './Tabs.js';
import { Bento } from './Bento.js';
import {
  DataTable, TextInput, PathSelector, Branching, Timeline, Comparison,
  StatCallout, Pullquote, Checklist, Flashcard, Narrative, KeyTerm,
  FullBleed, Graphic, ProcessFlow, Media, VideoTranscript, ImageGallery,
  LabeledImage, Divider, Callout,
} from './remaining.js';

// Components that receive (comp, variant, maxW)
type StandardProps = { comp: any; variant: string; maxW: string };
// Components that also receive index
type IndexedProps = { comp: any; index: number; variant: string; maxW: string };
// Components that only receive (comp, maxW)
type NoVariantProps = { comp: any; maxW: string };
// Components that receive (comp, variant) — no maxW
type NoMaxWProps = { comp: any; variant: string };

export interface ComponentEntry {
  component: ComponentType<any>;
  /** Whether this component receives `index` prop (for alternating layouts) */
  indexed?: boolean;
  /** Whether this component ignores variant */
  noVariant?: boolean;
  /** Whether this component ignores maxW */
  noMaxW?: boolean;
}

export const COMPONENT_REGISTRY: Record<string, ComponentEntry> = {
  'hero':             { component: Hero, noMaxW: true },
  'text':             { component: Text },
  'accordion':        { component: Accordion },
  'mcq':              { component: MCQ },
  'graphic-text':     { component: GraphicText, indexed: true },
  'tabs':             { component: Tabs },
  'bento':            { component: Bento },
  'data-table':       { component: DataTable },
  'textinput':        { component: TextInput, noVariant: true },
  'path-selector':    { component: PathSelector, noVariant: true },
  'branching':        { component: Branching },
  'timeline':         { component: Timeline },
  'comparison':       { component: Comparison },
  'stat-callout':     { component: StatCallout },
  'pullquote':        { component: Pullquote },
  'checklist':        { component: Checklist },
  'flashcard':        { component: Flashcard },
  'narrative':        { component: Narrative },
  'key-term':         { component: KeyTerm },
  'full-bleed':       { component: FullBleed, noMaxW: true },
  'graphic':          { component: Graphic },
  'process-flow':     { component: ProcessFlow },
  'media':            { component: Media, noVariant: true },
  'video-transcript': { component: VideoTranscript, noVariant: true },
  'image-gallery':    { component: ImageGallery, noVariant: true },
  'labeled-image':    { component: LabeledImage },
  'divider':          { component: Divider },
  'callout':          { component: Callout },
};
